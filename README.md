# 麻醉科護理班表管理系統

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

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

### 班表查詢
- 個人週班表
- 月班表查詢（個人/全部）
- 大班表（所有人員）
- 工作分配統計顯示
- 班表匯出（PDF格式）

### 換班功能
- 換班申請
- 換班匹配與驗證
- 換班歷史紀錄

### 公告專區
- 公告發布與管理
- 分類管理
- 重要公告突出顯示

## 專案架構

### 後端 (Backend)
```
backend/
├── app/
│   ├── core/          # 核心功能：設置、安全性、數據庫連接等
│   ├── models/        # 數據庫模型定義
│   │   ├── user.py    # 用戶模型
│   │   ├── schedule.py # 班表模型
│   │   ├── formula_schedule.py # 公式班表模型
│   │   ├── shift_swap.py # 換班模型
│   │   ├── announcement.py # 公告模型
│   │   └── log.py     # 日誌模型
│   ├── routes/        # API路由
│   │   ├── users.py   # 用戶相關API
│   │   ├── auth.py    # 認證相關API
│   │   ├── schedule.py # 班表相關API
│   │   ├── formula_schedule.py # 公式班表相關API
│   │   ├── shift_swap.py # 換班相關API
│   │   └── announcement.py # 公告相關API
│   ├── schemas/       # Pydantic模型（資料驗證）
│   │   ├── user.py
│   │   ├── schedule.py
│   │   ├── formula_schedule.py
│   │   ├── shift_swap.py
│   │   └── announcement.py
│   ├── utils/         # 工具函數
│   └── main.py        # 主應用入口
├── migrations/        # 數據庫遷移腳本
├── init_db.py         # 數據庫初始化腳本
├── requirements.txt   # 依賴項
├── .env               # 環境變數配置
└── run.py             # 啟動腳本
```

### 前端 (Frontend)
```
frontend/
├── public/           # 靜態資源
└── src/
    ├── assets/       # 圖片等資源
    ├── components/   # 可重用組件
    │   ├── layout/   # 頁面佈局組件
    │   ├── common/   # 通用組件
    │   └── schedule/ # 班表相關組件
    ├── pages/        # 頁面組件
    │   ├── Login.jsx           # 登入頁
    │   ├── Dashboard.jsx       # 儀表板
    │   ├── UserManagement.jsx  # 用戶管理
    │   ├── FormulaSchedule.jsx # 公式班表設定
    │   ├── MonthlySchedule.jsx # 月班表
    │   ├── WeeklySchedule.jsx  # 週班表與工作分配
    │   ├── BigSchedule.jsx     # 大班表
    │   ├── ShiftSwap.jsx       # 換班管理
    │   └── Announcement.jsx    # 公告管理
    ├── store/        # 狀態管理
    │   ├── userStore.js      # 用戶狀態
    │   ├── authStore.js      # 認證狀態
    │   ├── scheduleStore.js  # 班表狀態
    │   ├── settingsStore.js  # 設置狀態
    │   └── announcementStore.js # 公告狀態
    ├── utils/        # 工具函數
    │   ├── api.js    # API調用
    │   ├── date.js   # 日期處理
    │   └── auth.js   # 認證相關
    ├── App.jsx       # 應用主入口
    └── index.jsx     # 渲染入口
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
- **SQLite/MySQL**: 數據存儲
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

#### 3. 工作分配功能
- A班護理師可分配至不同工作區域（OR、DR、3F等）
- 支援工作分配統計顯示
- 提供快速分配和重置功能
- 直覺化色彩顯示工作分配狀態

#### 4. 狀態管理設計
- 使用Zustand分模塊管理狀態
- 重要數據持久化到localStorage
- 支持數據加載、錯誤處理和加載狀態顯示

#### 5. 安全性設計
- JWT令牌認證
- 基於角色的訪問控制
- 密碼加密存儲
- 防止CSRF攻擊

## 安裝與啟動

### 環境需求
- Python 3.8+ (後端)
- Node.js 14+ (前端)
- SQLite3 或 MySQL (數據庫)

### 後端安裝
```bash
# 進入後端目錄
cd backend

# 安裝依賴
pip install -r requirements.txt

# 複製環境變數範例檔並修改配置
cp .env.example .env

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

本專案採用 MIT 授權 - 詳情請參閱 [LICENSE](LICENSE) 文件

## 詳細文檔

更多詳細使用說明，請參考 [USAGE.md](USAGE.md) 文件。 