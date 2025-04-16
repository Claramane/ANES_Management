#!/usr/bin/env python3
"""
更新麻醉科公式班表資料

這個腳本直接將舊版公式班表數據寫入資料庫
"""

import json
import sys
import os
from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import sqlite3

# 獲取當前腳本所在的目錄
current_dir = os.path.dirname(os.path.abspath(__file__))
# 添加 backend 目錄到 Python 路徑
backend_dir = os.path.join(current_dir, 'backend')
sys.path.append(backend_dir)

# 資料庫路徑
db_path = os.path.join(current_dir, 'backend', 'anes.db')
if not os.path.exists(db_path):
    # 檢查是否在 backend 目錄內
    backend_db_path = os.path.join(current_dir, 'anes.db')
    if os.path.exists(backend_db_path):
        db_path = backend_db_path

try:
    # 嘗試導入後端模型
    from app.models.formula_schedule import FormulaSchedule, NurseFormulaAssignment
    from app.models.user import User
    from app.core.database import Base, SessionLocal, engine
    
    use_orm = True
    print("成功載入後端 ORM 模型")
except ImportError:
    use_orm = False
    print("無法載入後端 ORM 模型，將使用直接 SQL 操作")

# 舊版的公式班表數據
old_formula_data = [
    {
        "type": "regular",
        "formula_data": [
            {
                "shifts": ["O", "O", "O", "O", "O", "O", "O"],
                "nurses": []
            },
            {
                "shifts": ["O", "D", "D", "A", "O", "O", "O"],
                "nurses": [5]
            },
            {
                "shifts": ["O", "O", "O", "O", "O", "O", "O"],
                "nurses": [6]
            },
            {
                "shifts": ["O", "D", "O", "A", "O", "O", "O"],
                "nurses": [7]
            },
            {
                "shifts": ["O", "O", "O", "O", "O", "O", "O"],
                "nurses": [8]
            },
            {
                "shifts": ["O", "O", "O", "O", "O", "O", "O"],
                "nurses": []
            },
            {
                "shifts": ["O", "A", "O", "O", "O", "O", "O"],
                "nurses": []
            },
            {
                "shifts": ["O", "O", "D", "O", "O", "O", "O"],
                "nurses": []
            },
            {
                "shifts": ["D", "O", "O", "O", "O", "O", "O"],
                "nurses": []
            },
            {
                "shifts": ["O", "O", "O", "O", "O", "O", "O"],
                "nurses": []
            },
            {
                "shifts": ["O", "O", "O", "O", "O", "O", "O"],
                "nurses": []
            },
            {
                "shifts": ["O", "O", "O", "O", "O", "O", "O"],
                "nurses": []
            }
        ]
    },
    {
        "type": "por",
        "formula_data": [
            {
                "shifts": ["A", "F", "C", "K", "K", "O", "O"],
                "nurses": [33]
            },
            {
                "shifts": ["A", "C", "A", "O", "O", "O", "O"],
                "nurses": [34]
            },
            {
                "shifts": ["O", "O", "A", "O", "O", "O", "O"],
                "nurses": [35]
            },
            {
                "shifts": ["O", "O", "O", "O", "O", "O", "O"],
                "nurses": []
            },
            {
                "shifts": ["O", "O", "O", "O", "O", "O", "O"],
                "nurses": []
            },
            {
                "shifts": ["O", "A", "O", "A", "A", "O", "O"],
                "nurses": []
            },
            {
                "shifts": ["O", "O", "O", "O", "O", "O", "O"],
                "nurses": []
            }
        ]
    },
    {
        "type": "leader",
        "formula_data": [
            {
                "shifts": ["A", "A", "A", "A", "A", "E", "O"],
                "nurses": [2]
            },
            {
                "shifts": ["A", "A", "A", "A", "A", "O", "O"],
                "nurses": [3]
            }
        ]
    },
    {
        "type": "secretary",
        "formula_data": [
            {
                "shifts": ["B", "B", "B", "B", "B", "O", "O"],
                "nurses": [40]
            }
        ]
    }
]

# 類型映射關係
type_mapping = {
    'regular': 'anesthesia_specialist',
    'por': 'recovery_nurse',
    'leader': 'anesthesia_leader',
    'secretary': 'anesthesia_secretary'
}

# 舊版類型映射到顯示名稱
type_name_mapping = {
    'regular': '麻醉專科護理師',
    'por': '恢復室護理師',
    'leader': '麻醉科Leader',
    'secretary': '麻醉科書記'
}

def update_formula_schedules_with_orm():
    """使用 SQLAlchemy ORM 更新公式班表"""
    # 創建 session
    session = SessionLocal()
    
    try:
        # 處理每種公式班表類型
        for formula_item in old_formula_data:
            old_type = formula_item["type"]
            new_type = type_mapping.get(old_type)
            display_name = type_name_mapping.get(old_type)
            
            if not new_type or not display_name:
                print(f"無法識別的類型: {old_type}")
                continue
                
            # 檢查是否已存在相同名稱的公式班表
            formula = session.query(FormulaSchedule).filter_by(name=display_name).first()
            
            # 獲取第一組的班表模式
            if formula_item["formula_data"] and len(formula_item["formula_data"]) > 0:
                pattern = "".join(formula_item["formula_data"][0]["shifts"])
                print(f"使用模式 \"{pattern}\" 更新 {display_name} 公式班表")
            else:
                pattern = "".join(["O"] * 7)
                print(f"使用默認模式 \"{pattern}\" 更新 {display_name} 公式班表")
            
            if formula:
                formula.pattern = pattern
                print(f"更新現有公式班表: {display_name}")
            else:
                formula = FormulaSchedule(
                    name=display_name,
                    description=f"{display_name}的公式班表",
                    pattern=pattern,
                    is_active=True
                )
                session.add(formula)
                print(f"創建新公式班表: {display_name}")
            
            # 提交更改以獲取 ID
            session.commit()
            
            # 刪除現有的護理師指派
            session.query(NurseFormulaAssignment).filter_by(formula_id=formula.id).delete()
            
            # 為每個護理師創建指派
            for group_index, group_data in enumerate(formula_item["formula_data"]):
                for nurse_id in group_data["nurses"]:
                    # 檢查護理師是否存在
                    nurse = session.query(User).filter_by(id=nurse_id).first()
                    if nurse:
                        # 更新護理師的組別
                        nurse.group = group_index + 1
                        
                        # 創建指派
                        assignment = NurseFormulaAssignment(
                            user_id=nurse_id,
                            formula_id=formula.id,
                            start_cycle=1,
                            sort_order=group_index + 1
                        )
                        session.add(assignment)
                        print(f"將護理師 ID:{nurse_id} 指派到 {display_name} 的第 {group_index + 1} 組")
                    else:
                        print(f"警告: 找不到 ID 為 {nurse_id} 的護理師")
            
            # 提交所有更改
            session.commit()
            
        print("公式班表更新完成！")
    except Exception as e:
        session.rollback()
        print(f"更新公式班表時發生錯誤: {e}")
    finally:
        session.close()

def update_formula_schedules_direct_sql():
    """使用直接 SQL 語句更新公式班表"""
    try:
        # 連接到 SQLite 資料庫
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print(f"連接到資料庫: {db_path}")
        
        # 檢查 formula_schedules 表是否存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='formula_schedules'")
        if not cursor.fetchone():
            print("資料庫中沒有找到 formula_schedules 表，請確保資料庫已正確初始化")
            return
        
        # 處理每種公式班表類型
        for formula_item in old_formula_data:
            old_type = formula_item["type"]
            display_name = type_name_mapping.get(old_type)
            
            if not display_name:
                print(f"無法識別的類型: {old_type}")
                continue
                
            # 檢查是否已存在相同名稱的公式班表
            cursor.execute("SELECT id FROM formula_schedules WHERE name = ?", (display_name,))
            result = cursor.fetchone()
            
            # 獲取第一組的班表模式
            if formula_item["formula_data"] and len(formula_item["formula_data"]) > 0:
                pattern = "".join(formula_item["formula_data"][0]["shifts"])
                print(f"使用模式 \"{pattern}\" 更新 {display_name} 公式班表")
            else:
                pattern = "".join(["O"] * 7)
                print(f"使用默認模式 \"{pattern}\" 更新 {display_name} 公式班表")
            
            if result:
                formula_id = result[0]
                # 更新現有公式班表
                cursor.execute(
                    "UPDATE formula_schedules SET pattern = ? WHERE id = ?",
                    (pattern, formula_id)
                )
                print(f"更新現有公式班表: {display_name} (ID: {formula_id})")
            else:
                # 創建新公式班表
                cursor.execute(
                    "INSERT INTO formula_schedules (name, description, pattern, is_active) VALUES (?, ?, ?, ?)",
                    (display_name, f"{display_name}的公式班表", pattern, 1)
                )
                formula_id = cursor.lastrowid
                print(f"創建新公式班表: {display_name} (ID: {formula_id})")
            
            # 提交更改
            conn.commit()
            
            # 檢查 nurse_formula_assignments 表是否存在
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='nurse_formula_assignments'")
            if cursor.fetchone():
                # 刪除現有的護理師指派
                cursor.execute("DELETE FROM nurse_formula_assignments WHERE formula_id = ?", (formula_id,))
            else:
                print("警告: 資料庫中沒有找到 nurse_formula_assignments 表")
            
            # 檢查 users 表是否存在
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
            if not cursor.fetchone():
                print("警告: 資料庫中沒有找到 users 表")
                continue
                
            # 檢查 users 表是否有 group 欄位
            cursor.execute("PRAGMA table_info(users)")
            columns = cursor.fetchall()
            has_group_column = any(col[1] == 'group' for col in columns)
            if not has_group_column:
                print("警告: users 表中沒有 group 欄位")
            
            # 更新護理師組別和創建指派
            for group_index, group_data in enumerate(formula_item["formula_data"]):
                for nurse_id in group_data["nurses"]:
                    # 檢查護理師是否存在
                    cursor.execute("SELECT id FROM users WHERE id = ?", (nurse_id,))
                    if cursor.fetchone():
                        # 更新護理師的組別 (如果有 group 欄位)
                        if has_group_column:
                            cursor.execute("UPDATE users SET \"group\" = ? WHERE id = ?", (group_index + 1, nurse_id))
                        
                        # 如果 nurse_formula_assignments 表存在，則創建指派
                        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='nurse_formula_assignments'")
                        if cursor.fetchone():
                            cursor.execute(
                                "INSERT INTO nurse_formula_assignments (user_id, formula_id, start_cycle, sort_order) VALUES (?, ?, ?, ?)",
                                (nurse_id, formula_id, 1, group_index + 1)
                            )
                        
                        print(f"將護理師 ID:{nurse_id} 指派到 {display_name} 的第 {group_index + 1} 組")
                    else:
                        print(f"警告: 找不到 ID 為 {nurse_id} 的護理師")
            
            # 提交所有更改
            conn.commit()
            
        print("公式班表更新完成！")
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
        print(f"更新公式班表時發生錯誤: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

def update_settings():
    """更新設置數據"""
    try:
        # 計算每種類型的組別數量
        group_counts = {
            'regular': len(old_formula_data[0]["formula_data"]),  # 12
            'por': len(old_formula_data[1]["formula_data"]),      # 7
            'leader': len(old_formula_data[2]["formula_data"]),   # 2
            'secretary': len(old_formula_data[3]["formula_data"]) # 1
        }
        
        # 連接到 SQLite 資料庫
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print(f"連接到資料庫進行設置更新: {db_path}")
        
        # 檢查是否已有設置表
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'")
        has_settings_table = cursor.fetchone() is not None
        
        if not has_settings_table:
            # 創建設置表
            cursor.execute('''
            CREATE TABLE settings (
                id INTEGER PRIMARY KEY,
                key TEXT UNIQUE,
                value TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            ''')
            conn.commit()
            print("創建設置表")
        
        # 設置映射關係
        settings_mapping = {
            'regular': 'anesthesia_specialist_groups',
            'por': 'recovery_nurse_groups',
            'leader': 'anesthesia_leader_groups',
            'secretary': 'anesthesia_secretary_groups'
        }
        
        # 更新設置
        for old_type, count in group_counts.items():
            setting_key = settings_mapping.get(old_type)
            if setting_key:
                # 檢查設置是否存在
                cursor.execute("SELECT id FROM settings WHERE key = ?", (setting_key,))
                if cursor.fetchone():
                    # 更新設置
                    cursor.execute("UPDATE settings SET value = ? WHERE key = ?", (str(count), setting_key))
                else:
                    # 創建設置
                    cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", (setting_key, str(count)))
                
                print(f"設置 {setting_key} = {count}")
        
        conn.commit()
        print("設置更新完成！")
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
        print(f"更新設置時發生錯誤: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    print("開始更新麻醉科公式班表...")
    print(f"資料庫路徑: {db_path}")
    
    if not os.path.exists(db_path):
        print(f"錯誤: 找不到資料庫文件 {db_path}")
        sys.exit(1)
    
    if use_orm:
        update_formula_schedules_with_orm()
    else:
        update_formula_schedules_direct_sql()
    
    update_settings()
    
    print("所有更新完成！") 