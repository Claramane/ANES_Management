# 生產環境部署指南

## Zeabur 部署配置

### 1. 環境變數設置

在 Zeabur 後端服務中設置以下環境變數：

```
APP_NAME=恩主公麻醉科班表管理系統
SECRET_KEY=your-super-secure-production-secret-key-minimum-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
DEBUG=false
IS_PRODUCTION=true
HTTPS_ONLY=true

# 資料庫配置（根據實際情況調整）
DATABASE_URL=postgresql://production_user:production_password@production_host/production_db

# 前端域名配置（替換為實際的前端域名）
FRONTEND_ORIGIN=https://your-frontend-domain.zeabur.app
WEBAUTHN_RP_ID=your-frontend-domain.zeabur.app
BACKEND_CORS_ORIGINS=https://your-frontend-domain.zeabur.app
WEBAUTHN_EXPECTED_ORIGIN=https://your-frontend-domain.zeabur.app

# 管理員配置
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure-production-password
```

### 2. 重要安全設置

1. **SECRET_KEY**: 必須使用強密碼，至少32字符
2. **資料庫密碼**: 使用強密碼
3. **ADMIN_PASSWORD**: 使用強密碼
4. **HTTPS_ONLY=true**: 確保所有cookie只在HTTPS下傳輸
5. **IS_PRODUCTION=true**: 啟用生產環境安全設置

### 3. 域名配置

將以下域名替換為實際域名：
- `your-frontend-domain.zeabur.app` -> 實際前端域名
- 確保前後端域名在CORS設置中正確配置

### 4. 驗證部署

部署後驗證：
1. 訪問 `https://your-backend-domain.zeabur.app/health`
2. 確認返回 `{"status":"healthy","message":"系統運行正常"}`
3. 測試前端Passkey功能是否正常

### 5. 調試工具

如果有問題，可以訪問：
- `https://your-backend-domain.zeabur.app/api/webauthn/debug/session`（需要登入）

查看配置狀態。 