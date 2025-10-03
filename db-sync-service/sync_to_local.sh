#!/bin/bash

# ============================================================================
# 本機資料庫同步便捷腳本
# ============================================================================
#
# 用途：快速啟動本機資料庫同步服務
# 使用方式：
#   chmod +x sync_to_local.sh
#   ./sync_to_local.sh
#
# 功能：
#   1. 自動進入專案目錄
#   2. 啟動 Python 虛擬環境
#   3. 執行同步服務
#   4. Ctrl+C 可隨時停止
# ============================================================================

# 顏色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 專案目錄
PROJECT_DIR="/Users/jasmac/Documents/ANES_Management/db-sync-service"

echo -e "${GREEN}🚀 啟動本機資料庫同步服務${NC}"
echo ""

# 檢查專案目錄
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ 錯誤：找不到專案目錄 $PROJECT_DIR${NC}"
    exit 1
fi

cd "$PROJECT_DIR"

# 檢查 .env 檔案
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  警告：找不到 .env 檔案${NC}"
    echo -e "${YELLOW}   請先執行：cp .env.example .env${NC}"
    echo -e "${YELLOW}   並編輯 .env 填入正確的資料庫連線資訊${NC}"
    exit 1
fi

# 檢查虛擬環境
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}⚠️  虛擬環境不存在，正在建立...${NC}"
    python3 -m venv venv

    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 建立虛擬環境失敗${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ 虛擬環境建立成功${NC}"
    echo ""
fi

# 啟動虛擬環境
echo -e "${GREEN}📦 啟動虛擬環境...${NC}"
source venv/bin/activate

# 檢查依賴
if ! python -c "import asyncpg" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  缺少依賴套件，正在安裝...${NC}"
    pip install -r requirements.txt

    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 安裝依賴失敗${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ 依賴安裝完成${NC}"
    echo ""
fi

# 執行同步服務
echo -e "${GREEN}🔄 開始執行資料庫同步...${NC}"
echo -e "${YELLOW}💡 提示：按 Ctrl+C 可隨時停止服務${NC}"
echo ""

python main.py

# 執行結束
echo ""
echo -e "${GREEN}👋 同步服務已停止${NC}"
