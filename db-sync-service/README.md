# DB Sync Service - 資料庫同步服務

> 獨立的 Python 服務，負責將正式環境資料單向同步到測試站和本地環境

## 📚 文件索引

### 開始之前，請先閱讀以下文件：

1. **[CLAUDE.md](CLAUDE.md)** - 專案說明
   - 專案概述
   - 核心功能
   - 專案結構
   - 開發流程

2. **[docs/01_ARCHITECTURE.md](docs/01_ARCHITECTURE.md)** - 架構設計
   - 系統架構圖
   - 資料流向
   - 環境變數設計
   - 安全機制

3. **[docs/02_IMPLEMENTATION.md](docs/02_IMPLEMENTATION.md)** - 實作步驟
   - 開發階段規劃
   - 檔案功能說明
   - 代碼結構設計
   - 開發檢查清單

4. **[docs/03_DEPLOYMENT.md](docs/03_DEPLOYMENT.md)** - 部署流程
   - Zeabur 部署步驟
   - 環境變數設定
   - 監控配置
   - 故障排除

5. **[docs/04_TESTING.md](docs/04_TESTING.md)** - 測試計劃
   - 測試策略
   - 測試案例
   - 驗證步驟
   - 測試檢查清單

## 🎯 專案狀態

### ✅ 已完成
- [x] 專案結構建立
- [x] CLAUDE.md 撰寫
- [x] 完整架構設計
- [x] 實作步驟規劃
- [x] 部署流程文件
- [x] 測試計劃制定
- [x] 核心代碼實作
  - [x] config.py - 環境變數配置管理
  - [x] sync_worker.py - 資料同步邏輯
  - [x] main.py - 服務入口點
- [x] 部署檔案建立
  - [x] requirements.txt
  - [x] Dockerfile
  - [x] .gitignore
  - [x] .env.example

### ⏳ 待進行
- [ ] 本地測試與驗證
- [ ] 部署到 Zeabur
- [ ] 清理舊有整合

## 🎯 部署情境

本服務支援兩種部署方式，請根據您的需求選擇：

### 情境 A: Zeabur 雲端部署（推薦用於測試站自動同步）

**用途**：自動同步正式環境資料到測試站
**運行方式**：持續在 Zeabur 雲端運行
**同步目標**：測試站資料庫

**環境變數配置**：
```bash
SOURCE_DB_URL=postgresql://root:PASSWORD@hnd1.clusters.zeabur.com:32221/zeabur
TARGET_TEST_URL=postgresql://test_user:test_password@test-host:5432/test_db
SYNC_TARGETS=test
SYNC_INTERVAL_MINUTES=10
```

**⚠️ 重要限制**：
- ❌ 無法同步到 `localhost`（本機資料庫）
- ❌ 不要在 Zeabur 設定 `TARGET_LOCAL_URL`
- ✅ 只能同步到有公網 IP 或內網可達的資料庫

### 情境 B: 本機執行（推薦用於本地開發）

**用途**：手動同步正式環境資料到本機資料庫
**運行方式**：需要時手動執行
**同步目標**：本機 localhost 資料庫

**環境變數配置**：
```bash
SOURCE_DB_URL=postgresql://root:PASSWORD@hnd1.clusters.zeabur.com:32221/zeabur
TARGET_LOCAL_URL=postgresql://anes_user:YOUR_PASSWORD@localhost:5432/anes_db
SYNC_TARGETS=local
SYNC_INTERVAL_MINUTES=10
```

**使用時機**：
- ✅ 本地開發需要最新資料
- ✅ 測試新功能前同步資料
- ✅ 排查問題需要複製正式環境資料

---

## 🚀 快速開始

### 步驟 1: 建立環境變數檔案
```bash
# 複製範本
cp .env.example .env

# 編輯 .env 填入實際連線資訊
vi .env
```

### 步驟 2: 安裝依賴
```bash
# 建立虛擬環境
python -m venv venv
source venv/bin/activate  # Linux/macOS
# 或 venv\Scripts\activate  # Windows

# 安裝依賴
pip install -r requirements.txt
```

### 步驟 3: 本地測試
```bash
# 執行同步服務
python main.py

# 查看日誌輸出，確認同步正常
```

### 步驟 4: Docker 測試（可選）
```bash
# 建置映像
docker build -t db-sync-service .

# 執行容器
docker run --env-file .env db-sync-service
```

### 步驟 5: 部署到 Zeabur
參考 `docs/03_DEPLOYMENT.md` 詳細部署步驟

## 📋 核心功能

- **單向同步**: 正式環境 → 測試站 + 本地環境
- **自動執行**: 定期背景運行（每 10 分鐘）
- **多目標支援**: 可同時同步到多個環境
- **增量同步**: 只同步變更資料
- **環境變數驅動**: 所有配置通過環境變數控制

## 🔐 安全機制

- ✅ 單向同步保護
- ✅ 敏感資料排除
- ✅ SSL 連線支援
- ✅ 環境變數安全管理

## 📊 專案結構

```
db-sync-service/
├── main.py                 # 服務入口 ✅
├── sync_worker.py          # 同步邏輯 ✅
├── config.py               # 配置管理 ✅
├── requirements.txt        # 依賴套件 ✅
├── Dockerfile              # 容器化 ✅
├── .env.example            # 環境變數範本 ✅
├── .gitignore              # Git 忽略 ✅
├── CLAUDE.md               # 專案說明 ✅
├── README.md               # 本文件 ✅
└── docs/                   # 文件資料夾 ✅
    ├── 01_ARCHITECTURE.md  # 架構設計 ✅
    ├── 02_IMPLEMENTATION.md # 實作步驟 ✅
    ├── 03_DEPLOYMENT.md    # 部署流程 ✅
    └── 04_TESTING.md       # 測試計劃 ✅
```

## 🔗 相關專案

- **主專案**: `../backend/` 和 `../frontend/`
- **原同步邏輯**: `../backend/scripts/sync_db_incremental.py`
- **主專案文件**: `../docs/`

## ⚠️ 重要提醒

1. **環境變數安全**: 不要將 .env 檔案提交到 Git
2. **完整測試**: 部署前務必進行本地測試
3. **獨立部署**: 在 Zeabur 獨立專案部署
4. **清理整合**: 部署後清理主專案的舊有整合

## 📞 下一步

**當前已完成核心代碼實作，接下來：**

1. ⏳ **本地測試** - 建立 .env 並測試同步功能
2. ⏳ **驗證功能** - 確認所有表格同步正常
3. ⏳ **部署上線** - 部署到 Zeabur 獨立專案
4. ⏳ **清理舊系統** - 移除主專案中的同步整合

**需要協助請參考 `docs/` 中的詳細文件！**

---

**建立日期**: 2025-10-03
**最後更新**: 2025-10-03
**專案狀態**: ✅ 代碼實作完成，待測試部署
