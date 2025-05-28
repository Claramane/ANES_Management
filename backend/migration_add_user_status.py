#!/usr/bin/env python3
"""
資料庫遷移腳本：添加用戶狀態欄位
添加 is_active 和 deactivated_at 欄位到 users 表
"""

import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# 添加項目根目錄到 Python 路徑
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings

def run_migration():
    """執行資料庫遷移"""
    
    # 創建資料庫連接
    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = SessionLocal()
    
    try:
        print("開始執行資料庫遷移...")
        
        # 檢查欄位是否已存在
        check_is_active = text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'is_active'
        """)
        
        check_deactivated_at = text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'deactivated_at'
        """)
        
        is_active_exists = db.execute(check_is_active).fetchone()
        deactivated_at_exists = db.execute(check_deactivated_at).fetchone()
        
        # 添加 is_active 欄位
        if not is_active_exists:
            print("添加 is_active 欄位...")
            add_is_active = text("""
                ALTER TABLE users 
                ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE
            """)
            db.execute(add_is_active)
            print("✅ is_active 欄位添加成功")
        else:
            print("⚠️ is_active 欄位已存在，跳過")
        
        # 添加 deactivated_at 欄位
        if not deactivated_at_exists:
            print("添加 deactivated_at 欄位...")
            add_deactivated_at = text("""
                ALTER TABLE users 
                ADD COLUMN deactivated_at TIMESTAMP NULL
            """)
            db.execute(add_deactivated_at)
            print("✅ deactivated_at 欄位添加成功")
        else:
            print("⚠️ deactivated_at 欄位已存在，跳過")
        
        # 確保所有現有用戶都是啟用狀態
        if not is_active_exists:
            print("設置所有現有用戶為啟用狀態...")
            update_existing_users = text("""
                UPDATE users 
                SET is_active = TRUE 
                WHERE is_active IS NULL
            """)
            result = db.execute(update_existing_users)
            print(f"✅ 更新了 {result.rowcount} 個用戶的狀態")
        
        # 提交變更
        db.commit()
        print("🎉 資料庫遷移完成！")
        
    except Exception as e:
        print(f"❌ 遷移失敗: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    run_migration() 