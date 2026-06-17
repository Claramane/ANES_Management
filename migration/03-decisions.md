# 03 — 關鍵決策記錄 (ADR)

紀錄影響架構的重大決定。每筆含：決策、背景、影響。

---

## ADR-001：移除醫師自動下班偵測

- **決策**：新後端**不實作**任何醫師上下班狀態自動偵測 / 自動下班邏輯。
- **背景**：該功能已經架設在另一個獨立專案中，由該專案負責。
- **影響**：
  - 移除 `tasks/doctor_schedule_tasks.py` 中「每 5 分鐘檢查自動下班」的 cron。
  - `services/doctor_schedule_service.py` 中跨午夜判斷、自動下班偵測、狀態時間管理等邏輯大幅刪除。
  - `routes/doctor_schedule.py` 的 `/check-auto-off-duty`、`/update-doctor-status/*`、`set-status` 等視需求保留或移除（待確認手動操作是否仍由本系統提供）。

---

## ADR-002：移除自建 WebSocket，改用 Supabase Realtime

- **決策**：不在 Worker 重建 WebSocket；上線/下線狀態改用 **Supabase Realtime Presence**。
- **背景**：Worker 無常駐程序，無法維持長連線；系統將架在 Supabase 上，Realtime 為內建能力。
- **影響**：
  - 移除整個 `websocket/`、`routes/websocket.py`、心跳檢查任務。
  - 前端改用 Supabase JS SDK 訂閱 presence channel。
  - 既有 `/heartbeat`、`/online-users`、`last_activity_time` 機制可由 Realtime presence 取代（需確認是否仍要把上線資訊寫回 DB 做歷史記錄）。

---

## ADR-003：認證改用 Supabase Auth（Google OAuth）

- **決策**：採用 **Supabase Auth 的 Google 登入**，取代自建 JWT + bcrypt + WebAuthn + LINE 登入。
- **背景**：簡化認證維運，去除 Python 密碼學依賴與 WebAuthn 移植難題。
- **影響**：
  - 移除 `routes/webauthn.py`、`routes/line_login.py`、`core/security.py` 的密碼 / JWT 簽發邏輯。
  - 移除資料表 `webauthn_credentials`、`line_accounts`（或保留作歷史，停用寫入）。
  - `users` 表需新增與 Supabase Auth user 的對應（見 05）。
  - Worker 端只需用 Supabase JWKS **驗證** JWT，不再自簽。
  - **待確認**：原本用員工編號（username）登入，改 Google 後如何對應到員工資料？（見 open-questions）

---

## ADR-004：保留 PostgreSQL 資料模型，平移到 Supabase

- **決策**：資料表結構基本沿用現況，搬到 Supabase 的 Postgres，不重新設計 schema。
- **背景**：現有 schema 成熟且前端高度依賴；降低遷移風險。
- **影響**：
  - 用 Drizzle 重新宣告 schema（對照現有資料表）。
  - 啟用 Supabase RLS，但初期可由 Worker 用 service role 繞過、靠應用層權限（降低一次到位的複雜度）。
  - 需處理 ORM 差異（見 04）。

---

## ADR-005：分階段遷移，FastAPI 暫時保留

- **決策**：不一次性切換；以前端 API base 分流，逐模組搬遷，舊 FastAPI 作為 fallback。
- **背景**：系統為醫療營運用途，不可長時間中斷。
- **影響**：見 [`08-migration-plan.md`](./08-migration-plan.md)。

---

---

## ADR-006：班表版本控制改用 DSM branch/PR 模型（撤銷 ADR-004 版本控制部分）

- **決策**：**不**沿用現有 `schedule_versions + schedule_version_diffs`（JSON-diff）版本控制；改為採用與 `DoctorShiftManagement` 相同的 **git-style branch/PR 模型**（`schedule_branches + merge_requests + schedule_changes` audit + 3-way merge）。
- **背景**：讀取 DSM 後確認，DSM 已完整落地此模型（EAD-94，v2.0.0），包含 30+ 支 PL/pgSQL RPC（open_branch / write_to_branch / merge_branch / get_branch_state …）和前端組件（BranchRibbon / BranchMergeConflictDialog）。換班流程（ADR-007）也依賴同一套 3-way merge 基礎設施；若保留 JSON-diff，換班就無法共用，等於兩套版本控制並存。
- **影響**：
  - `schedule_versions`、`schedule_version_diffs` **不遷移到 Supabase**（廢棄，僅保留歷史查閱用的唯讀備份）。
  - 新增表：`schedule_branches`、`merge_requests`（從 DSM migration SQL 為模板調整）。
  - `schedule_changes` audit 表保留（DSM 也有，含 `branch_id` 欄），`monthly_schedules` 角色從「source of truth」改為「main branch 物化 cache」。
  - 現有版本控制前端（版本列表、diff 顯示）需要對應改寫（可參考 DSM `VersionHistoryPage`）。
  - 這是 **破壞性 schema 變更**，Phase 3 前需準備資料 migration script（歷史 schedule_versions 轉成 main branch 的初始 commit）。
  - ADR-004「保留 schema 不重新設計」仍適用於**其他 18 張表**，版本控制兩張除外。

---

## ADR-007：換班採用 DSM branch/PR + 兩階段審核模型

- **決策**：現有 `shift_swap_requests`（pending→accepted/rejected 兩狀態）改為 DSM 的 **三狀態流**（`pending_target → pending_admin → approved`）+ per-month branch 模型。
- **背景**：DSM `SHIFT_SWAP_DESIGN.md`（EAD-155）已設計完整，換班 = 兩人兩天整日對調、雙階段審核（被換人先同意、再到 admin）、接受時走 `merge_branch_internal`（3-way merge），與 ADR-006 的版本控制共用同一基礎設施。
- **影響**：
  - `shift_swap_requests` 表需新增欄位（`target_decision`、`branch_ids[]`、`merge_request_ids[]`、`swap_plan` JSONB 等）。
  - 後端換班 RPC（`submit_swap_request` / `decide_swap_request_as_target` / `review_swap_request` / `cancel_swap_request`）以 DSM 的 PL/pgSQL 設計為模板翻寫，含前端 `validateSwap` 邏輯的後端對應版本（`app_private.validate_swap`）。
  - 這塊**依賴 ADR-006 完成先**（branch 表存在後才能開 swap branch）。

---

## ADR-008：前端改用單一 SPA，以路由區分護理長 / 護理師介面

- **決策**：不分兩個前端 repo；一個 React SPA，路由區分 `/admin/*`（護理長排班、版本控制）和 `/app/*`（護理師看班、換班、加班）。
- **背景**：你的構想是護理長用電腦排班、護理師用手機換班；DSM 已驗證此模式（同一份 code + `isAdminAppPath()` / `isUserAppPath()` 路由判斷 + role gate）。共用登入狀態和 Supabase client，維護成本最低。
- **影響**：
  - 現有 React 前端**不需要**分成兩個 repo 或兩個部署；但路由結構需要重組。
  - `/admin/*` 路由加 role gate（`head_nurse` / `admin` 才能進）；護理長功能集中在此。
  - `/app/*` 為一般護理師介面，手機友好，lazy load。
  - 護理長排班介面放 `/admin/schedule`，含 BranchRibbon 編輯模式。

---

## 待補決策

- 是否保留操作日誌（`logs` 表）寫入，或改用 Supabase 的 `schedule_changes` audit 取代。
