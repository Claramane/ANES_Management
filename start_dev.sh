#!/bin/bash

echo "===== 護理班表管理系統開發模式啟動腳本 ====="
echo ""

# 設置變量
BACKEND_DIR="backend"
FRONTEND_DIR="frontend"

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

# 檢查前端目錄存在
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "錯誤: 找不到前端目錄 ($FRONTEND_DIR)"
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

# 返回主目錄
cd ..
echo ""

# 設置前端
echo "===== 設置前端 ====="
cd "$FRONTEND_DIR"

echo "安裝前端依賴..."
npm install || {
    echo "前端依賴安裝失敗，可能需要手動解決問題。"
    echo "請嘗試進入 frontend 目錄，運行 npm install 檢查具體錯誤。"
}
cd ..
echo ""

# 啟動服務
echo "===== 啟動服務指南 ====="
echo "後端服務將在 http://localhost:8000 運行"
echo "前端服務將在 http://localhost:3000 運行"
echo ""

echo "默認帳號:"
echo "護理長: admin / changeme"
echo "護理師: nurse / password"
echo ""

# 使用選項啟動
echo "請選擇啟動模式:"
echo "1) 僅啟動後端"
echo "2) 僅啟動前端"
echo "3) 顯示分別啟動前端和後端的指令"
read -p "請輸入選項 (1-3): " option

case $option in
    1)
        echo "正在啟動後端..."
        cd "$BACKEND_DIR"
        $PYTHON_CMD run.py
        ;;
    2)
        echo "正在啟動前端..."
        cd "$FRONTEND_DIR"
        npm start
        ;;
    3)
        echo "===== 分別啟動前端和後端的指令 ====="
        echo "1. 在一個終端窗口中，請運行以下命令啟動後端:"
        echo "   cd $CURRENT_DIR/$BACKEND_DIR && $PYTHON_CMD run.py"
        echo ""
        echo "2. 在另一個終端窗口中，請運行以下命令啟動前端:"
        echo "   cd $CURRENT_DIR/$FRONTEND_DIR && npm start"
        echo ""
        echo "請分別在兩個不同的終端窗口執行上述命令。"
        echo "按下 Ctrl+C 可以停止各自的服務。"
        ;;
    *)
        echo "無效選項，請重新運行腳本並選擇 1-3"
        exit 1
        ;;
esac 