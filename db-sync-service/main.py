"""
DB Sync Service - 資料庫同步服務入口點

獨立的資料庫同步服務，負責將正式環境資料單向同步到測試站和本地環境
"""

import asyncio
import logging
import signal
import sys
from datetime import datetime
from typing import Optional

from config import Config, setup_logging
from sync_worker import SyncWorker

logger = logging.getLogger(__name__)


class SyncService:
    """同步服務主控制器"""

    def __init__(self, config: Config):
        self.config = config
        self.worker = SyncWorker(config)
        self.running = True
        self.sync_count = 0
        self.last_sync_time: Optional[datetime] = None

    async def run(self):
        """啟動同步服務"""
        logger.info("🚀 DB Sync Service 啟動中...")
        logger.info(f"   同步目標: {', '.join(self.config.SYNC_TARGETS)}")
        logger.info(f"   同步間隔: {self.config.SYNC_INTERVAL_MINUTES} 分鐘")
        logger.info(f"   批次大小: {self.config.BATCH_SIZE}")
        logger.info("")

        # 設定信號處理（優雅關閉）
        self._setup_signal_handlers()

        # 主循環
        while self.running:
            try:
                # 執行同步
                await self.worker.sync_all_targets()

                self.sync_count += 1
                self.last_sync_time = datetime.now()

                # 等待下次同步
                if self.running:
                    logger.info(f"\n⏰ 下次同步時間: {self.config.SYNC_INTERVAL_MINUTES} 分鐘後")
                    await asyncio.sleep(self.config.SYNC_INTERVAL_MINUTES * 60)

            except Exception as e:
                logger.error(f"❌ 同步過程發生錯誤: {e}", exc_info=True)

                # 重試機制
                retry_delay = self.config.RETRY_DELAY_SECONDS
                logger.info(f"   將在 {retry_delay} 秒後重試...")
                await asyncio.sleep(retry_delay)

    def _setup_signal_handlers(self):
        """設定信號處理器（優雅關閉）"""

        def handle_shutdown(signum, frame):
            logger.info("\n\n🛑 收到關閉信號，正在優雅關閉服務...")
            self.running = False

        signal.signal(signal.SIGINT, handle_shutdown)   # Ctrl+C
        signal.signal(signal.SIGTERM, handle_shutdown)  # Docker stop

    def get_stats(self) -> dict:
        """取得服務統計資訊"""
        return {
            "status": "running" if self.running else "stopped",
            "sync_count": self.sync_count,
            "last_sync_time": self.last_sync_time.isoformat() if self.last_sync_time else None,
            "targets": self.config.SYNC_TARGETS
        }


async def main():
    """主程式入口"""
    try:
        # 1. 載入配置
        config = Config.from_env()

        # 2. 設定日誌
        setup_logging(config)

        # 3. 建立並啟動服務
        service = SyncService(config)
        await service.run()

    except ValueError as e:
        # 配置錯誤
        print(f"\n❌ 配置錯誤:\n{e}\n")
        print("請檢查環境變數設定，參考 .env.example")
        sys.exit(1)

    except Exception as e:
        # 其他錯誤
        logger.error(f"❌ 服務啟動失敗: {e}", exc_info=True)
        sys.exit(1)

    finally:
        logger.info("👋 DB Sync Service 已關閉")


if __name__ == "__main__":
    # 執行主程式
    asyncio.run(main())
