# 08 — 分階段執行計畫

原則：**不一次性切換**。前端以 API base 分流，逐模組搬遷，舊 FastAPI 作 fallback，每階段可獨立上線與回退。

---

## Phase 0 — 基礎建設（地基）

- [ ] 建立 Supabase 專案（DB / Auth / Realtime）。
- [ ] 設定 Google OAuth provider。
- [ ] `pg_dump` 現有 PostgreSQL → 匯入 Supabase（廢棄表不搬）。
- [ ] 建立 `worker/` 專案骨架（Hono + Drizzle + wrangler）。
- [ ] 用 Drizzle 宣告 schema，與 Supabase 對齊；設定 Hyperdrive 連 pooler。
- [ ] 建立 auth middleware（驗 Supabase JWT → 對應 users）。
- [ ] 健康檢查端點上線，驗證「Worker → Hyperdrive → Supabase」打通。

**產出**：能跑起來、能驗證身分、能讀一張表的最小 Worker。

---

## Phase 1 — 認證切換

- [ ] `users` 表加 `auth_user_id`，建立 email ↔ 員工對應與綁定流程。
- [ ] 前端接 Supabase JS（Google 登入），改帶 Supabase JWT。
- [ ] 移除舊 `/login`、密碼、心跳依賴。
- [ ] 上線/下線改用 Realtime presence（先與舊系統並行驗證）。

**風險**：員工 Google 帳號可用性、白名單綁定（見 open-questions）。

---

## Phase 2 — 唯讀 / 低風險模組

先搬「讀多寫少、連動少」的，建立信心：

- [ ] 公告（announcements）
- [ ] 公式班表（formula_schedules，唯讀為主）
- [ ] 班表讀取（monthly / details）
- [ ] 醫師班表讀取 + Cron 同步（精簡版）

前端對應這些 API 改打 Worker，舊 API 保留。

---

## Phase 3 — 核心寫入邏輯

- [ ] 排班生成（先寫純函式 + 對舊系統輸出做回歸測試 → 再接 API）。
- [ ] 班表版本控制（版本 / diff / publish）。
- [ ] 加班 CRUD + 批次整月重建。

> 進入此階段前需完成：**參考 DoctorShiftManagement 的版本控制與換班邏輯**。

---

## Phase 4 — 換班（最後，因連動最多）

- [ ] 換班申請 / 驗證 / 接受 / 拒絕。
- [ ] 接受時的班表 + 加班連動（交易）。
- [ ] 班別規則 CRUD。

---

## Phase 5 — 收尾

- [ ] 全部前端 API base 指向 Worker，下線 FastAPI。
- [ ] 逐表開啟 Supabase RLS（從 service-role 全權 → 細緻權限）。
- [ ] 廢棄 webauthn / line 表與相關前端。
- [ ] 更新 `docs/`（DATABASE_ARCHITECTURE / PERMISSIONS / USAGE）與版本號。

---

## 每階段共通檢查

- 回歸測試：新舊輸出比對（尤其排班生成、版本 diff）。
- 可回退：前端分流開關，出問題切回舊 API。
- 時區：所有日期邏輯確認 Asia/Taipei。

---

## 概略里程碑

| 階段 | 重點 | 相依 |
|------|------|------|
| Phase 0 | 地基打通 | — |
| Phase 1 | 認證 | Phase 0 |
| Phase 2 | 唯讀模組 | Phase 0 |
| Phase 3 | 排班 / 版本 / 加班 | Phase 1、參考 DoctorShiftManagement |
| Phase 4 | 換班 | Phase 3 |
| Phase 5 | 下線舊系統 | 全部 |
