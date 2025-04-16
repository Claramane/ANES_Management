import sqlite3
import os

def remove_is_active_fields():
    """從數據庫中移除所有表的is_active欄位"""
    try:
        # 數據庫路徑
        db_path = 'anes.db'
        
        # 備份數據庫
        backup_path = 'anes_backup.db'
        if os.path.exists(db_path):
            with open(db_path, 'rb') as src, open(backup_path, 'wb') as dst:
                dst.write(src.read())
            print(f"數據庫已備份至 {backup_path}")
        
        # 連接到SQLite數據庫
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 獲取所有表
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        processed_tables = 0
        
        for table in tables:
            table_name = table[0]
            
            # 獲取表的列信息
            cursor.execute(f"PRAGMA table_info({table_name});")
            columns = cursor.fetchall()
            
            # 檢查表是否有is_active列
            has_is_active = False
            column_names = []
            
            for column in columns:
                column_name = column[1]
                column_names.append(column_name)
                if column_name == 'is_active':
                    has_is_active = True
            
            if has_is_active:
                print(f"表 {table_name} 有is_active欄位，正在移除...")
                
                # 創建臨時表，不包含is_active
                new_columns = [col for col in column_names if col != 'is_active']
                new_columns_str = ', '.join(new_columns)
                
                # 創建臨時表
                cursor.execute(f"CREATE TABLE {table_name}_temp ({new_columns_str});")
                
                # 將數據從原表複製到臨時表
                cursor.execute(f"INSERT INTO {table_name}_temp SELECT {new_columns_str} FROM {table_name};")
                
                # 刪除原表
                cursor.execute(f"DROP TABLE {table_name};")
                
                # 將臨時表重命名為原表名
                cursor.execute(f"ALTER TABLE {table_name}_temp RENAME TO {table_name};")
                
                processed_tables += 1
                print(f"成功從表 {table_name} 中移除is_active欄位")
        
        # 提交更改
        conn.commit()
        
        print(f"完成! 共處理了 {processed_tables} 個表.")
    except Exception as e:
        print(f"處理過程中發生錯誤: {e}")
        if conn:
            conn.rollback()
    finally:
        # 關閉連接
        if conn:
            conn.close()

if __name__ == "__main__":
    print("開始從數據庫中移除is_active欄位...")
    remove_is_active_fields() 