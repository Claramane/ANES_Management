"""
執行所有遷移腳本的工具
"""

import os
import importlib.util
import sys

def run_migrations():
    """執行 migrations 目錄下的所有 Python 遷移腳本"""
    migrations_dir = os.path.join(os.path.dirname(__file__), 'migrations')
    
    # 獲取所有 .py 文件
    migration_files = [f for f in os.listdir(migrations_dir) 
                     if f.endswith('.py') and not f.startswith('__')]
    
    print(f"找到 {len(migration_files)} 個遷移腳本:")
    for i, file in enumerate(migration_files):
        print(f"{i+1}. {file}")
    
    print("\n開始執行遷移...")
    
    # 逐個執行遷移
    for file in migration_files:
        full_path = os.path.join(migrations_dir, file)
        module_name = file[:-3]  # 去掉 .py 後綴
        
        try:
            # 動態導入模塊
            spec = importlib.util.spec_from_file_location(module_name, full_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            # 檢查是否有 run_migration 函數
            if hasattr(module, 'run_migration'):
                print(f"\n執行遷移: {file}")
                success = module.run_migration()
                if success:
                    print(f"遷移 {file} 成功完成")
                else:
                    print(f"遷移 {file} 失敗")
            else:
                print(f"跳過 {file}: 沒有找到 run_migration 函數")
        except Exception as e:
            print(f"執行遷移 {file} 時發生錯誤: {str(e)}")
    
    print("\n所有遷移執行完畢")

if __name__ == "__main__":
    run_migrations() 