#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
將月班表資料導入PostgreSQL資料庫的程式
用於將2025年7月的班表資料從JSON檔案導入到資料庫中
"""

import json
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import sys

# 資料庫連接配置
DB_CONFIG = {
    'host': 'localhost',
    'database': 'anes_db',
    'user': 'anes_user',
    'password': 'anes_password'
}

def create_tables(cursor):
    """創建必要的資料表"""
    
    # 創建員工表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS employees (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) UNIQUE NOT NULL,
            role VARCHAR(50),
            group_number INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # 創建班表記錄表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS schedule_records (
            id SERIAL PRIMARY KEY,
            employee_name VARCHAR(100) NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            day INTEGER NOT NULL,
            shift_type VARCHAR(10) NOT NULL,
            vacation_days INTEGER DEFAULT 0,
            accumulated_leave INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_name) REFERENCES employees(name) ON DELETE CASCADE,
            UNIQUE(employee_name, year, month, day)
        )
    """)
    
    # 創建索引以提高查詢效能
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_employee_name ON employees(name)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_schedule_date ON schedule_records(year, month, day)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_schedule_employee ON schedule_records(employee_name)
    """)
    
    print("✓ 資料表建立完成")

def load_json_data(file_path):
    """載入JSON檔案"""
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            data = json.load(file)
        print("✓ JSON資料載入成功")
        return data
    except FileNotFoundError:
        print(f"❌ 找不到檔案: {file_path}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"❌ JSON解析錯誤: {e}")
        sys.exit(1)

def insert_employee(cursor, employee_data):
    """插入或更新員工資料"""
    try:
        cursor.execute("""
            INSERT INTO employees (name, role, group_number)
            VALUES (%s, %s, %s)
            ON CONFLICT (name) DO UPDATE SET
                role = EXCLUDED.role,
                group_number = EXCLUDED.group_number,
                updated_at = CURRENT_TIMESTAMP
        """, (employee_data['name'], employee_data['role'], employee_data['group']))
        
    except Exception as e:
        print(f"❌ 插入員工資料失敗 ({employee_data['name']}): {e}")
        raise

def insert_schedule_records(cursor, employee_data, year, month):
    """插入班表記錄"""
    name = employee_data['name']
    shifts = employee_data['shifts']
    vacation_days = employee_data.get('vacationDays', 0)
    accumulated_leave = employee_data.get('accumulatedLeave', 0)
    
    # 先刪除該員工該月份的現有記錄
    cursor.execute("""
        DELETE FROM schedule_records 
        WHERE employee_name = %s AND year = %s AND month = %s
    """, (name, year, month))
    
    # 插入新的班表記錄
    for day, shift_type in enumerate(shifts, 1):
        try:
            cursor.execute("""
                INSERT INTO schedule_records 
                (employee_name, year, month, day, shift_type, vacation_days, accumulated_leave)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (name, year, month, day, shift_type, vacation_days, accumulated_leave))
            
        except Exception as e:
            print(f"❌ 插入班表記錄失敗 ({name}, {year}/{month}/{day}): {e}")
            raise

def import_schedule_data(json_file_path):
    """主要的導入函數"""
    print("🚀 開始導入2025年7月班表資料...")
    
    # 載入JSON資料
    data = load_json_data(json_file_path)
    
    # 確認2025年資料存在
    if '2025' not in data:
        print("❌ JSON檔案中找不到2025年的資料")
        sys.exit(1)
    
    # 確認7月資料存在
    if '7' not in data['2025']:
        print("❌ JSON檔案中找不到2025年7月的資料")
        sys.exit(1)
    
    july_data = data['2025']['7']
    
    try:
        # 連接資料庫
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("✓ 資料庫連接成功")
        
        # 創建表格
        create_tables(cursor)
        
        # 開始導入資料
        schedule_data = july_data['schedule']
        total_employees = len(schedule_data)
        
        print(f"📊 準備導入 {total_employees} 位員工的2025年7月班表資料")
        
        for i, employee in enumerate(schedule_data, 1):
            print(f"  處理第 {i}/{total_employees} 位員工: {employee['name']}")
            
            # 插入員工資料
            insert_employee(cursor, employee)
            
            # 插入班表記錄
            insert_schedule_records(cursor, employee, 2025, 7)
        
        # 提交變更
        conn.commit()
        
        # 顯示統計資訊
        cursor.execute("SELECT COUNT(*) FROM employees")
        employee_count = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT COUNT(*) FROM schedule_records 
            WHERE year = 2025 AND month = 7
        """)
        schedule_count = cursor.fetchone()[0]
        
        print("\n📈 導入完成統計:")
        print(f"  • 員工總數: {employee_count}")
        print(f"  • 2025年7月班表記錄數: {schedule_count}")
        
        cursor.close()
        conn.close()
        
        print("\n✅ 2025年7月班表資料導入完成!")
        
    except psycopg2.Error as e:
        print(f"❌ 資料庫錯誤: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 未預期的錯誤: {e}")
        sys.exit(1)

def verify_import():
    """驗證導入結果"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        print("\n🔍 驗證導入結果:")
        
        # 查詢員工統計
        cursor.execute("""
            SELECT role, COUNT(*) as count 
            FROM employees 
            GROUP BY role 
            ORDER BY count DESC
        """)
        role_stats = cursor.fetchall()
        
        print("  員工角色統計:")
        for row in role_stats:
            print(f"    • {row['role']}: {row['count']} 人")
        
        # 查詢班表統計
        cursor.execute("""
            SELECT shift_type, COUNT(*) as count 
            FROM schedule_records 
            WHERE year = 2025 AND month = 7
            GROUP BY shift_type 
            ORDER BY count DESC
        """)
        shift_stats = cursor.fetchall()
        
        print("\n  2025年7月班表類型統計:")
        for row in shift_stats:
            print(f"    • {row['shift_type']}: {row['count']} 次")
        
        # 顯示幾個範例記錄
        cursor.execute("""
            SELECT e.name, e.role, s.day, s.shift_type
            FROM employees e
            JOIN schedule_records s ON e.name = s.employee_name
            WHERE s.year = 2025 AND s.month = 7 AND s.day <= 3
            ORDER BY e.name, s.day
            LIMIT 10
        """)
        
        sample_records = cursor.fetchall()
        print("\n  範例記錄 (前10筆):")
        for row in sample_records:
            print(f"    • {row['name']} ({row['role']}) - 7月{row['day']}日: {row['shift_type']}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ 驗證過程發生錯誤: {e}")

if __name__ == "__main__":
    # 設定JSON檔案路徑
    json_file = "monthly_schedule.json"
    
    # 執行導入
    import_schedule_data(json_file)
    
    # 驗證結果
    verify_import() 