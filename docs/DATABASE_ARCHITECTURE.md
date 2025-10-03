# 資料庫架構文件 (Database Architecture)

麻醉科護理班表管理系統 - 完整資料庫結構說明

## 概述

本系統使用 **PostgreSQL** 作為主要資料庫，搭配 **SQLAlchemy ORM**，採用關聯式資料庫設計，具備完整的約束條件、索引和外鍵關係。

## 核心表格結構

### 1. 使用者管理 (User Management)

#### **users** - 使用者主表
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username VARCHAR UNIQUE NOT NULL,  -- 員工編號/登入帳號
    email VARCHAR UNIQUE,
    full_name VARCHAR,                 -- 中文姓名
    hashed_password VARCHAR,           -- Bcrypt 加密密碼
    role VARCHAR,                      -- head_nurse, nurse, boss, admin
    identity VARCHAR,                  -- 護理師類別
    group_data TEXT,                   -- 群組資料 (JSON)
    hire_date DATE,                    -- 到職日期
    is_active BOOLEAN DEFAULT TRUE,    -- 帳號狀態
    deactivated_at TIMESTAMP,          -- 停用時間
    last_login_ip VARCHAR,
    last_login_time TIMESTAMP,
    last_activity_time TIMESTAMP,      -- 心跳追蹤
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

**護理師身份類別與班別**：
- **麻醉專科護理師**: D(日班), A(小夜班), N(大夜班), O(休假)
- **恢復室護理師**: A(日班), K(早班), C(中班), F(晚班), O(休假)
- **麻醉科Leader**: A(日班), E(半班), O(休假)
- **麻醉科書記**: B(日班), E(半班), O(休假)

#### **webauthn_credentials** - WebAuthn 生物辨識認證
```sql
CREATE TABLE webauthn_credentials (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    credential_id VARCHAR UNIQUE NOT NULL,
    public_key VARCHAR NOT NULL,
    sign_count INTEGER DEFAULT 0,
    device_name VARCHAR,               -- 使用者定義的裝置名稱
    device_fingerprint VARCHAR,       -- 裝置識別碼
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP
);
```

### 2. 排班管理核心 (Schedule Management Core)

#### **schedule_versions** - 班表版本控制
```sql
CREATE TABLE schedule_versions (
    id INTEGER PRIMARY KEY,
    version_number VARCHAR NOT NULL,
    month VARCHAR NOT NULL,            -- 格式: YYYYMM
    published_at TIMESTAMP,
    notes TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    is_base_version BOOLEAN DEFAULT FALSE,
    published_by INTEGER REFERENCES users(id),
    base_version_id INTEGER REFERENCES schedule_versions(id),
    created_at TIMESTAMP,
    UNIQUE(month, version)             -- 防止重複版本
);
```

#### **monthly_schedules** - 月班表
```sql
CREATE TABLE monthly_schedules (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    version_id INTEGER REFERENCES schedule_versions(id),
    date DATE NOT NULL,
    shift_type VARCHAR,                -- D, A, N, O 等班別
    area_code VARCHAR,                 -- 工作區域代碼
    work_time VARCHAR,                 -- 具體工作時間
    special_type VARCHAR,              -- SNP(小夜班包班), LNP(大夜班包班)
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(user_id, date, version_id)  -- 防止重複排班
);
```

#### **schedule_version_diffs** - 版本差異追蹤
```sql
CREATE TABLE schedule_version_diffs (
    id INTEGER PRIMARY KEY,
    version_id INTEGER REFERENCES schedule_versions(id),
    base_version_id INTEGER REFERENCES schedule_versions(id),
    diff_data JSON,                    -- 結構化差異資料
    created_at TIMESTAMP
);
```

#### **schedule_changes** - 班表變更記錄
```sql
CREATE TABLE schedule_changes (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    date DATE NOT NULL,
    version_id INTEGER REFERENCES schedule_versions(id),
    base_version_id INTEGER REFERENCES schedule_versions(id),
    changed_by INTEGER REFERENCES users(id),
    change_type VARCHAR,
    old_value VARCHAR,
    new_value VARCHAR,
    change_reason TEXT,
    created_at TIMESTAMP
);
```

### 3. 公式化排班系統 (Formula-Based Schedule Generation)

#### **formula_schedules** - 排班公式模板
```sql
CREATE TABLE formula_schedules (
    id INTEGER PRIMARY KEY,
    name VARCHAR NOT NULL,
    identity VARCHAR,                  -- 目標護理師類別
    num_groups INTEGER,               -- 輪班群組數量
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

#### **formula_schedule_patterns** - 公式排班模式
```sql
CREATE TABLE formula_schedule_patterns (
    id INTEGER PRIMARY KEY,
    formula_id INTEGER REFERENCES formula_schedules(id),
    group_number INTEGER,             -- 輪班群組
    day_offset INTEGER,               -- 週期內天數偏移
    pattern VARCHAR,
    shift_type VARCHAR,
    created_at TIMESTAMP,
    UNIQUE(formula_id, group_number, day_offset)
);
```

#### **nurse_formula_assignments** - 護理師公式分配
```sql
CREATE TABLE nurse_formula_assignments (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    formula_id INTEGER REFERENCES formula_schedules(id),
    group_number INTEGER,
    assigned_at TIMESTAMP,
    UNIQUE(user_id, formula_id)
);
```

### 4. 調班系統 (Shift Swapping System)

#### **shift_swap_requests** - 調班申請
```sql
CREATE TABLE shift_swap_requests (
    id INTEGER PRIMARY KEY,
    requestor_id INTEGER REFERENCES users(id),    -- 申請人
    acceptor_id INTEGER REFERENCES users(id),     -- 接受人
    target_nurse_id INTEGER REFERENCES users(id), -- 目標護理師
    from_date DATE NOT NULL,                      -- 原始日期
    to_date DATE NOT NULL,                        -- 目標日期
    from_shift VARCHAR,                           -- 原始班別
    to_shift VARCHAR,                             -- 目標班別
    from_mission VARCHAR,                         -- 原始任務
    to_mission VARCHAR,                           -- 目標任務
    from_overtime VARCHAR,                        -- 原始加班
    to_overtime VARCHAR,                          -- 目標加班
    swap_type VARCHAR,                            -- shift, mission, overtime
    status VARCHAR DEFAULT 'pending',             -- 狀態管理
    validation_result BOOLEAN,                    -- 驗證結果
    validation_message TEXT,                      -- 驗證訊息
    notes TEXT,                                   -- 備註
    accepted_at TIMESTAMP,                        -- 接受時間
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

#### **shift_rules** - 班別規則
```sql
CREATE TABLE shift_rules (
    id INTEGER PRIMARY KEY,
    shift_type VARCHAR NOT NULL,
    start_time VARCHAR,
    end_time VARCHAR,
    max_consecutive INTEGER,           -- 最大連續班數
    min_rest_hours INTEGER,            -- 最小休息時間
    max_weekly_shifts INTEGER,         -- 週最大班數
    max_monthly_shifts INTEGER,        -- 月最大班數
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP
);
```

### 5. 加班管理 (Overtime Management)

#### **overtime_records** - 加班記錄
```sql
CREATE TABLE overtime_records (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    overtime_shift VARCHAR,            -- A, B, C, D, E, F 班別
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
CREATE INDEX idx_overtime_records_date ON overtime_records(date);
```

#### **overtime_monthly_scores** - 月加班積分
```sql
CREATE TABLE overtime_monthly_scores (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    total_score INTEGER DEFAULT 0,
    details TEXT,
    calculated_at TIMESTAMP,
    UNIQUE(user_id, year, month)       -- 每人每月一筆記錄
);
```

#### **schedule_overtimes** - 班表加班
```sql
CREATE TABLE schedule_overtimes (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    date DATE NOT NULL,
    -- 多個加班相關追蹤欄位
    created_by INTEGER REFERENCES users(id),
    last_modified_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### 6. 醫師班表整合 (Doctor Schedule Integration)

#### **doctor_schedules** - 醫師班表主表
```sql
CREATE TABLE doctor_schedules (
    id INTEGER PRIMARY KEY,
    date VARCHAR UNIQUE NOT NULL,      -- 格式: YYYYMMDD
    duty_doctor VARCHAR,               -- 值班醫師姓名
    schedule_notes JSON,               -- 額外排班資訊
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
CREATE UNIQUE INDEX idx_doctor_schedules_date ON doctor_schedules(date);
```

#### **day_shift_doctors** - 日班醫師明細
```sql
CREATE TABLE day_shift_doctors (
    id INTEGER PRIMARY KEY,
    schedule_id INTEGER REFERENCES doctor_schedules(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,             -- 醫師姓名
    summary VARCHAR,                   -- 班表摘要
    time VARCHAR,                      -- 工作時間
    area_code VARCHAR,                 -- 工作區域
    status VARCHAR CHECK (status IN ('on_duty', 'off_duty', 'off')),
    meeting_time VARCHAR,              -- 會議時間 (HH:MM-HH:MM)
    created_at TIMESTAMP
);
```

#### **doctor_schedule_update_logs** - 醫師班表更新日誌
```sql
CREATE TABLE doctor_schedule_update_logs (
    id INTEGER PRIMARY KEY,
    start_date VARCHAR,                -- YYYYMMDD 格式
    end_date VARCHAR,                  -- YYYYMMDD 格式
    success BOOLEAN,
    total_days INTEGER,
    error_message TEXT,
    processing_time VARCHAR,
    created_at TIMESTAMP
);
```

### 7. 公告系統 (Announcement System)

#### **announcement_categories** - 公告分類
```sql
CREATE TABLE announcement_categories (
    id INTEGER PRIMARY KEY,
    name VARCHAR UNIQUE NOT NULL,
    description VARCHAR,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP
);
```

#### **announcements** - 公告主表
```sql
CREATE TABLE announcements (
    id INTEGER PRIMARY KEY,
    category_id INTEGER REFERENCES announcement_categories(id),
    author_id INTEGER REFERENCES users(id),
    title VARCHAR NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_important BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,   -- 置頂功能
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

#### **announcement_permissions** - 公告權限
```sql
CREATE TABLE announcement_permissions (
    id INTEGER PRIMARY KEY,
    announcement_id INTEGER REFERENCES announcements(id),
    user_id INTEGER REFERENCES users(id),
    category_id INTEGER,
    role VARCHAR,
    identity VARCHAR,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP
);
```

### 8. 系統表格 (System Tables)

#### **logs** - 系統日誌
```sql
CREATE TABLE logs (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR NOT NULL,           -- 執行動作
    operation_type VARCHAR,            -- login, logout, create_schedule 等
    operation_time TIMESTAMP,
    ip_address VARCHAR,
    description TEXT,                  -- 動作描述
    details TEXT,                      -- 詳細資訊
    user_agent TEXT,                   -- 瀏覽器資訊
    created_at TIMESTAMP
);
```

#### **settings** - 系統設定
```sql
CREATE TABLE settings (
    key VARCHAR PRIMARY KEY,           -- 設定鍵值
    value TEXT,                        -- 設定值
    description TEXT,                  -- 設定說明
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
CREATE INDEX idx_settings_key ON settings(key);
```

## 資料庫特性與配置

### **索引 (Indexes)**
- **效能索引**: 所有主鍵、外鍵及常查詢欄位
- **唯一索引**: 防止資料重複 (使用者名稱、信箱、憑證)
- **複合索引**: 多欄位搜尋 (user_id + date 組合)
- **專用索引**: 裝置指紋追蹤、班表變更最佳化

### **約束條件 (Constraints)**
- **主鍵**: 所有表格使用自動遞增整數
- **外鍵**: 適當的參照完整性，必要時使用 CASCADE DELETE
- **唯一約束**: 商業邏輯強制執行 (無重複排班、分配)
- **檢查約束**: 資料驗證 (醫師狀態值)

### **資料類型**
- **PostgreSQL 專用**: JSON 欄位用於彈性資料儲存
- **日期處理**: 分離 DATE 和 DATETIME 欄位以提高精確度
- **字串欄位**: 適當長度的 Varchar 支援中文字元
- **布林欄位**: 明確的 true/false 值與適當預設值

## 商業邏輯支援

### **主要功能架構**

1. **角色權限控制**: 使用者角色與身份類別的細緻權限管理
2. **班表版本控制**: 完整稽核軌跡與差異追蹤
3. **公式化生成**: 模板導向的自動排班創建
4. **班別驗證**: 複雜的工時合規規則
5. **加班積分**: 點數制分配系統
6. **WebAuthn 整合**: 現代生物辨識認證
7. **醫師整合**: 外部 API 資料同步
8. **稽核日誌**: 完整的操作追蹤

### **資料關係圖**

```
users (使用者)
├── webauthn_credentials (WebAuthn憑證)
├── monthly_schedules (月班表)
├── shift_swap_requests (調班申請)
├── overtime_records (加班記錄)
├── nurse_formula_assignments (公式分配)
└── logs (操作日誌)

schedule_versions (班表版本)
├── monthly_schedules (月班表)
├── schedule_version_diffs (版本差異)
└── schedule_changes (班表變更)

formula_schedules (排班公式)
├── formula_schedule_patterns (公式模式)
├── nurse_formula_assignments (護理師分配)
└── pattern_nurse_assignments (模式分配)

doctor_schedules (醫師班表)
└── day_shift_doctors (日班醫師)

announcements (公告)
├── announcement_categories (公告分類)
└── announcement_permissions (公告權限)
```

### **遷移歷史記錄**

資料庫包含多個遷移腳本顯示系統演化：
- `add_hire_date.sql`: 新增到職日期追蹤與歷史資料
- `add_is_pinned_to_announcements.py`: 新增公告置頂功能
- `add_last_activity_time.sql`: 新增使用者活動心跳追蹤
- `add_special_type_to_schedules.py`: 新增 SNP/LNP 包班分類

## 效能最佳化

### **查詢最佳化**
- 經常查詢的欄位建立索引
- 複合索引支援多條件查詢
- 外鍵索引加速關聯查詢

### **資料完整性**
- 外鍵約束確保參照完整性
- 唯一約束防止資料重複
- 檢查約束驗證資料有效性

### **擴展性設計**
- JSON 欄位支援彈性資料結構
- 版本控制系統支援歷史追蹤
- 模組化設計便於功能擴展

此資料庫架構展現了一個設計良好、適合正式環境的系統，支援複雜的醫療排班需求，具備適當的資料完整性、效能最佳化和稽核功能。

## 資料庫同步機制

### **同步需求背景**

正式環境資料庫持續更新，開發和測試環境需要定期同步正式資料以確保：
- 開發時使用真實資料結構和內容
- 測試環境接近正式環境狀態
- 問題排查時可複製正式環境資料

### **同步方案架構**

系統提供兩種資料庫同步方案：

#### **方案 A: PostgreSQL 邏輯複製（推薦）**

**架構**：
```
正式環境 (Zeabur)          本地/測試環境
    ↓                          ↓
[Publisher]    →→→→→→→→    [Subscriber]
(wal_level=logical)       (接收同步資料)
```

**特點**：
- ✅ **即時同步**：毫秒級延遲，資料接近即時更新
- ✅ **低資源消耗**：PostgreSQL 原生支援，無需額外服務
- ✅ **自動化**：設定後自動執行，無需手動介入
- ✅ **單向複製**：防止測試環境資料回寫正式環境

**適用條件**：
- PostgreSQL 10+ 版本
- `wal_level = logical`
- 具有 `REPLICATION` 權限

**同步對象**：
- ✅ 所有表格資料（可選擇特定表格）
- ❌ 表格結構（需先在訂閱端建立）
- ❌ 索引和約束（需先在訂閱端建立）

#### **方案 B: Python 增量同步（備案）**

**架構**：
```
正式環境              增量同步腳本           本地/測試環境
    ↓                      ↓                      ↓
[Source DB]  ←讀取增量→  [Python]  →寫入→  [Target DB]
              (基於 updated_at)
```

**特點**：
- ✅ **靈活控制**：可自定義同步邏輯和資料脫敏
- ✅ **低權限需求**：只需一般查詢權限
- ✅ **批次同步**：支援大數據量分批處理
- ⚠️ **定期執行**：需排程觸發（如每 10 分鐘）

**同步機制**：
1. **增量判斷**：基於 `updated_at` 欄位判斷變更記錄
2. **外鍵順序**：依照依賴關係排序同步（users → schedules → ...）
3. **UPSERT 邏輯**：存在則更新，不存在則插入
4. **敏感資料處理**：排除密碼等敏感欄位

**同步順序**（依外鍵依賴）：
```
1. users                      # 最優先（其他表格依賴）
2. formula_schedules          # 班表公式
3. schedules                  # 班表（依賴 users）
4. shift_swap_requests        # 調班申請（依賴 users, schedules）
5. overtime_records           # 加班記錄（依賴 users, schedules）
6. announcements              # 公告
7. doctor_schedules           # 醫師班表
8. doctor_schedule_details    # 醫師班表詳情（依賴 doctor_schedules）
9. notifications              # 通知（依賴 users）
10. shift_swap_notifications  # 調班通知（依賴 shift_swap_requests, users）
11. webauthn_credentials      # WebAuthn 憑證（依賴 users）
12. application_logs          # 應用程式日誌（最後）
```

### **敏感資料處理**

**排除同步的欄位**：
- `users.password` - 密碼欄位（使用測試密碼）
- `webauthn_credentials.credential_id` - 生物辨識憑證
- `webauthn_credentials.public_key` - 公鑰資料

**脫敏方式**：
- **方案 A**：使用訂閱端觸發器自動脱敏
- **方案 B**：配置檔 `exclude_fields` 排除欄位

### **同步工具說明**

#### **檢查工具**
- **`check_replication_support.py`**
  - 檢查資料庫是否支援邏輯複製
  - 驗證權限和配置
  - 檢查 `updated_at` 欄位（用於增量同步）

#### **邏輯複製工具（方案 A）**
- **`setup_replication.sql`**
  - 發布端：建立 PUBLICATION
  - 訂閱端：建立 SUBSCRIPTION
  - 包含測試驗證 SQL

- **`monitor_replication.py`**
  - 監控複製狀態和延遲
  - 檢查複製槽位健康度
  - 支援持續監控和告警

#### **增量同步工具（方案 B）**
- **`sync_db_incremental.py`**
  - 主同步腳本
  - 支援增量和全量同步
  - 批次處理大數據量

- **`sync_config.json`**
  - 資料庫連線配置
  - 同步表格清單
  - 排除欄位設定

- **`sync_state.json`** (自動生成)
  - 記錄最後同步時間
  - 追蹤同步統計

### **同步監控指標**

**邏輯複製監控**：
```sql
-- 查看複製延遲
SELECT
    subname,
    EXTRACT(EPOCH FROM (now() - latest_end_time))::INT AS lag_seconds
FROM pg_stat_subscription;

-- 查看複製槽位狀態
SELECT
    slot_name,
    active,
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS lag
FROM pg_replication_slots;
```

**Python 同步監控**：
```bash
# 查看同步狀態
cat backend/scripts/sync_state.json

# 執行監控腳本
python monitor_replication.py --mode subscriber --watch 30
```

### **故障處理機制**

**常見問題與解決**：

1. **權限不足**
   - 問題：無法建立 PUBLICATION
   - 解決：改用 Python 增量同步

2. **同步延遲過大**
   - 問題：lag_seconds > 60
   - 解決：檢查網路、重建訂閱或增加資源

3. **資料衝突**
   - 問題：測試環境修改資料被覆蓋
   - 解決：使用獨立測試資料庫或唯讀模式

4. **表格無時間戳記**
   - 問題：無法增量同步
   - 解決：全量同步或新增 `updated_at` 欄位

### **安全性考量**

**網路安全**：
- ✅ 使用 SSL 連線（`sslmode=require`）
- ✅ 防火牆限制 IP 白名單
- ✅ 加密傳輸敏感資料

**資料安全**：
- ✅ 敏感欄位排除或脫敏
- ✅ 測試環境使用獨立密碼
- ✅ 禁止測試環境回寫正式環境

**稽核記錄**：
- ✅ 記錄同步時間和數量
- ✅ 監控異常同步行為
- ✅ 定期檢視同步日誌

### **效能影響評估**

**對正式環境的影響**：
- PostgreSQL 邏輯複製：< 1% CPU/Memory
- 網路頻寬：依資料變更量，通常 < 10 MB/hr
- 不阻塞正式環境寫入操作

**對本地/測試環境的影響**：
- 資料庫寫入：UPSERT 操作
- 磁碟空間：與正式環境相同
- 建議配置：至少與正式環境 50% 的資源

### **部署建議**

**正式環境部署**：
1. 選擇低峰時段設定 PUBLICATION
2. 監控資源使用情況
3. 設定複製槽位大小限制

**本地/測試環境部署**：
1. 先執行 `init_db.py` 建立表格結構
2. 設定 SUBSCRIPTION 或排程 Python 同步
3. 驗證資料完整性

**整合到 APScheduler**（Python 方案）：
```python
# backend/app/tasks/scheduler.py
from scripts.sync_db_incremental import IncrementalSync, DatabaseConnector

scheduler.add_job(
    scheduled_db_sync,
    'interval',
    minutes=10,
    id='db_sync',
    name='資料庫增量同步'
)
```

### **相關文件**

完整同步實作指南請參考：
- [`backend/scripts/README_DATABASE_SYNC.md`](../backend/scripts/README_DATABASE_SYNC.md) - 詳細使用說明
- [`backend/scripts/setup_replication.sql`](../backend/scripts/setup_replication.sql) - 邏輯複製設定
- [`backend/scripts/sync_config.json`](../backend/scripts/sync_config.json) - 同步配置範本

---

**資料庫架構最後更新**: 2025-10-02
**同步機制版本**: v1.0