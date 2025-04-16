import sqlite3
from datetime import datetime

def update_formula_schedules():
    """更新所有formula_schedules的created_at和updated_at欄位為當前時間"""
    try:
        # 連接到SQLite數據庫
        conn = sqlite3.connect('anes.db')
        cursor = conn.cursor()
        
        # 獲取當前時間
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # 檢查是否有記錄
        cursor.execute("SELECT COUNT(*) FROM formula_schedules")
        count = cursor.fetchone()[0]
        print(f"發現 {count} 個公式班表記錄")
        
        # 更新所有記錄的created_at和updated_at欄位
        cursor.execute(
            "UPDATE formula_schedules SET created_at = ?, updated_at = ? WHERE created_at IS NULL OR updated_at IS NULL",
            (current_time, current_time)
        )
        
        # 提交更改
        conn.commit()
        
        # 顯示更新後的記錄
        cursor.execute("SELECT id, name, created_at, updated_at FROM formula_schedules")
        records = cursor.fetchall()
        print("更新後的記錄:")
        for record in records:
            print(f"ID: {record[0]}, 名稱: {record[1]}, 創建時間: {record[2]}, 更新時間: {record[3]}")
        
        print(f"成功更新 {conn.total_changes} 個記錄")
    except Exception as e:
        print(f"更新過程中發生錯誤: {e}")
    finally:
        # 關閉連接
        if conn:
            conn.close()

if __name__ == "__main__":
    print("開始更新formula_schedules表...")
    update_formula_schedules() 