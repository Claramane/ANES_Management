#!/bin/bash

echo "===== 護理班表管理系統後端開發模式啟動腳本 ====="
echo ""

# 設置變量
BACKEND_DIR="backend"

# 檢查 Python 命令
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "錯誤: 找不到 python 或 python3 命令。請確保已安裝 Python。"
    exit 1
fi

# 檢查 pip 命令
if command -v pip3 &> /dev/null; then
    PIP_CMD="pip3"
elif command -v pip &> /dev/null; then
    PIP_CMD="pip"
else
    echo "錯誤: 找不到 pip 或 pip3 命令。請確保已安裝 pip。"
    exit 1
fi

echo "使用 Python 命令: $PYTHON_CMD"
echo "使用 Pip 命令: $PIP_CMD"
echo ""

# 顯示目前工作目錄
CURRENT_DIR=$(pwd)
echo "目前工作目錄: $CURRENT_DIR"
echo ""

# 檢查後端目錄存在
if [ ! -d "$BACKEND_DIR" ]; then
    echo "錯誤: 找不到後端目錄 ($BACKEND_DIR)"
    exit 1
fi

# 設置後端
echo "===== 設置後端 ====="
cd "$BACKEND_DIR"

echo "安裝後端依賴..."
# 確保pydantic相關依賴正確安裝
echo "確保 Pydantic 相關依賴版本一致..."
$PIP_CMD uninstall -y pydantic pydantic-settings >/dev/null 2>&1
$PIP_CMD install -r requirements.txt

# 檢查.env文件是否存在
if [ ! -f ".env" ]; then
    echo "創建.env文件..."
    cp .env.example .env
    echo ".env文件已創建，請根據需要修改配置。"
else
    echo ".env文件已存在，確保其中的值格式正確..."
    # 確保DEBUG值正確
    if grep -q "DEBUG=True" .env; then
        echo "DEBUG=True 格式正確."
    elif grep -q "DEBUG=" .env; then
        echo "更新 DEBUG 設定..."
        sed -i '' 's/DEBUG=.*/DEBUG=True/g' .env
    else
        echo "添加 DEBUG 設定..."
        echo "DEBUG=True" >> .env
    fi
fi

# 初始化數據庫
echo "初始化數據庫..."
$PYTHON_CMD init_db.py || {
    echo "數據庫初始化失敗，可能需要手動解決問題。"
    echo "請嘗試進入 backend 目錄，運行 $PYTHON_CMD init_db.py 檢查具體錯誤。"
}

echo ""
echo "===== 啟動後端服務 ====="
echo "後端服務將在 http://localhost:8000 運行"
echo ""

echo "正在啟動後端..."
$PYTHON_CMD run.py 