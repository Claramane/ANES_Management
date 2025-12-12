# WebAuthn/Passkey 摘要與改進清單

本文快速整理專案內 WebAuthn/Passkey 的現況、技術細節與改進 TODO，方便後續迭代。所有路徑以倉庫根目錄為基準。

## 目前實作概況
- **後端路由**：`backend/app/routes/webauthn.py`（註冊、認證、憑證列表/刪除、除錯端點）。
- **資料模型**：`backend/app/models/webauthn.py` → `webauthn_credentials` 表，欄位含 `credential_id`、`public_key`、`sign_count`、`device_fingerprint`、`is_active`、`created_at/last_used_at`。
- **前端流程**：登入頁 `frontend/src/pages/Login.jsx`（Passkey 登入）；Zustand store `frontend/src/store/authStore.js`（Passkey 註冊/管理）。
- **設定**：`backend/app/core/config.py` 使用 `WEBAUTHN_RP_ID`、`WEBAUTHN_EXPECTED_ORIGIN`；`SessionMiddleware` 在 `backend/main.py` 設置 cookie 名 `session`，dev 同源 `lax`，prod `same_site=none`、`https_only` 依環境。

## 註冊流程（/webauthn/register）
1. **start**：`generate_registration_options` 產生 challenge，寫入 session；同時產生 server 簽名的 `challenge_token` 回前端（HMAC + 5 分鐘 TTL），並附 `challenge_b64`、`user_id`。
2. **finish**：優先 session challenge；無則驗證 `challenge_token`（簽名 + user 檢查 + 時效）。`verify_registration_response` 驗證通過後寫入 DB。
3. **設備指紋**：`generate_device_fingerprint` 以 UA（去版本號）、瀏覽器/OS、origin、RP_ID、`sec-ch-ua`/`sec-ch-ua-platform` 雜湊 SHA-256；若指紋已綁定其他帳號且 `is_active`，阻擋註冊。
4. **入庫**：將 credential_id / public_key 轉 base64url，保存 sign_count、device_name(user-agent)、device_fingerprint。

## 認證流程（/webauthn/authenticate）
1. **start**：必填 username，僅回傳該用戶 `allowCredentials`；不再回傳全庫憑證。回傳 `challenge_token`（簽名+TTL）。
2. **finish**：解析 clientDataJSON 取 challenge，若有 `challenge_token` 則驗證簽名/時效；更新 sign_count、last_used_at，寫登入 Log，更新使用者 last_login_time/IP，發 JWT。

## 前端要點
- **登入**：`Login.jsx` 觸發 `navigator.credentials.get()`，成功後呼叫 `/webauthn/authenticate/finish`，並以 `setAuth()` 直接寫入 token/user。
- **登入前必填 username**：Passkey 按鈕前要求輸入用戶名，start API 會帶 username，伺服器僅回傳該用戶憑證，避免全庫列表。
- **註冊**：`authStore.registerPasskey()` 先 `/webauthn/register/start`，將 challenge/user_id 暫存於 payload，以防 session 遺失，再 `/webauthn/register/finish`。
- **管理**：`getPasskeys`、`deletePasskey` 對應列表/刪除 API。

## 風險與缺口
- **憑證範圍**：已強制 username，避免回傳全庫憑證；如需更佳體驗可改採 discoverable credentials。
- **重複註冊防護**：已在 register_start 填入 `excludeCredentials`，但仍可考慮後端以 AAGUID/指紋判斷同一 authenticator 重註並給出提示。
- **指紋穩定性**：已加入 client hints/Origin/RPID，但跨瀏覽器仍視為不同設備；可再加入 AAGUID 或 per-device cookie。
- **Session 依賴**：已引入 `challenge_token`，減少對 session 失效時信任前端 challenge 的風險；仍可改為後端暫存(如 Redis)以完全移除前端參與。
- **環境設定風險**：若生產未設置正確 `WEBAUTHN_RP_ID` / `WEBAUTHN_EXPECTED_ORIGIN` / `HTTPS_ONLY=true`，WebAuthn 將驗證失敗。
- **缺乏率限與審計**：認證端點未實作速率限制；註冊/刪除缺少安全事件審計。

## 改進建議（TODO）
- [x] 認證 start 依使用者過濾：接受 `username`，僅回傳該用戶 `allowCredentials`；舊客戶端需遷移或落日。
- [x] 註冊 start 填充 `excludeCredentials`：列出該用戶現有 credential_id，避免重複註冊同一 authenticator。
- [x] 提升挑戰一致性：引入 `challenge_token`（HMAC + user + purpose + TTL），finish 必須驗證 token。
- [x] 強化設備指紋：新增 `sec-ch-ua`、`sec-ch-ua-platform`、RP/Origin 參與雜湊，弱化 UA 版本變動。
- [ ] 強制生產安全配置檢查：開機自檢若 `IS_PRODUCTION` 且未啟用 `HTTPS_ONLY`、RP/Origin 不吻合則阻擋啟動並記錄告警。
- [ ] 速率限制與審計：對 `/authenticate/*`、`/register/*` 增加速率限制；註冊/刪除 passkey 追加安全事件日誌。
- [ ] 前端 UX：在登入頁顯示「此裝置未註冊 Passkey」等更精確錯誤；管理頁加入裝置指紋/瀏覽器資訊提示。
- [x] 落日全庫 allowCredentials：強制前端傳 username，移除回傳全庫模式。

## 參考檔案
- 後端：`backend/app/routes/webauthn.py`、`backend/app/models/webauthn.py`、`backend/app/core/config.py`、`backend/main.py`
- 前端：`frontend/src/pages/Login.jsx`、`frontend/src/store/authStore.js`
- 資料表：`docs/DATABASE_ARCHITECTURE.md`（`webauthn_credentials`）、備份 SQL `local_anes_db_backup_20250626_013147.sql`
