#!/usr/bin/env python3
"""
PostgreSQL 增量資料同步腳本 (備案方案)

當 PostgreSQL 邏輯複製不可用時，使用此腳本進行增量同步。

功能：
1. 基於 updated_at/created_at 欄位判斷增量資料
2. 智能處理外鍵依賴順序
3. 批次同步以減少記憶體使用
4. 記錄同步狀態和錯誤日誌
5. 支援多資料庫目標（本地、測試環境）

使用方式：
    # 同步到本地資料庫
    python sync_db_incremental.py --target local

    # 同步到測試環境
    python sync_db_incremental.py --target test

    # 強制全量同步
    python sync_db_incremental.py --target local --full

    # 只同步特定表格
    python sync_db_incremental.py --target local --tables users,schedules

設定檔：
    sync_config.json - 包含資料庫連線和同步規則
"""

import sys
import os
from pathlib import Path

# 添加 backend 到 Python 路徑
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import asyncio
import asyncpg
import json
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from sqlalchemy import create_engine, text, MetaData, Table
from sqlalchemy.orm import sessionmaker


# ============================================================================
# 設定與常數
# ============================================================================

# 表格同步順序 (考慮外鍵依賴)
TABLE_SYNC_ORDER = [
    'users',                    # 最優先 (其他表格的外鍵參考)
    'formula_schedules',        # 班表公式
    'schedules',                # 班表 (依賴 users)
    'shift_swap_requests',      # 調班申請 (依賴 users, schedules)
    'overtime_records',         # 加班記錄 (依賴 users, schedules)
    'announcements',            # 公告
    'doctor_schedules',         # 醫師班表
    'doctor_schedule_details',  # 醫師班表詳情 (依賴 doctor_schedules)
    'notifications',            # 通知 (依賴 users)
    'shift_swap_notifications', # 調班通知 (依賴 shift_swap_requests, users)
    'webauthn_credentials',     # WebAuthn 憑證 (依賴 users)
    'application_logs',         # 應用程式日誌 (最後)
]

# 需要脫敏的欄位
SENSITIVE_FIELDS = {
    'users': ['password'],  # 密碼欄位不同步
    'webauthn_credentials': ['credential_id', 'public_key'],  # 生物辨識資料不同步
}

# 批次大小
BATCH_SIZE = 1000


# ============================================================================
# 同步狀態管理
# ============================================================================

class SyncState:
    """同步狀態管理"""

    def __init__(self, state_file: str = 'sync_state.json'):
        self.state_file = Path(__file__).parent / state_file
        self.state = self._load_state()

    def _load_state(self) -> Dict:
        """載入同步狀態"""
        if self.state_file.exists():
            with open(self.state_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}

    def save_state(self):
        """儲存同步狀態"""
        with open(self.state_file, 'w', encoding='utf-8') as f:
            json.dump(self.state, f, indent=2, ensure_ascii=False, default=str)

    def get_last_sync_time(self, table: str) -> Optional[datetime]:
        """取得表格的最後同步時間"""
        if table in self.state:
            return datetime.fromisoformat(self.state[table]['last_sync_time'])
        return None

    def update_sync_time(self, table: str, sync_time: datetime, records_synced: int):
        """更新表格的同步時間"""
        self.state[table] = {
            'last_sync_time': sync_time.isoformat(),
            'records_synced': records_synced,
            'updated_at': datetime.now().isoformat()
        }
        self.save_state()

    def get_stats(self) -> Dict:
        """取得同步統計"""
        return self.state


# ============================================================================
# 資料庫連線管理
# ============================================================================

class DatabaseConnector:
    """資料庫連線管理器"""

    def __init__(self, config_file: str = 'sync_config.json'):
        config_path = Path(__file__).parent / config_file
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = json.load(f)

    def get_source_url(self) -> str:
        """取得來源資料庫連線"""
        return self.config['source']['database_url']

    def get_target_url(self, target: str = 'local') -> str:
        """取得目標資料庫連線"""
        if target not in self.config['targets']:
            raise ValueError(f"Unknown target: {target}. Available: {list(self.config['targets'].keys())}")
        return self.config['targets'][target]['database_url']

    def get_sync_tables(self) -> List[str]:
        """取得需要同步的表格清單"""
        return self.config.get('sync_tables', TABLE_SYNC_ORDER)

    def get_exclude_fields(self, table: str) -> List[str]:
        """取得需要排除的欄位"""
        return self.config.get('exclude_fields', {}).get(table, [])


# ============================================================================
# 資料同步邏輯
# ============================================================================

class IncrementalSync:
    """增量資料同步"""

    def __init__(self, source_url: str, target_url: str):
        self.source_url = source_url
        self.target_url = target_url
        self.sync_state = SyncState()

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
            print(f"   ⚠️  表格 {table} 無時間戳記欄位，執行全量同步")
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
        """批次 upsert 資料到目標資料庫"""
        if not data:
            return 0

        exclude_fields = exclude_fields or []

        # 取得主鍵欄位
        primary_key = await self._get_primary_key(table, conn)
        if not primary_key:
            print(f"   ⚠️  表格 {table} 無主鍵，跳過同步")
            return 0

        # 過濾欄位
        filtered_data = []
        for row in data:
            filtered_row = {k: v for k, v in row.items() if k not in exclude_fields}
            filtered_data.append(filtered_row)

        # 構建 upsert 查詢
        if not filtered_data:
            return 0

        columns = list(filtered_data[0].keys())
        placeholders = ', '.join([f'${i+1}' for i in range(len(columns))])
        column_names = ', '.join(columns)

        # 構建 ON CONFLICT UPDATE 子句
        update_clause = ', '.join([
            f"{col} = EXCLUDED.{col}"
            for col in columns if col != primary_key
        ])

        upsert_query = f"""
            INSERT INTO {table} ({column_names})
            VALUES ({placeholders})
            ON CONFLICT ({primary_key})
            DO UPDATE SET {update_clause}
        """

        # 批次執行
        synced_count = 0
        for i in range(0, len(filtered_data), BATCH_SIZE):
            batch = filtered_data[i:i + BATCH_SIZE]
            async with conn.transaction():
                for row in batch:
                    values = [row[col] for col in columns]
                    await conn.execute(upsert_query, *values)
                    synced_count += 1

        return synced_count

    async def _get_primary_key(self, table: str, conn: asyncpg.Connection) -> Optional[str]:
        """取得表格的主鍵欄位"""
        result = await conn.fetch("""
            SELECT a.attname
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = $1::regclass AND i.indisprimary
        """, table)

        if result:
            return result[0]['attname']
        return None

    async def sync_table(
        self,
        table: str,
        force_full: bool = False,
        exclude_fields: List[str] = None
    ) -> Tuple[int, datetime]:
        """同步單一表格"""

        # 連接資料庫
        source_conn = await asyncpg.connect(self.source_url)
        target_conn = await asyncpg.connect(self.target_url)

        try:
            # 取得最後同步時間
            last_sync_time = None if force_full else self.sync_state.get_last_sync_time(table)

            # 取得增量資料
            print(f"   📥 從來源資料庫讀取增量資料...")
            data = await self.get_incremental_data(table, last_sync_time, source_conn)

            if not data:
                print(f"   ℹ️  無新資料需要同步")
                return 0, datetime.now()

            print(f"   📦 取得 {len(data)} 筆記錄")

            # 寫入目標資料庫
            print(f"   📤 寫入目標資料庫...")
            synced_count = await self.upsert_data(table, data, target_conn, exclude_fields)

            sync_time = datetime.now()
            print(f"   ✅ 成功同步 {synced_count} 筆記錄")

            return synced_count, sync_time

        finally:
            await source_conn.close()
            await target_conn.close()

    async def sync_all_tables(
        self,
        tables: List[str],
        force_full: bool = False,
        connector: DatabaseConnector = None
    ):
        """同步所有表格"""
        print(f"\n{'='*70}")
        print(f"🔄 開始增量資料同步")
        print(f"{'='*70}")
        print(f"來源: {self.source_url.split('@')[1] if '@' in self.source_url else 'local'}")
        print(f"目標: {self.target_url.split('@')[1] if '@' in self.target_url else 'local'}")
        print(f"模式: {'全量同步' if force_full else '增量同步'}")
        print(f"{'='*70}\n")

        total_synced = 0
        start_time = datetime.now()

        for table in tables:
            print(f"📋 同步表格: {table}")

            # 取得排除欄位
            exclude_fields = connector.get_exclude_fields(table) if connector else []
            if table in SENSITIVE_FIELDS:
                exclude_fields.extend(SENSITIVE_FIELDS[table])

            if exclude_fields:
                print(f"   🔒 排除欄位: {', '.join(exclude_fields)}")

            try:
                synced_count, sync_time = await self.sync_table(
                    table,
                    force_full=force_full,
                    exclude_fields=exclude_fields
                )

                # 更新同步狀態
                self.sync_state.update_sync_time(table, sync_time, synced_count)
                total_synced += synced_count

            except Exception as e:
                print(f"   ❌ 同步失敗: {e}")
                continue

            print()

        # 總結
        elapsed_time = (datetime.now() - start_time).total_seconds()
        print(f"{'='*70}")
        print(f"✅ 同步完成")
        print(f"{'='*70}")
        print(f"總共同步: {total_synced} 筆記錄")
        print(f"耗時: {elapsed_time:.2f} 秒")
        print(f"{'='*70}\n")


# ============================================================================
# 命令列介面
# ============================================================================

async def main():
    parser = argparse.ArgumentParser(description='PostgreSQL 增量資料同步工具')
    parser.add_argument(
        '--target',
        choices=['local', 'test'],
        default='local',
        help='目標環境 (local: 本地, test: 測試環境)'
    )
    parser.add_argument(
        '--full',
        action='store_true',
        help='強制全量同步 (忽略上次同步時間)'
    )
    parser.add_argument(
        '--tables',
        type=str,
        help='指定要同步的表格，用逗號分隔 (預設: 同步所有表格)'
    )
    parser.add_argument(
        '--config',
        type=str,
        default='sync_config.json',
        help='配置文件路徑 (預設: sync_config.json)'
    )

    args = parser.parse_args()

    # 載入配置
    connector = DatabaseConnector(args.config)

    # 取得資料庫連線
    source_url = connector.get_source_url()
    target_url = connector.get_target_url(args.target)

    # 取得要同步的表格
    if args.tables:
        tables = [t.strip() for t in args.tables.split(',')]
    else:
        tables = connector.get_sync_tables()

    # 執行同步
    sync = IncrementalSync(source_url, target_url)
    await sync.sync_all_tables(tables, force_full=args.full, connector=connector)


if __name__ == "__main__":
    asyncio.run(main())
