# LINE Login 導入計畫（草案）

> 目標：在現有 ANES Management 系統加入 LINE Login，提供跨裝置、低阻力登入途徑，與現行密碼 / Passkey 共存。

## 使用者流程 (預計)
1) 前端登入頁新增「使用 LINE 登入」按鈕。  
2) 進入 LINE 授權頁（scope: `profile`, `openid`, `email` 可選），完成授權後跳轉回 `FRONTEND_LINE_REDIRECT_URI`。  
3) 前端拿到 `code` → 呼叫後端 `/auth/line/callback`，後端以 `code` 換取 access_token / id_token。  
4) 後端驗簽 id_token，取得 LINE userId / displayName / email（若 scope 啟用）。  
5) 綁定策略：  
   - 若 LINE userId 已綁定本地帳號 → 發 JWT（或建立 session），登入成功。  
   - 若未綁定 → 引導使用者輸入「員工編號」完成綁定（建議要求再輸入一次密碼降低誤綁風險）。  
6) 後續登入可直接以 LINE userId 辨識發 JWT。

## 後端實作要點
- 新增路由：`/auth/line/login`（產生 state、nonce，導向 LINE 授權 URL）、`/auth/line/callback`。  
- state/nonce 安全：存放於 server-side（session/redis），TTL 5–10 分鐘；回來驗證。  
- Token 交換：POST `https://api.line.me/oauth2/v2.1/token`。  
- ID Token 驗證：  
  - 驗證 issuer = `https://access.line.me`  
  - audience = `LINE_CHANNEL_ID`  
  - nonce 符合先前生成  
  - exp 未過期  
- 綁定資料表：  
  - 採方案 B（並列表），但限制一個 user 只能綁一個 LINE；若已有綁定則拒絕新增。  
  - `line_accounts` 欄位：  
    - `id` bigserial PK  
    - `user_id` FK users.id ON DELETE CASCADE（唯一，保證每人一組）  
    - `line_user_id` varchar UNIQUE NOT NULL  
    - `display_name` varchar NULL  
    - `picture_url` text NULL  
    - `status` varchar(16) DEFAULT 'active'（保留但實務採硬刪）  
    - `created_at` timestamptz default now()  
    - `updated_at` timestamptz default now()  
    - `last_login_at` timestamptz NULL  
  - 硬刪解綁：刪除記錄，並寫 log。  
- JWT 發行：沿用既有 `create_access_token`，subject 放本地 username/id。  
- 日誌與審計：記錄綁定/登入事件（operation_type: `line_login`, `line_bind`）。  
- 速率限制：`/auth/line/login`、`/auth/line/callback` 皆需 per-IP 限流。

## 前端實作要點
- 登入頁新增 LINE 按鈕：點擊即導向後端 `/auth/line/login?redirect=<frontRedirect>`。  
- callback 頁（新頁或現有 Login 頁處理 `code`）：  
  - 從 URL 讀取 `code` & `state`，呼叫後端 `/auth/line/callback`。  
  - 若後端回覆「未綁定」，顯示綁定表單（輸入員工編號 + 密碼 或 OTP）。  
  - 成功後 setAuth 並導向 dashboard。  
- UI 提示：說明將共享 LINE 基本資料（名稱、頭貼、email(若同意)）。

## 環境變數 (後端)
- `LINE_CHANNEL_ID`
- `LINE_CHANNEL_SECRET`
- `LINE_REDIRECT_URI`（後端 callback，例：`https://backend.example.com/api/auth/line/callback`）
- `LINE_LOGIN_BASE_URL`（預設 `https://access.line.me/oauth2/v2.1/authorize`）
- `LINE_TOKEN_URL`（預設 `https://api.line.me/oauth2/v2.1/token`）
- `LINE_USERINFO_URL`（可選，若需額外 profile）
- `LINE_NONCE_TTL_SECONDS`（預設 600）
- `LINE_STATE_TTL_SECONDS`（預設 600）

## 安全考量
- 必驗證 state / nonce，防 CSRF/重放。  
- 僅信任 HTTPS redirect URI；開發用 http 需明確區分。  
- 綁定時需二次驗證（密碼或 email OTP）以防他人登入後綁錯帳。  
- 記錄登入/綁定日誌，提供異常追溯。  
- 速率限制、錯誤提示統一，避免帳號枚舉。

## 權限策略（登入來源管控）
- 若使用「密碼登入」後，僅提供「綁定 Passkey / 綁定 LINE」功能，封印換班、公告等修改操作（需在權限層判斷 login_method）。  
- 若已綁定 LINE 或 Passkey，鼓勵改用強身份登入；可考慮在 UI/後端逐步限制只允許 LINE/Passkey 修改敏感資料。

## 里程碑（建議）
1) 設定 LINE Developer Channel，取得 Channel ID/Secret，配置 redirect。  
2) 後端：state/nonce/交換/token 驗簽、資料表遷移、路由與服務。  
3) 前端：按鈕、callback 流程、綁定表單。  
4) 文件：README/USAGE 更新、環境變數範例。  
5) 測試：本地 & sandbox，驗證 state/nonce 失效、過期 token、取消授權流程。  
6) 部署：新增環境變數，驗證生產域名 redirect。

## 參考
- 官方文件：<https://developers.line.biz/en/docs/line-login/>  
- ID Token 驗證規則：<https://developers.line.biz/en/docs/line-login/verify-id-token/>
