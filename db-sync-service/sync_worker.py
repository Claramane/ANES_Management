"""
資料同步工作器模組

負責執行資料庫同步邏輯，包括增量同步、UPSERT 操作和狀態管理
"""

import asyncio
import asyncpg
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from config import Config

logger = logging.getLogger(__name__)


# ============================================================================
# 常數定義
# ============================================================================

# 表格同步順序 (依照外鍵依賴關係)
TABLE_SYNC_ORDER = [
    'users',                        # 基礎表格（無依賴）
    'formula_schedules',            # 依賴 users
    'monthly_schedules',            # 依賴 users
    'schedule_versions',            # 依賴 users
    'schedule_version_diffs',       # 依賴 schedule_versions
    'schedule_changes',             # 依賴 schedule_versions
    'shift_swap_requests',          # 依賴 users, schedules
    'overtime_records',             # 依賴 users, schedules
    'overtime_points',              # 依賴 users
    'overtime_monthly_scores',      # 依賴 users
    'overtime_summaries',           # 依賴 users
    'announcements',                # 依賴 users
    'doctor_schedules',             # 獨立表格
    'day_shift_doctors',            # 依賴 doctor_schedules
    'doctor_schedule_update_logs',  # 依賴 doctor_schedules
    # 'webauthn_credentials',       # 跳過：包含敏感生物辨識資料，且測試環境不需要
    'logs',                         # 最後（無依賴）
]

# 敏感欄位（不同步）
SENSITIVE_FIELDS = {
    'users': ['password'],
    # 'webauthn_credentials': ['credential_id', 'public_key']  # 暫時註解，因為這些欄位是 NOT NULL
}


# ============================================================================
# 同步狀態管理
# ============================================================================

class SyncStateManager:
    """同步狀態管理器"""

    def __init__(self, state_file: str = 'sync_state.json'):
        self.state_file = Path(state_file)
        self.state = self._load_state()

    def _load_state(self) -> Dict:
        """載入同步狀態"""
        if self.state_file.exists():
            try:
                with open(self.state_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"無法載入同步狀態檔案: {e}")
        return {}

    def save_state(self):
        """儲存同步狀態"""
        try:
            with open(self.state_file, 'w', encoding='utf-8') as f:
                json.dump(self.state, f, indent=2, ensure_ascii=False, default=str)
        except Exception as e:
            logger.error(f"無法儲存同步狀態: {e}")

    def get_last_sync_time(self, table: str) -> Optional[datetime]:
        """取得表格的最後同步時間"""
        if table in self.state:
            try:
                return datetime.fromisoformat(self.state[table]['last_sync_time'])
            except (KeyError, ValueError) as e:
                logger.warning(f"無法解析 {table} 的同步時間: {e}")
        return None

    def update_sync_time(self, table: str, sync_time: datetime, records_synced: int):
        """更新表格的同步時間"""
        self.state[table] = {
            'last_sync_time': sync_time.isoformat(),
            'records_synced': records_synced,
            'updated_at': datetime.now().isoformat()
        }
        self.save_state()


# ============================================================================
# 同步工作器
# ============================================================================

class SyncWorker:
    """資料同步工作器"""

    def __init__(self, config: Config):
        self.config = config
        self.state_manager = SyncStateManager()

    async def sync_all_targets(self):
        """同步到所有目標環境"""
        logger.info("=" * 60)
        logger.info("開始執行資料庫同步")
        logger.info(f"同步目標: {self.config.SYNC_TARGETS}")
        logger.info("=" * 60)

        total_synced = 0
        sync_start_time = datetime.now()

        for target_name, target_url in self.config.target_urls.items():
            try:
                logger.info(f"\n📊 同步到目標環境: {target_name}")
                count = await self.sync_to_target(target_name, target_url)
                total_synced += count
                logger.info(f"✅ 目標 {target_name} 同步完成: {count} 筆記錄")
            except Exception as e:
                logger.error(f"❌ 同步到 {target_name} 失敗: {e}", exc_info=True)

        sync_duration = (datetime.now() - sync_start_time).total_seconds()
        logger.info("=" * 60)
        logger.info(f"同步完成: 總共 {total_synced} 筆記錄，耗時 {sync_duration:.2f} 秒")
        logger.info("=" * 60)

    async def sync_to_target(self, target_name: str, target_url: str) -> int:
        """同步到單一目標環境"""
        total_records = 0

        # 連接來源和目標資料庫
        source_conn = await asyncpg.connect(self.config.SOURCE_DB_URL)
        target_conn = await asyncpg.connect(target_url)

        try:
            # 依序同步每個表格
            for table in TABLE_SYNC_ORDER:
                try:
                    count = await self.sync_table(table, source_conn, target_conn)
                    total_records += count

                    if count > 0:
                        logger.info(f"  ✓ {table}: {count} 筆記錄")
                    else:
                        logger.debug(f"  - {table}: 無新資料")

                except Exception as e:
                    logger.error(f"  ✗ {table} 同步失敗: {e}")
                    # 單一表格失敗不影響其他表格
                    continue

        finally:
            await source_conn.close()
            await target_conn.close()

        return total_records

    async def sync_table(
        self,
        table: str,
        source_conn: asyncpg.Connection,
        target_conn: asyncpg.Connection
    ) -> int:
        """同步單一表格"""

        # 1. 取得最後同步時間
        last_sync_time = self.state_manager.get_last_sync_time(table)

        # 2. 取得增量資料
        data = await self.get_incremental_data(table, last_sync_time, source_conn)

        if not data:
            return 0

        # 3. 取得需要排除的欄位
        exclude_fields = SENSITIVE_FIELDS.get(table, [])

        # 4. UPSERT 到目標資料庫
        count = await self.upsert_data(table, data, target_conn, exclude_fields)

        # 5. 更新同步狀態
        if count > 0:
            current_time = datetime.now()
            self.state_manager.update_sync_time(table, current_time, count)

        return count

    async def get_incremental_data(
        self,
        table: str,
        last_sync_time: Optional[datetime],
        conn: asyncpg.Connection
    ) -> List[Dict]:
        """取得增量資料"""

        # 檢查表格是否有時間戳記欄位
        time_column = await self._get_time_column(table, conn)

        if not time_column:
            # 無時間戳記，執行全量同步（但頻率較低）
            logger.debug(f"  表格 {table} 無時間戳記欄位，執行全量同步")
            query = f"SELECT * FROM {table}"
            rows = await conn.fetch(query)
            return [dict(row) for row in rows]

        # 構建增量查詢
        if last_sync_time:
            query = f"""
                SELECT * FROM {table}
                WHERE {time_column} > $1
                ORDER BY {time_column}
            """
            rows = await conn.fetch(query, last_sync_time)
        else:
            # 首次同步
            query = f"SELECT * FROM {table} ORDER BY {time_column}"
            rows = await conn.fetch(query)

        return [dict(row) for row in rows]

    async def _get_time_column(self, table: str, conn: asyncpg.Connection) -> Optional[str]:
        """檢測表格的時間戳記欄位"""
        columns = await conn.fetch("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = $1
            AND column_name IN ('updated_at', 'created_at')
            ORDER BY CASE column_name
                WHEN 'updated_at' THEN 1
                WHEN 'created_at' THEN 2
            END
        """, table)

        if columns:
            return columns[0]['column_name']
        return None

    async def upsert_data(
        self,
        table: str,
        data: List[Dict],
        conn: asyncpg.Connection,
        exclude_fields: List[str] = None
    ) -> int:
        """批次 UPSERT 資料到目標資料庫"""
        if not data:
            return 0

        exclude_fields = exclude_fields or []

        # 取得主鍵欄位
        primary_key = await self._get_primary_key(table, conn)
        if not primary_key:
            logger.warning(f"  表格 {table} 無主鍵，跳過同步")
            return 0

        # 過濾欄位
        filtered_data = []
        for row in data:
            filtered_row = {k: v for k, v in row.items() if k not in exclude_fields}
            filtered_data.append(filtered_row)

        if not filtered_data:
            return 0

        # 批次處理
        total_upserted = 0
        batch_size = self.config.BATCH_SIZE

        for i in range(0, len(filtered_data), batch_size):
            batch = filtered_data[i:i + batch_size]
            count = await self._upsert_batch(table, batch, primary_key, conn)
            total_upserted += count

        return total_upserted

    async def _upsert_batch(
        self,
        table: str,
        batch: List[Dict],
        primary_key: str,
        conn: asyncpg.Connection
    ) -> int:
        """執行批次 UPSERT"""
        if not batch:
            return 0

        columns = list(batch[0].keys())
        column_names = ', '.join(columns)

        # 構建 VALUES 子句
        placeholders_list = []
        values_list = []

        for idx, row in enumerate(batch):
            row_placeholders = ', '.join([f'${len(values_list) + i + 1}' for i in range(len(columns))])
            placeholders_list.append(f'({row_placeholders})')
            values_list.extend([row[col] for col in columns])

        values_clause = ', '.join(placeholders_list)

        # 構建 ON CONFLICT UPDATE 子句
        update_clause = ', '.join([
            f"{col} = EXCLUDED.{col}"
            for col in columns if col != primary_key
        ])

        # 構建完整 SQL
        if update_clause:
            query = f"""
                INSERT INTO {table} ({column_names})
                VALUES {values_clause}
                ON CONFLICT ({primary_key})
                DO UPDATE SET {update_clause}
            """
        else:
            query = f"""
                INSERT INTO {table} ({column_names})
                VALUES {values_clause}
                ON CONFLICT ({primary_key}) DO NOTHING
            """

        # 執行 UPSERT
        try:
            await conn.execute(query, *values_list)
            return len(batch)
        except Exception as e:
            logger.error(f"  UPSERT 失敗: {e}")
            raise

    async def _get_primary_key(self, table: str, conn: asyncpg.Connection) -> Optional[str]:
        """取得表格的主鍵欄位"""
        result = await conn.fetchrow("""
            SELECT a.attname
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = $1::regclass
            AND i.indisprimary
        """, table)

        if result:
            return result['attname']
        return None
