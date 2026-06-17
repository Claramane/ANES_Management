# 05 — 認證遷移：Supabase Google Auth

## 現況（將被取代）

- 帳密登入：`POST /login`（員工編號 + 密碼）→ 自簽 JWT（python-jose）
- 密碼：bcrypt（passlib）
- Passkey：WebAuthn（`routes/webauthn.py`，591 行）
- LINE 登入：OAuth（`routes/line_login.py`，348 行）
- 心跳 / 線上狀態：`/heartbeat` + `last_activity_time`

## 目標：Supabase Auth（Google OAuth）

### 流程

```
前端 (supabase-js)
  └─ signInWithOAuth({ provider: 'google' })
        └─ Supabase 簽發 JWT (含 sub = auth user id)
              └─ 前端帶 Authorization: Bearer <jwt> 呼叫 Worker
                    └─ Worker middleware 用 Supabase JWKS 驗證 JWT
                          └─ 由 jwt.sub / email 對應到 users 表
```

### Worker 端驗證（概念）

- 取得 Supabase 專案的 JWKS（`https://<project>.supabase.co/auth/v1/.well-known/jwks.json`）。
- 用 `jose`（JS）驗證簽章、`aud`、`exp`。
- 從 token 取 `sub`（auth user id）/ `email`，查 `users` 表得到 role / identity。
- 注入 `c.set('user', ...)` 供後續路由與權限判定使用。

## 使用者對應問題（關鍵）

現況用**員工編號**登入；Google 登入拿到的是 **email**。需要建立對應關係。

### 建議做法

1. `users` 表新增欄位：
   - `auth_user_id`（uuid，對應 Supabase `auth.users.id`，unique，nullable 初期）
   - 確認 `email` 欄位已有且為公司 Google 帳號 email。
2. 首次 Google 登入：
   - 以 email 比對既有 `users.email`；命中則寫入 `auth_user_id` 完成綁定。
   - 未命中 → 拒絕登入（白名單制，醫療系統不應自助註冊）。
3. 權限仍由 `users.role` / `users.identity` 決定，**與 Supabase Auth 無關**（Supabase 只負責「你是誰」，本系統決定「你能做什麼」）。

### 待確認（見 open-questions）

- 是否所有員工都有可用的公司 Google 帳號？沒有 Google 帳號的人怎麼辦？
- 是否需要保留一組「本地帳密」管理員後門（避免 Google 服務中斷時鎖死）？
- 既有 webauthn / line_accounts 資料是否需要保留歷史，或可直接廢棄。

## 權限判定移植

現有權限分散在前端與後端（參考 `docs/PERMISSIONS.md`）。後端權限函式（如 `get_shift_swap_privileged_user`）需移植為 Hono middleware：

- `requireRole(['admin','head_nurse'])`
- `requireIdentityPermission(category, action)`（公告權限依 identity，查 `announcement_permissions`）

## 影響的端點

| 現有端點 | 處置 |
|----------|------|
| `POST /login` / `/test-login` | ❌ 移除（改 Supabase OAuth）|
| `POST /users/change-password` | ❌ 移除 |
| `POST /admin/fix-passwords` | ❌ 移除 |
| `POST /heartbeat` | ❌ 移除（改 Realtime presence）|
| `GET /online-users` | 🔁 改由 Realtime presence 提供 |
| `webauthn/*`（8 個）| ❌ 全移除 |
| `line/*`（6 個）| ❌ 全移除 |
| `GET /users/me` | ✅ 保留（改由 Supabase JWT 解析）|
