#!/bin/bash

echo "===== 護理班表管理系統前端開發模式啟動腳本 ====="
echo ""

# 設置變量
FRONTEND_DIR="frontend"

# 顯示目前工作目錄
CURRENT_DIR=$(pwd)
echo "目前工作目錄: $CURRENT_DIR"
echo ""

# 檢查前端目錄存在
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "錯誤: 找不到前端目錄 ($FRONTEND_DIR)"
    exit 1
fi

# 設置前端
echo "===== 設置前端 ====="
cd "$FRONTEND_DIR"

echo "安裝前端依賴..."
npm install || {
    echo "前端依賴安裝失敗，可能需要手動解決問題。"
    echo "請嘗試進入 frontend 目錄，運行 npm install 檢查具體錯誤。"
}

echo ""
echo "===== 啟動前端服務 ====="
echo "前端服務將在 http://localhost:3000 運行"
echo "確保後端服務已啟動在 http://localhost:8000"
echo ""

echo "正在啟動前端..."
npm start 