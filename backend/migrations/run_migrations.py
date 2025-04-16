#!/usr/bin/env python3
import os
import sqlite3
from pathlib import Path

# 獲取SQL文件路徑
migrations_dir = Path(__file__).parent
sql_files = list(migrations_dir.glob('*.sql'))

# 獲取數據庫路徑
db_path = Path(__file__).parent.parent / 'anes.db'

print(f'資料庫路徑: {db_path}')
print(f'找到 {len(sql_files)} 個SQL遷移檔案')

# 連接到數據庫
conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

# 創建遷移跟踪表（如果不存在）
cursor.execute('''
CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
''')
conn.commit()

# 檢查已應用的遷移
applied_migrations = cursor.execute('SELECT file_name FROM migrations').fetchall()
applied_migrations = [row[0] for row in applied_migrations]

# 應用遷移
for sql_file in sorted(sql_files):
    file_name = sql_file.name
    
    if file_name in applied_migrations:
        print(f'遷移 {file_name} 已應用，跳過')
        continue
    
    print(f'應用遷移: {file_name}')
    
    # 讀取SQL文件內容
    with open(sql_file, 'r') as f:
        sql = f.read()
    
    # 執行SQL
    try:
        cursor.executescript(sql)
        # 記錄已應用的遷移
        cursor.execute('INSERT INTO migrations (file_name) VALUES (?)', (file_name,))
        conn.commit()
        print(f'✅ 成功應用遷移: {file_name}')
    except Exception as e:
        conn.rollback()
        print(f'❌ 遷移失敗: {file_name}')
        print(f'錯誤: {e}')

# 關閉連接
conn.close()
print('遷移完成!') 