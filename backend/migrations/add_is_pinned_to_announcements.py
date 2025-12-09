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
load_dotenv("../.env")

# 從環境變數獲取數據庫配置
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://anes_user:anes_password@localhost/anes_db")

def add_is_pinned_column():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        with conn.begin():
            try:
                logger.info("檢查 is_pinned 欄位是否存在...")
                result = conn.execute(text(
                    "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'is_pinned')"
                )).scalar()
                
                if result:
                    logger.info("is_pinned 欄位已存在，無需添加")
                else:
                    logger.info("正在添加 is_pinned 欄位...")
                    conn.execute(text("ALTER TABLE announcements ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT false"))
                    logger.info("成功添加 is_pinned 欄位")
                
            except Exception as e:
                logger.exception("添加 is_pinned 欄位失敗")
                raise

if __name__ == "__main__":
    add_is_pinned_column() 
