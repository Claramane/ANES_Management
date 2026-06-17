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
| [`open-questions.md`](./open-questions.md) | 待確認問題（含要參考 DoctorShiftManagement 的項目） |

## 現階段結論

砍掉「醫師自動下班偵測、WebSocket、自建認證」三項後，原本最棘手的三大平台障礙（常駐排程、長連線、WebAuthn）幾乎全部消失。**剩下的工作主力是：把排班生成 / 版本控制邏輯翻寫成 TS，以及把資料存取層從 SQLAlchemy 換成 Supabase。** 屬於工程量大但路徑清楚的遷移。
