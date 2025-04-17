#!/bin/bash
# 執行排班表版本差異功能的資料庫遷移

echo "=== 執行排班表版本差異功能的資料庫遷移 ==="
echo

# 檢查 Python 是否可用
command -v python3 >/dev/null 2>&1 || { echo "未找到 Python3，請安裝後再試"; exit 1; }

# 執行遷移腳本
echo "正在執行資料庫遷移..."
python3 backend/migrations/add_version_diff_table.py

# 檢查執行結果
if [ $? -eq 0 ]; then
    echo
    echo "=== 遷移完成 ==="
    echo "排班表版本差異功能已成功安裝"
    echo
    echo "請參考 VERSION_MANAGEMENT.md 文檔了解如何使用此功能"
else
    echo
    echo "=== 遷移失敗 ==="
    echo "請檢查錯誤訊息並解決問題後再試"
fi

echo 