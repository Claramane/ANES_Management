#!/usr/bin/env python3
"""
直接更新公式班表資料

此腳本使用SQL語言直接更新資料庫中的公式班表資料，不處理護理師指派
"""

import json
import sqlite3
import os

# 資料庫路徑
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', 'anes.db')

# 公式班表資料
formula_data_json = '''[{"type":"regular","formula_data":[{"shifts":["D","D","D","D","O","O","O"],"nurses":[6,28]},{"shifts":["A","A","O","O","N","N","N"],"nurses":[9,32]},{"shifts":["O","A","A","A","A","A","O"],"nurses":[10,22,29]},{"shifts":["N","N","N","N","N","O","O"],"nurses":[7,16]},{"shifts":["A","A","A","A","A","A","O"],"nurses":[14,18]},{"shifts":["N","N","N","N","O","O","O"],"nurses":[15,26,27]},{"shifts":["A","A","O","O","D","D","D"],"nurses":[5,20,25]},{"shifts":["O","O","A","A","A","O","A"],"nurses":[12,30]},{"shifts":["A","O","A","A","A","O","O"],"nurses":[11,33]},{"shifts":["A","A","A","A","A","A","O"],"nurses":[8,17,21,24]},{"shifts":["A","A","A","A","A","O","O"],"nurses":[13,23,31]}]},{"type":"por","formula_data":[{"shifts":["A","A","A","O","A","A","A"],"nurses":[36]},{"shifts":["O","A","A","A","O","O","O"],"nurses":[39]},{"shifts":["A","A","A","A","A","O","O"],"nurses":[40]},{"shifts":["A","A","O","A","A","A","O"],"nurses":[38]},{"shifts":["C","C","C","C","C","O","O"],"nurses":[37]},{"shifts":["F","F","F","F","F","O","O"],"nurses":[34]},{"shifts":["K","K","K","K","K","O","O"],"nurses":[35]}]},{"type":"leader","formula_data":[{"shifts":["A","A","A","A","A","E","O"],"nurses":[2]},{"shifts":["A","A","A","A","A","O","O"],"nurses":[3]}]},{"type":"secretary","formula_data":[{"shifts":["B","B","B","B","B","E","O"],"nurses":[40]}]}]'''

# 類型映射
type_name_mapping = {
    'regular': '麻醉專科護理師',
    'por': '恢復室護理師',
    'leader': '麻醉科Leader',
    'secretary': '麻醉科書記'
}

# 設置映射關係
settings_mapping = {
    'regular': 'anesthesia_specialist_groups',
    'por': 'recovery_nurse_groups',
    'leader': 'anesthesia_leader_groups',
    'secretary': 'anesthesia_secretary_groups'
}

def update_formula_schedules():
    """更新公式班表資料"""
    # 解析JSON資料
    formula_data = json.loads(formula_data_json)

    # 連接到資料庫
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print('===== 開始更新公式班表 =====')

    # 處理每種公式班表類型
    for formula_item in formula_data:
        type_key = formula_item['type']
        display_name = type_name_mapping.get(type_key)
        
        if not display_name:
            print(f'無法識別的類型: {type_key}')
            continue
        
        # 獲取第一組的班表模式
        if formula_item['formula_data'] and len(formula_item['formula_data']) > 0:
            pattern = ''.join(formula_item['formula_data'][0]['shifts'])
            print(f'使用模式 "{pattern}" 更新 {display_name} 公式班表')
        else:
            pattern = 'OOOOOOO'
            print(f'使用默認模式 "{pattern}" 更新 {display_name} 公式班表')
        
        # 檢查是否已存在相同名稱的公式班表
        cursor.execute('SELECT id FROM formula_schedules WHERE name = ?', (display_name,))
        result = cursor.fetchone()
        
        if result:
            formula_id = result[0]
            # 更新現有公式班表
            cursor.execute(
                'UPDATE formula_schedules SET pattern = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                (pattern, formula_id)
            )
            print(f'更新現有公式班表: {display_name} (ID: {formula_id})')
        else:
            # 創建新公式班表
            cursor.execute(
                'INSERT INTO formula_schedules (name, description, pattern, is_active) VALUES (?, ?, ?, ?)',
                (display_name, f'{display_name}的公式班表', pattern, 1)
            )
            formula_id = cursor.lastrowid
            print(f'創建新公式班表: {display_name} (ID: {formula_id})')
        
        # 提交更改
        conn.commit()

    print('公式班表更新完成！')

    # 更新設置數據
    print('===== 開始更新組別數量設置 =====')

    # 計算每種類型的組別數量
    for type_key, formula_item in [(item['type'], item) for item in formula_data]:
        count = len(formula_item['formula_data'])
        setting_key = settings_mapping.get(type_key)
        
        if setting_key:
            # 檢查設置是否存在
            cursor.execute('SELECT id FROM settings WHERE key = ?', (setting_key,))
            if cursor.fetchone():
                # 更新設置
                cursor.execute('UPDATE settings SET value = ? WHERE key = ?', (str(count), setting_key))
            else:
                # 創建設置
                cursor.execute('INSERT INTO settings (key, value) VALUES (?, ?)', (setting_key, str(count)))
            
            print(f'設置 {setting_key} = {count}')

    conn.commit()
    print('設置更新完成！')

    # 檢查更新結果
    print('\n===== 公式班表資料 =====')
    cursor.execute('SELECT * FROM formula_schedules')
    for row in cursor.fetchall():
        print(row)

    print('\n===== 組別數量設置 =====')
    cursor.execute('SELECT * FROM settings WHERE key LIKE "%groups"')
    for row in cursor.fetchall():
        print(row)

    # 關閉連接
    conn.close()
    print('\n所有更新完成！')

if __name__ == "__main__":
    print(f"資料庫路徑: {db_path}")
    if not os.path.exists(db_path):
        print(f"錯誤: 找不到資料庫文件 {db_path}")
        exit(1)
    
    update_formula_schedules() 