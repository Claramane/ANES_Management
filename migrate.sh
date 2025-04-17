#!/bin/bash
# 執行從SQLite到PostgreSQL的完整遷移流程

echo "=== 開始麻醉排班系統資料庫遷移 (SQLite -> PostgreSQL) ==="
echo

# 1. 檢查依賴
echo "檢查依賴..."
python -c "import psycopg2" 2>/dev/null || { echo "缺少 psycopg2 庫，請先運行: pip install psycopg2-binary"; exit 1; }
python -c "import tabulate" 2>/dev/null || { echo "缺少 tabulate 庫，請先運行: pip install tabulate"; exit 1; }

# 2. 設置PostgreSQL（如果未設置）
echo
echo "設置PostgreSQL..."
read -p "是否需要創建PostgreSQL數據庫和用戶？(y/n): " setup_db
if [[ "$setup_db" == "y" ]]; then
    sudo -u postgres psql -f setup_postgres.sql
    if [ $? -ne 0 ]; then
        echo "設置PostgreSQL數據庫失敗！"
        exit 1
    fi
    echo "PostgreSQL數據庫和用戶創建成功！"
fi

# 3. 創建表結構
echo
echo "創建表結構..."
python create_postgres_tables.py
if [ $? -ne 0 ]; then
    echo "創建表結構失敗！"
    exit 1
fi

# 4. 遷移數據
echo
echo "開始數據遷移..."
python migrate_to_postgres.py
if [ $? -ne 0 ]; then
    echo "數據遷移失敗！"
    exit 1
fi

# 5. 轉換班表模式
echo
echo "轉換班表模式..."
python convert_patterns.py
if [ $? -ne 0 ]; then
    echo "轉換班表模式失敗，但繼續執行..."
fi

# 6. 驗證遷移結果
echo
echo "驗證遷移結果..."
python check_migration.py
if [ $? -ne 0 ]; then
    echo "驗證過程遇到錯誤，請檢查日誌..."
fi

# 7. 完成
echo
echo "=== 遷移完成 ==="
echo "PostgreSQL連接字串: postgresql://anes_user:anes_password@localhost/anes_db"
echo "請更新你的應用配置以使用PostgreSQL。"
echo
echo "建議備份SQLite數據庫文件:"
echo "cp instance/anes.db instance/anes.db.bak.$(date +%Y%m%d)"
echo

# 詢問是否更新配置
read -p "是否自動更新配置文件以使用PostgreSQL？(y/n): " update_config
if [[ "$update_config" == "y" ]]; then
    if [ -f "backend/config.py" ]; then
        # 備份配置文件
        cp backend/config.py backend/config.py.bak.$(date +%Y%m%d)
        
        # 更新配置
        sed -i.bak 's|SQLALCHEMY_DATABASE_URI = .*|SQLALCHEMY_DATABASE_URI = "postgresql://anes_user:anes_password@localhost/anes_db"|' backend/config.py
        echo "配置已更新！原配置已備份。"
    else
        echo "未找到配置文件 backend/config.py，請手動更新。"
    fi
fi

echo "感謝使用麻醉排班系統資料庫遷移工具！" 