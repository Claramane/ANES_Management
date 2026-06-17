# 07 — 需移植的核心商業邏輯

這份列出「真正含邏輯、要小心翻成 TS」的部分。純 CRUD 不在此列。

---

## 1. 排班自動生成（`routes/schedules.py` `generate_monthly_schedule`，~370 行）

**這是整個遷移最重的純邏輯。** 概念：

- 依「公式班表」（`formula_schedules` + `formula_schedule_patterns`）為每位護理師生成整月每日班別。
- 流程要點：
  1. 取得該月每位 nurse 的 formula 指派（`nurse_formula_assignments`，含 `group_number`）。
  2. 解析 `group_data`（JSON）。
  3. 對該月每一天：計算當週週數 / `day_of_week`，由 pattern 字串取出 `shift_type = pattern_str[day_of_week]`。
  4. 多組（num_groups）循環、`day_offset` 位移。
  5. 特殊處理：夜班人員保留、護理長特殊排班、`formula_id` 對應。
  6. 寫入 `monthly_schedules`，綁定 `version_id`。

**移植注意**：
- 純運算、無 Python 特有依賴 → 可直接翻 TS。
- 週數 / 星期計算務必用 **Asia/Taipei**，避免 UTC 偏移錯一天。
- 大量 row 寫入：用 Drizzle 批次 insert，注意 Worker CPU 上限。
- 建議先抽成 `services/scheduleGenerator.ts` 純函式（輸入：nurses + formulas + 月份；輸出：schedule rows），便於寫單元測試比對舊系統輸出。

---

## 2. 班表版本控制（ADR-006：改用 DSM branch/PR 模型，不移植現有 JSON-diff）

> **決策已定（ADR-006）**：`schedule_versions + schedule_version_diffs` 不移植。採 DSM 的 git-style branch 模型。

**新模型核心概念**（直接照搬 DSM）：

- `monthly_schedules` = main branch 物化 cache（一般護理師直接讀這張表，快）
- `schedule_branches` = 草稿 / 請假 / 換班等各類 branch
- branch state = `base_commit.snapshot` + `replay(schedule_changes WHERE branch_id=X)`，不存實體 row
- `merge_branch()` RPC 執行 3-way merge，無衝突 fast-forward，有衝突走 conflict resolution

**護理長排班編輯流程**（複製 DSM admin_edit flow）：
1. 進 `/admin/schedule` → 預設 main 唯讀
2. 點「開新草稿」→ `open_branch(kind='admin_edit')`
3. 編輯格子 → `write_to_branch` RPC（樂觀更新）
4. 「提交到 main」→ `compute_branch_merge_conflicts` 預檢 → 無衝突 merge，有衝突顯示 dialog

**核心 RPC 清單**（以 DSM 為模板，欄位名稱視 ANES 資料結構微調）：

| RPC | 功能 |
|-----|------|
| `open_branch(month, kind, name?)` | 開草稿 |
| `write_to_branch(branch_id, date, shift_type, op, old, new)` | 寫格子變更 |
| `get_branch_state(branch_id)` | 重建 branch 快照 |
| `compute_branch_merge_conflicts(branch_id)` | 預檢衝突 |
| `merge_branch(branch_id, message?, conflict_resolution?)` | 3-way merge → main |
| `close_branch(branch_id)` | 捨棄草稿 |
| `restore_to_commit(commit_id)` | 還原整月到某 commit |

**DSM 可直接參考的 migration SQL**：`DoctorShiftManagement/supabase/migrations/` 中 `20260529*` 系列（phase 1a~3f）。

**移植注意**：
- ANES 的 `monthly_schedules` 欄位和 DSM 的 `shift_assignments` 不同（ANES 含 area_code、SNP/LNP 等欄位），schema 要 ANES 化，但 RPC 邏輯可照搬。
- 自動排班生成（`generate_monthly_schedule`）產生的 row 直接進 `monthly_schedules`（main），並建一筆 `kind='manual'` commit 做快照。

---

## 3. 換班流程（ADR-007：改用 DSM 三階段審核 + branch 模型）

> **決策已定（ADR-007）**：現有兩狀態（pending/accepted）升級為三階段（pending_target → pending_admin → approved），換班成立走 `merge_branch`，依賴 ADR-006 完成先。

**三段狀態流**（來自 DSM `SHIFT_SWAP_DESIGN.md`）：

```
submit → pending_target → (target同意) → pending_admin → (admin核准) → approved → merge_branch
                        → (target拒絕) → rejected_by_target → close_branch
                                                           → (re-validate失敗) → invalidated
                        → (requester取消) → cancelled → close_branch
```

**換班成立的連動**：
- 換班 = 兩人兩天**整日對調**（可能 2~4 個格子），不只是單一班別互換
- `submit_swap_request` 時先模擬完整 swap、跑衝突驗證（前端 `validateSwap` 邏輯 + 後端 PL/pgSQL 對應版本），再 per-month 開 `kind='swap_request'` branch，把 4 格變更寫進 branch
- admin 核准 → `merge_branch_internal`（與版本控制共用 3-way merge）

**`shift_swap_requests` 表新增欄位**（對照 DSM）：
- `target_decision`、`target_decided_at`
- `swap_plan` JSONB（4 格 final state，供 audit）
- `branch_ids` UUID[]、`merge_request_ids` UUID[]

**可直接參考的 DSM 代碼**：
- `SHIFT_SWAP_DESIGN.md`：完整 RPC 規格（submit / decide_as_target / review / cancel / validate）
- `src/utils/swapValidation.js`：前端驗證邏輯（移植成 ANES 版本時需調整班別定義）

**ANES vs DSM 換班差異**：
- DSM 換班對象是醫師（doctor_code A-L），ANES 是護理師（user_id + shift_type 更複雜）
- ANES 的 `shift_rules` 表（工時規則）需要整合進後端的 `app_private.validate_swap`
- ANES 換班可能涉及 area_code 連動（需確認）

---

## 4. 加班分配（演算法在前端，後端僅存取）

- ⭐ **好消息**：核心「統一分數導向輪次分配 + Fisher-Yates」演算法在
  `frontend/src/utils/overtimeAllocation.js` 與 `OvertimeAllocation/OvertimeAllocationButton.jsx`，**後端不含演算法**。
- 後端只負責 `overtime_records` / `overtime_monthly_scores` 的讀寫（含批次整月重建 `bulk-month`）。
- 班別分數設定見 `docs/ROUND_ALLOCATION_LOGIC.md`（A=2.0, B=1.0, C=0.8, D=0.3, E/F=0）。

**移植注意**：前端不動，後端只要把 CRUD + 批次重建翻過去即可。批次「清整月再重建」注意在交易內完成。

---

## 5. 醫師班表外部同步（`services/doctor_schedule_service.py`，精簡後）

- 移除自動下班偵測（ADR-001）後，僅保留：
  - 從外部 API `docdutyapi.claramane.com/schedule/{start}/{end}` 拉資料。
  - 寫入 `doctor_schedules` / `day_shift_doctors`，**保留**手動狀態（請假 / 開會）覆蓋規則（待確認是否仍需要）。
  - 特殊業務規則（如週三疼痛門診、週二~週五自動加入特定醫師）— **需確認是否保留**。
- 改用 **Cloudflare Cron Trigger** 定期觸發「更新未來數月」。

**移植注意**：`requests.get` → `fetch()`；同步邏輯改為 Cron handler；注意 Worker subrequest 限制。

---

## 移植優先序（依風險 × 價值）

1. 🥇 排班生成（最重、最高價值、可先寫純函式 + 測試比對）
2. 🥈 班表版本控制 + 換班（需先參考 DoctorShiftManagement）
3. 🥉 加班 CRUD、公告、公式班表（相對單純）
4. 醫師班表同步（精簡 + Cron）
