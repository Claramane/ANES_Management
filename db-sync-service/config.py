"""
環境變數配置管理模組

負責載入、驗證和管理所有環境變數配置
"""

import os
import logging
from typing import Dict, List, Optional
from dotenv import load_dotenv

# 載入環境變數
load_dotenv()

logger = logging.getLogger(__name__)


class Config:
    """環境變數配置類別"""

    def __init__(self):
        # ===== 必要配置 =====
        self.SOURCE_DB_URL: str = os.getenv('SOURCE_DB_URL', '')
        self.SYNC_TARGETS: List[str] = self._parse_list(os.getenv('SYNC_TARGETS', ''))

        # ===== 目標資料庫 URLs =====
        self.target_urls: Dict[str, str] = {}
        if 'local' in self.SYNC_TARGETS:
            self.target_urls['local'] = os.getenv('TARGET_LOCAL_URL', '')
        if 'test' in self.SYNC_TARGETS:
            self.target_urls['test'] = os.getenv('TARGET_TEST_URL', '')

        # ===== 同步設定 =====
        self.SYNC_INTERVAL_MINUTES: int = int(os.getenv('SYNC_INTERVAL_MINUTES', '10'))
        self.BATCH_SIZE: int = int(os.getenv('BATCH_SIZE', '1000'))

        # ===== 日誌設定 =====
        self.LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')

        # ===== 健康檢查設定 =====
        self.ENABLE_HEALTH_CHECK: bool = os.getenv('ENABLE_HEALTH_CHECK', 'false').lower() == 'true'
        self.HEALTH_CHECK_PORT: int = int(os.getenv('HEALTH_CHECK_PORT', '8080'))

        # ===== 錯誤處理設定 =====
        self.MAX_RETRY_ATTEMPTS: int = int(os.getenv('MAX_RETRY_ATTEMPTS', '3'))
        self.RETRY_DELAY_SECONDS: int = int(os.getenv('RETRY_DELAY_SECONDS', '60'))

    @staticmethod
    def _parse_list(value: str) -> List[str]:
        """解析逗號分隔的字串為列表"""
        if not value:
            return []
        return [item.strip() for item in value.split(',') if item.strip()]

    def validate(self) -> None:
        """驗證配置的完整性和有效性"""
        errors = []

        # 1. 檢查必要欄位
        if not self.SOURCE_DB_URL:
            errors.append("SOURCE_DB_URL is required")

        if not self.SYNC_TARGETS:
            errors.append("SYNC_TARGETS is required (e.g., 'local,test')")

        # 2. 檢查目標配置一致性
        for target in self.SYNC_TARGETS:
            if target not in self.target_urls or not self.target_urls[target]:
                errors.append(f"TARGET_{target.upper()}_URL not found for target '{target}'")

        # 3. 檢查單向同步保護
        for target_name, target_url in self.target_urls.items():
            if target_url == self.SOURCE_DB_URL:
                errors.append(f"Target '{target_name}' URL cannot be the same as SOURCE_DB_URL")

        # 4. 檢查數值範圍
        if self.SYNC_INTERVAL_MINUTES <= 0:
            errors.append("SYNC_INTERVAL_MINUTES must be greater than 0")

        if self.BATCH_SIZE <= 0:
            errors.append("BATCH_SIZE must be greater than 0")

        # 如果有錯誤，拋出異常
        if errors:
            error_msg = "Configuration validation failed:\n" + "\n".join(f"  - {error}" for error in errors)
            raise ValueError(error_msg)

        logger.info("✅ Configuration validated successfully")

    @classmethod
    def from_env(cls) -> 'Config':
        """從環境變數建立配置實例"""
        config = cls()
        config.validate()
        return config

    def __repr__(self) -> str:
        """配置的字串表示（隱藏敏感資訊）"""
        return (
            f"Config(\n"
            f"  SOURCE_DB_URL=***\n"
            f"  SYNC_TARGETS={self.SYNC_TARGETS}\n"
            f"  target_urls={list(self.target_urls.keys())}\n"
            f"  SYNC_INTERVAL_MINUTES={self.SYNC_INTERVAL_MINUTES}\n"
            f"  BATCH_SIZE={self.BATCH_SIZE}\n"
            f"  LOG_LEVEL={self.LOG_LEVEL}\n"
            f")"
        )


def setup_logging(config: Config) -> None:
    """設定日誌系統"""
    log_level = getattr(logging, config.LOG_LEVEL.upper(), logging.INFO)

    logging.basicConfig(
        level=log_level,
        format='[%(asctime)s] %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    logger.info(f"日誌級別設定為: {config.LOG_LEVEL}")


if __name__ == "__main__":
    # 測試配置載入
    try:
        config = Config.from_env()
        print("✅ Configuration loaded successfully:")
        print(config)
    except ValueError as e:
        print(f"❌ Configuration error: {e}")
