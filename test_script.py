import sqlite3
import os

print("Hello World")
print(f"當前工作目錄: {os.getcwd()}")

# 檢查數據庫文件是否存在
db_path = 'anes.db'
print(f"數據庫文件存在: {os.path.exists(db_path)}")

try:
    # 連接數據庫
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    print("成功連接到數據庫")
    
    # 顯示數據庫中的表
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cur.fetchall()
    print("數據庫中的表:")
    for table in tables:
        print(f"  - {table[0]}")
    
    # 檢查formula_schedules表
    cur.execute("SELECT * FROM formula_schedules")
    formulas = cur.fetchall()
    print(f"找到 {len(formulas)} 個公式班表")
    
    # 關閉連接
    conn.close()
    print("數據庫連接已關閉")
except Exception as e:
    print(f"發生錯誤: {e}")
    if 'conn' in locals():
        conn.close() 