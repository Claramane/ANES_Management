#!/usr/bin/env python
"""
檢查 SQLite 到 PostgreSQL 遷移的數據完整性
"""

import os
import sqlite3
import psycopg2
import json
from psycopg2.extras import RealDictCursor
from tabulate import tabulate

# 數據庫連接信息
SQLITE_DB_PATH = "backend/anes.db"
PG_DB_NAME = "anes_db"
PG_USER = "anes_user"
PG_PASSWORD = "anes_password"
PG_HOST = "localhost"

# 要檢查的表
TABLES_TO_CHECK = [
    'users',
    'schedule_versions',
    'monthly_schedules',
    'formula_schedules',
    'formula_schedule_patterns',
    'nurse_formula_assignments',
    'pattern_nurse_assignments',
    'shift_swap_requests',
    'announcement_categories',
    'announcements',
    'announcement_permissions',
    'logs'
]

def connect_sqlite():
    """連接SQLite資料庫"""
    try:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        print(f"連接SQLite數據庫出錯: {e}")
        return None

def connect_postgres():
    """連接PostgreSQL資料庫"""
    try:
        conn = psycopg2.connect(
            dbname=PG_DB_NAME,
            user=PG_USER,
            password=PG_PASSWORD,
            host=PG_HOST,
            cursor_factory=RealDictCursor
        )
        return conn
    except Exception as e:
        print(f"連接PostgreSQL數據庫出錯: {e}")
        return None

def get_sqlite_table_info(conn, table):
    """獲取SQLite表的結構信息"""
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table})")
    columns = cursor.fetchall()
    return [col['name'] for col in columns]

def get_postgres_table_info(conn, table):
    """獲取PostgreSQL表的結構信息"""
    cursor = conn.cursor()
    cursor.execute(f"""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '{table}'
        ORDER BY ordinal_position
    """)
    columns = cursor.fetchall()
    return [col['column_name'] for col in columns]

def get_table_count(sqlite_conn, pg_conn, table):
    """獲取表中的記錄數量"""
    sqlite_cursor = sqlite_conn.cursor()
    pg_cursor = pg_conn.cursor()
    
    sqlite_cursor.execute(f"SELECT COUNT(*) as count FROM {table}")
    sqlite_count = sqlite_cursor.fetchone()['count']
    
    pg_cursor.execute(f"SELECT COUNT(*) as count FROM {table}")
    pg_count = pg_cursor.fetchone()['count']
    
    return sqlite_count, pg_count

def check_random_records(sqlite_conn, pg_conn, table, sqlite_columns, pg_columns):
    """檢查表中的隨機記錄"""
    sqlite_cursor = sqlite_conn.cursor()
    pg_cursor = pg_conn.cursor()
    
    # 獲取共同列
    common_columns = list(set(sqlite_columns) & set(pg_columns))
    if not common_columns:
        return False, "沒有共同列"
    
    # 構建查詢
    sqlite_cols = ", ".join(common_columns)
    pg_cols = ", ".join(common_columns)
    
    # 從 SQLite 獲取最多5條記錄
    sqlite_cursor.execute(f"SELECT {sqlite_cols} FROM {table} ORDER BY id LIMIT 5")
    sqlite_records = sqlite_cursor.fetchall()
    
    if not sqlite_records:
        return True, "表為空"
    
    # 檢查這些記錄是否存在於 PostgreSQL 中
    for record in sqlite_records:
        # 構建 WHERE 子句
        conditions = []
        params = []
        for col in common_columns:
            if col == 'id':  # 使用 ID 作為主要匹配條件
                conditions.append(f"{col} = %s")
                params.append(record[col])
                break
        
        if not conditions:
            # 如果沒有 ID 列，使用其他列作為匹配條件
            for col in common_columns:
                if record[col] is not None:
                    conditions.append(f"{col} = %s")
                    params.append(record[col])
                    if len(conditions) >= 2:  # 最多使用兩個條件
                        break
        
        if not conditions:
            return False, "無法構建查詢條件"
        
        where_clause = " AND ".join(conditions)
        pg_cursor.execute(f"SELECT {pg_cols} FROM {table} WHERE {where_clause}", params)
        pg_record = pg_cursor.fetchone()
        
        if not pg_record:
            return False, f"記錄在 PostgreSQL 中不存在: {dict(record)}"
        
        # 檢查值是否匹配
        for col in common_columns:
            if record[col] != pg_record[col]:
                return False, f"列 '{col}' 值不匹配: SQLite={record[col]}, PostgreSQL={pg_record[col]}"
    
    return True, "抽樣記錄檢查通過"

def main():
    """主函數"""
    print("開始檢查 SQLite 到 PostgreSQL 的數據遷移結果...")
    
    # 連接數據庫
    sqlite_conn = connect_sqlite()
    pg_conn = connect_postgres()
    
    if not sqlite_conn or not pg_conn:
        print("無法連接數據庫，檢查中止")
        return
    
    # 存儲檢查結果
    results = []
    
    # 檢查每個表
    for table in TABLES_TO_CHECK:
        print(f"\n檢查表: {table}")
        
        # 獲取表結構
        sqlite_columns = get_sqlite_table_info(sqlite_conn, table)
        pg_columns = get_postgres_table_info(pg_conn, table)
        
        # 檢查列是否匹配
        missing_columns = set(sqlite_columns) - set(pg_columns)
        extra_columns = set(pg_columns) - set(sqlite_columns)
        
        # 獲取記錄數量
        try:
            sqlite_count, pg_count = get_table_count(sqlite_conn, pg_conn, table)
            count_match = sqlite_count == pg_count
            
            # 抽樣檢查記錄
            records_match, records_message = check_random_records(
                sqlite_conn, pg_conn, table, sqlite_columns, pg_columns
            )
            
            status = "通過" if count_match and records_match else "失敗"
            
            results.append({
                "表名": table,
                "SQLite記錄數": sqlite_count,
                "PostgreSQL記錄數": pg_count,
                "記錄數匹配": "是" if count_match else "否",
                "缺少列": ", ".join(missing_columns) if missing_columns else "無",
                "額外列": ", ".join(extra_columns) if extra_columns else "無",
                "抽樣檢查": records_message,
                "狀態": status
            })
            
        except Exception as e:
            print(f"檢查表 {table} 時出錯: {e}")
            results.append({
                "表名": table,
                "SQLite記錄數": "錯誤",
                "PostgreSQL記錄數": "錯誤",
                "記錄數匹配": "否",
                "缺少列": "檢查失敗",
                "額外列": "檢查失敗",
                "抽樣檢查": f"錯誤: {e}",
                "狀態": "錯誤"
            })
    
    # 關閉連接
    sqlite_conn.close()
    pg_conn.close()
    
    # 顯示結果
    print("\n數據遷移檢查結果:")
    print(tabulate(results, headers="keys", tablefmt="grid"))
    
    # 保存結果到文件
    with open("migration_check_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    # 總結
    success_count = sum(1 for r in results if r["狀態"] == "通過")
    print(f"\n總結: {success_count}/{len(results)} 表遷移成功")
    
    if success_count == len(results):
        print("恭喜！數據遷移檢查通過，所有表數據完整。")
    else:
        print("警告: 部分表可能存在數據不一致，請檢查詳細報告。")

if __name__ == "__main__":
    main() 