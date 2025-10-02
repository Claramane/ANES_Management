# Zeabur 環境變數配置文件

## 版本資訊
**最後更新**: 2025-10-02

## 目錄
1. [環境架構總覽](#環境架構總覽)
2. [正式環境配置](#正式環境配置)
3. [測試環境配置](#測試環境配置)
4. [部署步驟](#部署步驟)
5. [常見問題](#常見問題)

---

## 環境架構總覽

### 🟢 正式環境（main 分支）

| 服務 | Zeabur 服務名稱 | URL | 分支 |
|-----|---------------|-----|------|
| 前端 | `anes-frontend` | https://eckanesmanagement.zeabur.app | main |
| 後端 | `anes-backend` | https://anesmanagementbackend.zeabur.app | main |
| 資料庫 | `anes-db` | 內部連接 | - |

### 🔵 測試環境（develop 分支）

| 服務 | Zeabur 服務名稱 | URL | 分支 |
|-----|---------------|-----|------|
| 前端 | `anes-frontend-dev` | https://dev-eckanesmanagement.zeabur.app | develop |
| 後端 | `anes-backend-dev` | https://dev-anesmanagementbackend.zeabur.app | develop |
| 資料庫 | `anes-db-dev` | 內部連接 | - |

---

## 正式環境配置

### 前端環境變數 (`anes-frontend`)

```bash
# API 連接
REACT_APP_API_BASE_URL=https://anesmanagementbackend.zeabur.app/api

# 醫師員工對應表
REACT_APP_DOCTOR_EMPLOYEE_MAPPING=[{"name":"林怡芸","employee_id":"01757"},{"name":"游雅盛","employee_id":"01221"},{"name":"陳燁晨","employee_id":"02003"},{"name":"顏任軒","employee_id":"02002"},{"name":"吳佩諭","employee_id":"01161"},{"name":"史若蘭","employee_id":"00013"},{"name":"陳品臣","employee_id":"02106"},{"name":"陳柏羽","employee_id":"02109"},{"name":"陳建榮","employee_id":"01951"},{"name":"范守仁","employee_id":"01959"}]

# Zeabur 設定
PORT=${WEB_PORT}
```

### 後端環境變數 (`anes-backend`)

```bash
# 應用基本設定
APP_NAME=護理班表管理系統
IS_PRODUCTION=true
DEBUG=false
PORT=${WEB_PORT}

# 安全設定
SECRET_KEY=<請在 Zeabur 設定，不要寫死>
ALGORITHM=HS256
PASSWORD=${POSTGRES_PASSWORD}
ACCESS_TOKEN_EXPIRE_MINUTES=480

# 域名與信任設定
TRUSTED_HOSTS=anesmanagementbackend.zeabur.app,eckanesmanagement.zeabur.app
FRONTEND_ORIGIN=https://eckanesmanagement.zeabur.app
HTTPS_ONLY=true

# CORS 設定
BACKEND_CORS_ORIGINS=["https://eckanesmanagement.zeabur.app"]

# WebAuthn 設定
WEBAUTHN_EXPECTED_ORIGIN=https://eckanesmanagement.zeabur.app
WEBAUTHN_RP_ID=eckanesmanagement.zeabur.app

# 資料庫連接
DATABASE_URL=${POSTGRES_CONNECTION_STRING}

# 外部 API
EXTERNAL_API_BASE=https://docdutyapi.zeabur.app
```

---

## 測試環境配置

### 前端環境變數 (`anes-frontend-dev`)

```bash
# API 連接
REACT_APP_API_BASE_URL=https://dev-anesmanagementbackend.zeabur.app/api

# 醫師員工對應表（與正式環境相同）
REACT_APP_DOCTOR_EMPLOYEE_MAPPING=[{"name":"林怡芸","employee_id":"01757"},{"name":"游雅盛","employee_id":"01221"},{"name":"陳燁晨","employee_id":"02003"},{"name":"顏任軒","employee_id":"02002"},{"name":"吳佩諭","employee_id":"01161"},{"name":"史若蘭","employee_id":"00013"},{"name":"陳品臣","employee_id":"02106"},{"name":"陳柏羽","employee_id":"02109"},{"name":"陳建榮","employee_id":"01951"},{"name":"范守仁","employee_id":"01959"}]

# Zeabur 設定
PORT=${WEB_PORT}
```

### 後端環境變數 (`anes-backend-dev`)

```bash
# 應用基本設定
APP_NAME=護理班表管理系統（測試）
IS_PRODUCTION=false
DEBUG=true
PORT=${WEB_PORT}

# 安全設定
SECRET_KEY=<請在 Zeabur 設定，可與正式環境不同>
ALGORITHM=HS256
PASSWORD=${POSTGRES_PASSWORD}
ACCESS_TOKEN_EXPIRE_MINUTES=480

# 域名與信任設定
TRUSTED_HOSTS=dev-anesmanagementbackend.zeabur.app,anesmanagementbackenddev.zeabur.app,dev-eckanesmanagement.zeabur.app
FRONTEND_ORIGIN=https://dev-eckanesmanagement.zeabur.app
HTTPS_ONLY=true

# CORS 設定
BACKEND_CORS_ORIGINS=["https://dev-eckanesmanagement.zeabur.app"]

# WebAuthn 設定
WEBAUTHN_EXPECTED_ORIGIN=https://dev-eckanesmanagement.zeabur.app
WEBAUTHN_RP_ID=dev-eckanesmanagement.zeabur.app

# 資料庫連接
DATABASE_URL=${POSTGRES_CONNECTION_STRING}

# 外部 API
EXTERNAL_API_BASE=https://docdutyapi.zeabur.app
```

---

## 部署步驟

### 1. 建立測試前端服務

1. Zeabur Dashboard → **Add Service** → **Git Repository**
2. 選擇 Repository: `Claramane/ANES_Management`
3. **Branch**: `develop` ⚠️ 重要
4. **Root Directory**: `frontend`
5. Service Name: `anes-frontend-dev`
6. 設定環境變數（見上方測試環境配置）
7. 設定域名：`dev-eckanesmanagement`

### 2. 建立測試後端服務

1. Zeabur Dashboard → **Add Service** → **Git Repository**
2. 選擇 Repository: `Claramane/ANES_Management`
3. **Branch**: `develop` ⚠️ 重要
4. **Root Directory**: `backend`
5. Service Name: `anes-backend-dev`
6. 設定環境變數（見上方測試環境配置）
7. 設定域名：`dev-anesmanagementbackend`

### 3. 建立測試資料庫

1. Zeabur Dashboard → **Add Service** → **Marketplace**
2. 選擇 **PostgreSQL**
3. Service Name: `anes-db-dev`
4. Zeabur 會自動提供 `${POSTGRES_CONNECTION_STRING}` 環境變數

### 4. 初始化測試資料庫

**方法 A：本機執行初始化腳本**

```bash
# 設定測試資料庫 URL
export DATABASE_URL=<Zeabur 測試資料庫 URL>

# 執行初始化
cd backend
python init_db.py
python migrations/initial_data.py
```

**方法 B：使用 Zeabur CLI**

```bash
# 連接到測試後端容器
zeabur exec anes-backend-dev -- python init_db.py
zeabur exec anes-backend-dev -- python migrations/initial_data.py
```

### 5. 驗證部署

1. **測試前端**: 訪問 https://dev-eckanesmanagement.zeabur.app
2. **測試後端 API**: 訪問 https://dev-anesmanagementbackend.zeabur.app/api/docs
3. **測試登入**: 使用測試帳號登入
4. **測試功能**: 驗證主要功能正常運作

---

## 自動部署設定

### GitHub Actions 自動部署（可選）

Zeabur 預設會自動監聽分支變更：

```
✅ main 分支推送 → 自動部署到正式環境
✅ develop 分支推送 → 自動部署到測試環境
```

如需手動觸發部署：
1. 進入 Zeabur 服務頁面
2. 點擊 **Redeploy** 按鈕

---

## 常見問題

### Q1: 如何區分正式和測試環境？

**A**: 透過環境變數判斷：

- 正式環境：`IS_PRODUCTION=true`, `DEBUG=false`
- 測試環境：`IS_PRODUCTION=false`, `DEBUG=true`

### Q2: 測試資料庫會影響正式資料庫嗎？

**A**: 不會。測試環境使用獨立的資料庫服務 (`anes-db-dev`)，與正式資料庫 (`anes-db`) 完全隔離。

### Q3: 如何更新環境變數？

**A**:

1. 進入 Zeabur 服務頁面
2. 點擊 **Variables** 頁籤
3. 修改變數值
4. 點擊 **Redeploy** 使變更生效

### Q4: 如何重置測試環境？

**A**:

```bash
# 方法 1: 刪除並重新建立測試資料庫服務
# 方法 2: 執行資料庫重置腳本
export DATABASE_URL=<測試資料庫 URL>
cd backend
python init_db.py  # 重新建立表格
python migrations/initial_data.py  # 填充初始資料
```

### Q5: 成本控制建議

**A**:

1. **使用較小規格** - 測試環境可以用較小的 instance
2. **暫停服務** - 不測試時可以暫停測試服務
3. **定期清理** - 刪除不需要的測試資料

### Q6: 如何查看測試環境日誌？

**A**:

1. Zeabur Dashboard → 選擇測試服務
2. 點擊 **Logs** 頁籤
3. 即時查看應用程式日誌

---

## 環境變數安全性提醒

### ⚠️ 絕對不要在代碼中寫死：

- ❌ `SECRET_KEY`
- ❌ `PASSWORD`
- ❌ 資料庫密碼
- ❌ API 金鑰

### ✅ 正確做法：

1. 在 Zeabur Dashboard 設定環境變數
2. 使用 `${變數名稱}` 引用 Zeabur 提供的變數
3. 敏感資訊使用 Zeabur 的 Secret 功能

---

## 相關文件

- `docs/GIT_WORKFLOW.md` - Git 分支管理與工作流程規範
- `docs/DATABASE_ARCHITECTURE.md` - 資料庫架構文件
- `docs/SECURITY.md` - 安全性指南
- `CLAUDE.md` - 專案開發指南

---

**維護提醒**: 本文件應隨著部署環境變更而更新。如有新的環境變數或配置變更，請及時反映到此文件中。
