import asyncio
import logging
import sys
from pathlib import Path
from datetime import timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

# 添加 scripts 到 Python 路徑
scripts_dir = Path(__file__).parent.parent.parent / "scripts"
sys.path.insert(0, str(scripts_dir))

from sync_db_incremental import IncrementalSync, DatabaseConnector
from ..utils.timezone import now

logger = logging.getLogger(__name__)

class DatabaseSyncTaskManager:
    """資料庫同步定時任務管理器

    功能：
    - 單向同步：正式環境 (Zeabur) → 本地環境
    - 自動增量同步：只同步變更的資料
    - 定期執行：每10分鐘自動執行一次
    - 錯誤處理：自動記錄並重試
    """

    def __init__(self):
        self.scheduler = None
        self.sync_enabled = True  # 可透過配置控制是否啟用

    def start_scheduler(self):
        """啟動排程器"""
        if self.scheduler is None and self.sync_enabled:
            self.scheduler = AsyncIOScheduler()

            # 每10分鐘執行一次增量同步
            self.scheduler.add_job(
                func=self.sync_database_incremental,
                trigger=IntervalTrigger(minutes=10),
                id='database_sync_incremental',
                name='資料庫增量同步 (正式環境 → 本地)',
                replace_existing=True,
                max_instances=1  # 確保同時只有一個實例在運行
            )

            # 系統啟動後30秒執行首次同步
            self.scheduler.add_job(
                func=self.sync_database_incremental,
                trigger='date',  # 一次性任務
                run_date=now() + timedelta(seconds=30),
                id='initial_database_sync',
                name='初始資料庫同步',
                replace_existing=True
            )

            self.scheduler.start()
            logger.info("資料庫同步定時任務已啟動 - 每10分鐘自動同步正式環境資料到本地")

    def stop_scheduler(self):
        """停止排程器"""
        if self.scheduler:
            self.scheduler.shutdown()
            self.scheduler = None
            logger.info("資料庫同步定時任務已停止")

    async def sync_database_incremental(self):
        """執行增量資料庫同步

        同步流程：
        1. 連接正式環境 (Zeabur) 和本地環境
        2. 檢查各表格的最後同步時間
        3. 只同步有變更的記錄 (基於 updated_at)
        4. 記錄同步狀態和統計
        """
        try:
            logger.info("開始執行資料庫增量同步...")

            # 載入配置
            connector = DatabaseConnector()
            source_url = connector.get_source_url()
            target_url = connector.get_target_url('local')
            sync_tables = connector.get_sync_tables()

            # 建立同步器
            sync = IncrementalSync(source_url, target_url)

            # 執行增量同步（force_full=False）
            await sync.sync_all_tables(
                tables=sync_tables,
                force_full=False,  # 增量同步
                connector=connector
            )

            logger.info("資料庫增量同步完成")

        except Exception as e:
            logger.error(f"資料庫同步時發生錯誤: {str(e)}", exc_info=True)

    async def sync_database_full(self):
        """執行全量資料庫同步（手動觸發用）

        注意：全量同步會重新同步所有資料，耗時較長
        建議只在以下情況使用：
        - 首次設定
        - 資料不一致需要重置
        - 長時間未同步後的恢復
        """
        try:
            logger.info("開始執行資料庫全量同步...")

            # 載入配置
            connector = DatabaseConnector()
            source_url = connector.get_source_url()
            target_url = connector.get_target_url('local')
            sync_tables = connector.get_sync_tables()

            # 建立同步器
            sync = IncrementalSync(source_url, target_url)

            # 執行全量同步（force_full=True）
            await sync.sync_all_tables(
                tables=sync_tables,
                force_full=True,  # 全量同步
                connector=connector
            )

            logger.info("資料庫全量同步完成")

        except Exception as e:
            logger.error(f"資料庫全量同步時發生錯誤: {str(e)}", exc_info=True)

# 全局任務管理器實例
db_sync_task_manager = DatabaseSyncTaskManager()
