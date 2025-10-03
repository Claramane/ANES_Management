# 實作步驟文件

## 📋 開發步驟總覽

### 階段 1: 專案初始化
### 階段 2: 核心邏輯實作
### 階段 3: 服務整合
### 階段 4: 本地測試
### 階段 5: 部署準備

---

## 階段 1: 專案初始化

### 步驟 1.1: 建立基礎檔案

**檔案清單**：
- [x] `CLAUDE.md` - 專案說明
- [x] `docs/01_ARCHITECTURE.md` - 架構文件
- [ ] `docs/02_IMPLEMENTATION.md` - 本文件
- [ ] `docs/03_DEPLOYMENT.md` - 部署文件
- [ ] `docs/04_TESTING.md` - 測試文件
- [ ] `README.md` - 使用者文件
- [ ] `.gitignore` - Git 忽略配置
- [ ] `.env.example` - 環境變數範本

### 步驟 1.2: 設定 `.gitignore`

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
ENV/

# 環境變數
.env
.env.local

# 同步狀態
sync_state.json

# IDE
.vscode/
.idea/
*.swp
*.swo

# 日誌
*.log
logs/

# OS
.DS_Store
Thumbs.db
```

### 步驟 1.3: 建立環境變數範本

**`.env.example`**:
```bash
# =================================================================
# DB Sync Service 環境變數配置範本
# =================================================================

# ---------------------------------------------------------------
# 資料庫連線 (必須)
# ---------------------------------------------------------------

# 來源資料庫（正式環境 Zeabur）
SOURCE_DB_URL=postgresql://root:YOUR_PASSWORD@hnd1.clusters.zeabur.com:32221/zeabur

# 目標資料庫 - 本地環境
TARGET_LOCAL_URL=postgresql://anes_user:anes_password@localhost:5432/anes_db

# 目標資料庫 - 測試站
TARGET_TEST_URL=postgresql://test_user:test_password@test-host:5432/test_db

# ---------------------------------------------------------------
# 同步設定 (必須)
# ---------------------------------------------------------------

# 要啟用的同步目標（逗號分隔: local, test）
SYNC_TARGETS=local,test

# 同步間隔（分鐘）
SYNC_INTERVAL_MINUTES=10

# ---------------------------------------------------------------
# 進階設定 (可選)
# ---------------------------------------------------------------

# 日誌級別（DEBUG, INFO, WARNING, ERROR）
LOG_LEVEL=INFO

# 啟用健康檢查端點
ENABLE_HEALTH_CHECK=false

# 健康檢查端口（如啟用）
HEALTH_CHECK_PORT=8080

# 批次大小
BATCH_SIZE=1000

# 最大重試次數
MAX_RETRY_ATTEMPTS=3

# 重試延遲（秒）
RETRY_DELAY_SECONDS=60
```

---

## 階段 2: 核心邏輯實作

### 步驟 2.1: 建立配置管理 (`config.py`)

**功能需求**：
- 讀取環境變數
- 驗證必要配置
- 提供配置類別

**實作要點**：
```python
class Config:
    # 必要配置
    SOURCE_DB_URL: str
    SYNC_TARGETS: List[str]

    # 目標資料庫 URLs
    target_urls: Dict[str, str]

    # 同步設定
    SYNC_INTERVAL_MINUTES: int = 10
    BATCH_SIZE: int = 1000

    # 驗證方法
    def validate(self):
        # 檢查必要欄位
        # 檢查資料庫連線
        # 檢查目標配置一致性
```

### 步驟 2.2: 建立同步工作器 (`sync_worker.py`)

**功能需求**：
- 從原專案複製並改造同步邏輯
- 支援多目標同步
- 增量同步判斷
- UPSERT 邏輯實作

**核心類別**：
```python
class SyncWorker:
    def __init__(self, source_url: str, config: Config):
        self.source_url = source_url
        self.config = config

    async def sync_to_target(self, target_name: str, target_url: str):
        """同步到單一目標"""

    async def sync_all_targets(self):
        """同步到所有目標"""

    async def get_incremental_data(self, table: str, last_sync_time):
        """取得增量資料"""

    async def upsert_data(self, table: str, data: List[Dict], target_conn):
        """批次 UPSERT"""
```

**表格同步順序**（硬編碼）:
```python
TABLE_SYNC_ORDER = [
    'users',
    'formula_schedules',
    'monthly_schedules',
    'schedule_versions',
    'schedule_version_diffs',
    'schedule_changes',
    'shift_swap_requests',
    'overtime_records',
    'overtime_points',
    'overtime_monthly_scores',
    'overtime_summaries',
    'announcements',
    'doctor_schedules',
    'day_shift_doctors',
    'doctor_schedule_update_logs',
    'webauthn_credentials',
    'logs'
]
```

**敏感欄位處理**（硬編碼）:
```python
SENSITIVE_FIELDS = {
    'users': ['password'],
    'webauthn_credentials': ['credential_id', 'public_key']
}
```

### 步驟 2.3: 建立同步狀態管理

**狀態文件** (`sync_state.json`):
- 記錄每個表格的最後同步時間
- 記錄同步數量
- 記錄錯誤資訊

**實作方式**:
```python
class SyncStateManager:
    def __init__(self, state_file: str = 'sync_state.json'):
        self.state_file = state_file

    def get_last_sync_time(self, table: str) -> datetime:
        """取得表格最後同步時間"""

    def update_sync_state(self, table: str, sync_time: datetime, count: int):
        """更新同步狀態"""

    def save_state(self):
        """儲存狀態到檔案"""
```

### 步驟 2.4: 建立主服務 (`main.py`)

**功能需求**：
- 服務入口點
- 定時任務排程
- 錯誤處理和日誌
- （可選）健康檢查端點

**服務架構**:
```python
import asyncio
from config import Config
from sync_worker import SyncWorker

async def main():
    # 1. 載入配置
    config = Config.from_env()
    config.validate()

    # 2. 建立同步工作器
    worker = SyncWorker(config.SOURCE_DB_URL, config)

    # 3. 定時執行
    while True:
        try:
            await worker.sync_all_targets()
        except Exception as e:
            logger.error(f"同步失敗: {e}")

        await asyncio.sleep(config.SYNC_INTERVAL_MINUTES * 60)

if __name__ == "__main__":
    asyncio.run(main())
```

---

## 階段 3: 服務整合

### 步驟 3.1: 建立 `requirements.txt`

```txt
# 核心依賴
asyncpg==0.29.0
asyncio-mqtt==0.16.1
python-dotenv==1.0.0

# 可選依賴（健康檢查）
fastapi==0.104.1
uvicorn==0.24.0

# 工具
python-dateutil==2.8.2
```

### 步驟 3.2: 建立 `Dockerfile`

```dockerfile
FROM python:3.9-slim

WORKDIR /app

# 安裝依賴
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 複製代碼
COPY . .

# 啟動服務
CMD ["python", "main.py"]
```

### 步驟 3.3: 建立 `README.md`

**內容大綱**：
1. 專案簡介
2. 功能特性
3. 環境變數設定
4. 本地開發指南
5. Zeabur 部署步驟
6. 監控和維護
7. 故障排除

---

## 階段 4: 本地測試

### 步驟 4.1: 單元測試（可選）

**測試項目**：
- Config 驗證邏輯
- 增量資料查詢
- UPSERT 邏輯
- 狀態管理

### 步驟 4.2: 整合測試

**測試腳本** (`test_sync.py`):
```python
async def test_sync():
    # 1. 測試配置載入
    # 2. 測試資料庫連線
    # 3. 測試同步邏輯
    # 4. 驗證資料一致性
```

**手動測試步驟**:
1. 設定本地 `.env`
2. 執行 `python main.py`
3. 檢查日誌輸出
4. 驗證資料同步結果
5. 檢查 `sync_state.json`

---

## 階段 5: 部署準備

### 步驟 5.1: 清理原有整合

**從主專案移除**：
- [ ] 刪除 `backend/app/tasks/db_sync_tasks.py`
- [ ] 從 `backend/main.py` 移除同步任務整合
- [ ] 保留 `backend/scripts/sync_db_incremental.py`（改為手動工具）

**更新文件**：
- [ ] 更新 `ANES_Management/CLAUDE.md`
- [ ] 更新 `docs/DATABASE_ARCHITECTURE.md`
- [ ] 建立遷移說明文件

### 步驟 5.2: Git 版本控制

```bash
# 初始化 Git（如果是獨立 repo）
git init
git add .
git commit -m "初始化 DB Sync Service"

# 或加入主專案（monorepo）
cd ../
git add db-sync-service/
git commit -m "新增獨立資料庫同步服務"
```

### 步驟 5.3: 部署前檢查清單

- [ ] 所有檔案建立完成
- [ ] 本地測試通過
- [ ] 環境變數範本完整
- [ ] Dockerfile 正確
- [ ] README 文件完整
- [ ] Git 版本控制設定

---

## 📝 開發檢查清單

### 必要檔案
- [x] `CLAUDE.md`
- [ ] `main.py`
- [ ] `sync_worker.py`
- [ ] `config.py`
- [ ] `requirements.txt`
- [ ] `Dockerfile`
- [ ] `.env.example`
- [ ] `.gitignore`
- [ ] `README.md`

### 文件
- [x] `docs/01_ARCHITECTURE.md`
- [x] `docs/02_IMPLEMENTATION.md`
- [ ] `docs/03_DEPLOYMENT.md`
- [ ] `docs/04_TESTING.md`

### 測試
- [ ] 配置驗證測試
- [ ] 資料庫連線測試
- [ ] 同步邏輯測試
- [ ] 整合測試

### 部署
- [ ] 清理舊有整合
- [ ] Git 版本控制
- [ ] Zeabur 部署
- [ ] 環境變數設定
- [ ] 監控設定

---

## 🔄 開發流程

```
1. 確認文件 ✅
   ↓
2. 建立基礎檔案
   ↓
3. 實作核心邏輯
   ↓
4. 本地測試
   ↓
5. 清理舊整合
   ↓
6. 部署到 Zeabur
   ↓
7. 驗證運行
```

---

**文件版本**: v1.0
**最後更新**: 2025-10-03
