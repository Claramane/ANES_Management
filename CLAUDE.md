# CLAUDE.md

本文件為 Claude Code (claude.ai/code) 在此儲存庫工作時提供指導。

> **📁 重要文件位置提醒**: 本文件中提到的其他重要文件（如 `DATABASE_ARCHITECTURE.md`、`ROUND_ALLOCATION_LOGIC.md`、`SECURITY.md`、`USAGE.md`、`PERMISSIONS.md`、`GIT_WORKFLOW.md`）都位於 `docs/` 資料夾中。

## 版本資訊

**當前版本**: v0.9.5 beta
**最後更新**: 2025-10-01

### 版本號規範

**格式**: `vX.Y.Z [狀態]`

- **X (主版本號)**: 重大架構變更、破壞性更新
- **Y (次版本號)**: 新功能、重要功能改進
- **Z (修訂號)**: Bug修復、小優化、文字調整
- **狀態標籤**: `beta`、`rc`、`stable`（可選）

### 版本號更新時機規則

| 更新類型 | 範例 | 版本號變更 |
|---------|------|-----------|
| **重大架構變更** | 資料庫結構大改、認證系統重寫 | v0.9.5 → v1.0.0 或 v0.10.0 |
| **新功能/重要改進** | 長按快速輸入、醫師班表系統 | v0.9.5 → v0.10.0 |
| **中等功能改進** | UI優化、品牌更新、頁面重構 | v0.9.5 → v0.9.6 |
| **Bug修復** | 修復權限判定錯誤、資料顯示問題 | v0.9.5 → v0.9.5.1 |
| **文字/樣式微調** | 按鈕文字、間距調整 | 不更新或 v0.9.5 → v0.9.5.1 |

### 版本號更新檢查清單

**⚠️ 重要提醒**: 每次更新版本號時，您**必須**同步更新以下5個位置：

- [ ] 1. `CLAUDE.md` - 版本資訊區塊（第9-10行）
- [ ] 2. `README.md` - 版本徽章（第3行）和版本更新記錄區塊
- [ ] 3. `frontend/src/pages/Settings.jsx` - 系統信息區塊（約第671行）
- [ ] 4. `frontend/src/pages/Login.jsx` - 版本資訊（約第308行）
- [ ] 5. `docs/USAGE.md` - 版本歷史記錄（第1行）

**版本號更新流程**：
1. **決定版本號**：根據上方「版本號更新時機規則」表格判斷
2. **更新5個位置**：依照檢查清單逐一更新所有位置
3. **記錄更新內容**：在 `README.md` 版本更新記錄中詳細描述變更
4. **驗證一致性**：確認所有檔案的版本號完全一致
5. **提交 commit**：使用格式「更新系統版本號至 vX.X.X」

**⚠️ 嚴格要求**: 絕對不允許版本號不一致！更新前請逐一檢查所有5個位置！

## 專案概述

這是一個 **麻醉科護理班表管理系統** (Anesthesia Nursing Schedule Management System) - 一個為麻醉科部門設計的全端網路應用程式，用於管理護理排班。系統支援角色權限控制、複雜排班算法、調班管理、加班追蹤，以及即時用戶狀態監控。

## 專案結構

專案分為兩個主要資料夾：

```
ANES_Management/
├── backend/           # 後端 API 服務 (FastAPI) - 使用 uv 管理 Python 套件
└── frontend/          # 前端網頁應用 (React) - 使用 pnpm 管理 Node.js 套件
```

**生產環境部署**：專案在生產環境中只包含這兩個資料夾，所有服務都在這個結構內運行。

**套件管理工具**：
- **前端**：使用 `pnpm` 進行 Node.js 依賴管理（請勿改用 npm 或 yarn）
- **後端**：⚠️ **必須使用 `uv` 進行 Python 套件管理** - `uv` 是 Rust 編寫的極速 Python 套件安裝工具，比傳統 pip 快 10-100 倍

### ⚠️ Python 套件管理重要規範

**本專案後端強制使用 `uv` 管理 Python 套件，禁止使用傳統 pip！**

**為什麼使用 uv？**
- **速度極快**：比 pip 快 10-100 倍，使用 Rust 編寫
- **更可靠**：更好的依賴解析和鎖定機制
- **生產環境一致**：與部署環境（Zeabur）使用相同工具
- **向後兼容**：完全兼容 requirements.txt 格式

**安裝 uv：**
```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# 使用 pip 安裝（不推薦但可用）
pip install uv
```

**使用 uv 的標準流程：**
```bash
cd backend

# 1. 建立虛擬環境（僅第一次）
python -m venv venv

# 2. 啟動虛擬環境
source venv/bin/activate    # Linux/macOS
# 或
venv\Scripts\activate       # Windows

# 3. 使用 uv 安裝套件（極速安裝）
uv pip install -r requirements.txt

# 4. 新增套件時也使用 uv
uv pip install 套件名稱

# 5. 更新 requirements.txt
uv pip freeze > requirements.txt
```

**⚠️ 嚴格禁止的操作：**
- ❌ 使用 `pip install` 安裝套件（除非安裝 uv 本身）
- ❌ 混用 pip 和 uv 管理同一個環境
- ❌ 直接修改 requirements.txt 而不通過 uv

**正確做法：**
- ✅ 所有套件安裝都使用 `uv pip install`
- ✅ 更新套件使用 `uv pip install --upgrade`
- ✅ 移除套件使用 `uv pip uninstall`
- ✅ 生成依賴列表使用 `uv pip freeze`

## 常用開發指令

### 前端 (React)
```bash
cd frontend
pnpm install         # 安裝依賴套件
pnpm start          # 啟動開發伺服器 (port 3000)
pnpm build          # 建置正式版本
pnpm test           # 執行測試
```

### 後端 (FastAPI)
```bash
cd backend

# 建立並啟動虛擬環境 (開發時必須)
python -m venv venv
source venv/bin/activate    # Linux/macOS
# 或
venv\Scripts\activate       # Windows

# ⚠️ 必須使用 uv 安裝套件（禁止使用 pip）
uv pip install -r requirements.txt

# 啟動開發伺服器和資料庫操作
python main.py      # 啟動開發伺服器 (port 8000)
python init_db.py   # 初始化資料庫

# 套件管理操作（全部使用 uv）
uv pip install 套件名稱                    # 安裝新套件
uv pip install --upgrade 套件名稱          # 更新套件
uv pip uninstall 套件名稱                  # 移除套件
uv pip freeze > requirements.txt          # 更新依賴列表
uv pip list                               # 列出已安裝套件
```

**⚠️ 重要提醒**：
1. **虛擬環境必須啟動**：開發環境中進行後端測試時，必須先啟動虛擬環境 (venv)
2. **強制使用 uv**：所有套件安裝操作都必須使用 `uv pip`，不可使用傳統 `pip`
3. **避免套件衝突**：不要在同一環境混用 pip 和 uv

### 資料庫操作

#### Python 腳本操作
```bash
# 後端資料庫操作
python backend/init_db.py                    # 初始化資料庫表格
python backend/migrations/initial_data.py    # 填充初始資料
python backend/scripts/reset_logs.py         # 重設應用程式日誌
```

#### 直接使用 psql 操作 PostgreSQL
```bash
# 連接到本地 PostgreSQL 資料庫
PGPASSWORD=anes_password psql -h localhost -U anes_user -d anes_db

# 執行單行 SQL 查詢
PGPASSWORD=anes_password psql -h localhost -U anes_user -d anes_db -c "SELECT * FROM users LIMIT 10;"

# 常用查詢範例
# 查看表格結構
PGPASSWORD=anes_password psql -h localhost -U anes_user -d anes_db -c "\d users"

# 查詢特定用戶
PGPASSWORD=anes_password psql -h localhost -U anes_user -d anes_db -c "SELECT id, username, full_name, identity, role FROM users WHERE username = '02003';"

# 更新用戶資料
PGPASSWORD=anes_password psql -h localhost -U anes_user -d anes_db -c "UPDATE users SET identity = '麻醉科醫師', role = 'admin' WHERE username = '02003';"
```

**資料庫連線資訊**:
- Host: localhost
- User: anes_user
- Password: anes_password
- Database: anes_db

## 架構概覽

### 技術堆疊
- **前端**: React 18, Material-UI, Zustand (狀態管理), React Router
- **前端套件管理**: pnpm (快速 Node.js 套件管理)
- **後端**: FastAPI, SQLAlchemy, JWT 認證, WebAuthn/Passkey 支援
- **後端套件管理**: ⚠️ **uv (強制使用，Rust 編寫的極速 Python 套件管理工具)**
- **資料庫**: PostgreSQL/SQLite 配合 SQLAlchemy ORM
- **排程系統**: APScheduler 自動化任務
- **認證系統**: JWT + WebAuthn/Passkey 生物辨識認證

### 關鍵架構模式

#### 1. 角色權限控制
- **角色類型**: `head_nurse`, `nurse`, `boss`, `admin`
- **身份類型**: 不同護理類別具有特定班別模式
  - 麻醉專科護理師: D(日班), A(小夜班), N(大夜班), O(休假)
  - 恢復室護理師: A(日班), K(早班), C(中班), F(晚班), O(休假)
  - 麻醉科Leader: A(日班), E(半班), O(休假)
  - 麻醉科書記: B(日班), E(半班), O(休假)

#### 2. 狀態管理 (Zustand)
- **authStore.js**: 認證、用戶管理、Passkey 功能
- **scheduleStore.js**: 班表資料、公式模式、班別分配
- **settingsStore.js**: 應用程式設定、偏好設定
- **userStore.js**: 用戶管理操作

#### 3. 後端服務層
- **模型**: SQLAlchemy ORM 模型在 `backend/app/models/`
- **路由**: FastAPI 路由器在 `backend/app/routes/`
- **架構**: Pydantic 驗證架構在 `backend/app/schemas/`
- **服務**: 商業邏輯在 `backend/app/services/`

#### 4. 核心功能架構

**班表管理**:
- 基於公式的班表生成，每種身份類型具有不同模式
- A班護理師工作分配系統 (OR, DR, 3F 區域)
- 夜班包班系統 (SNP/LNP 分類)
- 加班追蹤與自動計分

**醫師班表系統**:
- 外部 API 整合醫師班表資料
- 自動更新：每5分鐘更新當月，每日更新未來月份
- 狀態管理 (上班、下班、開會、請假)
- 區域代碼管理工作分配

**調班管理**:
- 完整流程：申請 → 審核 → 通知 → 歷史記錄
- 自動驗證班別衝突和工時規則
- 狀態追蹤：待審核、已接受、已拒絕、已取消、已過期

**認證系統**:
- 傳統用戶名/密碼 + JWT
- WebAuthn/Passkey 生物辨識認證
- 會話管理與自動令牌刷新

## 資料庫架構說明

**重要**: 完整資料庫架構詳情、表格結構、關聯關係和架構文件，請參考：`docs/DATABASE_ARCHITECTURE.md`

### 快速參考 - 關鍵表格
- `users`: 用戶帳戶，包含角色和身份類型
- `schedules`: 月班表分配
- `formula_schedules`: 班表模板/模式
- `shift_swap_requests`: 調班申請
- `overtime_records`: 加班追蹤和計分
- `doctor_schedules`: 來自外部 API 的醫師班表資料
- `announcements`: 系統公告

### 重要關聯關係
- 用戶 → 班表：一對多關聯
- 班表 → 工作分配：A班分配的嵌入式 JSON
- 醫師班表 → 日班詳情：外鍵關聯

**詳細架構資訊、約束條件、索引和完整表格結構，請務必查看 `docs/DATABASE_ARCHITECTURE.md`**

**⚠️ 重要提醒**: 進行任何資料庫相關變更時（新增/修改表格、欄位、關聯、約束條件或索引），您**必須**更新 `docs/DATABASE_ARCHITECTURE.md` 以反映變更。包括：
- 新增表格或欄位
- 修改現有表格結構
- 建立新的關聯關係或外鍵
- 新增或移除索引/約束條件
- 資料庫遷移腳本
保持文件與實際資料庫架構同步！

### 智能分配邏輯
**重要**: 完整智能分配算法文件，包括輪次分配邏輯、計分系統和實作細節，請參考：`docs/ROUND_ALLOCATION_LOGIC.md`

**⚠️ 重要提醒**: 對加班分配算法、計分系統或智能分配邏輯進行任何變更時，您**必須**更新 `docs/ROUND_ALLOCATION_LOGIC.md` 以反映變更。包括：
- 修改分配算法或輪次邏輯
- 變更計分公式或班別數值
- 新增分配模式或功能
- 更新 Fisher-Yates 洗牌或候選人篩選邏輯
- 修改與分配相關的 UI 組件或 hooks
保持智能分配文件與實際實作同步！

### 安全指南
**重要**: 完整安全指南、最佳實務和事件回應程序，請參考：`docs/SECURITY.md`

**⚠️ 重要提醒**: 實作新功能或進行系統變更時，您**必須**視需要檢視並更新 `docs/SECURITY.md`。包括：
- 新增認證或授權機制
- 實作新的 API 端點或資料存取模式
- 修改資料庫架構或存取控制
- 新增第三方依賴或服務
- 變更部署或基礎架構配置
確保所有安全措施符合醫療資料保護要求！

### 使用說明文件
**重要**: 完整用戶指南、功能文件和系統操作說明，請參考：`docs/USAGE.md`

**⚠️ 重要提醒**: 新增功能、修改現有功能或更新系統時，您**必須**更新 `docs/USAGE.md` 以反映變更。包括：
- 新增功能或特性
- 修改用戶介面或工作流程
- 變更角色權限或存取控制
- 更新系統需求或依賴
- **在代碼和文件中一致地更新版本號**
- 新增配置選項或設定
- 修改 API 端點或資料格式
保持使用說明文件與實際系統功能同步，並確保所有文件的版本一致性！

### 用戶權限判定文件
**重要**: 完整前端權限判定位置、權限矩陣和開發規範，請參考：`docs/PERMISSIONS.md`

**⚠️ 重要提醒**: 新增、修改或刪除任何權限判定邏輯時，您**必須**更新 `docs/PERMISSIONS.md` 以反映變更。包括：
- 新增或修改 role/identity 判定邏輯
- 變更功能的權限要求
- 新增需要權限控制的功能或頁面
- 修改現有的權限檢查函數
- 更新權限矩陣或權限層級
- 變更路由保護或 UI 元素顯示邏輯
確保權限文件與實際代碼保持同步，並保證系統安全性！

## 開發模式

### 前端組件結構
```
src/
├── components/           # 可重用的 UI 組件
│   ├── Layout.jsx       # 主要應用程式佈局
│   ├── common/          # 共用組件
│   └── ShiftSwap/       # 功能特定組件
├── pages/               # 路由層級組件
├── store/               # Zustand 狀態管理
├── utils/               # 工具函數
└── hooks/               # 自定義 React hooks
```

### UI 設計指南

#### 扁平化設計原則
系統遵循現代扁平化設計原則，提供乾淨、專業的醫療介面：

**按鈕設計標準：**
```javascript
// 標準按鈕配置
const buttonStyles = {
  // 主要動作 (下班按鈕)
  primary: {
    color: "primary",           // 藍色背景
    boxShadow: 'none'          // 無陰影效果
  },
  
  // 次要動作 (開會按鈕)
  outlined: {
    variant: "outlined",        // 白色邊框
    boxShadow: 'none'
  },
  
  // 警告/危險動作 (請假按鈕)
  danger: {
    backgroundColor: '#d32f2f',  // 紅色背景
    color: 'white',
    boxShadow: 'none'
  }
};
```

**視覺層次優化：**
- **一致間距**: 整個介面統一的按鈕高度和內距
- **色彩對比**: 優化對比度以符合無障礙標準
- **簡化元素**: 專注於內容而非裝飾性元素
- **字體排版**: 清晰的層次結構，適當的字重和大小

**Material-UI 組件指南：**
```javascript
// 一致的組件配置
<Button
  variant="contained"
  color="primary"
  sx={{ 
    boxShadow: 'none',        // 總是移除陰影
    textTransform: 'none',    // 保持原始文字大小寫
    borderRadius: 1,          // 微妙的圓角
    fontWeight: 500           // 中等字重
  }}
>
  動作文字
</Button>
```

**色彩調色板標準：**
- **主要藍色**: `#1976d2` - 用於主要動作和導航
- **成功綠色**: `#2e7d32` - 用於確認和成功狀態
- **警告橘色**: `#ed6c02` - 用於警告和注意事項
- **錯誤紅色**: `#d32f2f` - 用於錯誤和危險動作
- **灰色調**: 用於文字、邊框和背景的各種灰階

**無障礙要求：**
- **鍵盤導航**: 所有互動元素必須支援鍵盤操作
- **ARIA 標籤**: 螢幕閱讀器的適當 ARIA 屬性
- **焦點管理**: 清晰的焦點指示器和邏輯 tab 順序
- **色彩獨立**: 資訊不應僅依賴顏色傳達

**響應式設計標準：**
- **行動優先**: 先為行動裝置設計，再增強大螢幕體驗
- **斷點**: 遵循 Material-UI 標準斷點
- **觸控目標**: 行動裝置最小 44px 觸控目標
- **彈性佈局**: 使用 Grid 和 Flexbox 實現響應式佈局

#### 醫療專用設計考量
- **高對比度**: 確保在各種照明條件下的可讀性
- **錯誤預防**: 清晰的驗證和確認對話框
- **資料清晰度**: 表格和班表必須易於掃描
- **狀態指示器**: 不同狀態的清晰視覺指示器 (上班、開會、請假)
- **專業外觀**: 乾淨、醫療級的介面美學

### 後端模組結構
```
backend/app/
├── core/                # 核心配置和資料庫
├── models/              # SQLAlchemy ORM 模型
├── routes/              # FastAPI 路由處理器
├── schemas/             # Pydantic 驗證架構
├── services/            # 商業邏輯層
├── tasks/               # 背景任務 (APScheduler)
└── utils/               # 工具函數
```

## 關鍵配置

### 環境變數
- 資料庫連線設定在 `backend/app/core/config.py`
- 前端 API 代理配置在 `frontend/package.json` (proxy: "http://localhost:8001")
- CORS 來源根據環境動態設定

### 認證流程
1. 傳統登入：POST `/api/login` 包含表單資料
2. JWT 令牌透過 Zustand persist 儲存在 localStorage
3. 自動令牌驗證和刷新
4. Passkey 註冊/認證透過 WebAuthn API

### 排班系統
- 公式模式定義不同身份類型的週班表
- 月班表從公式生成並可手動調整
- A班護理師的工作分配以 JSON 格式儲存在班表記錄中
- 加班根據班別模式和身份自動計算

## 測試

### 資料庫測試
- 使用 `backend/init_db.py` 重設資料庫狀態
- 透過 `backend/migrations/initial_data.py` 填充初始資料
- 測試帳戶：admin/changeme, nurse/password

### 前端測試
- React Testing Library 配置在 `frontend/package.json`
- 在前端目錄執行 `pnpm test` 運行測試

## 安全說明

- JWT 令牌與自動過期檢查
- WebAuthn/Passkey 實作無密碼認證
- CORS 配置開發和正式環境
- 透過 SQLAlchemy ORM 防止 SQL 注入
- 透過 Pydantic 架構進行輸入驗證

## 部署配置

### 建置優化
- **前端**: 使用 pnpm 進行更快的依賴管理 (pnpm-lock.yaml)
- **後端**: 使用 uv 進行更快的 Python 套件安裝

### 平台特定配置
- `frontend/zeabur.json`: 前端部署與 pnpm 優化
- `backend/zeabur.json`: 後端部署與 uv 優化
- `vercel.json`: 舊版 Vercel 配置

### 建置輸出
- 前端建置輸出在 `frontend/build/`
- 後端 WSGI 伺服器配置在 `backend/main.py`
- 資料庫遷移在 `backend/migrations/`

## Git 版本控制最佳實務

**重要**: 完整 Git 分支管理策略、工作流程和命名規則，請參考：`docs/GIT_WORKFLOW.md`

### 提交 Commit 的時機
**⚠️ 重要**: 完成一個功能段落或重要修改後,應該立即提交 git commit。不要累積太多變更才提交。

**建議的提交時機**：
- 完成一個完整的功能模組
- 修復一個 bug
- 重構一個組件
- 更新文件或配置
- 完成一組相關的小修改（3-5 個檔案）

**提交前檢查清單**：
- [ ] 確認所有修改的檔案都符合預期
- [ ] 檢查是否有遺漏的檔案需要加入
- [ ] 撰寫清楚的 commit 訊息
- [ ] 避免在 commit 訊息中提到 AI 助手名稱

### Commit 訊息規範

**格式**：
```
簡短標題（50字以內）

1. 功能/修改類別
   - 具體變更描述
   - 相關檔案說明

2. 另一個功能/修改
   - 描述

修改檔案：
- 檔案名稱: 變更說明
```

**⚠️ 重要規則**：
- ❌ **不要在 commit 訊息中提到 AI 助手**（如 Claude、ChatGPT 等）
- ❌ **不要使用自動生成的標記**（如 "Generated with..."）
- ✅ 使用清楚、專業的技術描述
- ✅ 專注於「做了什麼」而非「誰做的」

**良好的 Commit 訊息範例**：
```
新增用戶權限管理功能

1. 實作角色權限判定邏輯
   - 新增 role 和 identity 分離判定
   - 統一使用 role 進行權限檢查

2. 優化 UI 顯示
   - 更新角色顯示名稱
   - 調整權限錯誤提示

修改檔案：
- UserManagement.jsx: 權限判定優化
- authStore.js: 角色檢查邏輯
```

### 常用 Git 指令
```bash
# 查看狀態
git status

# 查看變更
git diff
git diff --stat

# 加入檔案
git add <file>
git add .

# 提交
git commit -m "commit 訊息"

# 查看歷史
git log --oneline -10
```

# 提交 git commit 的時候不要提到 Claude
# 提交 git commit 的時候不要提到 Claude
