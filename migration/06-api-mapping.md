# 06 — API 端點對照表

全部端點與遷移處置。圖例：✅ 移植　🔁 改寫/取代　❌ 移除　⚠️ 視需求

## users（`routes/users.py`）

| Method | Path | 處置 | 備註 |
|--------|------|------|------|
| POST | `/login` | ❌ | 改 Supabase OAuth |
| POST | `/test-login` | ❌ | |
| POST | `/heartbeat` | ❌ | 改 Realtime presence |
| GET | `/online-users` | 🔁 | Realtime presence |
| GET | `/debug/online-users-info` | ❌ | |
| GET | `/debug/timezone-test` | ❌ | |
| POST | `/admin/fix-passwords` | ❌ | |
| POST | `/users/change-password` | ❌ | Supabase 管理 |
| GET | `/users` | ✅ | |
| POST | `/users` | ✅ | 建帳號需同步建立 / 綁定 auth user |
| GET | `/users/me` | ✅ | 由 JWT 解析 |
| PUT | `/users/me` | ✅ | |
| PUT | `/users/{id}` | ✅ | |
| DELETE | `/users/{id}` | ✅ | |
| POST | `/users/{id}/activate` | ✅ | |

## schedules（`routes/schedules.py`）— 核心

| Method | Path | 處置 | 備註 |
|--------|------|------|------|
| GET | `/schedules/monthly/{year}/{month}` | ✅ | |
| GET | `/schedules/details` | ✅ | |
| POST | `/schedules/generate` | ✅ | **排班生成，最重邏輯**（見 07）|
| POST | `/schedules/saveMonth` | ✅ | 建立版本 |
| POST | `/schedules/updateShift` | ✅ | |
| PUT | `/schedules/{id}` | ✅ | |
| POST | `/schedules/bulkUpdateAreaCodes` | ✅ | |
| POST | `/schedules/resetAreaCodes` | ✅ | |
| POST | `/schedules/versions/compare` | ✅ | 版本差異比較 |
| POST | `/schedules/versions/{id}/publish` | ✅ | 發布版本 |

## formula_schedules（`routes/formula_schedules.py`）

| Method | Path | 處置 |
|--------|------|------|
| GET | `/` | ✅ |
| GET | `/patterns` | ✅ |
| GET | `/{id}` | ✅ |
| PUT | `/{id}` | ✅ |

## overtime（`routes/overtime.py`）

| Method | Path | 處置 | 備註 |
|--------|------|------|------|
| GET | `/overtime` | ✅ | |
| GET | `/overtime/me` | ✅ | |
| POST | `/overtime` | ✅ | |
| POST | `/overtime/bulk` | ✅ | 批次注意 CPU 限制 |
| POST | `/overtime/user/{id}` | ✅ | |
| PUT | `/overtime/{id}` | ✅ | |
| PUT | `/overtime/bulk-month` | ✅ | 整月重建，批次 |
| DELETE | `/overtime/{id}` | ✅ | |
| GET/POST/DELETE | `/overtime/monthly-scores*` | ✅ | 分數結果存取（演算法在前端）|

## shift_swap（`routes/shift_swap.py`）— 核心

| Method | Path | 處置 | 備註 |
|--------|------|------|------|
| GET | `/` `/me` `/{id}` | ✅ | |
| GET | `/available-months` | ✅ | |
| POST | `/` | ✅ | 建立換班申請 |
| PUT | `/{id}` | ✅ | |
| PUT | `/{id}/accept` | ✅ | **換班成立，連動班表/加班** |
| PUT | `/{id}/reject` | ✅ | |
| POST | `/validate` | ✅ | 衝突 / 工時驗證 |
| POST | `/update-shift` `/update-areas` | ✅ | |
| POST | `/update-overtime` `/update-overtime-month` | ✅ | |
| GET/POST/PUT/DELETE | `/rules*` | ✅ | 班別規則 CRUD |

> ⚠️ 換班成立的連動更新（班表 + 加班）需參考 **DoctorShiftManagement** 的版本控制做法後定案。

## doctor_schedule（`routes/doctor_schedule.py` + service）

| Method | Path | 處置 | 備註 |
|--------|------|------|------|
| GET | `/today` `/public/today` `/public/date/{date}` | ✅ | 讀取 |
| GET | `/schedules/{start}/{end}` | ✅ | |
| POST | `/update-from-external` | 🔁 | 改 fetch；改 Cron 觸發 |
| POST | `/update-future-four-months` | 🔁 | 改 Cron Trigger |
| POST | `/check-auto-off-duty` | ❌ | **ADR-001 移除** |
| POST | `/update-doctor-status/{id}` | ⚠️ | 自動偵測移除；手動操作待確認 |
| POST | `/doctor/{id}/set-status` | ⚠️ | 待確認是否本系統提供 |
| POST | `/doctor/{id}/area-code` | ⚠️ | |
| POST | `/doctor/{id}/meeting-time(/remove)` | ⚠️ | |
| POST | `/doctor/{id}/toggle-active` `/toggle-leave` | ⚠️ | |
| GET | `/scheduler-status` `/update-logs` `/health` | ⚠️ | |
| GET/POST | `/debug/*` `/test-*` | ❌ | |

## announcements（`routes/announcements.py`）

| Method | Path | 處置 |
|--------|------|------|
| GET | `/` `/categories` `/{id}` | ✅ |
| POST | `/` | ✅ |
| PUT | `/{id}` | ✅ |
| POST | `/{id}/pin` | ✅ |
| DELETE | `/{id}` | ✅ |

## 全移除模組

- `webauthn/*`（8 個端點）→ ❌
- `line/*`（6 個端點）→ ❌
- `ws/status` + WebSocket → ❌（改 Realtime）
