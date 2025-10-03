# 資料庫自動同步說明

## 🎯 功能概述

系統已整合 **APScheduler 自動背景同步**，實現正式環境到本地/測試環境的單向資料同步。

### ✅ 關鍵特性

- **🔄 自動執行**: 無需手動操作，後端啟動即自動運行
- **📍 單向同步**: 正式環境 (Zeabur) → 本地/測試環境
- **⏰ 定期更新**: 每 10 分鐘自動增量同步
- **🔒 安全機制**: 只在本地/測試環境啟動，避免影響正式環境
- **📊 智能增量**: 只同步變更資料，節省時間和資源

---

## 📋 同步配置

### 同步時程

| 事件 | 執行時機 | 說明 |
|------|---------|------|
| **首次同步** | 系統啟動後 30 秒 | 確保環境初始化後執行 |
| **定期同步** | 每 10 分鐘 | 持續保持資料一致性 |
| **增量檢測** | 每次執行 | 基於 `updated_at` 判斷變更 |

### 同步方向

```
正式環境 (Zeabur)          本地/測試環境
   PostgreSQL    ────────▶   PostgreSQL
                (單向同步)
```

**⚠️ 重要**:
- ✅ 正式環境的變更會自動同步到本地
- ❌ 本地環境的變更**不會**回寫到正式環境
- ✅ 本地修改會被下次同步覆蓋（保護正式資料）

---

## 🚀 啟動流程

### 自動啟動

當您啟動後端服務時：

```bash
cd backend
python main.py
```

會自動執行以下流程：

1. ✅ 檢查環境（`IS_PRODUCTION`）
2. ✅ 如果是本地/測試環境 → 啟動同步任務
3. ✅ 如果是正式環境 → 跳過同步（單向保護）
4. ✅ 30 秒後執行首次同步
5. ✅ 每 10 分鐘自動執行增量同步

### 日誌輸出

**啟動成功**：
```
INFO - 資料庫同步定時任務啟動成功（正式環境 → 本地，每10分鐘執行）
```

**同步執行**：
```
INFO - 開始執行資料庫增量同步...
INFO - 📋 同步表格: users
INFO - ℹ️  無新資料需要同步
INFO - 資料庫增量同步完成
```

**錯誤處理**：
```
ERROR - 資料庫同步時發生錯誤: [詳細錯誤訊息]
```

---

## 📊 同步範圍

### 同步表格清單

依照外鍵依賴順序同步：

1. ✅ `users` - 使用者資料（排除 password）
2. ✅ `formula_schedules` - 班表公式
3. ✅ `monthly_schedules` - 月班表
4. ✅ `schedule_versions` - 班表版本
5. ✅ `schedule_version_diffs` - 版本差異
6. ✅ `schedule_changes` - 班表變更
7. ✅ `shift_swap_requests` - 調班申請
8. ✅ `overtime_records` - 加班記錄
9. ✅ `overtime_points` - 加班積分
10. ✅ `overtime_monthly_scores` - 月加班分數
11. ✅ `overtime_summaries` - 加班統計
12. ✅ `announcements` - 公告
13. ✅ `doctor_schedules` - 醫師班表
14. ✅ `day_shift_doctors` - 日班醫師
15. ✅ `doctor_schedule_update_logs` - 醫師班表更新日誌
16. ⚠️ `webauthn_credentials` - WebAuthn 憑證（排除敏感欄位）
17. ✅ `logs` - 系統日誌

### 排除欄位

為保護敏感資料，以下欄位**不會**同步：

- `users.password` - 用戶密碼
- `webauthn_credentials.credential_id` - 生物辨識憑證
- `webauthn_credentials.public_key` - 公鑰資料

---

## 🔧 技術實作

### 檔案結構

```
backend/
├── app/
│   └── tasks/
│       ├── db_sync_tasks.py          # 同步任務管理器 ✨新增
│       └── doctor_schedule_tasks.py  # 醫師班表任務
├── main.py                            # 主應用程式 (已整合)
└── scripts/
    ├── sync_db_incremental.py        # 核心同步邏輯
    ├── sync_config.json               # 同步配置
    └── sync_state.json                # 同步狀態 (自動生成)
```

### 核心代碼

**任務管理器** (`app/tasks/db_sync_tasks.py`):

```python
class DatabaseSyncTaskManager:
    def start_scheduler(self):
        # 每10分鐘執行一次
        self.scheduler.add_job(
            func=self.sync_database_incremental,
            trigger=IntervalTrigger(minutes=10),
            id='database_sync_incremental',
            name='資料庫增量同步 (正式環境 → 本地)',
            max_instances=1
        )
```

**主應用程式整合** (`main.py`):

```python
# 只在本地/測試環境啟動
if not settings.IS_PRODUCTION:
    db_sync_task_manager.start_scheduler()
    logger.info("資料庫同步定時任務啟動成功")
```

---

## 📈 監控與維護

### 查看同步狀態

```bash
# 查看同步歷史
cat backend/scripts/sync_state.json | python3 -m json.tool

# 輸出範例
{
  "users": {
    "last_sync_time": "2025-10-03T14:20:23",
    "records_synced": 0,
    "updated_at": "2025-10-03T14:20:23"
  },
  "doctor_schedules": {
    "last_sync_time": "2025-10-03T14:20:32",
    "records_synced": 114,
    "updated_at": "2025-10-03T14:20:33"
  }
}
```

### 手動測試

```bash
# 測試自動同步功能
cd backend
python3 test_auto_sync.py
```

### 手動全量同步

如遇資料不一致，可手動執行全量同步：

```bash
cd backend/scripts
python3 sync_db_incremental.py --target local --full
```

---

## ⚙️ 配置調整

### 修改同步頻率

編輯 `app/tasks/db_sync_tasks.py`:

```python
# 改為每 5 分鐘
trigger=IntervalTrigger(minutes=5)

# 改為每小時
trigger=IntervalTrigger(hours=1)
```

### 停用自動同步

編輯 `app/tasks/db_sync_tasks.py`:

```python
class DatabaseSyncTaskManager:
    def __init__(self):
        self.sync_enabled = False  # 改為 False
```

### 新增同步表格

編輯 `scripts/sync_config.json`:

```json
{
  "sync_tables": [
    "users",
    "new_table_name",  // 加入新表格
    ...
  ]
}
```

**⚠️ 注意**: 新增表格時需考慮外鍵依賴順序！

---

## 🔍 故障排除

### 問題 1: 同步未啟動

**現象**: 後端啟動但沒有同步日誌

**檢查**:
```bash
# 確認環境變數
echo $IS_PRODUCTION  # 應為空或 false

# 檢查配置
cat backend/scripts/sync_config.json
```

**解決**:
- 確保不是正式環境 (`IS_PRODUCTION != true`)
- 檢查 `db_sync_tasks.py` 中 `sync_enabled = True`

### 問題 2: 同步錯誤

**現象**: 日誌顯示同步失敗

**檢查**:
```bash
# 測試資料庫連線
python3 backend/scripts/check_replication_support.py

# 手動執行同步查看詳細錯誤
python3 backend/scripts/sync_db_incremental.py --target local
```

**常見原因**:
- 正式環境資料庫連線問題
- 本地資料庫未初始化 (`python init_db.py`)
- 表格結構不一致

### 問題 3: 資料不一致

**現象**: 本地資料與正式環境不符

**解決**:
```bash
# 執行全量同步重置
python3 scripts/sync_db_incremental.py --target local --full
```

---

## 📚 相關文件

- [QUICK_START.md](QUICK_START.md) - 快速入門指南
- [README_DATABASE_SYNC.md](README_DATABASE_SYNC.md) - 完整同步手冊
- [sync_config.json](sync_config.json) - 同步配置
- [../docs/DATABASE_ARCHITECTURE.md](../../docs/DATABASE_ARCHITECTURE.md) - 資料庫架構

---

## 🎉 總結

✅ **已完成整合**:
- APScheduler 自動背景同步
- 單向安全機制（正式 → 本地）
- 智能增量同步（只同步變更）
- 完整錯誤處理和日誌

✅ **使用方式**:
1. 啟動後端服務 (`python main.py`)
2. 系統自動開始同步
3. 查看 `sync_state.json` 監控狀態
4. 如有需要，手動執行全量同步

🔒 **安全保證**:
- 只在本地/測試環境執行
- 單向同步保護正式環境
- 敏感資料自動排除

---

**最後更新**: 2025-10-03
**狀態**: ✅ 已整合並測試通過
