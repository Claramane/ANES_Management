# 遠端部署配置指南

## WebAuthn在遠端環境的配置

### 問題診斷

如果遇到 "No challenge in session" 錯誤，通常是以下原因：

1. **Session配置問題**：不同的SECRET_KEY或cookie設定
2. **CORS配置問題**：前後端域名不匹配
3. **HTTPS配置問題**：WebAuthn在生產環境需要HTTPS
4. **RP_ID配置錯誤**：域名設定不正確

### 必需的環境變數配置

在遠端環境（如Zeabur）中設定以下環境變數：

```bash
# 基本配置
SECRET_KEY=your-production-secret-key-min-32-chars
IS_PRODUCTION=true
HTTPS_ONLY=true  # 如果使用HTTPS
DEBUG=false

# WebAuthn配置
WEBAUTHN_RP_ID=your-domain.zeabur.app  # 不包含協議和端口
WEBAUTHN_EXPECTED_ORIGIN=https://your-frontend-domain.zeabur.app
FRONTEND_ORIGIN=https://your-frontend-domain.zeabur.app

# CORS配置
BACKEND_CORS_ORIGINS=https://your-frontend-domain.zeabur.app

# 資料庫配置
DATABASE_URL=postgresql://user:password@host:port/database
```

### 重要注意事項

1. **SECRET_KEY**：
   - 必須是固定值，至少32字符
   - 在生產環境中不應該每次啟動都改變
   - 用於session加密，如果改變會導致session失效

2. **RP_ID設定**：
   - 只包含域名，不包含協議
   - 不包含端口號
   - 例如：`your-app.zeabur.app`，不是 `https://your-app.zeabur.app`

3. **CORS設定**：
   - 確保前端域名在BACKEND_CORS_ORIGINS中
   - 設定 `allow_credentials=True`

4. **HTTPS要求**：
   - WebAuthn在生產環境必須使用HTTPS
   - 設定 `HTTPS_ONLY=true`

### 調試步驟

1. **檢查配置**：
   ```bash
   # 在後端目錄執行
   python check_webauthn_config.py
   ```

2. **檢查session狀態**：
   - 訪問 `/api/webauthn/debug/session` 端點
   - 檢查session是否正常創建

3. **檢查瀏覽器控制台**：
   - 查看是否有CORS錯誤
   - 檢查網路請求是否包含cookies

4. **檢查服務器日誌**：
   - 查看詳細的錯誤信息和調試輸出

### 常見問題與解決

#### 問題1：Session無法保持
**解決方案**：
- 確保SECRET_KEY在環境變數中設定且固定
- 檢查cookie的same_site和secure設定
- 確認前後端在相同域名或正確設定CORS

#### 問題2：RP_ID不匹配
**解決方案**：
- RP_ID只能是域名，不包含協議
- 確保前端和後端使用相同的RP_ID設定

#### 問題3：HTTPS證書問題
**解決方案**：
- 在Zeabur等平台，通常會自動提供HTTPS
- 確保所有請求都使用HTTPS
- 設定 `HTTPS_ONLY=true`

### 部署檢查清單

- [ ] 設定固定的SECRET_KEY
- [ ] 配置正確的WEBAUTHN_RP_ID（只包含域名）
- [ ] 設定WEBAUTHN_EXPECTED_ORIGIN（包含完整URL）
- [ ] 配置CORS允許來源
- [ ] 確認HTTPS設定
- [ ] 測試session是否正常工作
- [ ] 驗證WebAuthn註冊和登入流程

### 測試步驟

1. 部署後先測試基本API端點
2. 測試用戶登入功能
3. 檢查 `/api/webauthn/debug/session` 端點
4. 嘗試WebAuthn註冊流程
5. 檢查瀏覽器開發者工具的網路和控制台選項卡

### 生產環境建議

- 使用固定的SECRET_KEY
- 啟用HTTPS
- 設定適當的session過期時間
- 定期備份資料庫
- 監控服務器日誌 