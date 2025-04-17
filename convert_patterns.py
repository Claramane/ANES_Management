#!/usr/bin/env python
"""
將SQLite格式的班表模式轉換為PostgreSQL格式
"""

import re
import psycopg2
from datetime import datetime

# PostgreSQL連接信息
PG_DB_NAME = "anes_db"
PG_USER = "anes_user"
PG_PASSWORD = "anes_password"
PG_HOST = "localhost"

# 讀取原始的patterns.sql文件
def read_patterns_file(filename="patterns.sql"):
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        return content
    except Exception as e:
        print(f"讀取patterns.sql文件時出錯: {e}")
        return None

# 轉換patterns以適應新的表結構
def convert_patterns(content):
    if not content:
        return None
    
    # 創建新的SQL語句列表
    new_sql = []
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # 先添加公式班表記錄
    new_sql.append("-- 添加公式班表記錄")
    new_sql.append("INSERT INTO formula_schedules (id, name, identity, num_groups, description, is_active, created_at, updated_at) VALUES (1, '麻醉專科護理師', 'anes_nurse', 7, '麻醉專科護理師班表', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);")
    new_sql.append("INSERT INTO formula_schedules (id, name, identity, num_groups, description, is_active, created_at, updated_at) VALUES (2, '恢復室護理師', 'recovery_nurse', 7, '恢復室護理師班表', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);")
    new_sql.append("INSERT INTO formula_schedules (id, name, identity, num_groups, description, is_active, created_at, updated_at) VALUES (3, '麻醉科Leader', 'anes_leader', 7, '麻醉科Leader班表', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);")
    new_sql.append("INSERT INTO formula_schedules (id, name, identity, num_groups, description, is_active, created_at, updated_at) VALUES (4, '麻醉科書記', 'anes_secretary', 7, '麻醉科書記班表', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);")
    new_sql.append("")
    
    # 正則表達式匹配並轉換每個INSERT語句
    pattern = r"INSERT INTO formula_schedule_patterns \(formula_id, group_number, pattern, created_at, updated_at\) VALUES \((\d+), (\d+), '([A-Z]+)', datetime\('now'\), datetime\('now'\)\);"
    
    # 添加序列重置
    new_sql.append("-- 重置序列")
    new_sql.append("SELECT setval('formula_schedules_id_seq', (SELECT MAX(id) FROM formula_schedules));")
    new_sql.append("SELECT setval('formula_schedule_patterns_id_seq', 1);")
    new_sql.append("")
    
    # 添加模式記錄
    new_sql.append("-- 添加模式記錄")
    
    matches = re.findall(pattern, content)
    for match in matches:
        formula_id, group_number, pattern_str = match
        
        # 為模式中的每一天生成一個記錄
        for day_offset, shift_type in enumerate(pattern_str):
            new_sql.append(f"INSERT INTO formula_schedule_patterns (formula_id, group_number, day_offset, shift_type, created_at, updated_at) VALUES ({formula_id}, {group_number}, {day_offset}, '{shift_type}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);")
    
    return "\n".join(new_sql)

# 將轉換後的SQL保存到新文件
def save_converted_sql(sql, filename="patterns_postgres.sql"):
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(sql)
        print(f"轉換後的SQL已保存到 {filename}")
    except Exception as e:
        print(f"保存轉換後的SQL時出錯: {e}")

# 直接執行SQL
def execute_sql(sql):
    try:
        # 連接到PostgreSQL
        conn = psycopg2.connect(
            dbname=PG_DB_NAME,
            user=PG_USER,
            password=PG_PASSWORD,
            host=PG_HOST
        )
        cursor = conn.cursor()
        
        # 執行SQL語句
        cursor.execute(sql)
        conn.commit()
        
        print("班表模式成功導入到PostgreSQL")
    except Exception as e:
        print(f"執行SQL時出錯: {e}")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def main():
    # 讀取原始patterns.sql
    content = read_patterns_file()
    
    # 轉換SQL
    converted_sql = convert_patterns(content)
    
    if converted_sql:
        # 保存轉換後的SQL
        save_converted_sql(converted_sql)
        
        # 詢問是否直接執行
        response = input("是否要直接將轉換後的SQL導入到PostgreSQL? (y/n): ")
        if response.lower() == 'y':
            execute_sql(converted_sql)
            print("完成！")
        else:
            print(f"請手動執行 patterns_postgres.sql 文件")
    else:
        print("轉換失敗，無法生成SQL")

if __name__ == "__main__":
    main() 