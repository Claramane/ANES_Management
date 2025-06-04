#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
更新現有月班表資料的程式
用於將JSON檔案中2025年7月的班表資料更新到現有的monthly_schedules表中
"""

import json
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, date
import sys

# 資料庫連接配置
DB_CONFIG = {
    'host': 'localhost',
    'database': 'anes_db',
    'user': 'anes_user',
    'password': 'anes_password'
}

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

def get_existing_users(cursor):
    """取得現有用戶的姓名和ID映射"""
    cursor.execute("""
        SELECT id, full_name 
        FROM users 
        WHERE is_active = true
        ORDER BY full_name
    """)
    
    users = cursor.fetchall()
    user_mapping = {}
    for user in users:
        user_mapping[user['full_name']] = user['id']
    
    print(f"✓ 載入了 {len(user_mapping)} 位現有用戶")
    return user_mapping

def check_existing_schedule(cursor, year, month):
    """檢查現有的班表資料"""
    # 修正日期計算邏輯
    if month == 12:
        next_year = year + 1
        next_month = 1
    else:
        next_year = year
        next_month = month + 1
    
    cursor.execute("""
        SELECT COUNT(DISTINCT u.full_name) as user_count,
               COUNT(*) as total_records
        FROM monthly_schedules ms
        JOIN users u ON ms.user_id = u.id
        WHERE ms.date >= %s AND ms.date < %s
    """, (f"{year}-{month:02d}-01", f"{next_year}-{next_month:02d}-01"))
    
    result = cursor.fetchone()
    print(f"✓ 現有班表資料: {result['user_count']} 位員工，共 {result['total_records']} 筆記錄")
    return result

def update_employee_schedule(cursor, user_id, full_name, year, month, shifts):
    """更新特定員工的班表資料"""
    updated_count = 0
    
    for day, shift_type in enumerate(shifts, 1):
        schedule_date = date(year, month, day)
        
        try:
            # 更新現有記錄的shift_type
            cursor.execute("""
                UPDATE monthly_schedules 
                SET shift_type = %s, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = %s AND date = %s
            """, (shift_type, user_id, schedule_date))
            
            if cursor.rowcount > 0:
                updated_count += 1
            else:
                print(f"    ⚠️  找不到 {full_name} 在 {schedule_date} 的記錄")
                
        except Exception as e:
            print(f"    ❌ 更新失敗 ({full_name}, {schedule_date}): {e}")
            raise
    
    return updated_count

def update_schedule_data(json_file_path):
    """主要的更新函數"""
    print("🚀 開始更新2025年7月班表資料...")
    
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
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        print("✓ 資料庫連接成功")
        
        # 檢查現有班表
        check_existing_schedule(cursor, 2025, 7)
        
        # 獲取現有用戶映射
        user_mapping = get_existing_users(cursor)
        
        # 開始更新資料
        schedule_data = july_data['schedule']
        total_employees = len(schedule_data)
        
        print(f"📊 準備更新 {total_employees} 位員工的2025年7月班表資料")
        
        matched_count = 0
        unmatched_employees = []
        total_updated_records = 0
        
        for i, employee in enumerate(schedule_data, 1):
            employee_name = employee['name']
            print(f"  處理第 {i}/{total_employees} 位員工: {employee_name}")
            
            if employee_name in user_mapping:
                user_id = user_mapping[employee_name]
                updated_records = update_employee_schedule(
                    cursor, user_id, employee_name, 2025, 7, employee['shifts']
                )
                total_updated_records += updated_records
                matched_count += 1
                print(f"    ✓ 已更新 {updated_records} 筆記錄")
            else:
                unmatched_employees.append(employee_name)
                print(f"    ⚠️  找不到對應的用戶: {employee_name}")
        
        # 提交變更
        conn.commit()
        
        print("\n📈 更新完成統計:")
        print(f"  • JSON檔案中的員工總數: {total_employees}")
        print(f"  • 成功匹配的員工數: {matched_count}")
        print(f"  • 未匹配的員工數: {len(unmatched_employees)}")
        print(f"  • 總更新記錄數: {total_updated_records}")
        
        if unmatched_employees:
            print("\n⚠️  未匹配的員工清單:")
            for name in unmatched_employees:
                print(f"    • {name}")
        
        cursor.close()
        conn.close()
        
        print("\n✅ 2025年7月班表資料更新完成!")
        
    except psycopg2.Error as e:
        print(f"❌ 資料庫錯誤: {e}")
        if 'conn' in locals():
            conn.rollback()
        sys.exit(1)
    except Exception as e:
        print(f"❌ 未預期的錯誤: {e}")
        if 'conn' in locals():
            conn.rollback()
        sys.exit(1)

def verify_update():
    """驗證更新結果"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        print("\n🔍 驗證更新結果:")
        
        # 統計各班別數量
        cursor.execute("""
            SELECT shift_type, COUNT(*) as count 
            FROM monthly_schedules ms
            WHERE ms.date >= '2025-07-01' AND ms.date < '2025-08-01'
            GROUP BY shift_type 
            ORDER BY count DESC
        """)
        shift_stats = cursor.fetchall()
        
        print("  2025年7月班表類型統計:")
        for row in shift_stats:
            print(f"    • {row['shift_type']}: {row['count']} 次")
        
        # 檢查還有多少O班（應該很少或沒有）
        o_count = next((row['count'] for row in shift_stats if row['shift_type'] == 'O'), 0)
        if o_count > 0:
            print(f"\n  ⚠️  仍有 {o_count} 筆休假(O)記錄，可能是未匹配的員工")
        else:
            print("\n  ✓ 所有空班表都已成功更新")
        
        # 顯示幾個範例記錄
        cursor.execute("""
            SELECT u.full_name, ms.date, ms.shift_type
            FROM monthly_schedules ms
            JOIN users u ON ms.user_id = u.id
            WHERE ms.date >= '2025-07-01' AND ms.date <= '2025-07-03'
            AND ms.shift_type != 'O'
            ORDER BY u.full_name, ms.date
            LIMIT 10
        """)
        
        sample_records = cursor.fetchall()
        print("\n  更新後的範例記錄 (前10筆非休假記錄):")
        for row in sample_records:
            print(f"    • {row['full_name']} - {row['date']}: {row['shift_type']}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ 驗證過程發生錯誤: {e}")

if __name__ == "__main__":
    # 設定JSON檔案路徑
    json_file = "monthly_schedule.json"
    
    # 執行更新
    update_schedule_data(json_file)
    
    # 驗證結果
    verify_update() 