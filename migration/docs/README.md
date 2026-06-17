# 麻醉科班表系統 — Cloudflare + Supabase 遷移工作區

本資料夾收錄將後端從 **FastAPI (Python)** 遷移到 **Cloudflare Workers (TypeScript)**、資料庫改用 **Supabase (PostgreSQL)** 的所有評估、決策與計畫文件。

> 狀態：**規劃中（尚未動工）**
> 建立日期：2026-06-17
> 對應分支：`claude/cloudflare-workers-migration-lgb31t`

## 目標架構（一句話）

```
React 前端 (Cloudflare Pages)
        │  HTTPS / JSON
        ▼
Cloudflare Workers (TypeScript + Hono)  ── 商業邏輯 API
        │  Postgres wire (Hyperdrive / supabase-js)
        ▼
Supabase (PostgreSQL + Auth + Realtime)
```

- **認證**：Supabase Auth（Google OAuth）取代自建 JWT / WebAuthn / LINE 登入
- **即時上下線**：Supabase Realtime 取代自建 WebSocket
- **背景排程**：Cloudflare Cron Triggers 取代 APScheduler（且醫師自動下班偵測整組移除）

## 文件導覽

| 檔案 | 內容 |
|------|------|
| [`00-conversation-log.md`](./00-conversation-log.md) | 對話與決策紀錄：評估脈絡、決策總結、結論 |
| [`01-current-backend.md`](./01-current-backend.md) | 現況盤點：技術棧、模組規模、依賴清單 |
| [`02-target-architecture.md`](./02-target-architecture.md) | 目標技術選型與專案結構 |
| [`03-decisions.md`](./03-decisions.md) | 關鍵決策記錄（ADR） |
| [`04-database-schema.md`](./04-database-schema.md) | 資料表盤點與 Supabase 遷移注意事項 |
| [`05-auth-migration.md`](./05-auth-migration.md) | Supabase Google Auth 遷移計畫 |
| [`06-api-mapping.md`](./06-api-mapping.md) | 全部 API 端點對照（去/留/改） |
| [`07-business-logic.md`](./07-business-logic.md) | 需移植的核心商業邏輯 |
| [`08-migration-plan.md`](./08-migration-plan.md) | 分階段執行計畫 |
| [`09-dsm-reference.md`](./09-dsm-reference.md) | DoctorShiftManagement 參考摘要（認證 / 版本控制 / 換班 / 路由） |
| [`open-questions.md`](./open-questions.md) | 待確認問題（已解決項目已標記）|

## 最新架構決策（2026-06-17 更新）

讀取 DoctorShiftManagement 後，確認了三個重要決策：

- **ADR-006**：版本控制改用 DSM 的 **git-style branch/PR 模型**（`schedule_branches + 3-way merge`），`schedule_versions + schedule_version_diffs` 廢棄。
- **ADR-007**：換班升級為 DSM 的**三段審核流程**（pending_target → pending_admin → approved），接受時走 `merge_branch`。
- **ADR-008**：前端為**單一 SPA**，以 `/admin/*` / `/app/*` 路由區分護理長 / 護理師介面。

另一重要發現：DSM 主流程走「前端直連 Supabase + PL/pgSQL RPC」，**不經 Hono API gateway**。ANES 跟進此模式，Worker 只負責自動排班生成和醫師班表 Cron 同步兩件事。

## 原始結論（仍適用）

砍掉「醫師自動下班偵測、WebSocket、自建認證」三項後，最棘手的三大平台障礙幾乎消失。**剩下的工作主力是：排班生成翻成 TS（Worker）、版本控制改 branch 模型（PL/pgSQL）、認證改 Supabase Auth。** 路徑清楚，工程量大但無架構死路。
