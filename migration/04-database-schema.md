# 04 — 資料庫盤點與 Supabase 遷移

## 資料表清單（共 20 張）

| 資料表 | 用途 | 遷移後 |
|--------|------|--------|
| `users` | 使用者帳戶（role / identity）| ✅ 保留，新增 Supabase auth 對應欄 |
| `logs` | 操作日誌 | ⚠️ 待定（是否保留寫入）|
| `formula_schedules` | 公式班表模板 | ✅ 保留 |
| `formula_schedule_patterns` | 公式班別模式（每組每日）| ✅ 保留 |
| `nurse_formula_assignments` | 護理師→公式 分組指派 | ✅ 保留 |
| `pattern_nurse_assignments` | 護理師→pattern 指派 | ✅ 保留 |
| `monthly_schedules` | 月班表分配（含 area_code / 版本）| ✅ 保留（核心）|
| `schedule_versions` | 班表版本 | ✅ 保留（版本控制核心）|
| `schedule_version_diffs` | 版本差異（JSON）| ✅ 保留 |
| `overtime_records` | 加班記錄 | ✅ 保留 |
| `overtime_monthly_scores` | 加班月分數 | ✅ 保留 |
| `shift_swap_requests` | 換班申請 | ✅ 保留（核心）|
| `shift_rules` | 班別規則 | ✅ 保留 |
| `doctor_schedules` | 醫師班表（每日）| ✅ 保留 |
| `day_shift_doctors` | 白班醫師明細 | ✅ 保留 |
| `doctor_schedule_update_logs` | 醫師班表更新記錄 | ⚠️ 視同步機制保留 |
| `announcement_categories` | 公告分類 | ✅ 保留 |
| `announcements` | 公告 | ✅ 保留 |
| `announcement_permissions` | 公告權限（依 identity）| ✅ 保留 |
| `webauthn_credentials` | Passkey 憑證 | ❌ 廢棄（改 Supabase Auth）|
| `line_accounts` | LINE 綁定 | ❌ 廢棄（改 Supabase Auth）|

## 核心關聯（保留）

```
users 1──* monthly_schedules *──1 schedule_versions
                                        └──* schedule_version_diffs (version_id / base_version_id 雙外鍵)
users 1──* overtime_records
users 1──* overtime_monthly_scores
users 1──* shift_swap_requests (requestor_id / acceptor_id / target_nurse_id 三外鍵)
formula_schedules 1──* formula_schedule_patterns 1──* pattern_nurse_assignments *──1 users
formula_schedules 1──* nurse_formula_assignments *──1 users
doctor_schedules 1──* day_shift_doctors
announcement_categories 1──* announcements / announcement_permissions
```

## `users` 表重點欄位（權限相關）

- `role`：`head_nurse` / `nurse` / `boss` / `admin`（功能權限判定）
- `identity`：護理身份（決定班別模式，如 麻醉專科護理師 / 恢復室護理師 / Leader / 書記）
- `group_data`：JSON（分組資料，排班生成時 `json.loads` 使用）
- `username`：員工編號（目前登入帳號）

## SQLAlchemy → Drizzle 遷移注意

| 項目 | 注意 |
|------|------|
| JSON 欄位 | `schedule_notes` / `diff_data` / `group_data` → Drizzle `jsonb`，前端格式需保持一致 |
| 多重外鍵到 users | `shift_swap_requests`、`schedule_version_diffs` 需明確指定 relation，Drizzle 要分別命名 |
| 預設值 `func.now()` | → Drizzle `defaultNow()`；`onupdate` → 需用 trigger 或應用層處理 |
| `BigInteger` 主鍵 | `line_accounts.id`（若廢棄則不需處理）|
| 日期型別 | `Date` vs `DateTime`，注意時區（Supabase 預設 UTC，商業邏輯用 Asia/Taipei）|
| raw SQL（如線上使用者查詢）| 改 presence 後多半不需要；保留者用 Drizzle `sql` template |

## Supabase 設定要點

1. **連線方式**：Worker 經 **Hyperdrive** 連 Supabase 的 **transaction pooler (port 6543)**。
   - 對應現況 `prepare_threshold=0`：pooler 模式需停用 prepared statements，Drizzle/postgres.js 設 `prepare: false`。
2. **RLS**：初期可關閉或用 service role key 由 Worker 全權存取，靠應用層權限；中後期再逐表開 RLS。
3. **Migration**：用 Drizzle Kit 產生 schema migration；初次可由現有 PG dump 匯入結構 + 資料。
4. **資料搬遷**：`pg_dump` 現有 DB → 匯入 Supabase；廢棄表（webauthn / line）可不搬。

## 待確認

- 現有資料量級（決定搬遷與批次處理策略）。
- `logs` 是否續用（影響是否保留寫入路徑）。
