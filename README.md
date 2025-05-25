# 麻醉科護理班表管理系統

![Version](https://img.shields.io/badge/version-0.8.8-blue)
![License](https://img.shields.io/badge/license-Apache%202.0-green)

這是一個專為麻醉科部門設計的護理班表管理系統，旨在簡化護理長排班和護理師查詢班表的流程。系統支援麻醉科、恢復室等專科護理師的特殊排班需求，提供直覺化的界面和高效的排班工具。**版本 0.8.6 主要更新了換班系統的邏輯與操作流程，並優化了用戶管理及恢復室等介面的人員排序機制。**

## 系統特色

- **直覺化界面**：現代化設計，易於使用
- **專科排班**：專為麻醉科和恢復室等特殊班表需求設計
- **Passkey無密碼登入**：支援FIDO2/WebAuthn Passkey，提供更安全、便利、跨裝置的無密碼登入與管理（可於系統設定頁註冊、刪除Passkey，支援生物辨識/PIN驗證，資料僅儲存於本地裝置，保障隱私）
- **工作分配**：支援A班時的特殊工作分配管理（手術室、恢復室等）
- **統計分析**：提供班表統計與人力配置分析
- **響應式設計**：支援桌面和移動設備使用

## 系統功能

### 用戶管理
- 帳號密碼登入
- **Passkey無密碼登入/管理（WebAuthn）**
- 角色區分（護理長與一般護理師）
- 身份類別（麻醉專科護理師、恢復室護理師、麻醉科Leader、麻醉科書記）
- IP限制（護理長單一登入）
- **護理師排序功能（主要基於護理師「身份」進行預設排序，護理長可在用戶管理介面調整顯示順序）**

### 排班管理（護理長專用）
- 公式班表設定（依身份類別有不同班型）
- 月班表生成與調整
- 班表發布與版本管理
- **人員排序設定（在月班表、週班表等相關介面，人員列表會根據其「身份」設定的權重進行排序，例如優先顯示特定身份如恢復室護理師）**
- 批量調整組別功能
- 工作分配管理（A班特殊工作分配）
- 夜班包班人員管理（小夜包班、大夜包班）

### 班表查詢
- 個人週班表
- 月班表查詢（個人/全部）
- 大班表（所有人員）
- 工作分配統計顯示
- 班表匯出（PDF格式）
- 週班表優化：移除開發用API計數器，改進工作分配操作與顯示
- 分類顯示：常規月班表、小夜班包班、大夜班包班

### 換班功能
- **完整換班系統：已完成，提供換班申請、審核、通知、歷史紀錄與自動工時規則驗證。**
- **智能驗證：內建班別衝突與工時規則自動驗證 (例如，檢查前後班次間隔時間、確保護理師有足夠休息)。**
- **狀態追蹤：清晰追蹤換班請求的各種狀態 (待處理、已接受、已拒絕、已取消、已過期)。**
- **歷史紀錄：保留所有換班操作的詳細歷史紀錄。**

### 加班管理
- 自動識別月班表中的加班人員（A班）
- 加班人員排序標記（A-F）
- 加班記錄持久化存儲
- 權限控制（僅護理長和管理員可編輯）
- 批量更新和修改
- 個人加班記錄查詢
- 加班分數統計：每月自動計算並儲存加班分數
- 年度統計表格：顯示護理師1-12月的加班分數
- 優化API請求：防止重複資料請求，提高效能
- 麻醉科Leader排班限制：加班僅能安排在E或F班

### 公告專區
- 公告發布與管理
- 分類管理
- 重要公告突出顯示
- 分頁顯示 (每頁最多30則公告)，提升列表載入效能

## 專案架構

### 後端 (Backend)
```
backend
├── app
│   ├── core
│   │   ├── config.py
│   │   ├── database.py
│   │   └── security.py
│   ├── models
│   │   ├── __init__.py
│   │   ├── announcement.py
│   │   ├── formula.py
│   │   ├── log.py
│   │   ├── overtime.py
│   │   ├── schedule.py
│   │   ├── shift_swap.py
│   │   ├── user.py
│   │   └── webauthn.py
│   ├── routes
│   │   ├── __init__.py
│   │   ├── announcements.py
│   │   ├── formula_schedules.py
│   │   ├── overtime.py
│   │   ├── schedules.py
│   │   ├── shift_swap.py
│   │   ├── users.py
│   │   └── webauthn.py
│   └── schemas
│       ├── __init__.py
│       ├── announcement.py
│       ├── overtime.py
│       ├── schedule.py
│       ├── shift_swap.py
│       ├── user.py
│       └── webauthn.py
├── check_users.py
├── create_tables.py
├── init_db.py
├── main.py
├── migrations
│   ├── add_hire_date.sql
│   ├── add_is_pinned_to_announcements.py
│   ├── add_special_type_to_schedules.py
│   └── initial_data.py
├── requirements.txt
└── scripts
    ├── reset_logs.py
    └── run_reset_logs.sh

8 directories, 38 files
```

### 前端 (Frontend)
```
frontend
├── package-lock.json
├── package.json
├── public
│   ├── favicon.ico
│   ├── index.html
│   └── manifest.json
├── src
│   ├── App.jsx
│   ├── components
│   │   ├── Layout.jsx
│   │   └── OvertimeStaff.jsx
│   ├── index.css
│   ├── index.jsx
│   ├── pages
│   │   ├── Announcement.jsx
│   │   ├── BigSchedule.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Formula.jsx
│   │   ├── Login.jsx
│   │   ├── MonthlySchedule.jsx
│   │   ├── NotFound.jsx
│   │   ├── OvertimeStaff.jsx
│   │   ├── PublishAnnouncementForm.jsx
│   │   ├── Settings.jsx
│   │   ├── ShiftSwap.jsx
│   │   ├── StrictModeDroppable.jsx
│   │   ├── UserManagement.jsx
│   │   ├── VersionHistory.jsx
│   │   └── WeeklySchedule.jsx
│   ├── reportWebVitals.js
│   ├── store
│   │   ├── authStore.js
│   │   ├── scheduleStore.js
│   │   ├── settingsStore.js
│   │   └── userStore.js
│   └── utils
│       ├── api.js
│       └── migrateFormulaPatternsData.js
└── temp_file.jsx

7 directories, 33 files
```

## 技術架構與設計邏輯

### 前端技術
- **React**: 採用函數式組件和Hooks進行開發
- **Zustand**: 輕量級狀態管理，各模組有獨立的Store
- **Material-UI**: UI組件庫，提供現代化界面設計
- **Axios**: 處理API請求
- **React Router**: 路由管理
- **localStorage/sessionStorage**: 持久化存儲登入狀態
- **jsPDF & html2canvas**: 生成PDF班表

### 後端技術
- **FastAPI**: 高性能Python API框架
- **SQLAlchemy**: ORM數據庫操作
- **Pydantic**: 數據驗證和schema定義
- **JWT**: JSON Web Token認證
- **PostgreSQL**: 數據存儲
- **Bcrypt**: 密碼加密

### 核心設計邏輯

#### 1. 身份與角色系統
- **角色**: 區分護理長和一般護理師的權限
- **身份**: 使用不同的身份類別區分不同類型的護理師
  - 麻醉專科護理師: 使用D(日班)、A(小夜班)、N(大夜班)、O(休假)班型
  - 恢復室護理師: 使用A(日班)、K(早班)、C(中班)、F(晚班)、O(休假)班型
  - 麻醉科Leader: 使用A(日班)、E(半班)、O(休假)班型
  - 麻醉科書記: 使用B(日班)、E(半班)、O(休假)班型

#### 2. 公式班表設計
- 每種身份有獨立的公式班表設置
- 可設定每種身份的組別數量
- 護理師分配到特定組別
- 各班型有特定的背景顏色和工時計算
- 支援特殊分類：小夜班包班(SNP)和大夜班包班(LNP)

#### 3. 夜班包班系統
- 支援將護理師標記為小夜班包班(SNP)或大夜班包班(LNP)
- 分類顯示：常規月班表、小夜班包班專區、大夜班包班專區
- 護理長可一鍵更新包班人員列表
- 包班護理師信息持久化存儲
- 月班表標籤頁支援快速切換查看不同類型護理師的排班

#### 4. 工作分配功能
- A班護理師可分配至不同工作區域（OR、DR、3F等）
- 支援工作分配統計顯示
- 提供快速分配和重置功能
- 直覺化色彩顯示工作分配狀態

#### 5. 狀態管理設計
- 使用Zustand分模塊管理狀態
- 重要數據持久化到localStorage
- 支持數據加載、錯誤處理和加載狀態顯示

#### 6. 安全性設計
- JWT令牌認證
- 基於角色的訪問控制
- 密碼加密存儲
- 防止CSRF攻擊

#### 7. 加班分數計算系統
- 自動計算護理師每月加班分數
- 分數計算考慮班別和身份
- 月度分數持久化存儲在資料庫
- 年度統計表顯示1-12月分數
- 專科護理師和Leader分開計算

## 安裝與啟動

### 環境需求
- Python 3.8+ (後端)
- Node.js 14+ (前端)
- PostgreSQL (數據庫)

### 後端安裝
```bash
# 進入後端目錄
cd backend

# 安裝依賴
pip install -r requirements.txt

# 複製環境變數範例檔並修改配置
cp .env.example .env

# 配置PostgreSQL數據庫
# 請確保PostgreSQL已安裝且運行中
# 創建數據庫和用戶

# 初始化數據庫
python init_db.py
```

### 前端安裝
```bash
# 進入前端目錄
cd frontend

# 安裝依賴
npm install
```

### 啟動後端
```bash
cd backend
python run.py
```
後端服務將在 http://localhost:8000 運行

### 啟動前端
```bash
cd frontend
npm start
```
前端應用將在 http://localhost:3000 運行

### 使用便捷腳本啟動
```bash
# 同時啟動前後端
./start_dev.sh
```

## 版本更新記錄

### v0.8.8
- 新增Passkey（WebAuthn）無密碼登入功能，支援生物辨識/PIN跨裝置註冊與登入
- Passkey管理功能整合至Settings頁面，移除獨立Passkey管理頁與選單，優化刪除警告與說明
- 修正WebAuthn認證CBOR解碼與型別轉換問題，提升登入穩定性
- 換班系統正式完成，支援完整申請、審核、歷史紀錄與自動工時驗證

### v0.8.6
- 更新換班邏輯與操作流程：引入更完善的換班申請、審核機制及自動工時規則驗證。
- 優化用戶管理及恢復室等介面的人員排序機制：排序主要依據護理師身份進行。

## 預設帳號

系統初始化後會創建兩個預設帳號：

1. **護理長**
   - 用戶名：admin
   - 密碼：changeme

2. **測試護理師**
   - 用戶名：nurse
   - 密碼：password

首次登入後建議修改密碼。

## 使用示例

### 排班流程
1. 護理長登入系統
2. 設定公式班表與人員分組
3. 生成月班表
4. 調整特殊班表需求
5. 分配A班工作區域
6. 發布班表

### 護理師使用流程
1. 登入系統
2. 查看個人班表
3. 查詢月班表和工作分配
4. 申請換班 (如需要)

## 貢獻指南

我們歡迎任何形式的貢獻，包括但不限於：

- 錯誤回報
- 功能建議
- 代碼貢獻
- 文檔改進

請遵循以下步驟：

1. Fork 本倉庫
2. 創建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m '添加一些功能'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 開啟一個 Pull Request

## 問題回報

如果您遇到任何問題，請在 GitHub Issues 中提出，並提供以下信息：

- 問題描述
- 重現步驟
- 預期行為
- 實際行為
- 截圖 (如有)
- 環境信息

## 維護者

* [Claramane](https://github.com/Claramane)

## 授權

本專案採用 Apache 2.0 授權 - 詳情請參閱 [LICENSE](LICENSE) 文件

## 詳細文檔

更多詳細使用說明，請參考 [USAGE.md](USAGE.md) 文件。 

## 當前進度 (v0.8.8)
- 換班系統已完成，支援完整申請、審核、歷史紀錄與自動工時驗證
- 新增Passkey（WebAuthn）無密碼登入與管理，整合至Settings頁面
- 加入夜班包班管理系統，支援小夜班包班(SNP)和大夜班包班(LNP)的分類顯示與管理
- 優化月班表顯示，新增標籤頁分類顯示不同類型護理師
- 添加一鍵更新包班人員功能，便於護理長維護夜班包班列表
- 改進排班表生成與儲存邏輯，確保特殊分類數據的持久化
- 增強鍵盤快捷輸入功能，提升排班操作效率
- 優化錯誤處理機制，提供更友善的用戶體驗
- 修復多個已知問題，增強系統穩定性

## 未來計劃
- 班表版本管理git系統
- 連結開刀房刀表系統
- 連結病人自費項目清單系統
- 連結醫師班表系統
- 加入醫師管理系統
  