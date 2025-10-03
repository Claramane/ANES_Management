#!/bin/bash

# 使用 Docker PostgreSQL 客戶端進行同步
# 解決版本不匹配問題

set -e

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 資料庫連線資訊
REMOTE_DB="postgresql://root:SGPdg26Npyc35KtzHoW1x4U0YC7TkL98@hnd1.clusters.zeabur.com:32221/zeabur"
LOCAL_DB="postgresql://anes_user:anes_password@host.docker.internal/anes_db"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="backup_remote_${TIMESTAMP}.sql"
BACKUP_DIR="$(dirname "$0")/backups"

mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}================================${NC}"
echo -e "${YELLOW}資料庫同步腳本 (Docker版本)${NC}"
echo -e "${YELLOW}遠端 → 本地${NC}"
echo -e "${YELLOW}================================${NC}"
echo ""

# 檢查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}錯誤: 找不到 Docker${NC}"
    echo -e "${RED}請安裝 Docker 或使用 Python 腳本${NC}"
    exit 1
fi

echo -e "${YELLOW}警告: 此操作會覆蓋本地資料庫的所有資料！${NC}"
echo ""
read -p "確定要繼續嗎? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${RED}操作已取消${NC}"
    exit 1
fi

# 使用 Docker PostgreSQL 17
DOCKER_IMAGE="postgres:17"

echo -e "${GREEN}[1/3] 正在從遠端資料庫匯出資料...${NC}"
docker run --rm \
    -v "$BACKUP_DIR:/backup" \
    "$DOCKER_IMAGE" \
    pg_dump "$REMOTE_DB" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --file="/backup/$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 資料匯出成功${NC}"
else
    echo -e "${RED}✗ 資料匯出失敗${NC}"
    exit 1
fi

echo -e "${GREEN}[2/3] 正在清理本地資料庫...${NC}"
docker run --rm \
    "$DOCKER_IMAGE" \
    psql "$LOCAL_DB" \
    -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null || true

echo -e "${GREEN}[3/3] 正在導入資料到本地資料庫...${NC}"
docker run --rm \
    -v "$BACKUP_DIR:/backup" \
    "$DOCKER_IMAGE" \
    psql "$LOCAL_DB" < "/backup/$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 資料導入成功${NC}"
else
    echo -e "${RED}✗ 資料導入失敗${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}同步完成！${NC}"
echo -e "${GREEN}================================${NC}"
