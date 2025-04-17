#!/bin/bash

# 確保腳本在錯誤時停止執行
set -e

# 獲取腳本所在目錄的絕對路徑
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# 回到項目根目錄
cd "$SCRIPT_DIR/.."

# 檢查 Python 是否可用
if ! command -v python3 &> /dev/null
then
    echo "Python3 未安裝，請先安裝 Python3。"
    exit 1
fi

# 檢查虛擬環境是否存在
if [ -d "venv" ] || [ -d ".venv" ]; then
    # 激活虛擬環境
    if [ -d "venv" ]; then
        source venv/bin/activate
    else
        source .venv/bin/activate
    fi
    echo "已激活虛擬環境。"
else
    echo "警告：未找到虛擬環境，直接使用系統 Python。"
fi

# 執行日誌重置腳本
echo "執行日誌重置腳本..."
python3 "$SCRIPT_DIR/reset_logs.py"

# 腳本執行完後提示
echo "腳本執行完成。"

# 如果激活了虛擬環境，則退出
if [ -n "$VIRTUAL_ENV" ]; then
    deactivate
    echo "已退出虛擬環境。"
fi 