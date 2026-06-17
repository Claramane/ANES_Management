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

## 待補決策（移到 open-questions 追蹤）

- 換班 / 班表版本控制的具體規則，需參考 **DoctorShiftManagement** 專案後再定案。
- 是否保留操作日誌（`logs` 表）寫入。
