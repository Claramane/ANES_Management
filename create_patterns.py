import sqlite3
import json
import os

print(f"當前工作目錄: {os.getcwd()}")

# 連接到數據庫
db_path = 'anes.db'
print(f"嘗試連接數據庫: {db_path}")
print(f"數據庫文件存在: {os.path.exists(db_path)}")

try:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    print("成功連接到數據庫")

    # 確保formula_schedule_patterns表存在
    cur.execute('''
    CREATE TABLE IF NOT EXISTS formula_schedule_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        formula_id INTEGER,
        group_number INTEGER,
        pattern TEXT,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        FOREIGN KEY (formula_id) REFERENCES formula_schedules (id)
    )
    ''')
    conn.commit()
    print("確保formula_schedule_patterns表存在")

    # 清空現有記錄
    cur.execute('DELETE FROM formula_schedule_patterns')
    conn.commit()
    print("已清空現有的formula_schedule_patterns記錄")

    # 檢查formula_schedules表
    cur.execute('SELECT id, name, pattern FROM formula_schedules')
    formulas = cur.fetchall()
    print(f"找到 {len(formulas)} 個公式班表:")
    for formula in formulas:
        print(f"  - ID: {formula[0]}, 名稱: {formula[1]}, 模式: {formula[2]}")

    # 定義數據
    old_formula_data = [
        {
            'type': 'regular',  # 麻醉專科護理師
            'formula_data': [
                {'shifts': ['D', 'D', 'D', 'D', 'O', 'O', 'O'], 'nurses': []},  # 基本模式
                {'shifts': ['O', 'D', 'D', 'D', 'D', 'O', 'O'], 'nurses': []},
                {'shifts': ['O', 'O', 'D', 'D', 'D', 'D', 'O'], 'nurses': []},
                {'shifts': ['O', 'O', 'O', 'D', 'D', 'D', 'D'], 'nurses': []},
                {'shifts': ['D', 'O', 'O', 'O', 'D', 'D', 'D'], 'nurses': []},
                {'shifts': ['D', 'D', 'O', 'O', 'O', 'D', 'D'], 'nurses': []},
                {'shifts': ['D', 'D', 'D', 'O', 'O', 'O', 'D'], 'nurses': []}
            ]
        },
        {
            'type': 'por',  # 恢復室護理師
            'formula_data': [
                {'shifts': ['A', 'A', 'A', 'O', 'A', 'A', 'A'], 'nurses': []},  # 基本模式
                {'shifts': ['A', 'A', 'A', 'A', 'O', 'A', 'A'], 'nurses': []},
                {'shifts': ['A', 'A', 'A', 'A', 'A', 'O', 'A'], 'nurses': []},
                {'shifts': ['A', 'A', 'A', 'A', 'A', 'A', 'O'], 'nurses': []},
                {'shifts': ['O', 'A', 'A', 'A', 'A', 'A', 'A'], 'nurses': []},
                {'shifts': ['A', 'O', 'A', 'A', 'A', 'A', 'A'], 'nurses': []},
                {'shifts': ['A', 'A', 'O', 'A', 'A', 'A', 'A'], 'nurses': []}
            ]
        },
        {
            'type': 'leader',  # 麻醉科Leader
            'formula_data': [
                {'shifts': ['A', 'A', 'A', 'A', 'A', 'E', 'O'], 'nurses': []},  # 基本模式
                {'shifts': ['O', 'A', 'A', 'A', 'A', 'A', 'E'], 'nurses': []},
                {'shifts': ['E', 'O', 'A', 'A', 'A', 'A', 'A'], 'nurses': []},
                {'shifts': ['A', 'E', 'O', 'A', 'A', 'A', 'A'], 'nurses': []},
                {'shifts': ['A', 'A', 'E', 'O', 'A', 'A', 'A'], 'nurses': []},
                {'shifts': ['A', 'A', 'A', 'E', 'O', 'A', 'A'], 'nurses': []},
                {'shifts': ['A', 'A', 'A', 'A', 'E', 'O', 'A'], 'nurses': []}
            ]
        },
        {
            'type': 'secretary',  # 麻醉科書記
            'formula_data': [
                {'shifts': ['B', 'B', 'B', 'B', 'B', 'E', 'O'], 'nurses': []},  # 基本模式
                {'shifts': ['O', 'B', 'B', 'B', 'B', 'B', 'E'], 'nurses': []},
                {'shifts': ['E', 'O', 'B', 'B', 'B', 'B', 'B'], 'nurses': []},
                {'shifts': ['B', 'E', 'O', 'B', 'B', 'B', 'B'], 'nurses': []},
                {'shifts': ['B', 'B', 'E', 'O', 'B', 'B', 'B'], 'nurses': []},
                {'shifts': ['B', 'B', 'B', 'E', 'O', 'B', 'B'], 'nurses': []},
                {'shifts': ['B', 'B', 'B', 'B', 'E', 'O', 'B'], 'nurses': []}
            ]
        }
    ]

    # 類型名稱映射到formula_id
    type_id_mapping = {}
    for formula in formulas:
        formula_id, name, _ = formula
        if '麻醉專科護理師' in name:
            type_id_mapping['regular'] = formula_id
        elif '恢復室護理師' in name:
            type_id_mapping['por'] = formula_id
        elif 'Leader' in name:
            type_id_mapping['leader'] = formula_id
        elif '書記' in name:
            type_id_mapping['secretary'] = formula_id

    print(f"類型ID映射: {type_id_mapping}")

    # 創建新的pattern記錄
    patterns_created = 0

    for formula_item in old_formula_data:
        old_type = formula_item['type']
        formula_id = type_id_mapping.get(old_type)
        
        if not formula_id:
            print(f'無法識別的類型: {old_type}')
            continue
        
        print(f'處理公式ID {formula_id} ({old_type})的模式:')
        
        for group_index, group_data in enumerate(formula_item['formula_data']):
            pattern_str = ''.join(group_data['shifts'])
            group_number = group_index + 1
            
            # 插入新記錄
            try:
                cur.execute(
                    'INSERT INTO formula_schedule_patterns (formula_id, group_number, pattern, created_at, updated_at) VALUES (?, ?, ?, datetime("now"), datetime("now"))',
                    (formula_id, group_number, pattern_str)
                )
                patterns_created += 1
                print(f'  - 添加組別 {group_number} 的模式: {pattern_str}')
            except sqlite3.Error as e:
                print(f'  - 錯誤: 無法添加組別 {group_number} 的模式 {pattern_str}: {e}')

    # 提交更改
    conn.commit()
    print(f'成功創建 {patterns_created} 條模式記錄')

    # 驗證創建的記錄
    cur.execute('SELECT * FROM formula_schedule_patterns ORDER BY formula_id, group_number')
    patterns = cur.fetchall()
    print('\n新創建的formula_schedule_patterns記錄:')
    for pattern in patterns:
        print(f'ID: {pattern[0]}, 公式ID: {pattern[1]}, 組別: {pattern[2]}, 模式: {pattern[3]}')

    # 關閉連接
    conn.close()
    print("數據庫連接已關閉")

except Exception as e:
    print(f"發生錯誤: {e}")
    if 'conn' in locals():
        conn.close()
        print("數據庫連接已關閉") 