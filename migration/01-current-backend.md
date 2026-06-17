# 01 — 現況後端盤點

## 技術棧

| 層 | 現況 |
|----|------|
| Web 框架 | FastAPI 0.104 + Uvicorn |
| ORM | SQLAlchemy + Alembic |
| DB | PostgreSQL（psycopg 3，PgBouncer transaction pool，`prepare_threshold=0`）|
| 認證 | JWT（python-jose）+ bcrypt（passlib）+ WebAuthn 2.5 + LINE OAuth |
| 即時 | 自建 WebSocket（記憶體連線池 + 心跳）|
| 排程 | APScheduler（常駐）|
| 外部整合 | 醫師班表 API `docdutyapi.claramane.com` |

## 模組規模（後端約 7,100 行）

| 模組 | 行數 | 遷移後去向 |
|------|------|-----------|
| `routes/schedules.py` | 1,300 | ✅ 移植（核心，含版本控制）|
| `routes/shift_swap.py` | 749 | ✅ 移植（換班流程）|
| `services/doctor_schedule_service.py` | 694 | ⚠️ 大幅精簡（移除狀態偵測，僅保留 API 同步）|
| `routes/overtime.py` | 648 | ✅ 移植（CRUD，演算法在前端）|
| `routes/doctor_schedule.py` | 608 | ⚠️ 精簡 |
| `routes/users.py` | 601 | 🔁 部分移植（認證改 Supabase，使用者資料保留）|
| `routes/webauthn.py` | 591 | ❌ 移除（改 Supabase Auth）|
| `routes/announcements.py` | 325 | ✅ 移植 |
| `routes/formula_schedules.py` | 313 | ✅ 移植 |
| `routes/line_login.py` | 348 | ❌ 移除（改 Supabase Auth）|
| `websocket/` + `routes/websocket.py` | ~480 | ❌ 移除（改 Supabase Realtime）|
| `tasks/doctor_schedule_tasks.py` | 169 | ❌ 移除（醫師偵測不再需要）/ 部分改 Cron |

圖例：✅ 直接移植　⚠️ 移植但精簡　🔁 部分移植　❌ 移除

## Python 依賴遷移對照

| Python 套件 | 用途 | TS / Workers 替代 | 備註 |
|------------|------|------------------|------|
| fastapi / uvicorn | Web 框架 | **Hono** | 路由體驗最接近 FastAPI |
| SQLAlchemy / alembic | ORM / migration | **Drizzle ORM** 或 supabase-js | Drizzle 有型別安全 + migration |
| psycopg | PG 驅動 | **Hyperdrive + postgres.js** 或 supabase-js | 見 04 |
| python-jose | JWT | Supabase Auth 內建 | 不需自簽 |
| passlib / bcrypt | 密碼雜湊 | Supabase Auth 內建 | 不再自管密碼 |
| webauthn | Passkey | ❌ 移除 | 改 Google OAuth |
| APScheduler | 背景排程 | **Cloudflare Cron Triggers** | 部分任務直接刪除 |
| httpx / requests | HTTP | 原生 `fetch()` | |
| pytz / dateutil | 時區 | `Temporal` polyfill 或 `date-fns-tz` | 注意 Asia/Taipei |
| pydantic | 驗證 | **Zod** | 與 Hono 整合良好 |

## 全部 API 端點數量

共約 **90 個端點**（完整對照見 [`06-api-mapping.md`](./06-api-mapping.md)）。
