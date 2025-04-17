#!/usr/bin/env python
"""
將SQLite數據遷移到PostgreSQL
"""

import os
import json
import sqlite3
import psycopg2
import subprocess
from psycopg2.extras import execute_values
from datetime import datetime

# SQLite數據庫文件路徑
SQLITE_DB_PATH = "instance/anes.db"

# PostgreSQL連接信息
PG_DB_NAME = "anes_db"
PG_USER = "anes_user"
PG_PASSWORD = "anes_password"
PG_HOST = "localhost"

# 表名映射（SQLite表名 -> PostgreSQL表名）
TABLE_MAPPING = {
    'users': 'users',
    'schedule_versions': 'schedule_versions',
    'monthly_schedules': 'monthly_schedules',
    'formula_schedules': 'formula_schedules',
    'formula_schedule_patterns': 'formula_schedule_patterns',
    'nurse_formula_assignments': 'nurse_formula_assignments',
    'pattern_nurse_assignments': 'pattern_nurse_assignments',
    'shift_swap_requests': 'shift_swap_requests',
    'announcement_categories': 'announcement_categories',
    'announcements': 'announcements',
    'announcement_permissions': 'announcement_permissions',
    'logs': 'logs',
    'migrations': 'migrations',
    'shift_rules': 'shift_rules'
}

def export_sqlite_data():
    """從SQLite導出數據到JSON文件"""
    print("從SQLite導出數據...")
    
    # 連接SQLite數據庫
    conn = sqlite3.connect(SQLITE_DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # 獲取所有表
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    
    data = {}
    
    # 導出每個表的數據
    for table in tables:
        print(f"導出表: {table}")
        cursor.execute(f"SELECT * FROM {table};")
        rows = cursor.fetchall()
        
        # 將行數據轉換為字典列表
        table_data = []
        for row in rows:
            row_dict = {key: row[key] for key in row.keys()}
            table_data.append(row_dict)
        
        data[table] = table_data
    
    # 保存到JSON文件
    with open('sqlite_data_dump.json', 'w') as f:
        json.dump(data, f, default=str)
    
    print(f"導出完成，數據保存到 sqlite_data_dump.json")
    
    cursor.close()
    conn.close()
    
    return data

def prepare_postgres_database():
    """準備PostgreSQL數據庫結構"""
    print("準備PostgreSQL數據庫結構...")
    
    try:
        # 運行表創建腳本
        subprocess.run(['python', 'create_postgres_tables.py'], check=True)
        print("PostgreSQL表結構創建成功！")
    except Exception as e:
        print(f"創建PostgreSQL表結構時出錯: {e}")
        raise

def import_data_to_postgres(data):
    """將數據導入到PostgreSQL"""
    print("將數據導入到PostgreSQL...")
    
    # 連接PostgreSQL
    conn = psycopg2.connect(
        dbname=PG_DB_NAME,
        user=PG_USER,
        password=PG_PASSWORD,
        host=PG_HOST
    )
    cursor = conn.cursor()
    
    # 導入每個表的數據
    for sqlite_table, rows in data.items():
        # 檢查表是否在映射中
        if sqlite_table not in TABLE_MAPPING:
            print(f"跳過未映射表: {sqlite_table}")
            continue
        
        pg_table = TABLE_MAPPING[sqlite_table]
        
        if not rows:
            print(f"表 {sqlite_table} -> {pg_table} 沒有數據，跳過")
            continue
        
        print(f"導入表: {sqlite_table} -> {pg_table} ({len(rows)} 行)")
        
        try:
            # 獲取表的列名
            columns = list(rows[0].keys())
            
            # 構建INSERT語句
            columns_str = ', '.join(columns)
            placeholders = ', '.join(['%s'] * len(columns))
            
            # 構建批量插入使用的値
            values = []
            for row in rows:
                row_values = [row[col] for col in columns]
                values.append(row_values)
            
            # 執行批量插入
            query = f"INSERT INTO {pg_table} ({columns_str}) VALUES %s"
            template = f"({', '.join(['%s'] * len(columns))})"
            execute_values(cursor, f"INSERT INTO {pg_table} ({columns_str}) VALUES %s", values, template=template)
            
            conn.commit()
            print(f"成功導入 {len(rows)} 行到 {pg_table}")
        except Exception as e:
            conn.rollback()
            print(f"導入表 {pg_table} 時出錯: {e}")
            print(f"第一行數據: {rows[0] if rows else 'No data'}")
    
    cursor.close()
    conn.close()

def main():
    """主函數"""
    print("開始SQLite到PostgreSQL的數據遷移...")
    
    # 導出SQLite數據
    data = export_sqlite_data()
    
    # 準備PostgreSQL數據庫
    prepare_postgres_database()
    
    # 導入數據到PostgreSQL
    import_data_to_postgres(data)
    
    print("\n遷移完成！")
    print(f"PostgreSQL連接字串: postgresql://{PG_USER}:{PG_PASSWORD}@{PG_HOST}/{PG_DB_NAME}")
    print("請更新你的應用配置以使用PostgreSQL。")

if __name__ == "__main__":
    main() 