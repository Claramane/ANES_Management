"""
添加 special_type 欄位到 monthly_schedules 表
用於標記特殊班別類型，如小夜包班(SNP)和大夜包班(LNP)
"""

from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

# 加載環境變數
load_dotenv()

# 獲取資料庫 URL
DATABASE_URL = os.getenv('DATABASE_URL')

def run_migration():
    """執行添加 special_type 欄位的遷移"""
    if not DATABASE_URL:
        print("錯誤: 無法獲取資料庫 URL，請檢查 .env 檔案")
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
                print("special_type 欄位已存在，無需創建")
                return True
        
        # 添加欄位
        with engine.connect() as conn:
            conn.execute(text(
                "ALTER TABLE monthly_schedules ADD COLUMN special_type VARCHAR"
            ))
            conn.commit()
            print("成功添加 special_type 欄位到 monthly_schedules 表")
        return True
    except Exception as e:
        print(f"遷移過程中出錯: {str(e)}")
        return False

if __name__ == "__main__":
    success = run_migration()
    if success:
        print("遷移完成")
    else:
        print("遷移失敗") 