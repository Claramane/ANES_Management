from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

# 加載環境變數
load_dotenv("../.env")

# 從環境變數獲取數據庫配置
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://anes_user:anes_password@localhost/anes_db")

def add_is_pinned_column():
    # 創建資料庫連接
    engine = create_engine(DATABASE_URL)
    
    # 連接到資料庫並檢查欄位是否存在
    with engine.connect() as conn:
        # 開始一個新事務
        with conn.begin():
            try:
                print("檢查 is_pinned 欄位是否存在...")
                
                # 使用 information_schema 安全地檢查欄位是否存在
                result = conn.execute(text(
                    "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'is_pinned')"
                )).scalar()
                
                if result:
                    print("is_pinned 欄位已存在，無需添加")
                else:
                    print("正在添加 is_pinned 欄位...")
                    # 添加 is_pinned 欄位，預設為 false
                    conn.execute(text("ALTER TABLE announcements ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT false"))
                    print("成功添加 is_pinned 欄位")
                
            except Exception as e:
                print(f"發生錯誤: {str(e)}")
                raise

if __name__ == "__main__":
    add_is_pinned_column() 