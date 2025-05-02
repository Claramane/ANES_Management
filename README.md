# 麻醉科護理班表管理系統

![Version](https://img.shields.io/badge/version-0.8.3-blue)
![License](https://img.shields.io/badge/license-Apache%202.0-green)

這是一個專為麻醉科部門設計的護理班表管理系統，旨在簡化護理長排班和護理師查詢班表的流程。系統支援麻醉科、恢復室等專科護理師的特殊排班需求，提供直覺化的界面和高效的排班工具。

## 系統特色

- **直覺化界面**：現代化設計，易於使用
- **專科排班**：專為麻醉科和恢復室等特殊班表需求設計
- **工作分配**：支援A班時的特殊工作分配管理（手術室、恢復室等）
- **統計分析**：提供班表統計與人力配置分析
- **響應式設計**：支援桌面和移動設備使用

## 系統功能

### 用戶管理
- 帳號密碼登入
- 角色區分（護理長與一般護理師）
- 身份類別（麻醉專科護理師、恢復室護理師、麻醉科Leader、麻醉科書記）
- IP限制（護理長單一登入）
- 護理師排序功能

### 排班管理（護理長專用）
- 公式班表設定（依身份類別有不同班型）
- 月班表生成與調整
- 班表發布與版本管理
- 人員排序設定
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
- 換班申請
- 換班匹配與驗證
- 換班歷史紀錄

### 加班管理
- 自動識別月班表中的加班人員（A班）
- 加班人員排序標記（A-F）
- 加班記錄持久化存儲
- 權限控制（僅護理長和管理員可編輯）
- 批量更新和修改
- 個人加班記錄查詢

### 公告專區
- 公告發布與管理
- 分類管理
- 重要公告突出顯示
- 分頁顯示 (每頁最多30則公告)，提升列表載入效能

## 專案架構

### 後端 (Backend)
```
backend/
├── app/
│   ├── core/          # 核心功能：設置、安全性、數據庫連接等
│   ├── models/        # 數據庫模型定義 (SQLAlchemy)
│   │   ├── user.py    # 用戶模型
│   │   ├── schedule.py # 班表模型
│   │   ├── formula.py # 公式班表與模式模型
│   │   ├── shift_swap.py # 換班模型
│   │   ├── announcement.py # 公告模型
│   │   ├── overtime.py # 加班記錄模型
│   │   └── log.py     # 日誌模型
│   ├── routes/        # API 路由 (FastAPI)
│   │   ├── users.py   # 用戶相關 API
│   │   ├── schedules.py # 班表相關 API
│   │   ├── formula_schedules.py # 公式班表相關 API
│   │   ├── overtime.py # 加班記錄相關 API
│   │   └── announcements.py # 公告相關 API
│   ├── schemas/       # Pydantic 模型（資料驗證）
│   │   ├── user.py
│   │   ├── schedule.py
│   │   ├── shift_swap.py
│   │   ├── overtime.py
│   │   └── announcement.py
│   └── main.py        # 主應用入口 (FastAPI App)
├── migrations/        # 數據庫遷移腳本
├── scripts/           # 輔助腳本 (例如，數據遷移、檢查)
├── init_db.py         # 數據庫初始化腳本
├── requirements.txt   # Python 依賴項
├── .env.example       # 環境變數範例檔
└── run.py             # Gunicorn 啟動腳本
```

### 前端 (Frontend)
```
frontend/
├── public/           # 靜態資源 (例如 index.html, favicons)
├── src/
│   ├── assets/       # 圖片、字體等資源
│   ├── components/   # 可重用 React 組件
│   │   └── Layout.jsx   # 主要頁面佈局
│   │   └── OvertimeStaff.jsx # 加班人員相關組件 (可能需要移動到 pages 或更具體目錄)
│   ├── pages/        # 頁面級 React 組件
│   │   ├── Login.jsx           # 登入頁
│   │   ├── Dashboard.jsx       # 儀表板
│   │   ├── UserManagement.jsx  # 用戶管理
│   │   ├── Formula.jsx         # 公式班表設定頁
│   │   ├── MonthlySchedule.jsx # 月班表頁
│   │   ├── WeeklySchedule.jsx  # 週班表與工作分配頁
│   │   ├── BigSchedule.jsx     # 大班表頁
│   │   ├── OvertimeStaff.jsx   # 加班人員管理頁
│   │   ├── ShiftSwap.jsx       # 換班管理頁
│   │   ├── Announcement.jsx    # 公告列表頁
│   │   ├── PublishAnnouncementForm.jsx # 發布公告表單
│   │   ├── VersionHistory.jsx  # 版本歷史頁 (班表)
│   │   ├── Settings.jsx        # 設置頁
│   │   └── NotFound.jsx        # 404 頁面
│   ├── store/        # 狀態管理 (Zustand)
│   │   ├── authStore.js      # 認證狀態
│   │   ├── userStore.js      # 用戶狀態
│   │   ├── scheduleStore.js  # 班表狀態
│   │   └── settingsStore.js  # 設置狀態
│   ├── utils/        # 工具函數
│   │   ├── api.js    # API 請求封裝 (Axios)
│   │   └── migrateFormulaPatternsData.js # 數據遷移相關工具
│   ├── App.jsx       # 應用主組件 (路由配置)
│   ├── index.jsx     # React 應用渲染入口
│   ├── index.css     # 全局樣式
│   └── reportWebVitals.js # 性能監測
├── package.json      # Node.js 項目配置與依賴
└── .gitignore        # Git 忽略配置
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

# 只啟動前端
./frontend_start_dev.sh

# 只啟動後端
./backend_start_dev.sh
```

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

## 當前進度 (v0.8.0)
- 加入夜班包班管理系統，支援小夜班包班(SNP)和大夜班包班(LNP)的分類顯示與管理
- 優化月班表顯示，新增標籤頁分類顯示不同類型護理師
- 添加一鍵更新包班人員功能，便於護理長維護夜班包班列表
- 改進排班表生成與儲存邏輯，確保特殊分類數據的持久化
- 增強鍵盤快捷輸入功能，提升排班操作效率
- 優化錯誤處理機制，提供更友善的用戶體驗
- 修復多個已知問題，增強系統穩定性

## 未來計劃
- 換班系統 （下一個優先項目）
- 班表版本管理git系統
- 連結開刀房刀表系統
- 連結病人自費項目清單系統
- 連結醫師班表系統
- 加入醫師管理系統
  