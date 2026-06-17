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
| `monthly_schedules` | 月班表分配（含 area_code / 版本）| ✅ 保留，角色改為「main branch 物化 cache」（見 ADR-006）|
| `schedule_versions` | 班表版本（JSON-diff 模型）| ❌ **廢棄**（ADR-006 改用 DSM branch 模型）|
| `schedule_version_diffs` | 版本差異（JSON）| ❌ **廢棄**（ADR-006）|
| `overtime_records` | 加班記錄 | ✅ 保留 |
| `overtime_monthly_scores` | 加班月分數 | ✅ 保留 |
| `shift_swap_requests` | 換班申請 | ✅ 保留，但**需新增欄位**（ADR-007：target_decision、branch_ids[]、swap_plan JSONB 等）|
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
users 1──* monthly_schedules（物化 main cache）
users 1──* overtime_records
users 1──* overtime_monthly_scores
users 1──* shift_swap_requests (requestor_id / acceptor_id / target_nurse_id 三外鍵)
formula_schedules 1──* formula_schedule_patterns 1──* pattern_nurse_assignments *──1 users
formula_schedules 1──* nurse_formula_assignments *──1 users
doctor_schedules 1──* day_shift_doctors
announcement_categories 1──* announcements / announcement_permissions
```

## 新增表（ADR-006 branch 模型）

以下為遷移後新增，設計參考 DSM migration SQL（`SCHEDULE_BRANCHES_DESIGN.md`）：

| 資料表 | 用途 |
|--------|------|
| `schedule_branches` | 草稿 / 請假 / 換班等各類 branch（per-month，含 base_commit_id / owner / status）|
| `merge_requests` | 每個 branch 對應一個 PR，記錄審核狀態與 conflict_resolution |
| `schedule_commits` | 每次 merge 到 main 的 commit snapshot（含 kind='merge' / 'restore' / 'manual'）|
| `schedule_heads` | 每月 main 的 HEAD 指標 |
| `schedule_changes` | audit log，含 `branch_id` 欄（NULL=main 路徑，非 NULL=branch 路徑）|

## `users` 表重點欄位（權限相關）

- `role`：`head_nurse` / `nurse` / `boss` / `admin`（功能權限判定）
- `identity`：護理身份（決定班別模式，如 麻醉專科護理師 / 恢復室護理師 / Leader / 書記）
- `group_data`：JSON（分組資料，排班生成時 `json.loads` 使用）
- `username`：員工編號（目前登入帳號）

## 前端直連 Supabase vs Worker gateway

採 ADR-006/007 後，版本控制與換班的核心邏輯移入 **PL/pgSQL RPC**，前端直接呼叫 `supabase.rpc()`，不經 Worker。Worker 僅負責：

- 自動排班生成（純運算，避免 RPC timeout）
- 醫師班表外部 API 同步（Cron Trigger）
- 其他需要 service key 的衛星功能

這和計畫初版（Worker 持有所有商業邏輯）不同，但符合 DSM 已驗證的落地方式。

## 資料搬遷注意

| 項目 | 注意 |
|------|------|
| JSON 欄位 | `group_data` / `swap_plan` 等 → Supabase `jsonb`，格式保持一致 |
| 多重外鍵到 users | `shift_swap_requests` 三外鍵需明確指定 relation |
| 預設值 `func.now()` | → Supabase trigger 或 `DEFAULT NOW()` |
| 日期型別 | `Date` vs `TIMESTAMPTZ`，注意時區（Supabase 預設 UTC，商業邏輯用 Asia/Taipei）|
| schedule_versions 歷史資料 | 不搬遷；保留一份 pg_dump 唯讀備份，Phase 5 評估是否廢棄表 |

## Supabase 設定要點

1. **連線方式**：Worker 經 **Hyperdrive** 連 Supabase 的 **transaction pooler (port 6543)**。
   - 對應現況 `prepare_threshold=0`：pooler 模式需停用 prepared statements，Drizzle/postgres.js 設 `prepare: false`。
2. **RLS**：初期可關閉或用 service role key 由 Worker 全權存取，靠應用層權限；中後期再逐表開 RLS。
3. **Migration**：用 Drizzle Kit 產生 schema migration；初次可由現有 PG dump 匯入結構 + 資料。
4. **資料搬遷**：`pg_dump` 現有 DB → 匯入 Supabase；廢棄表（webauthn / line）可不搬。

## 待確認

- 現有資料量級（決定搬遷與批次處理策略）。
- `logs` 是否續用（影響是否保留寫入路徑）。
