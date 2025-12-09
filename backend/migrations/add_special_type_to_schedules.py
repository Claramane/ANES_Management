"""
添加 special_type 欄位到 monthly_schedules 表
用於標記特殊班別類型，如小夜包班(SNP)和大夜包班(LNP)
"""

import logging
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)

# 加載環境變數
load_dotenv()

# 獲取資料庫 URL
DATABASE_URL = os.getenv('DATABASE_URL')

def run_migration():
    """執行添加 special_type 欄位的遷移"""
    if not DATABASE_URL:
        logger.error("無法獲取資料庫 URL，請檢查 .env 檔案")
        return False
    
    engine = create_engine(DATABASE_URL)
    
    try:
        # 檢查欄位是否已存在
        with engine.connect() as conn:
            result = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'monthly_schedules' AND column_name = 'special_type'"
            ))
            if result.fetchone():
                logger.info("special_type 欄位已存在，無需創建")
                return True
        
        # 添加欄位
        with engine.connect() as conn:
            conn.execute(text(
                "ALTER TABLE monthly_schedules ADD COLUMN special_type VARCHAR"
            ))
            conn.commit()
            logger.info("成功添加 special_type 欄位到 monthly_schedules 表")
        return True
    except Exception as e:
        logger.exception("遷移過程中出錯")
        return False

if __name__ == "__main__":
    success = run_migration()
    if success:
        logger.info("遷移完成")
    else:
        logger.error("遷移失敗")
