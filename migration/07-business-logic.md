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

## 2. 班表版本控制（`routes/schedules.py`）

涉及表：`schedule_versions`、`schedule_version_diffs`、`monthly_schedules.version_id`。

- **產生版本**：`generate` / `saveMonth` 時建立 `ScheduleVersion`（`version_number` 如 `v1.0_YYYYMM`、`month`、`is_base_version`、`is_published`）。
- **基準版本**：`is_base_version` 標記；diff 以 base 為基準。
- **差異比較**：`/versions/compare` → 算兩版本差異，存 `schedule_version_diffs.diff_data`（JSON）。
- **發布**：`/versions/{id}/publish` → 設 `is_published=true`、記錄 `published_by` / `published_at`、寫 log。

**移植注意**：
- diff 演算法需確認（目前以 JSON 存差異）→ **需參考 DoctorShiftManagement 的版本控制做法**，確認 diff 結構與比較邏輯是否要對齊。
- 「版本 + diff」模式適合保留，但要釐清：每次存檔開新版本，還是覆蓋？base version 何時重設？

---

## 3. 換班流程（`routes/shift_swap.py`，749 行）

- 申請（`POST /`）→ 驗證（`/validate`，班別衝突 + 工時規則 `shift_rules`）→ 接受（`/accept`）→ 連動更新班表 / 加班。
- `swap_type`：`shift` / `mission` / `overtime` 三種，各自更新不同欄位。
- 接受時：更新雙方 `monthly_schedules`（shift / area / work_time）與 `overtime_records`。
- 狀態機：`pending → accepted / rejected`（另有 cancelled / expired 概念）。

**移植注意**：
- 連動更新需**交易**（多表一致）。Worker + postgres.js 可用 transaction；Hyperdrive transaction pool 下確認交易行為。
- 工時規則驗證邏輯（`max_consecutive` / `min_rest_hours` / `max_weekly_shifts` …）為純運算，可移植。
- **需參考 DoctorShiftManagement** 確認換班與版本控制如何互動（換班是否產生新班表版本？）。

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
