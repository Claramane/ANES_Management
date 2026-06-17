# 09 — DoctorShiftManagement 參考摘要

> 本文件整理從 `Claramane/DoctorShiftManagement` 讀取後，對 ANES migration 計畫有直接影響的關鍵發現。
> 2026-06-17 更新。

---

## 一、DSM 的實際架構（和 ANES 計畫初版假設的不同）

ANES migration 計畫 `02-target-architecture.md` 原本假設目標是「Cloudflare Worker (Hono + Drizzle) 做 API gateway」。但 DSM 實際落地的是另一套：

```
React 前端
  ├── 讀取 / 複雜邏輯：直連 Supabase（@supabase/supabase-js, anon key + RLS）
  │      ├── 讀表：supabase.from('table').select(...)
  │      └── 複雜操作：supabase.rpc('rpc_name', params)  ← 30+ 支 PL/pgSQL RPC
  └── 衛星功能：各自獨立的 Cloudflare Worker（passkey / notification / shift / excel 等）
```

**DSM 沒有 Hono API gateway、沒有 Drizzle ORM、沒有 Hyperdrive。**

ANES 仍然需要 Worker 處理：（1）自動排班生成（純運算量大）、（2）醫師班表 Cron 同步。其餘邏輯跟 DSM 一樣走 Supabase RPC + RLS。

---

## 二、認證（Phase 1 直接可用）

### 登入流程
1. 前端：`supabase.auth.signInWithOAuth({ provider: 'google' })`
2. 取得 JWT 後，前端查 `public.user_profiles`（以 `auth.users.id` 對應）
3. 查無資料 / `is_active=false` → 前端強制登出
4. 取得 profile 後，依 `permissions[]` 決定可見功能

### user_profiles 表關鍵欄位
```sql
email          TEXT  -- 業務主鍵，admin 預先填好
id             UUID  -- 連到 auth.users.id（首次登入由 trigger 自動填）
role           TEXT  -- 'admin' | 'supervisor' | 'doctor'（ANES 對應 head_nurse/nurse/boss/admin）
is_active      BOOL  -- 停用開關
permissions    TEXT[] -- capability-based 授權清單（見下方）
```

### 首次登入 auto-link trigger（DSM migration `20260430040816_auto_link_auth_user_to_profile.sql`）
```sql
-- 使用者第一次 Google 登入後，trigger 以 email 比對 user_profiles，
-- 命中則填入 id=auth.users.id；未命中則拒絕（白名單制）
```
ANES 照抄這個 trigger，email 對應到現有 `users.email` 欄位。

### 權限 capabilities（DSM 已使用的，ANES 可參考對應）

| DSM capability | ANES 對應用途 |
|---|---|
| `manage_schedule` | 護理長排班編輯 |
| `commit_schedule_version` | 版本控制 commit |
| `restore_schedule_version` | 版本還原 |
| `manage_leave_requests` | 換班 / 請假審核（admin） |
| `manage_user_profiles` | 使用者管理 |
| `review_overtime_request` | 加班審核 |

### MFA 現況
- DSM 目前實際跑：Google OAuth + TOTP（admin/supervisor 強制）
- Passkey 架構已設計完成但暫停（WebView `disallowed_useragent` 問題）
- **結論**：ANES 走 Google + TOTP（head_nurse/admin 強制），Passkey 不急

---

## 三、班表版本控制（Phase 3 核心，ADR-006）

### 版本控制模型（DSM EAD-94，v2.0.0 已上線）

git-style branch/PR 模型：

| 概念 | DSM 對應 |
|---|---|
| repo | 一個月份（per-month） |
| main | 對外版本，HEAD 是最新 |
| branch | `schedule_branches` 表（草稿 / 請假 / 換班） |
| commit | `schedule_commits`（snapshot JSONB） |
| PR | `merge_requests` 表 |
| working tree | 前端 IndexedDB + `branchUncommitted` |

### 核心 RPC（DSM 已實作，ANES 需調整欄位名稱後直接用）

```
open_branch(month, kind, name?)           → 開草稿，回傳 branch row
write_to_branch(branch_id, ...)           → 寫格子變更到 branch
commit_to_branch(branch_id, msg, changes) → 批次提交（有 uncommitted 才能 merge）
get_branch_state(branch_id)               → 重建 branch snapshot（base + replay）
compute_branch_merge_conflicts(branch_id) → 預檢 3-way merge 衝突
merge_branch(branch_id, msg?, resolution?)→ 3-way merge → main
close_branch(branch_id)                   → 捨棄草稿
restore_to_commit(commit_id)              → 整月還原
```

### 護理長 UX（BranchRibbon，複製 DSM `src/components/BranchRibbon.jsx`）
- 進排班頁預設 main 唯讀
- 點「開草稿」→ admin_edit branch，格子可編
- 點「提交到 main」→ pre-flight 衝突檢查 → merge 或衝突 dialog

### DSM migration SQL 位置（直接作為 ANES 模板）
```
DoctorShiftManagement/supabase/migrations/
  20260529010000_schedule_branches_phase_1a.sql  ← schedule_branches / merge_requests 建表
  20260529011000_schedule_branches_phase_1b_rpcs.sql  ← open/write/get/close/merge RPC
  20260529014000_schedule_branches_phase_1d_three_way_merge.sql  ← 3-way merge
```

---

## 四、換班（Phase 4，ADR-007）

### 三段狀態流
```
submit → pending_target → target 同意 → pending_admin → admin 核准 → approved
                        → target 拒絕 → rejected_by_target
                                     → re-validate 失敗 → invalidated
              ↓ requester 取消
           cancelled
```

### 換班 = 整日對調（DSM 設計）
- 不只換選中的一格，而是兩人在那兩天所有 swappable 班別全部互換（最多 4 格）
- 驗證邏輯：前端 `validateSwap` + 後端 `app_private.validate_swap`（兩邊邏輯 1:1 對應）
- 接受 = `merge_branch_internal`（共用版本控制基礎設施）

### DSM 可直接參考的代碼
- `docs/SHIFT_SWAP_DESIGN.md`：完整 RPC 規格
- `src/utils/swapValidation.js`：前端驗證邏輯（班別定義需 ANES 化）
- `src/components/SwapRequestForm.jsx`：換班申請表單

### ANES 需要額外處理的差異
1. `shift_rules` 表（工時規則：max_consecutive / min_rest_hours）需整合進 `validate_swap`
2. `area_code` 換班連動（換班時 OR/DR/3F 要不要一起對調？待確認）
3. ANES 護理師沒有 `doctor_code` 單一字母概念，用 `user_id` 識別

---

## 五、前端路由（ADR-008）

DSM 路由切法（`src/navigation/routes.js`）：

```javascript
'/app/my-schedule'      // 一般使用者看班
'/app/swap-request'     // 換班申請（手機友好）
'/app/leave-request'    // 請假
'/app/overtime-request' // 加班
'/admin/schedule'       // admin 排班編輯（BranchRibbon）
'/admin/history'        // 版本歷史
'/admin/user-logs'      // 使用者日誌
```

ANES 對應路由建議：
```
/app/schedule           → 護理師看班（手機）
/app/swap               → 換班申請
/app/overtime           → 加班記錄
/app/announcements      → 公告
/admin/schedule         → 護理長排班（BranchRibbon + 版本控制）
/admin/users            → 使用者管理
/admin/formula          → 公式班表管理
/admin/overtime-review  → 加班審核
```

---

## 六、DSM 目前沒有、ANES 需要自行設計的功能

| ANES 特有 | 說明 |
|---|---|
| 自動排班生成 | DSM 手動排班；ANES 有 370 行公式生成邏輯，走 Worker |
| Realtime presence（上下線）| DSM 只有 login notification（email），沒有即時上下線 |
| 身份 (identity) 班別模式 | DSM 醫師只有 doctor_code；ANES 護理師有麻醉專科 / 恢復室 / Leader 等不同班別模式 |
| SNP/LNP 夜班包班 | ANES 特有邏輯 |
| area_code 工作分配 | ANES 特有（OR/DR/3F），換班連動待確認 |
