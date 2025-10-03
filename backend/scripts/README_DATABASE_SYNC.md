# 資料庫同步方案使用指南

本文件說明如何將正式環境的 PostgreSQL 資料庫同步到本地或測試環境。

## 📋 目錄

- [方案概述](#方案概述)
- [方案 A: PostgreSQL 邏輯複製（推薦）](#方案-a-postgresql-邏輯複製推薦)
- [方案 B: Python 增量同步（備案）](#方案-b-python-增量同步備案)
- [工具說明](#工具說明)
- [常見問題](#常見問題)
- [故障排除](#故障排除)

---

## 方案概述

### 🎯 使用場景

- **正式環境資料不斷更新**，需要定期同步到本地/測試環境
- **開發和測試**需要使用接近正式環境的資料
- **資料分析**或**問題排查**需要複製正式資料

### 📊 方案比較

| 特性 | 方案 A: 邏輯複製 | 方案 B: Python 同步 |
|------|-----------------|-------------------|
| **同步延遲** | 毫秒級 (即時) | 分鐘級 (排程) |
| **資源消耗** | 極低 | 中等 |
| **設定複雜度** | 低 | 中 |
| **維護成本** | 極低 | 中 |
| **權限要求** | 需要 REPLICATION | 一般查詢權限 |
| **適用場景** | 即時同步需求 | 定期批次同步 |

---

## 方案 A: PostgreSQL 邏輯複製（推薦）

### 📌 前置需求

1. **發布端（正式環境）**：
   - PostgreSQL 10+ 版本
   - `wal_level = logical`
   - 具有 `REPLICATION` 權限或超級用戶權限

2. **訂閱端（本地/測試環境）**：
   - PostgreSQL 10+ 版本
   - 已建立相同的資料庫結構（執行 `init_db.py`）
   - 能夠連接到發布端資料庫

### 🔍 步驟 1: 檢查支援度

首先檢查正式環境是否支援邏輯複製：

```bash
cd backend/scripts
python check_replication_support.py
```

**預期輸出**：
```
✅ 此資料庫 **完全支援** PostgreSQL 邏輯複製
   建議使用邏輯複製方案進行資料同步
```

### ⚙️ 步驟 2: 設定發布端（正式環境）

使用 `psql` 或資料庫管理工具連接到**正式環境**，執行：

```bash
# 方式 1: 使用 psql
PGPASSWORD=SGPdg26Npyc35KtzHoW1x4U0YC7TkL98 psql \
  -h hnd1.clusters.zeabur.com \
  -p 32221 \
  -U root \
  -d zeabur \
  -f setup_replication.sql
```

或手動執行 SQL：

```sql
-- 建立發布（選擇方案 A 或 B）

-- 方案 A: 發布所有表格（簡單）
CREATE PUBLICATION anes_prod_publication FOR ALL TABLES;

-- 方案 B: 發布特定表格（推薦，可控性高）
CREATE PUBLICATION anes_prod_publication FOR TABLE
    users, schedules, shift_swap_requests, overtime_records,
    announcements, doctor_schedules, doctor_schedule_details,
    formula_schedules, notifications, shift_swap_notifications,
    application_logs, webauthn_credentials;
```

**驗證發布**：
```sql
SELECT * FROM pg_publication WHERE pubname = 'anes_prod_publication';
```

### 🔗 步驟 3: 設定訂閱端（本地環境）

⚠️ **重要**：先確保本地資料庫已執行 `init_db.py` 建立表格結構！

連接到**本地資料庫**，執行：

```bash
# 方式 1: 使用 psql
PGPASSWORD=anes_password psql \
  -h localhost \
  -U anes_user \
  -d anes_db
```

然後執行：

```sql
-- 建立訂閱
CREATE SUBSCRIPTION anes_local_subscription
CONNECTION 'postgresql://root:SGPdg26Npyc35KtzHoW1x4U0YC7TkL98@hnd1.clusters.zeabur.com:32221/zeabur'
PUBLICATION anes_prod_publication
WITH (
    copy_data = true,          -- 初次訂閱時複製現有資料
    create_slot = true,        -- 自動建立複製槽位
    enabled = true             -- 立即啟用訂閱
);
```

**驗證訂閱**：
```sql
-- 查看訂閱狀態
SELECT * FROM pg_subscription WHERE subname = 'anes_local_subscription';

-- 查看複製統計
SELECT * FROM pg_stat_subscription WHERE subname = 'anes_local_subscription';
```

### 📊 步驟 4: 監控同步狀態

使用監控工具檢查複製狀態：

```bash
# 檢查訂閱端狀態
python monitor_replication.py --mode subscriber

# 檢查發布端狀態（需提供發布端連線）
python monitor_replication.py --mode publisher \
  --publisher-url "postgresql://root:SGPdg26Npyc35KtzHoW1x4U0YC7TkL98@hnd1.clusters.zeabur.com:32221/zeabur"

# 持續監控（每 30 秒檢查一次）
python monitor_replication.py --mode subscriber --watch 30
```

### 🛠️ 維護操作

```sql
-- 暫停同步
ALTER SUBSCRIPTION anes_local_subscription DISABLE;

-- 恢復同步
ALTER SUBSCRIPTION anes_local_subscription ENABLE;

-- 重新整理（當發布端新增表格時）
ALTER SUBSCRIPTION anes_local_subscription REFRESH PUBLICATION;

-- 查看延遲
SELECT
    subname,
    EXTRACT(EPOCH FROM (now() - latest_end_time))::INT AS lag_seconds
FROM pg_stat_subscription;
```

### 🗑️ 移除複製

```sql
-- 在訂閱端執行
DROP SUBSCRIPTION IF EXISTS anes_local_subscription;

-- 在發布端執行（清理槽位）
SELECT pg_drop_replication_slot('anes_local_slot');
DROP PUBLICATION IF EXISTS anes_prod_publication;
```

---

## 方案 B: Python 增量同步（備案）

### 📌 使用時機

- Zeabur 不支援邏輯複製權限
- 需要更靈活的同步控制（如資料脫敏）
- 只需定期同步，不需即時更新

### ⚙️ 步驟 1: 設定同步配置

編輯 `sync_config.json`：

```json
{
  "source": {
    "database_url": "postgresql://root:SGPdg26Npyc35KtzHoW1x4U0YC7TkL98@hnd1.clusters.zeabur.com:32221/zeabur"
  },
  "targets": {
    "local": {
      "database_url": "postgresql://anes_user:anes_password@localhost:5432/anes_db"
    }
  },
  "exclude_fields": {
    "users": ["password"],
    "webauthn_credentials": ["credential_id", "public_key"]
  }
}
```

### 🔄 步驟 2: 執行同步

```bash
cd backend/scripts

# 首次執行：全量同步
python sync_db_incremental.py --target local --full

# 後續執行：增量同步
python sync_db_incremental.py --target local

# 只同步特定表格
python sync_db_incremental.py --target local --tables users,schedules

# 同步到測試環境
python sync_db_incremental.py --target test
```

### 📊 步驟 3: 查看同步狀態

同步狀態會記錄在 `sync_state.json`：

```bash
cat sync_state.json
```

**輸出範例**：
```json
{
  "users": {
    "last_sync_time": "2025-10-02T10:30:00",
    "records_synced": 45,
    "updated_at": "2025-10-02T10:30:05"
  },
  "schedules": {
    "last_sync_time": "2025-10-02T10:30:10",
    "records_synced": 1250,
    "updated_at": "2025-10-02T10:30:15"
  }
}
```

### ⏰ 步驟 4: 設定自動排程（可選）

整合到現有的 APScheduler：

```python
# backend/app/tasks/scheduler.py

from scripts.sync_db_incremental import IncrementalSync, DatabaseConnector

async def scheduled_db_sync():
    """定期資料庫同步任務"""
    connector = DatabaseConnector()
    source_url = connector.get_source_url()
    target_url = connector.get_target_url('local')

    sync = IncrementalSync(source_url, target_url)
    tables = connector.get_sync_tables()

    await sync.sync_all_tables(tables, force_full=False, connector=connector)

# 加入排程（每 10 分鐘執行一次）
scheduler.add_job(
    scheduled_db_sync,
    'interval',
    minutes=10,
    id='db_sync',
    name='資料庫增量同步'
)
```

---

## 工具說明

### 📁 檔案列表

| 檔案 | 說明 | 使用方式 |
|------|------|---------|
| `check_replication_support.py` | 檢查資料庫是否支援邏輯複製 | `python check_replication_support.py` |
| `setup_replication.sql` | 邏輯複製設定 SQL 腳本 | `psql -f setup_replication.sql` |
| `monitor_replication.py` | 複製狀態監控工具 | `python monitor_replication.py --mode subscriber` |
| `sync_db_incremental.py` | Python 增量同步腳本 | `python sync_db_incremental.py --target local` |
| `sync_config.json` | 同步配置文件 | 編輯後使用 |
| `sync_state.json` | 同步狀態記錄（自動生成） | 查看同步歷史 |

### 🔧 環境變數

如果不使用配置文件，可以設定環境變數：

```bash
# .env
SOURCE_DATABASE_URL=postgresql://root:SGPdg26Npyc35KtzHoW1x4U0YC7TkL98@hnd1.clusters.zeabur.com:32221/zeabur
TARGET_DATABASE_URL=postgresql://anes_user:anes_password@localhost:5432/anes_db
```

---

## 常見問題

### ❓ Q1: 如何選擇使用哪個方案？

**A**: 建議流程：
1. 執行 `check_replication_support.py` 檢查
2. 如果支援邏輯複製 → 使用**方案 A**（即時、低維護）
3. 如果不支援 → 使用**方案 B**（靈活、可控）

### ❓ Q2: 邏輯複製會影響正式環境效能嗎？

**A**: 影響極小（< 1% CPU/Memory）。PostgreSQL 邏輯複製是異步的，不會阻塞正式環境的寫入操作。

### ❓ Q3: 如果本地環境修改了資料會怎樣？

**A**:
- **邏輯複製**：本地修改會被正式環境的更新覆蓋（單向同步）
- **Python 同步**：使用 UPSERT 邏輯，以正式環境資料為準

建議：測試環境應避免手動修改資料，或使用獨立的測試資料庫。

### ❓ Q4: 如何處理敏感資料？

**A**:
- **方案 A**：使用觸發器在訂閱端自動脫敏
- **方案 B**：在 `sync_config.json` 的 `exclude_fields` 設定排除欄位

範例脫敏觸發器（方案 A）：
```sql
-- 在訂閱端執行
CREATE OR REPLACE FUNCTION mask_sensitive_data()
RETURNS TRIGGER AS $$
BEGIN
    NEW.password = 'MASKED';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mask_users_password
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION mask_sensitive_data();
```

### ❓ Q5: 同步會複製資料庫結構嗎？

**A**:
- **邏輯複製**：只複製資料，不複製結構。需先在訂閱端執行 `init_db.py`
- **Python 同步**：同上，只同步資料

### ❓ Q6: 可以同步到多個環境嗎？

**A**: 可以！
- **方案 A**：建立多個訂閱（在不同環境執行 `CREATE SUBSCRIPTION`）
- **方案 B**：在 `sync_config.json` 的 `targets` 新增多個目標

---

## 故障排除

### 🔴 問題 1: 邏輯複製無法建立

**錯誤訊息**：
```
ERROR: permission denied to create publication
```

**原因**：用戶沒有 `REPLICATION` 權限

**解決方式**：
1. 聯繫 Zeabur 支援申請權限
2. 或改用**方案 B**（Python 增量同步）

---

### 🔴 問題 2: 訂閱建立失敗

**錯誤訊息**：
```
ERROR: could not connect to publisher
```

**檢查清單**：
- [ ] 網路連線是否正常？
- [ ] 正式環境防火牆是否允許本地 IP？
- [ ] 連線字串是否正確？
- [ ] 密碼是否包含特殊字元（需 URL 編碼）？

**解決方式**：
```bash
# 測試連線
PGPASSWORD=SGPdg26Npyc35KtzHoW1x4U0YC7TkL98 psql \
  -h hnd1.clusters.zeabur.com \
  -p 32221 \
  -U root \
  -d zeabur \
  -c "SELECT 1"
```

---

### 🔴 問題 3: 同步延遲過大

**現象**：`lag_seconds > 60`

**可能原因**：
1. 網路延遲
2. 正式環境寫入量大
3. 本地環境效能不足

**解決方式**：
```sql
-- 檢查複製槽位狀態
SELECT
    slot_name,
    active,
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS lag
FROM pg_replication_slots;

-- 如果延遲過大，考慮刪除後重新建立訂閱
DROP SUBSCRIPTION anes_local_subscription;
-- 然後重新建立
```

---

### 🔴 問題 4: Python 同步腳本錯誤

**錯誤訊息**：
```
ModuleNotFoundError: No module named 'asyncpg'
```

**解決方式**：
```bash
# 安裝依賴
cd backend
pip install -r requirements.txt

# 或使用 uv（更快）
pip install uv
uv pip install -r requirements.txt
```

---

### 🔴 問題 5: 表格無 updated_at 欄位

**錯誤訊息**：
```
⚠️ 表格 xxx 無時間戳記欄位，執行全量同步
```

**解決方式**：

**選項 1**：接受全量同步（適合小表格）

**選項 2**：新增 `updated_at` 欄位（需遷移腳本）：
```sql
ALTER TABLE xxx ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TRIGGER update_xxx_updated_at
BEFORE UPDATE ON xxx
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

---

## 📞 技術支援

如遇到問題，請提供以下資訊：

1. **環境資訊**：
   ```bash
   python check_replication_support.py > support_info.txt
   ```

2. **錯誤日誌**：
   ```bash
   # PostgreSQL 日誌
   tail -f /var/log/postgresql/postgresql.log

   # Python 腳本輸出
   python sync_db_incremental.py --target local 2>&1 | tee sync_error.log
   ```

3. **同步狀態**：
   ```bash
   cat sync_state.json
   ```

---

## 📚 相關文件

- [DATABASE_ARCHITECTURE.md](../../docs/DATABASE_ARCHITECTURE.md) - 資料庫架構說明
- [PostgreSQL 邏輯複製官方文件](https://www.postgresql.org/docs/current/logical-replication.html)
- [CLAUDE.md](../../CLAUDE.md) - 專案開發指南

---

**最後更新**: 2025-10-02
**維護者**: ANES Management Team
