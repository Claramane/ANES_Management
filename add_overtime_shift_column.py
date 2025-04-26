#!/usr/bin/env python
"""
修復 overtime_records 表結構：添加缺少的 overtime_shift 欄位
"""

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import sys
import os

# 讀取環境變量或使用默認連接信息
DB_NAME = os.environ.get("DB_NAME", "anes_db")
DB_USER = os.environ.get("DB_USER", "anes_user")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "anes_password")
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = os.environ.get("DB_PORT", "5432")

def fix_overtime_records_table():
    """
    連接到PostgreSQL並添加缺少的overtime_shift欄位
    """
    print(f"正在連接到PostgreSQL數據庫: {DB_NAME} @ {DB_HOST}...")
    
    try:
        # 連接到PostgreSQL
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        
        # 設置隔離級別
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        
        # 創建游標
        cursor = conn.cursor()
        
        # 檢查表是否存在
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'overtime_records'
            );
        """)
        
        if not cursor.fetchone()[0]:
            print("錯誤: overtime_records 表不存在，請確保先創建此表。")
            return False
        
        # 檢查列是否已存在
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'overtime_records' AND column_name = 'overtime_shift'
            );
        """)
        
        if cursor.fetchone()[0]:
            print("overtime_shift 欄位已存在，無需修改。")
            return True
        
        # 添加缺少的欄位
        print("正在添加 overtime_shift 欄位...")
        cursor.execute("""
            ALTER TABLE overtime_records 
            ADD COLUMN overtime_shift VARCHAR(1);
        """)
        
        # 確認修改
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'overtime_records' AND column_name = 'overtime_shift';
        """)
        
        result = cursor.fetchone()
        if result:
            print(f"成功添加欄位: {result[0]} ({result[1]})")
            return True
        else:
            print("添加欄位失敗，請手動檢查數據庫。")
            return False
            
    except psycopg2.Error as e:
        print(f"數據庫錯誤: {e}")
        return False
    except Exception as e:
        print(f"發生錯誤: {e}")
        return False
    finally:
        if 'conn' in locals() and conn:
            cursor.close()
            conn.close()
            print("數據庫連接已關閉")
            
if __name__ == "__main__":
    print("開始修復 overtime_records 表結構...")
    if fix_overtime_records_table():
        print("修復完成！請重啟後端服務。")
        sys.exit(0)
    else:
        print("修復失敗，請參考錯誤信息並手動解決問題。")
        sys.exit(1) 