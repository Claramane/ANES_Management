# 部署流程文件

## 🚀 Zeabur 部署步驟

### 前置準備

**確認事項**：
- ✅ 所有代碼已實作並測試通過
- ✅ `.env.example` 已建立
- ✅ `Dockerfile` 已建立
- ✅ `requirements.txt` 已完成
- ✅ Git 版本控制已設定

---

## 部署流程

### 步驟 1: 建立 Zeabur 專案

1. **登入 Zeabur**
   - 前往 https://zeabur.com
   - 登入您的帳號

2. **建立新專案**
   - 點擊「Create Project」
   - 專案名稱：`db-sync-service`
   - 區域：選擇與正式環境相同（如 Japan - Tokyo）

3. **新增服務**
   - 選擇「Git Repository」
   - 連接您的 Git repository

### 步驟 2: 連接 Git Repository

**方案 A: 獨立 Repository（推薦）**
```bash
# 建立獨立 Git repo
cd db-sync-service
git init
git remote add origin https://github.com/YOUR_USERNAME/db-sync-service.git
git add .
git commit -m "Initial commit"
git push -u origin main
```

**方案 B: Monorepo 子目錄**
```bash
# 在主專案中
git add db-sync-service/
git commit -m "新增資料庫同步服務"
git push
```

Zeabur 設定：
- Root Directory: `db-sync-service/`（如果是 monorepo）

### 步驟 3: 設定環境變數

在 Zeabur 專案設定中，新增以下環境變數：

#### 必要環境變數

**⚠️ 重要提醒**：Zeabur 部署時**無法連接到 localhost**，請勿設定 `TARGET_LOCAL_URL`

```bash
# 來源資料庫（正式環境）
SOURCE_DB_URL=postgresql://root:SGPdg26Npyc35KtzHoW1x4U0YC7TkL98@hnd1.clusters.zeabur.com:32221/zeabur

# 目標資料庫 - 測試站（必須有公網 IP 或 Zeabur 內網可達）
TARGET_TEST_URL=postgresql://test_user:test_password@test-host:5432/test_db

# 同步設定
SYNC_TARGETS=test  # 只同步到測試站，不要設為 "local"
SYNC_INTERVAL_MINUTES=10
```

#### ❌ 錯誤配置範例（不要這樣設定）

```bash
# ❌ 錯誤：Zeabur 無法連接到 localhost
TARGET_LOCAL_URL=postgresql://anes_user:anes_password@localhost:5432/anes_db
SYNC_TARGETS=local,test  # ❌ 包含 local 會失敗

# ✅ 正確：只同步到測試站
SYNC_TARGETS=test
```

#### 本機同步說明

如需同步到本機資料庫：
1. 在本機執行服務（不要部署到 Zeabur）
2. 設定本機 `.env` 檔案：
   ```bash
   SOURCE_DB_URL=postgresql://root:PASSWORD@hnd1.clusters.zeabur.com:32221/zeabur
   TARGET_LOCAL_URL=postgresql://anes_user:anes_password@localhost:5432/anes_db
   SYNC_TARGETS=local
   ```
3. 本機執行：`python main.py`

#### 進階環境變數（可選）

```bash
LOG_LEVEL=INFO
BATCH_SIZE=1000
MAX_RETRY_ATTEMPTS=3
RETRY_DELAY_SECONDS=60
```

### 步驟 4: 部署服務

1. **觸發部署**
   - Zeabur 會自動偵測 `Dockerfile`
   - 開始建置 Docker 映像
   - 部署到 Zeabur 平台

2. **查看建置日誌**
   - 檢查建置過程
   - 確認無錯誤訊息

3. **啟動服務**
   - 服務自動啟動
   - 開始執行同步任務

### 步驟 5: 驗證部署

1. **檢查日誌**
   ```
   [INFO] 開始執行資料庫同步
   [INFO] 同步表格: users
   [INFO] 同步完成: 總共 XXX 筆記錄
   ```

2. **驗證資料**
   - 連接測試站資料庫
   - 檢查資料是否同步成功
   - 比對資料數量

3. **檢查同步狀態**
   - 查看 `sync_state.json`（透過日誌）
   - 確認最後同步時間

---

## 🔐 安全性設定

### 環境變數安全

**⚠️ 重要**：
- ❌ 不要將 `.env` 加入 Git
- ❌ 不要在代碼中硬編碼密碼
- ✅ 使用 Zeabur 環境變數功能
- ✅ 定期更新資料庫密碼

### 資料庫連線安全

```bash
# 建議使用 SSL 連線
SOURCE_DB_URL=postgresql://user:pass@host:port/db?sslmode=require

# 測試站也應使用 SSL
TARGET_TEST_URL=postgresql://user:pass@host:port/db?sslmode=require
```

### IP 白名單

如果資料庫有 IP 限制：
1. 取得 Zeabur 服務的 IP
2. 將 IP 加入資料庫白名單

---

## 📊 監控設定

### Zeabur 日誌監控

**查看即時日誌**：
1. 進入 Zeabur 專案
2. 選擇服務
3. 點擊「Logs」頁籤
4. 即時查看同步日誌

**日誌級別**：
- `DEBUG`: 詳細除錯資訊
- `INFO`: 一般同步資訊（推薦）
- `WARNING`: 警告訊息
- `ERROR`: 錯誤訊息

### 同步狀態追蹤

**透過日誌查看狀態**：
```bash
# 查看最近的同步記錄
grep "同步完成" logs | tail -10

# 查看錯誤記錄
grep "ERROR" logs | tail -20
```

### 告警設定（可選）

如果 Zeabur 支援告警：
1. 設定錯誤告警
2. 設定服務停止告警
3. 設定通知方式（Email/Slack）

---

## 🔄 更新部署

### 代碼更新流程

1. **本地修改**
   ```bash
   # 修改代碼
   vim sync_worker.py

   # 測試
   python main.py

   # 提交
   git add .
   git commit -m "優化同步邏輯"
   git push
   ```

2. **Zeabur 自動部署**
   - Zeabur 偵測到 Git 更新
   - 自動重新建置
   - 自動部署新版本

3. **驗證更新**
   - 檢查新版本日誌
   - 確認功能正常

### 環境變數更新

1. 在 Zeabur 介面修改環境變數
2. 重新啟動服務
3. 驗證新配置生效

---

## ⚙️ 服務管理

### 啟動/停止服務

**Zeabur 介面**：
- Stop Service: 停止服務
- Start Service: 啟動服務
- Restart Service: 重新啟動

**適用時機**：
- 環境變數更新後重啟
- 錯誤恢復時重啟
- 維護時暫停

### 擴展資源（如需要）

如果同步效能不足：
1. 升級 Zeabur Plan
2. 增加 CPU/Memory
3. 調整 `BATCH_SIZE` 參數

### 服務降級

如遇問題需要暫停同步：
1. 停止 Zeabur 服務
2. 或設定 `SYNC_INTERVAL_MINUTES=999999`（實質暫停）
3. 排查問題
4. 恢復服務

---

## 🧪 健康檢查（可選功能）

### 啟用健康檢查

**環境變數**：
```bash
ENABLE_HEALTH_CHECK=true
HEALTH_CHECK_PORT=8080
```

**程式碼實作**（在 `main.py`）：
```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "last_sync": get_last_sync_time(),
        "targets": config.SYNC_TARGETS
    }

# 在背景執行同步，前景提供健康檢查
```

**Zeabur 設定**：
- Health Check Path: `/health`
- Port: 8080

---

## 📋 部署檢查清單

### 部署前
- [ ] 代碼已完成並測試
- [ ] Dockerfile 已建立
- [ ] requirements.txt 已完成
- [ ] .env.example 已建立
- [ ] README.md 已撰寫
- [ ] Git repository 已設定

### Zeabur 設定
- [ ] 建立新專案
- [ ] 連接 Git repository
- [ ] 設定所有環境變數
- [ ] 確認 Root Directory（如 monorepo）
- [ ] 觸發部署

### 部署後
- [ ] 檢查建置日誌
- [ ] 檢查執行日誌
- [ ] 驗證資料同步
- [ ] 設定監控告警
- [ ] 記錄服務 URL

### 清理舊系統
- [ ] 移除 `backend/app/tasks/db_sync_tasks.py`
- [ ] 從 `backend/main.py` 移除同步整合
- [ ] 更新主專案文件
- [ ] 提交變更到 Git

---

## 🐛 故障排除

### 問題 1: 建置失敗

**現象**: Zeabur 建置過程失敗

**排查**:
```bash
# 檢查 Dockerfile
# 檢查 requirements.txt 依賴
# 檢查 Python 版本相容性
```

**解決**:
- 修正 Dockerfile 設定
- 更新依賴版本
- 重新觸發建置

### 問題 2: 服務啟動失敗

**現象**: 服務部署後立即停止

**排查**:
- 檢查環境變數是否完整
- 檢查資料庫連線是否正確
- 查看啟動日誌錯誤訊息

**解決**:
- 補齊缺少的環境變數
- 修正資料庫連線字串
- 確認網路連通性

### 問題 3: 同步失敗

**現象**: 服務運行但同步失敗

**排查**:
- 檢查來源資料庫連線
- 檢查目標資料庫連線
- 檢查表格結構是否一致

**解決**:
- 修正資料庫連線
- 同步表格結構
- 檢查外鍵約束

### 問題 4: 網路連通性

**現象**: 無法連接資料庫

**檢查**:
```bash
# 測試連線（在 Zeabur logs）
psql $SOURCE_DB_URL -c "SELECT 1"
psql $TARGET_TEST_URL -c "SELECT 1"
```

**解決**:
- 確認防火牆設定
- 確認 IP 白名單
- 確認 SSL 設定

---

## 📚 相關資源

**Zeabur 文件**:
- https://zeabur.com/docs
- https://zeabur.com/docs/deploy/dockerfile

**監控工具**:
- Zeabur Logs
- (可選) 外部監控服務

**緊急聯絡**:
- Zeabur Support
- 團隊技術負責人

---

**文件版本**: v1.0
**最後更新**: 2025-10-03
