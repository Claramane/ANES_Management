# 02 — 目標架構與技術選型

## 整體拓樸

```
┌──────────────────────────────┐
│  React 前端                   │  Cloudflare Pages
│  (既有，幾乎不動)             │
└───────────────┬──────────────┘
                │ fetch JSON (/api/*)
                │ + Supabase JS SDK (Auth / Realtime)
                ▼
┌──────────────────────────────┐
│  Cloudflare Worker            │  TypeScript + Hono
│  - 商業邏輯 API               │
│  - 驗證 Supabase JWT          │
│  - Cron Triggers（排程）      │
└───────────────┬──────────────┘
                │ Postgres wire
                ▼
┌──────────────────────────────┐
│  Supabase                     │
│  - PostgreSQL (RLS)           │
│  - Auth (Google OAuth)        │
│  - Realtime (上線/下線)       │
└──────────────────────────────┘
```

## 技術選型決策

| 面向 | 選用 | 理由 / 替代方案 |
|------|------|----------------|
| Worker 框架 | **Hono** | 輕量、邊緣原生、路由 / middleware 體驗近 FastAPI。替代：Itty Router（太精簡）、Elysia（偏 Bun）|
| 資料存取 | **Drizzle ORM** + Hyperdrive | 型別安全、SQL-like、migration 工具。替代：直接 supabase-js（前端可用，Worker 內查詢能力較弱）|
| DB 連線 | **Cloudflare Hyperdrive** → Supabase pooler | Hyperdrive 做連線池 + 邊緣快取，解決 Worker 無常駐連線問題 |
| 驗證 schema | **Zod** + `@hono/zod-validator` | 取代 Pydantic |
| 認證 | **Supabase Auth (Google)** | Worker 端只驗 JWT（用 Supabase JWKS）|
| 即時 | **Supabase Realtime** | presence 功能直接顯示上線/下線 |
| 排程 | **Cloudflare Cron Triggers** | wrangler `triggers.crons` 設定 |
| 部署 | **Wrangler** | Worker + Pages 一致工具鏈 |

## 建議專案結構（新後端）

```
worker/
├── src/
│   ├── index.ts              # Hono app 入口 + 路由掛載
│   ├── env.ts                # Env 型別 (bindings: HYPERDRIVE, SUPABASE_* …)
│   ├── middleware/
│   │   ├── auth.ts           # 驗證 Supabase JWT、注入 user
│   │   └── permissions.ts    # role / identity 權限判定
│   ├── db/
│   │   ├── schema.ts         # Drizzle schema（對應現有資料表）
│   │   └── client.ts         # Hyperdrive 連線
│   ├── routes/
│   │   ├── users.ts
│   │   ├── schedules.ts      # 含版本控制
│   │   ├── formula.ts
│   │   ├── overtime.ts
│   │   ├── shiftSwap.ts
│   │   ├── doctorSchedule.ts
│   │   └── announcements.ts
│   ├── services/
│   │   ├── scheduleGenerator.ts   # 排班生成邏輯（移植自 schedules.py）
│   │   ├── scheduleVersion.ts     # 版本 diff / publish
│   │   └── doctorSync.ts          # 外部 API 同步
│   ├── schemas/              # Zod schemas
│   └── cron/
│       └── doctorScheduleUpdate.ts  # Cron 觸發的未來月份更新
├── drizzle/                  # migration 檔
├── wrangler.toml
└── package.json
```

## Worker 平台限制需注意

| 限制 | 影響 | 對策 |
|------|------|------|
| CPU 時間（付費方案上限約 30s / 請求）| 排班生成 / 整月批次更新 | 邏輯已是純運算，最佳化迴圈；必要時分批 |
| 無常駐記憶體 | 不能存連線池 / 連線狀態 | Hyperdrive 處理 DB 連線 |
| 無檔案系統 | 不能寫暫存檔 | 不需要（皆走 DB）|
| 單次請求 subrequest 數限制 | 大量外部 fetch | 醫師 API 同步注意批次 |
| 時區 | UTC 為主 | 所有商業邏輯明確使用 Asia/Taipei |
