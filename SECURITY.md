# 安全指南

## 🔒 敏感資訊處理規範

### 禁止事項
- ❌ 不得在代碼中硬編碼任何密碼、API密鑰或連線字串
- ❌ 不得將包含敏感資訊的檔案提交到版本控制
- ❌ 不得在commit訊息中包含敏感資訊
- ❌ 不得在文檔中暴露真實的密碼或主機位址

### 安全最佳實踐

#### 1. 環境變數使用
所有敏感配置應使用環境變數：
```bash
# 正確做法
export DATABASE_URL="postgresql://user:password@host:port/db"
export SECRET_KEY="your-secret-key"

# 錯誤做法：不要在代碼中硬編碼
DATABASE_URL = "postgresql://user:password@host:port/db"
```

#### 2. .env檔案
- 使用 `.env` 檔案管理本地開發環境變數
- 確保 `.env` 已加入 `.gitignore`
- 提供 `.env.example` 作為範例

#### 3. 檔案命名規範
以下檔案類型自動被 `.gitignore` 忽略：
- `setup_remote_*.py`
- `test_*.py`
- `migration_*.py`
- `*_test.py`
- `*_migration.py`
- `secrets.py`
- `credentials.py`
- `config_*.py`
- `deploy_*.py`
- `remote_*.py`
- `production_*.py`

## 🚨 敏感資訊洩露應急處理

### 立即行動清單
1. **停止使用洩露的憑證**
2. **更改所有相關密碼**
3. **清理Git歷史**
4. **通知相關人員**

### Git歷史清理方法

#### 方法1：git filter-branch（已執行）
```bash
# 刪除敏感檔案
git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch path/to/sensitive/file' --prune-empty --tag-name-filter cat -- --all

# 替換敏感字串
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch --force --tree-filter 'find . -name "*.py" -type f -exec sed -i "" "s/SENSITIVE_STRING/[REDACTED]/g" {} + 2>/dev/null || true' --prune-empty --tag-name-filter cat -- --all

# 強制推送
git push --force origin main
git push --force origin --tags

# 清理本地
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

#### 方法2：BFG Repo-Cleaner（推薦）
```bash
# 安裝 BFG
brew install bfg

# 刪除敏感檔案
bfg --delete-files "sensitive-file.py"

# 替換敏感字串
bfg --replace-text passwords.txt

# 清理和推送
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force origin main
```

## 🛡️ 防護措施

### 1. Pre-commit Hook
建議設置 pre-commit hook 檢查敏感資訊：
```bash
#!/bin/sh
# 檢查是否包含密碼模式
if git diff --cached --name-only | xargs grep -l "password.*=" 2>/dev/null; then
    echo "警告：發現可能的密碼！"
    exit 1
fi
```

### 2. 定期安全檢查
- 每月檢查 `.gitignore` 是否更新
- 定期掃描代碼庫是否有硬編碼的敏感資訊
- 檢查環境變數設置是否正確

### 3. 團隊培訓
- 新成員必須閱讀此安全指南
- 定期進行安全意識培訓
- 建立敏感資訊洩露回報機制

## 📞 安全事件回報

如發現安全問題，請立即聯絡：
- 系統管理員
- 資訊安全負責人
- 專案負責人

## 🔍 安全檢查清單

- [ ] 所有敏感配置已改為環境變數
- [ ] `.env` 檔案已加入 `.gitignore`
- [ ] 沒有硬編碼的密碼或API密鑰
- [ ] 測試檔案和部署腳本已排除版本控制
- [ ] Git歷史中無敏感資訊
- [ ] 設置了適當的 `.gitignore` 規則
- [ ] 團隊成員已了解安全規範

---

**記住：安全是每個人的責任！** 