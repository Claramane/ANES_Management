# 護理班表管理系統

這是一個為護理部門設計的班表管理系統，旨在簡化護理長排班和護理師查詢班表的流程。系統特別設計適用於麻醉科、恢復室等專科護理師的排班需求。

## 系統功能

### 用戶管理
- 帳號密碼登入
- 角色區分（護理長與一般護理師）
- 身份類別（麻醉專科護理師、恢復室護理師、麻醉科Leader、麻醉科書記）
- IP限制（護理長單一登入）

### 排班管理（護理長專用）
- 公式班表設定（依身份類別有不同班型）
- 月班表生成
- 班表發布與版本管理
- 人員排序設定
- 批量調整組別功能

### 班表查詢
- 個人週班表
- 月班表查詢
- 大班表（所有人員）

### 換班功能
- 換班申請
- 換班匹配與驗證

### 公告專區
- 公告發布
- 分類管理

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

### 後端技術
- **FastAPI**: 高性能Python API框架
- **SQLAlchemy**: ORM數據庫操作
- **Pydantic**: 數據驗證和schema定義
- **JWT**: JSON Web Token認證
- **SQLite/MySQL**: 數據存儲

### 核心設計邏輯

#### 1. 身份與角色系統
- **角色**: 區分護理長和一般護理師的權限
- **身份**: 使用不同的身份類別區分不同類型的護理師
  - 麻醉專科護理師: 使用D(日班)、A(半夜班)、N(夜班)、O(休假)班型
  - 恢復室護理師: 使用A(日班)、K(早班)、C(中班)、F(晚班)、O(休假)班型
  - 麻醉科Leader: 使用A(日班)、E(半班)、O(休假)班型
  - 麻醉科書記: 使用B(日班)、E(半班)、O(休假)班型

#### 2. 公式班表設計
- 每種身份有獨立的公式班表設置
- 可設定每種身份的組別數量
- 護理師分配到特定組別
- 各班型有特定的背景顏色和工時計算

#### 3. 狀態管理設計
- 使用Zustand分模塊管理狀態
- 重要數據持久化到localStorage
- 支持數據加載、錯誤處理和加載狀態顯示

#### 4. 安全性設計
- JWT令牌認證
- 基於角色的訪問控制
- 密碼加密存儲
- 防止CSRF攻擊

## 安裝與啟動

### 後端安裝
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # 複製環境變數範例檔
python init_db.py     # 初始化數據庫
```

### 前端安裝
```bash
cd frontend
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

## 詳細文檔

更多詳細使用說明，請參考 [USAGE.md](USAGE.md) 文件。 