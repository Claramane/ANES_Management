# 資料庫同步快速入門

## 🚀 快速開始

### 1. 檢查環境支援

```bash
cd backend/scripts
python3 check_replication_support.py
```

**結果**：
- ✅ Zeabur 正式環境：`wal_level = replica` → **不支援邏輯複製**
- ✅ 使用方案：**Python 增量同步**

---

## 📦 首次全量同步

第一次使用時，需要執行全量同步：

```bash
python3 sync_db_incremental.py --target local --full
```

**預期結果**：
```
✅ 成功同步 58,000+ 筆記錄
耗時: ~20 秒
```

**驗證同步結果**：
```bash
# 比較正式和本地資料數量
python3 << 'EOF'
import asyncio, asyncpg

async def verify():
    prod = await asyncpg.connect("postgresql://root:SGPdg26Npyc35KtzHoW1x4U0YC7TkL98@hnd1.clusters.zeabur.com:32221/zeabur")
    local = await asyncpg.connect("postgresql://anes_user:anes_password@localhost:5432/anes_db")

    for table in ['users', 'monthly_schedules', 'shift_swap_requests']:
        p = await prod.fetchval(f"SELECT COUNT(*) FROM {table}")
        l = await local.fetchval(f"SELECT COUNT(*) FROM {table}")
        print(f"{'✅' if p == l else '❌'} {table}: 正式 {p} | 本地 {l}")

    await prod.close()
    await local.close()

asyncio.run(verify())
EOF
```

---

## 🔄 日常增量同步

後續執行時，會自動只同步變更的資料：

```bash
# 同步所有表格（只同步有變更的記錄）
python3 sync_db_incremental.py --target local

# 只同步特定表格
python3 sync_db_incremental.py --target local --tables users,monthly_schedules
```

**增量同步原理**：
- 基於 `updated_at` 欄位判斷變更
- 只同步最後一次同步時間之後的記錄
- 同步狀態記錄在 `sync_state.json`

---

## 📊 查看同步狀態

```bash
# 查看同步歷史
cat sync_state.json | python3 -m json.tool

# 範例輸出
{
  "users": {
    "last_sync_time": "2025-10-03T14:05:20.367302",
    "records_synced": 50,
    "updated_at": "2025-10-03T14:05:20.446615"
  },
  ...
}
```

---

## ⚙️ 配置說明

編輯 `sync_config.json`：

```json
{
  "source": {
    "database_url": "postgresql://正式環境連線"
  },
  "targets": {
    "local": {
      "database_url": "postgresql://本地環境連線"
    }
  },
  "sync_tables": [
    "users",
    "monthly_schedules",
    ...
  ],
  "exclude_fields": {
    "users": ["password"]
  }
}
```

**重要欄位**：
- `source`: 正式環境連線（Zeabur）
- `targets.local`: 本地環境連線
- `sync_tables`: 要同步的表格（依外鍵順序）
- `exclude_fields`: 不同步的欄位（如密碼）

---

## 🔍 故障排除

### 問題 1: 連線失敗

```bash
❌ 連接失敗: connection refused
```

**解決**：
1. 檢查本地 PostgreSQL 是否啟動
2. 驗證連線資訊：`psql -h localhost -U anes_user -d anes_db`

### 問題 2: 表格不存在

```bash
❌ relation "xxx" does not exist
```

**解決**：
1. 先執行 `python3 ../init_db.py` 建立表格結構
2. 確認 `sync_config.json` 的表格名稱正確

### 問題 3: 外鍵錯誤

```bash
❌ foreign key constraint fails
```

**解決**：
- 依照 `sync_config.json` 中的順序同步（已自動處理）
- 確保 `users` 等基礎表格先同步

---

## 🤖 自動同步（已整合 APScheduler）

### ✅ 自動同步已啟用

系統已整合到 APScheduler，**自動背景執行**：

**同步設定**：
- 📍 **單向同步**: 正式環境 (Zeabur) → 本地環境
- ⏰ **執行頻率**: 每 10 分鐘自動執行一次
- 🚀 **首次執行**: 系統啟動後 30 秒執行
- 🔒 **安全機制**: 只在本地/測試環境啟動，正式環境不執行

**實作位置**：
- 任務管理器: `backend/app/tasks/db_sync_tasks.py`
- 啟動整合: `backend/main.py` (已自動啟動)

**查看同步日誌**：
```bash
# 後端啟動時會顯示
INFO - 資料庫同步定時任務啟動成功（正式環境 → 本地，每10分鐘執行）
```

### 手動觸發全量同步（可選）

如需手動執行全量同步：
```bash
cd backend/scripts
python3 sync_db_incremental.py --target local --full
```

---

## 📋 常用指令總結

| 指令 | 用途 |
|------|------|
| `python3 check_replication_support.py` | 檢查邏輯複製支援 |
| `python3 sync_db_incremental.py --target local --full` | 首次全量同步 |
| `python3 sync_db_incremental.py --target local` | 增量同步所有表格 |
| `python3 sync_db_incremental.py --target local --tables users` | 只同步特定表格 |
| `cat sync_state.json \| python3 -m json.tool` | 查看同步狀態 |

---

## 📚 完整文件

詳細使用說明請參考：
- [README_DATABASE_SYNC.md](README_DATABASE_SYNC.md) - 完整操作手冊
- [../docs/DATABASE_ARCHITECTURE.md](../../docs/DATABASE_ARCHITECTURE.md) - 資料庫架構與同步機制

---

**最後更新**: 2025-10-03
**狀態**: ✅ 已測試，正常運作
