# 對話與決策紀錄 — Cloudflare + Supabase 遷移評估

> 本文件記錄此次遷移評估的完整討論脈絡與決策，作為後續實作的依據。
> 日期：2026-06-17

## 背景與目標

將「麻醉科護理班表管理系統」遷移到新的技術底：

- **資料庫**：改用 **Supabase**（PostgreSQL + Auth + Realtime）
- **部署**：前後端都架在 **Cloudflare**
- **前端**：既有 React，沿用（遷移風險低）
- **後端**：從 **FastAPI (Python)** 改寫成 **Cloudflare Workers 原生 TypeScript**

核心提問：改寫成 Worker 原生 TS 有哪些技術障礙？目前後端有哪些複雜邏輯？

## 評估過程摘要

1. 盤點後端：約 7,100 行 Python（FastAPI + SQLAlchemy），約 90 個 API 端點，20 張資料表。
2. 找出平台相依與複雜邏輯，評估在 Worker（V8 isolate、無常駐程序、無 Python、執行時間限制）下的障礙。
3. 關鍵發現：**最複雜的加班輪次分配演算法（含 Fisher-Yates）其實在前端**
   （`frontend/src/utils/overtimeAllocation.js`），不在後端 → 零遷移成本。
4. 依使用者決策砍掉三大障礙來源，重新評估難度。

## 初版評估的三大障礙（後經決策消除）

| 障礙 | 原因 | 結果 |
|------|------|------|
| APScheduler 常駐背景排程 | Worker 無常駐程序 | 因 ADR-001 大幅移除 |
| 自建 WebSocket 長連線 | Worker 無法維持連線 | ADR-002 改 Supabase Realtime |
| WebAuthn / Passkey | Python 套件難移植 | ADR-003 改 Supabase Auth |

## 本次拍板的決策

| 決策 | 內容 |
|------|------|
| **ADR-001** | 移除醫師自動下班偵測（已在另一專案實作）→ 連帶移除 5 分鐘 cron 與大半狀態管理邏輯 |
| **ADR-002** | 移除自建 WebSocket，上線/下線改用 **Supabase Realtime presence** |
| **ADR-003** | 認證改用 **Supabase Auth（Google OAuth）**，廢除自建 JWT / bcrypt / WebAuthn / LINE 登入 |
| **ADR-004** | 保留現有 PostgreSQL 資料模型，平移到 Supabase（不重新設計 schema）|
| **ADR-005** | 分階段遷移，FastAPI 暫時保留作 fallback，前端以 API base 分流 |

（決策細節見 [`03-decisions.md`](./03-decisions.md)）

## 結論

砍掉「醫師自動偵測、WebSocket、自建認證」三項後，三大平台障礙幾乎全部消失。

> **遷移難度從「中高」降到：主要是把排班生成 / 版本控制邏輯翻寫成 TS，以及把資料存取層從 SQLAlchemy 換成 Supabase。**
> 屬於工程量大但路徑清楚的遷移，無架構性死路。

選定技術棧：**Cloudflare Workers + Hono + Drizzle ORM + Hyperdrive → Supabase**（前端驗 Supabase JWT、用 Supabase JS SDK 處理 Auth 與 Realtime）。

## 過程中遇到的限制

- 使用者要求參考另一專案 **`Claramane/DoctorShiftManagement`**（登入、換班、班表版本控制）。
- 但本 session 的 GitHub 權限被鎖在 `anes_management`，且該專案為 private、環境無 git 憑證，無 `add_repo` 工具 → **本 session 無法讀取**。
- 已於 [`open-questions.md`](./open-questions.md) 記錄需從該專案確認的項目與三種開通方式。

## 待辦（進實作前）

1. 取得 DoctorShiftManagement 的登入 / 換班 / 版本控制做法（見 open-questions）。
2. 確認認證對應（員工 ↔ Google email、白名單、後門帳號）。
3. 確認醫師班表手動操作是否仍由本系統提供。
4. 之後可先搭 Phase 0 的 `worker/` 骨架（不依賴 DoctorShiftManagement）。

## 文件索引

完整規劃見本資料夾其餘文件：`README.md`、`01`~`08`、`open-questions.md`。
