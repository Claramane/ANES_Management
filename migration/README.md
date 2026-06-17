# anes-migration

麻醉科班表系統 Cloudflare + Supabase 遷移工作區。

## 專案結構

```
anes-migration/
├── docs/           # 規劃文件（評估、決策、架構）
├── supabase/       # Supabase CLI 專案（migrations、functions、seed）
│   └── migrations/ # SQL migration 檔案
├── worker/         # Cloudflare Workers（自動排班生成、醫師班表 Cron）
│   └── src/
└── README.md
```

## 目標架構

```
React 前端 (Cloudflare Pages)
        │  HTTPS / JSON
        ▼
Cloudflare Workers (TypeScript)   ← 排班生成 + 醫師班表 Cron
        │  supabase-js
        ▼
Supabase (PostgreSQL + Auth + Realtime)
```

前端主流程直連 Supabase（RLS + PL/pgSQL RPC），Worker 只處理純運算量大的任務。

## Supabase 專案

- **名稱**: AnesNurseShiftManagement
- **Region**: ap-southeast-2
- **URL**: https://mruruchxdnyvltqsmskj.supabase.co

## 規劃文件

所有評估、決策與計畫文件見 [`docs/`](./docs/)，入口為 [`docs/README.md`](./docs/README.md)。

## 分階段執行計畫概覽

| 階段 | 重點 | 相依 |
|------|------|------|
| Phase 0 | 地基：Supabase schema + Worker 骨架 | — |
| Phase 1 | 認證：Google OAuth + auto-link trigger | Phase 0 |
| Phase 2 | 唯讀模組：公告、公式班表、班表讀取 | Phase 0 |
| Phase 3 | 排班生成 + 版本控制（branch/PR 模型） | Phase 1 |
| Phase 4 | 換班三段審核 | Phase 3 |
| Phase 5 | 下線舊系統 | 全部 |
