#!/usr/bin/env python
"""
添加排班版本差異表並更新排班版本表的遷移腳本
"""

import sqlite3
import sys
import os

# 資料庫檔案路徑
DB_PATH = "backend/anes.db"

def add_version_diff_tables():
    """添加排班版本差異表並更新排班版本表"""
    print("開始添加排班版本差異表...")
    
    try:
        # 連接資料庫
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # 檢查資料庫連接
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        if not result or result[0] != 1:
            raise Exception("資料庫連接測試失敗")
        
        # 1. 添加 is_base_version 欄位到 schedule_versions 表
        print("正在更新 schedule_versions 表...")
        
        # 檢查欄位是否已存在
        cursor.execute("PRAGMA table_info(schedule_versions)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if "is_base_version" not in columns:
            cursor.execute("""
                ALTER TABLE schedule_versions
                ADD COLUMN is_base_version BOOLEAN DEFAULT 0
            """)
            print("已添加 is_base_version 欄位到 schedule_versions 表")
        else:
            print("is_base_version 欄位已存在，跳過")
        
        # 2. 創建 schedule_version_diffs 表
        print("正在創建 schedule_version_diffs 表...")
        
        # 檢查表是否已存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='schedule_version_diffs'")
        if not cursor.fetchone():
            cursor.execute("""
                CREATE TABLE schedule_version_diffs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    version_id INTEGER NOT NULL,
                    base_version_id INTEGER NOT NULL,
                    diff_data TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (version_id) REFERENCES schedule_versions (id),
                    FOREIGN KEY (base_version_id) REFERENCES schedule_versions (id)
                )
            """)
            print("已創建 schedule_version_diffs 表")
        else:
            print("schedule_version_diffs 表已存在，跳過")
        
        # 提交事務
        conn.commit()
        print("成功添加排班版本差異表和相關欄位")
        
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"錯誤: {str(e)}")
        return False
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
    
    return True

def main():
    """主函數"""
    print("=" * 50)
    print("排班版本差異功能資料庫遷移腳本")
    print("=" * 50)
    
    if not os.path.exists(DB_PATH):
        print(f"錯誤: 找不到資料庫檔案 {DB_PATH}")
        return 1
    
    success = add_version_diff_tables()
    
    if success:
        print("\n遷移成功完成！")
        return 0
    else:
        print("\n遷移失敗！")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 