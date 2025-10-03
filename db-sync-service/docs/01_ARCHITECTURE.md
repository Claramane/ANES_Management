# 架構設計文件

## 🏗️ 系統架構

### 整體架構圖

```
┌─────────────────────────────────────────────────┐
│              Zeabur 正式環境                      │
│  ┌──────────────────────────────────────────┐   │
│  │  PostgreSQL Database (正式資料庫)         │   │
│  │  - 真實業務資料                           │   │
│  │  - 持續更新中                             │   │
│  └──────────────┬───────────────────────────┘   │
└─────────────────┼───────────────────────────────┘
                  │
                  │ (讀取)
                  ▼
┌─────────────────────────────────────────────────┐
│        Zeabur - DB Sync Service (獨立專案)       │
│  ┌──────────────────────────────────────────┐   │
│  │  Python 同步服務                          │   │
│  │  - 定期執行 (每10分鐘)                    │   │
│  │  - 增量同步邏輯                           │   │
│  │  - 多目標支援                             │   │
│  │  - 環境變數配置                           │   │
│  └──────────────┬───────────────────────────┘   │
└─────────────────┼───────────────────────────────┘
                  │
                  │ (寫入)
                  ▼
┌─────────────────────────────────────────────────┐
│               同步目標環境                        │
│  ┌──────────────┐        ┌──────────────────┐  │
│  │  本地開發環境  │        │  測試站環境        │  │
│  │  PostgreSQL   │        │  PostgreSQL       │  │
│  └──────────────┘        └──────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 關鍵設計原則

1. **單向同步**
   - ✅ 正式環境 → 測試/本地環境（允許）
   - ❌ 測試/本地環境 → 正式環境（禁止）
   - 🔒 只讀取正式環境，只寫入目標環境

2. **完全解耦**
   - 獨立服務，不依賴主後端 API
   - 獨立部署，獨立資源
   - 獨立日誌和監控

3. **環境變數驅動**
   - 所有連線通過環境變數
   - 支援多目標動態配置
   - 靈活的同步參數設定

## 📊 資料流向

### 同步流程

```
1. 定時觸發 (每10分鐘)
   ↓
2. 載入環境變數配置
   ↓
3. 連接正式環境資料庫 (SOURCE)
   ↓
4. 讀取上次同步時間 (from sync_state)
   ↓
5. 查詢增量資料 (WHERE updated_at > last_sync_time)
   ↓
6. 依照外鍵順序處理表格
   ↓
7. 對每個目標環境執行 UPSERT
   - Target 1: 本地環境 (如果啟用)
   - Target 2: 測試站 (如果啟用)
   ↓
8. 更新同步狀態記錄
   ↓
9. 記錄日誌和統計
   ↓
10. 等待下次觸發
```

### 表格同步順序

依照外鍵依賴關係：

```
1. users                      # 基礎表格（無依賴）
2. formula_schedules          # 依賴 users
3. monthly_schedules          # 依賴 users
4. schedule_versions          # 依賴 users
5. schedule_version_diffs     # 依賴 schedule_versions
6. schedule_changes           # 依賴 schedule_versions
7. shift_swap_requests        # 依賴 users, schedules
8. overtime_records           # 依賴 users, schedules
9. overtime_points            # 依賴 users
10. overtime_monthly_scores   # 依賴 users
11. overtime_summaries        # 依賴 users
12. announcements             # 依賴 users
13. doctor_schedules          # 獨立表格
14. day_shift_doctors         # 依賴 doctor_schedules
15. doctor_schedule_update_logs # 依賴 doctor_schedules
16. webauthn_credentials      # 依賴 users
17. logs                      # 最後（無依賴）
```

## 🔐 環境變數設計

### 必要環境變數

```bash
# 來源資料庫（正式環境）- 必須
SOURCE_DB_URL=postgresql://user:pass@host:port/database

# 目標資料庫 - 至少一個
TARGET_LOCAL_URL=postgresql://user:pass@localhost:5432/database
TARGET_TEST_URL=postgresql://user:pass@test-host:5432/database

# 同步設定 - 必須
SYNC_TARGETS=local,test          # 要啟用的目標（逗號分隔）
SYNC_INTERVAL_MINUTES=10         # 同步間隔（分鐘）
```

### 進階環境變數

```bash
# 同步範圍控制
SYNC_TABLES=users,schedules,...  # 指定表格（預設：全部）
EXCLUDE_FIELDS=users:password,webauthn_credentials:credential_id  # 排除欄位

# 服務設定
LOG_LEVEL=INFO                   # 日誌級別: DEBUG, INFO, WARNING, ERROR
ENABLE_HEALTH_CHECK=true         # 啟用健康檢查 HTTP 端點
HEALTH_CHECK_PORT=8080           # 健康檢查端口

# 錯誤處理
MAX_RETRY_ATTEMPTS=3             # 最大重試次數
RETRY_DELAY_SECONDS=60           # 重試延遲（秒）

# 效能調整
BATCH_SIZE=1000                  # 批次大小
```

### 環境變數驗證

服務啟動時會驗證：
- ✅ SOURCE_DB_URL 必須存在
- ✅ 至少一個 TARGET_*_URL 必須存在
- ✅ SYNC_TARGETS 中指定的目標必須有對應的 URL
- ✅ 所有資料庫連線可用性測試

## 🔒 安全機制

### 1. 單向保護

```python
# 防止反向同步
if target_url == source_url:
    raise ValueError("目標不能與來源相同！")

# 防止正式環境寫入
if is_production_url(target_url):
    raise ValueError("不允許寫入正式環境！")
```

### 2. 敏感資料處理

**排除欄位**：
- `users.password` - 密碼
- `webauthn_credentials.credential_id` - 生物辨識憑證
- `webauthn_credentials.public_key` - 公鑰

**實作方式**：
```python
SENSITIVE_FIELDS = {
    'users': ['password'],
    'webauthn_credentials': ['credential_id', 'public_key']
}
```

### 3. 連線安全

- 使用環境變數儲存敏感資訊
- 不在代碼中硬編碼密碼
- 支援 SSL 連線（sslmode=require）

### 4. 錯誤隔離

- 單一表格失敗不影響其他表格
- 完整錯誤日誌記錄
- 自動重試機制

## 📈 效能考量

### 資源使用

**預估資源需求**：
- CPU: 0.5 核心（同步時）
- Memory: 256 MB - 512 MB
- 網路: 依資料量，通常 < 50 MB/次

**Zeabur 建議配置**：
- Plan: Starter 或 Developer
- Auto-scaling: 關閉（單一實例即可）

### 優化策略

1. **增量同步**
   - 只同步有 `updated_at` 變更的記錄
   - 大幅減少資料傳輸量

2. **批次處理**
   - BATCH_SIZE=1000（可調整）
   - 避免一次載入過多資料

3. **連線池**
   - 重用資料庫連線
   - 減少連線開銷

4. **表格無時間戳處理**
   - 自動檢測無 `updated_at` 的表格
   - 執行全量同步（但頻率較低）

## 🔍 監控與日誌

### 日誌格式

```
[2025-10-03 14:30:00] INFO - 開始執行資料庫同步
[2025-10-03 14:30:01] INFO - 同步表格: users (增量: 5 筆)
[2025-10-03 14:30:02] INFO - 同步表格: schedules (增量: 120 筆)
[2025-10-03 14:30:05] INFO - 同步完成: 總共 250 筆記錄，耗時 5.2 秒
```

### 健康檢查端點（可選）

```
GET /health
Response:
{
  "status": "healthy",
  "last_sync_time": "2025-10-03T14:30:05",
  "sync_count": 250,
  "targets": ["local", "test"]
}
```

### 同步狀態追蹤

**狀態文件** (`sync_state.json`):
```json
{
  "users": {
    "last_sync_time": "2025-10-03T14:30:01",
    "records_synced": 5,
    "last_error": null
  }
}
```

## 🎯 與現有系統的關係

### 與主專案的差異

| 特性 | 主專案 (backend) | DB Sync Service |
|------|-----------------|-----------------|
| **職責** | 業務邏輯和 API | 資料同步 |
| **部署** | Zeabur 主專案 | Zeabur 獨立專案 |
| **資源** | API 服務資源 | 獨立資源 |
| **依賴** | 完整依賴樹 | 最小依賴 |
| **執行模式** | HTTP 請求驅動 | 定時任務驅動 |

### 複用邏輯

從主專案複用：
- ✅ 同步邏輯核心（`sync_db_incremental.py`）
- ✅ 表格順序配置
- ✅ 敏感欄位清單

獨立實作：
- ✅ 環境變數配置系統
- ✅ 多目標支援邏輯
- ✅ 服務入口和排程

---

**文件版本**: v1.0
**最後更新**: 2025-10-03
