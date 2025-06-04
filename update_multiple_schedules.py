#!/usr/bin/env python3
"""
批量更新多個月份的班表資料到資料庫
更新2025年8月到2026年3月的班表
"""

import json
import psycopg2
from datetime import datetime, date
import sys
import calendar

# 資料庫連接設定
DB_CONFIG = {
    'host': 'localhost',
    'database': 'anes_db',
    'user': 'anes_user',
    'password': 'anes_password'
}

def load_schedule_data(filename):
    """載入班表JSON檔案"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"❌ 找不到檔案：{filename}")
        return None
    except json.JSONDecodeError as e:
        print(f"❌ JSON解析錯誤：{e}")
        return None

def connect_database():
    """連接資料庫"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except psycopg2.Error as e:
        print(f"❌ 資料庫連接失敗：{e}")
        return None

def get_employee_mapping(conn):
    """獲取員工姓名與ID的對應"""
    cursor = conn.cursor()
    cursor.execute("SELECT id, full_name FROM users WHERE is_active = true")
    employees = cursor.fetchall()
    cursor.close()
    
    # 建立姓名到ID的對應字典
    name_to_id = {}
    for emp_id, full_name in employees:
        name_to_id[full_name] = emp_id
    
    print(f"📋 載入 {len(name_to_id)} 位活躍員工資料")
    return name_to_id

def check_existing_records(conn, year, month):
    """檢查指定月份是否已有班表記錄"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COUNT(*) FROM monthly_schedules 
        WHERE EXTRACT(year FROM date) = %s AND EXTRACT(month FROM date) = %s
    """, (year, month))
    count = cursor.fetchone()[0]
    cursor.close()
    return count

def update_monthly_schedule(conn, year, month, schedule_data, name_to_id):
    """更新單個月份的班表"""
    print(f"\n🔄 更新 {year}年{month}月 班表...")
    
    # 檢查是否有現有記錄
    existing_count = check_existing_records(conn, year, month)
    if existing_count == 0:
        print(f"⚠️  資料庫中沒有 {year}年{month}月 的班表記錄，跳過此月份")
        return 0, 0, []
    
    print(f"📊 資料庫中已有 {existing_count} 筆 {year}年{month}月 記錄")
    
    cursor = conn.cursor()
    updated_count = 0
    matched_employees = 0
    unmatched_employees = []
    
    # 找到對應年月的資料
    target_data = None
    if str(year) in schedule_data and str(month) in schedule_data[str(year)]:
        target_data = schedule_data[str(year)][str(month)]
    
    if not target_data:
        print(f"❌ JSON檔案中沒有找到 {year}年{month}月 的資料")
        return 0, 0, []
    
    employees_data = target_data.get('schedule', [])
    print(f"📋 JSON中有 {len(employees_data)} 位員工的班表資料")
    
    # 獲取該月份的天數
    days_in_month = calendar.monthrange(year, month)[1]
    
    for employee in employees_data:
        name = employee.get('name', '')
        shifts = employee.get('shifts', [])
        
        if name in name_to_id:
            matched_employees += 1
            employee_id = name_to_id[name]
            
            # 更新每天的班別
            for day_num in range(1, min(len(shifts) + 1, days_in_month + 1)):
                shift = shifts[day_num - 1] if day_num <= len(shifts) else 'O'
                target_date = date(year, month, day_num)
                
                try:
                    cursor.execute("""
                        UPDATE monthly_schedules 
                        SET shift_type = %s 
                        WHERE user_id = %s AND date = %s
                    """, (shift, employee_id, target_date))
                    
                    if cursor.rowcount > 0:
                        updated_count += 1
                        
                except psycopg2.Error as e:
                    print(f"⚠️  更新 {name} {target_date} 班別時出錯：{e}")
        else:
            unmatched_employees.append(name)
    
    cursor.close()
    
    print(f"✅ {year}年{month}月 更新完成：")
    print(f"   - 成功匹配員工：{matched_employees}位")
    print(f"   - 更新記錄數：{updated_count}筆")
    if unmatched_employees:
        print(f"   - 未匹配員工：{len(unmatched_employees)}位 - {', '.join(unmatched_employees)}")
    
    return updated_count, matched_employees, unmatched_employees

def main():
    print("🚀 開始批量更新班表資料...")
    print("📅 目標期間：2025年8月 至 2026年3月")
    
    # 載入班表資料
    schedule_data = load_schedule_data('monthly_schedule.json')
    if not schedule_data:
        return
    
    # 連接資料庫
    conn = connect_database()
    if not conn:
        return
    
    try:
        # 獲取員工對應
        name_to_id = get_employee_mapping(conn)
        
        # 定義要更新的月份範圍
        months_to_update = [
            (2025, 8), (2025, 9), (2025, 10), (2025, 11), (2025, 12),
            (2026, 1), (2026, 2), (2026, 3)
        ]
        
        total_updated = 0
        total_matched = 0
        all_unmatched = set()
        
        for year, month in months_to_update:
            updated, matched, unmatched = update_monthly_schedule(
                conn, year, month, schedule_data, name_to_id
            )
            total_updated += updated
            total_matched += matched
            all_unmatched.update(unmatched)
            
            # 提交此月份的更新
            conn.commit()
            print(f"💾 {year}年{month}月 更新已提交")
        
        print(f"\n🎉 批量更新完成！")
        print(f"📊 總計統計：")
        print(f"   - 總更新記錄數：{total_updated}筆")
        print(f"   - 平均匹配員工：{total_matched // len(months_to_update) if months_to_update else 0}位/月")
        if all_unmatched:
            print(f"   - 持續未匹配員工：{len(all_unmatched)}位 - {', '.join(sorted(all_unmatched))}")
        
        # 驗證更新結果
        print(f"\n🔍 驗證更新結果...")
        cursor = conn.cursor()
        for year, month in months_to_update:
            cursor.execute("""
                SELECT shift_type, COUNT(*) 
                FROM monthly_schedules 
                WHERE EXTRACT(year FROM date) = %s AND EXTRACT(month FROM date) = %s
                GROUP BY shift_type 
                ORDER BY shift_type
            """, (year, month))
            
            shift_stats = cursor.fetchall()
            print(f"   {year}年{month}月 班別統計：", end="")
            if shift_stats:
                stats_str = ", ".join([f"{shift}班{count}次" for shift, count in shift_stats])
                print(f" {stats_str}")
            else:
                print(" 無資料")
        
        cursor.close()
        
    except Exception as e:
        print(f"❌ 更新過程中發生錯誤：{e}")
        conn.rollback()
    finally:
        conn.close()
        print("🔐 資料庫連接已關閉")

if __name__ == "__main__":
    main() 