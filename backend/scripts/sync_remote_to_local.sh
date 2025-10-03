#!/bin/bash

# 資料庫同步腳本 - 從遠端同步到本地
# 用途：將遠端 Zeabur 資料庫的資料同步到本地開發資料庫

set -e  # 遇到錯誤立即退出

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 資料庫連線資訊
REMOTE_DB="postgresql://root:SGPdg26Npyc35KtzHoW1x4U0YC7TkL98@hnd1.clusters.zeabur.com:32221/zeabur"
LOCAL_DB="postgresql://anes_user:anes_password@localhost/anes_db"

# 備份檔案名稱（包含時間戳記）
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="backup_remote_${TIMESTAMP}.sql"
BACKUP_DIR="$(dirname "$0")/backups"

# 創建備份目錄
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}================================${NC}"
echo -e "${YELLOW}資料庫同步腳本${NC}"
echo -e "${YELLOW}遠端 → 本地${NC}"
echo -e "${YELLOW}================================${NC}"
echo ""

# 檢查 PostgreSQL 工具是否安裝
if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}錯誤: 找不到 pg_dump 命令${NC}"
    echo -e "${RED}請安裝 PostgreSQL 客戶端工具${NC}"
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo -e "${RED}錯誤: 找不到 psql 命令${NC}"
    echo -e "${RED}請安裝 PostgreSQL 客戶端工具${NC}"
    exit 1
fi

# 確認操作
echo -e "${YELLOW}警告: 此操作會覆蓋本地資料庫的所有資料！${NC}"
echo -e "${YELLOW}本地資料庫: anes_db@localhost${NC}"
echo ""
read -p "確定要繼續嗎? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${RED}操作已取消${NC}"
    exit 1
fi

# 步驟 1: 從遠端資料庫匯出資料
echo -e "${GREEN}[1/4] 正在從遠端資料庫匯出資料...${NC}"
pg_dump "$REMOTE_DB" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --file="$BACKUP_DIR/$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 資料匯出成功: $BACKUP_DIR/$BACKUP_FILE${NC}"
else
    echo -e "${RED}✗ 資料匯出失敗${NC}"
    exit 1
fi

# 步驟 2: 備份本地資料庫（以防萬一）
echo -e "${GREEN}[2/4] 正在備份本地資料庫...${NC}"
LOCAL_BACKUP_FILE="backup_local_before_sync_${TIMESTAMP}.sql"
pg_dump "$LOCAL_DB" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --file="$BACKUP_DIR/$LOCAL_BACKUP_FILE" 2>/dev/null || true

if [ -f "$BACKUP_DIR/$LOCAL_BACKUP_FILE" ]; then
    echo -e "${GREEN}✓ 本地資料庫已備份: $BACKUP_DIR/$LOCAL_BACKUP_FILE${NC}"
else
    echo -e "${YELLOW}! 本地資料庫備份跳過（資料庫可能不存在）${NC}"
fi

# 步驟 3: 刪除本地資料庫的現有資料
echo -e "${GREEN}[3/4] 正在清理本地資料庫...${NC}"
psql "$LOCAL_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null || {
    echo -e "${YELLOW}! 清理失敗，嘗試直接導入${NC}"
}

# 步驟 4: 將資料導入本地資料庫
echo -e "${GREEN}[4/4] 正在導入資料到本地資料庫...${NC}"
psql "$LOCAL_DB" < "$BACKUP_DIR/$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 資料導入成功${NC}"
else
    echo -e "${RED}✗ 資料導入失敗${NC}"
    echo -e "${YELLOW}可以嘗試手動導入: psql $LOCAL_DB < $BACKUP_DIR/$BACKUP_FILE${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}同步完成！${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${GREEN}備份檔案位置:${NC}"
echo -e "  遠端備份: $BACKUP_DIR/$BACKUP_FILE"
if [ -f "$BACKUP_DIR/$LOCAL_BACKUP_FILE" ]; then
    echo -e "  本地備份: $BACKUP_DIR/$LOCAL_BACKUP_FILE"
fi
echo ""
echo -e "${YELLOW}提示: 備份檔案會保留在 $BACKUP_DIR 目錄${NC}"
echo -e "${YELLOW}如需還原，請使用: psql $LOCAL_DB < [備份檔案]${NC}"
