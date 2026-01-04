# Git 分支管理與工作流程規範

## 版本資訊
**最後更新**: 2025-10-02

## 目錄
1. [Git Flow 工作流程](#git-flow-工作流程)
2. [分支命名規則](#分支命名規則)
3. [GitHub 分支保護設定](#github-分支保護設定)
4. [開發流程](#開發流程)
5. [正式發布流程](#正式發布流程)
6. [緊急修復流程 (Hotfix)](#緊急修復流程-hotfix)
7. [誤合併到 main 的退版流程](#誤合併到-main-的退版流程)
8. [Merge 策略](#merge-策略)
9. [實用指令範例](#實用指令範例)
10. [常見問題處理](#常見問題處理)

---

## Git Flow 工作流程

### 分支策略

本專案採用標準 Git Flow 策略，包含永久分支和臨時分支：

```
main (正式環境)
   ↑
   │ (僅限 hotfix 合併，需人工審核)
   │
develop (開發/測試環境)
   ↑
   ├── feature/新功能開發
   ├── bugfix/錯誤修復
   ├── refactor/程式碼重構
   └── docs/文件更新

main (正式環境)
   ↑
   └── hotfix/緊急修復 (直接從 main 建立)
```

### 分支說明

| 分支類型 | 說明 | 生命週期 | 來源分支 | 合併目標 | 環境用途 |
|---------|------|---------|---------|---------|---------|
| `main` | **正式版本分支** | 永久 | - | - | **正式環境（Production）** |
| `develop` | **開發整合分支** | 永久 | main | **永不合併回 main** | **開發/測試環境** |
| `feature/*` | 新功能開發 | 暫時 | develop | develop | 本地開發 |
| `bugfix/*` | Bug 修復 | 暫時 | develop | develop | 本地開發 |
| `hotfix/*` | 緊急修復 | 暫時 | main | main + develop | 正式環境緊急修復 |
| `refactor/*` | 程式碼重構 | 暫時 | develop | develop | 本地開發 |
| `docs/*` | 文件更新 | 暫時 | develop | develop | 本地開發 |

### ⚠️ 重要規則

1. **`main` 分支保護**：
   - ✅ `main` 分支**僅用於正式環境部署**
   - ❌ `develop` 分支**永遠不能合併回 `main`**
   - ❌ `feature/*` 分支**絕對不能直接合併到 `main`**
   - ✅ 只有經過完整測試的 `hotfix/*` 可以合併到 `main`（需人工審核）
   - ✅ 正式發布時，由**專案負責人**手動選擇穩定的 commit 合併到 `main`

2. **`develop` 分支用途**：
   - ✅ 作為**開發環境和測試站**的部署分支
   - ✅ 所有 `feature`、`bugfix`、`refactor` 都合併到 `develop`
   - ✅ 在 `develop` 上進行整合測試
   - ❌ **永遠不合併回 `main`**（避免未穩定功能進入正式環境）

3. **正式發布流程**：
   - 在 `develop` 充分測試後
   - 由專案負責人建立 `release/vX.Y.Z` 分支
   - 經最終驗證後，手動合併到 `main` 並打上版本標籤

---

## 分支命名規則

### 台灣業界常見命名方式

**格式**: `類型/簡短描述`

#### 1. Feature 分支（新功能）
```bash
feature/user-passkey-auth          # 新增 Passkey 認證功能
feature/doctor-schedule-view       # 新增醫師班表檢視
feature/overtime-calculation       # 新增加班計算功能
feature/shift-swap-notification    # 新增調班通知功能
```

#### 2. Bugfix 分支（Bug 修復）
```bash
bugfix/login-token-refresh         # 修復登入 token 刷新問題
bugfix/schedule-display-error      # 修復班表顯示錯誤
bugfix/permission-check-logic      # 修復權限判定邏輯
bugfix/overtime-score-calculation  # 修復加班計分錯誤
```

#### 3. Hotfix 分支（緊急修復）
```bash
hotfix/critical-login-crash        # 緊急修復登入崩潰
hotfix/database-connection-lost    # 緊急修復資料庫連線中斷
hotfix/security-vulnerability      # 緊急修復安全漏洞
```

#### 4. Refactor 分支（重構）
```bash
refactor/auth-store-structure      # 重構認證狀態管理
refactor/api-route-organization    # 重構 API 路由結構
refactor/ui-component-structure    # 重構 UI 組件架構
```

#### 5. Docs 分支（文件更新）
```bash
docs/api-documentation             # 更新 API 文件
docs/user-manual                   # 更新使用手冊
docs/database-schema               # 更新資料庫架構文件
```

### 命名最佳實務

**✅ 良好的命名**:
- `feature/quick-input-longpress` - 清楚描述功能
- `bugfix/shift-swap-status-update` - 明確指出修復範圍
- `refactor/zustand-store-optimization` - 說明重構目標

**❌ 不良的命名**:
- `feature/new-stuff` - 太模糊
- `fix` - 缺少類型前綴和描述
- `feature/修改班表` - 避免使用中文（可能造成編碼問題）
- `feature/develop/user-auth` - 不需要加來源分支（冗餘）

### ❓ 常見問題：需要在分支名稱中標註來源分支嗎？

**Q**: 分支命名是否應該用 `feature/develop/新功能` 或 `feature/main/新功能`？

**A**: ❌ **不需要**。原因：

1. **所有 feature 分支預設從 `develop` 切出** - 這是 Git Flow 標準
2. **分支來源可以用 Git 指令查詢** - 不需要寫在名稱裡
3. **業界標準就是 `feature/{功能描述}`** - 簡潔明瞭

**查詢分支來源的方法**：
```bash
# 查看分支的起始點
git log --oneline --graph feature/user-auth develop

# 查看分支的 merge-base
git merge-base feature/user-auth develop
```

### 🔄 例外：多層命名（大型功能拆分）

**適用情境**：同一個大功能有多個子任務，多人協作

**格式**：`feature/{主功能}/{子功能}`

**範例**：
```bash
# 大功能：班表自動分配系統
feature/auto-schedule/algorithm        # 分配算法
feature/auto-schedule/ui               # UI 介面
feature/auto-schedule/integration      # 系統整合

# 大功能：Passkey 認證系統
feature/passkey/registration           # 註冊流程
feature/passkey/authentication         # 認證流程
feature/passkey/management             # 管理功能
```

**何時使用**：
- ✅ 大型功能需要拆分成多個 PR
- ✅ 多人協作，各自負責不同子功能
- ✅ 開發週期超過 1 週的功能

**何時不使用**：
- ❌ 小型功能，1-2 天就能完成
- ❌ 單人開發
- ❌ 功能簡單，不需要拆分

---

## GitHub 分支保護設定

為了確保 `main` 分支的安全性，**必須**在 GitHub 設定分支保護規則。

### 設定步驟

1. **前往 GitHub Repository Settings**
   - Settings → Branches → Add branch protection rule

2. **設定 `main` 分支保護**

**Branch name pattern**: `main`

**必須啟用的規則**：

- ✅ **Require a pull request before merging**
  - ✅ Require approvals: **1** (至少需要 1 人審核)
  - ✅ Dismiss stale pull request approvals when new commits are pushed
  - ✅ Require review from Code Owners (可選)

- ✅ **Require status checks to pass before merging**
  - ✅ Require branches to be up to date before merging
  - ✅ Status checks: 選擇 CI/CD 測試流程（如果有）

- ✅ **Require conversation resolution before merging**
  - 確保所有 PR 討論都已解決

- ✅ **Require signed commits** (建議啟用)

- ✅ **Require linear history** (建議啟用，強制使用 rebase 或 squash)

- ✅ **Include administrators**
  - **重要**：連管理員也必須遵守規則

- ✅ **Restrict who can push to matching branches**
  - 限制只有特定人員可以直接推送到 `main`
  - 建議：只允許專案負責人

- ✅ **Allow force pushes**: ❌ **禁用**
- ✅ **Allow deletions**: ❌ **禁用**

3. **設定 `develop` 分支保護**（建議）

**Branch name pattern**: `develop`

**建議啟用的規則**：

- ✅ **Require a pull request before merging**
  - Require approvals: **1**
- ✅ **Require status checks to pass before merging**
- ✅ **Require conversation resolution before merging**

### ⚠️ 嚴格執行規則

設定完成後：

1. **任何人都無法直接推送到 `main`** - 包括管理員
2. **所有變更都必須透過 Pull Request**
3. **Pull Request 必須經過審核才能合併**
4. **`feature/*` 分支絕對無法直接合併到 `main`** - 系統會阻擋
5. **只有專案負責人可以核准 PR 並合併到 `main`**

### 驗證保護設定

設定完成後，嘗試直接推送到 `main` 應該會看到錯誤：

```bash
git push origin main

# 應該會出現錯誤：
# remote: error: GH006: Protected branch update failed for refs/heads/main.
# remote: error: Required status check(s) are expected.
```

這表示保護設定已生效！✅

---

## 開發流程

### 1. 開始新功能開發

```bash
# 1. 確保在 develop 分支且是最新版本
git checkout develop
git pull origin develop

# 2. 建立新的 feature 分支（從 develop 分支建立）
git checkout -b feature/user-passkey-auth

# 3. 進行開發...
# 編輯檔案、新增功能

# 4. 本地測試確認功能正常
cd frontend && pnpm test
cd ../backend && python -m pytest
```

### 2. 提交變更

```bash
# 1. 查看變更
git status
git diff

# 2. 加入變更檔案
git add src/components/Auth/PasskeyAuth.jsx
git add backend/app/routes/auth.py

# 3. 提交變更（參考 CLAUDE.md 的 commit 訊息規範）
git commit -m "新增 Passkey 生物辨識認證功能

1. 前端實作
   - 新增 PasskeyAuth 組件
   - 整合 WebAuthn API

2. 後端實作
   - 新增 passkey 註冊與驗證端點
   - 實作 challenge 生成邏輯

修改檔案：
- PasskeyAuth.jsx: Passkey UI 組件
- auth.py: Passkey API 端點"
```

### 3. 推送到遠端

```bash
# 1. 推送分支到遠端（第一次推送）
git push -u origin feature/user-passkey-auth

# 2. 後續推送
git push
```

### 4. 建立 Pull Request (PR) - 合併到 develop

**GitHub 流程**:
1. 前往 GitHub repository
2. 點擊 "New Pull Request"
3. **重要**：選擇 base: `develop` ← compare: `feature/user-passkey-auth`
   - ⚠️ **絕對不要選擇 `main` 作為 base**
4. 填寫 PR 描述：

```markdown
## 功能說明
實作 Passkey 生物辨識認證功能，讓使用者可以使用指紋或臉部辨識登入系統。

## 變更項目
- [ ] 前端 Passkey UI 組件
- [ ] WebAuthn API 整合
- [ ] 後端 Passkey 驗證端點
- [ ] 測試案例

## 測試方式
1. 前往登入頁面
2. 點擊「使用 Passkey 登入」
3. 完成生物辨識驗證
4. 確認登入成功

## 相關文件
- docs/SECURITY.md - 認證安全指南

## 截圖
[附上功能截圖]
```

### 5. Code Review 與測試

**審核重點**:
- [ ] 程式碼符合專案規範
- [ ] 測試案例完整
- [ ] 文件已更新
- [ ] 無安全性問題
- [ ] 無效能疑慮

**測試檢查**:
```bash
# 前端測試
cd frontend
pnpm test
pnpm build  # 確認可以正常建置

# 後端測試
cd backend
source venv/bin/activate
python -m pytest
```

### 6. Merge 回 develop

**審核通過後**:
1. 確認所有測試通過
2. 解決所有 review comments
3. 點擊 GitHub "Merge pull request"
4. 選擇 merge 策略（見下方 Merge 策略章節）
5. 刪除遠端分支（GitHub 會提示）

**本地清理**:
```bash
# 1. 切回 develop 分支
git checkout develop

# 2. 拉取最新版本（包含剛 merge 的變更）
git pull origin develop

# 3. 刪除本地 feature 分支
git branch -d feature/user-passkey-auth

# 4. 刪除遠端分支（如果 GitHub 沒自動刪除）
git push origin --delete feature/user-passkey-auth
```

### 7. 部署到測試環境

```bash
# develop 分支會自動部署到開發/測試環境
# 在測試環境中驗證新功能
```

---

## 正式發布流程

當 `develop` 分支經過充分測試，準備發布到正式環境時：

### 方法 1: Cherry-pick 特定 Commits（推薦）

**適用於**：只想發布部分穩定功能到正式環境

```bash
# 1. 切換到 main 分支
git checkout main
git pull origin main

# 2. 在 develop 分支找出要發布的 commits
git log develop --oneline -20

# 3. Cherry-pick 穩定的 commits 到 main
git cherry-pick <commit-hash-1>
git cherry-pick <commit-hash-2>
git cherry-pick <commit-hash-3>

# 4. 更新版本號（參考 CLAUDE.md 版本號規範）
# 編輯 5 個位置的版本號...

# 5. Commit 版本號更新
git add .
git commit -m "更新系統版本號至 vX.Y.Z"

# 6. 打上版本標籤
git tag -a v0.10.0 -m "Release v0.10.0: 新增 Passkey 認證功能"

# 7. 推送到遠端（需要專案負責人權限）
git push origin main
git push origin v0.10.0
```

### 方法 2: Release 分支（完整發布）

**適用於**：發布 develop 上的所有變更到正式環境

```bash
# 1. 從 develop 建立 release 分支
git checkout develop
git pull origin develop
git checkout -b release/v0.10.0

# 2. 更新版本號（參考 CLAUDE.md 版本號規範）
# 編輯 5 個位置的版本號...

# 3. Commit 版本號更新
git add .
git commit -m "更新系統版本號至 v0.10.0"

# 4. 推送 release 分支
git push -u origin release/v0.10.0

# 5. 建立 PR: release/v0.10.0 → main
# 在 GitHub 建立 Pull Request
# base: main ← compare: release/v0.10.0

# 6. 經過最終審核後，合併到 main
# 由專案負責人核准並合併

# 7. 打上版本標籤
git checkout main
git pull origin main
git tag -a v0.10.0 -m "Release v0.10.0: 麻醉科班表系統重大更新"
git push origin v0.10.0

# 8. 刪除 release 分支
git branch -d release/v0.10.0
git push origin --delete release/v0.10.0
```

### ⚠️ 發布檢查清單

發布到 `main` 前，務必確認：

- [ ] develop 分支所有功能都已充分測試
- [ ] 所有測試案例通過
- [ ] 版本號已更新（5 個位置，參考 CLAUDE.md）
- [ ] CHANGELOG.md 已更新（如果有）
- [ ] 資料庫遷移腳本已準備（如果需要）
- [ ] 環境變數已確認（正式環境配置）
- [ ] 備份計畫已準備（重要！）
- [ ] 回滾計畫已準備（重要！）
- [ ] 專案負責人已審核並同意發布

---

## 緊急修復流程 (Hotfix)

當正式環境出現緊急問題，需要立即修復：

### 1. 建立 Hotfix 分支

```bash
# 1. 從 main 分支建立 hotfix（不是從 develop）
git checkout main
git pull origin main
git checkout -b hotfix/critical-login-crash

# 2. 修復問題
# 編輯檔案、修復 bug

# 3. 本地測試
cd frontend && pnpm test
cd ../backend && python -m pytest

# 4. Commit 修復
git add .
git commit -m "緊急修復：修復登入崩潰問題

問題描述：
- 用戶登入時系統崩潰
- 原因：JWT token 驗證邏輯錯誤

修復內容：
- 修正 token 過期檢查邏輯
- 新增 null 值保護

修改檔案：
- authStore.js: 修正 token 驗證邏輯"

# 5. 推送到遠端
git push -u origin hotfix/critical-login-crash
```

### 2. 建立 Pull Request 到 main

```bash
# 1. 在 GitHub 建立 PR
# base: main ← compare: hotfix/critical-login-crash

# 2. 標記為緊急 (Urgent/Critical)

# 3. 通知專案負責人立即審核
```

### 3. 審核並合併到 main

```bash
# 專案負責人審核後合併到 main
# 合併後自動部署到正式環境

# 更新版本號（Hotfix 通常更新 patch 版本）
# v0.9.5 → v0.9.5.1
```

### 4. 同步到 develop

**重要**：Hotfix 修復後，必須同步到 `develop` 分支

```bash
# 1. 切換到 develop 分支
git checkout develop
git pull origin develop

# 2. Merge hotfix 分支到 develop
git merge hotfix/critical-login-crash

# 3. 解決衝突（如果有）

# 4. 推送到遠端
git push origin develop

# 5. 刪除 hotfix 分支
git branch -d hotfix/critical-login-crash
git push origin --delete hotfix/critical-login-crash
```

---

## 誤合併到 main 的退版流程

如果不小心將 `feature` 或 `develop` 分支合併到 `main`，需要立即回滾。

### ⚠️ 情境判斷

**情境 A**：合併後**尚未推送到遠端**

**情境 B**：合併後**已推送到遠端，但正式環境尚未部署**

**情境 C**：合併後**已推送到遠端，且正式環境已部署**

---

### 情境 A：尚未推送到遠端（最簡單）

```bash
# 1. 確認當前狀態
git log --oneline -5

# 2. 找到錯誤的 merge commit（最新的一筆）

# 3. 重設到 merge 之前的 commit
git reset --hard HEAD~1

# 或者指定特定 commit
git reset --hard <commit-hash>

# 4. 確認狀態
git log --oneline -5
git status

# ✅ 完成！main 分支已恢復到錯誤合併之前的狀態
```

---

### 情境 B：已推送但尚未部署（需要謹慎）

```bash
# ⚠️ 警告：這會改寫遠端歷史，需要團隊協調

# 1. 確認當前狀態
git log --oneline -10

# 2. 找到錯誤的 merge commit hash
# 假設錯誤的 merge commit 是 abc1234

# 3. 本地重設到正確的 commit
git reset --hard <正確的commit-hash>

# 4. 強制推送到遠端（需要專案負責人權限）
git push --force-with-lease origin main

# 5. 通知所有團隊成員
# 告知他們 main 分支已回滾，需要重新同步

# 團隊成員執行：
git checkout main
git fetch origin
git reset --hard origin/main
```

**通知訊息範本**：
```
🚨 緊急通知：main 分支已回滾

原因：誤將 feature/xxx 合併到 main
回滾到：commit <hash> - <commit 訊息>

所有成員請執行：
git checkout main
git fetch origin
git reset --hard origin/main

如有問題請立即聯繫。
```

---

### 情境 C：已推送且已部署（最嚴重，需要緊急處理）

**步驟 1：立即暫停部署**

```bash
# 1. 通知 DevOps 團隊暫停自動部署
# 2. 評估正式環境影響範圍
```

**步驟 2：使用 Revert（推薦，更安全）**

```bash
# 1. 確認錯誤的 merge commit
git log --oneline --graph -10

# 找到 merge commit，例如：
# abc1234 Merge branch 'feature/xxx' into main

# 2. 使用 git revert 撤銷 merge（保留歷史）
git revert -m 1 abc1234

# -m 1 表示保留第一個 parent（main 分支）

# 3. 這會建立一個新的 commit 來撤銷變更
git log --oneline -3
# 顯示：
# def5678 Revert "Merge branch 'feature/xxx' into main"
# abc1234 Merge branch 'feature/xxx' into main
# 之前的 commits...

# 4. 推送到遠端
git push origin main

# 5. 正式環境會自動部署這個 revert commit
```

**步驟 3：資料庫回滾（如果需要）**

```bash
# 如果錯誤合併包含資料庫遷移

# 1. 連接到正式環境資料庫
PGPASSWORD=xxx psql -h production-host -U xxx -d xxx

# 2. 執行回滾腳本（如果有準備）
\i rollback_migration.sql

# 3. 或手動回滾（依據資料庫遷移記錄）
# 例如：刪除新增的表格、恢復修改的欄位等
```

**步驟 4：驗證與監控**

```bash
# 1. 檢查正式環境功能
# 2. 監控錯誤日誌
# 3. 確認用戶回報
# 4. 資料完整性檢查
```

**步驟 5：事後處理**

```bash
# 1. 撰寫事故報告
# - 發生時間
# - 影響範圍
# - 根本原因
# - 處理步驟
# - 預防措施

# 2. 加強分支保護規則
# - 檢視 GitHub 分支保護設定
# - 確保 main 分支無法被誤合併

# 3. 團隊教育訓練
# - 分享此次經驗
# - 重申 Git Flow 規範
```

---

### 退版決策流程圖

```
發現誤合併到 main
    ↓
是否已推送到遠端？
    ├─ NO → 情境 A：本地 reset
    └─ YES → 是否已部署到正式環境？
             ├─ NO → 情境 B：force push（需團隊協調）
             └─ YES → 情境 C：使用 revert（最安全）
                      ↓
                   是否有資料庫變更？
                      ├─ NO → 直接 revert commit
                      └─ YES → revert commit + 資料庫回滾
```

---

### 預防措施（重要！）

為了避免誤合併，務必：

1. **啟用 GitHub 分支保護**（見「GitHub 分支保護設定」章節）
   - 禁止直接推送到 `main`
   - 強制 PR 審核

2. **Git Hooks 設定**（本地防護）

建立 `.git/hooks/pre-push` 腳本：

```bash
#!/bin/bash
# 防止誤推送到 main

current_branch=$(git symbolic-ref HEAD | sed -e 's,.*/\(.*\),\1,')

if [ "$current_branch" = "main" ]; then
    read -p "⚠️  你正在推送到 main 分支！確定要繼續嗎？(yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "❌ 推送已取消"
        exit 1
    fi
fi

exit 0
```

```bash
# 賦予執行權限
chmod +x .git/hooks/pre-push
```

3. **使用 Git Alias 簡化安全操作**

```bash
# 在 ~/.gitconfig 加入
[alias]
    safe-push = "!f() { current_branch=$(git rev-parse --abbrev-ref HEAD); if [ \"$current_branch\" = \"main\" ]; then echo '❌ 無法推送到 main，請使用 PR'; exit 1; else git push \"$@\"; fi; }; f"

# 使用方式
git safe-push  # 會阻擋推送到 main
```

4. **定期備份重要分支**

```bash
# 建立定期備份腳本
git tag backup/main-$(date +%Y%m%d) main
git push origin backup/main-$(date +%Y%m%d)
```

---

## Merge 策略

### 1. Merge Commit (預設，推薦)

**使用時機**: 重要功能、需要保留完整開發歷史

```bash
git checkout main
git merge --no-ff feature/user-passkey-auth
```

**優點**:
- 保留完整的分支歷史
- 易於追蹤功能開發過程
- 可以一次 revert 整個功能

**Git 歷史**:
```
*   Merge branch 'feature/user-passkey-auth'
|\
| * 新增 Passkey 驗證邏輯
| * 新增 Passkey UI 組件
|/
* 更新系統版本號至 v0.9.5
```

### 2. Squash Merge

**使用時機**: 小功能、commit 歷史雜亂、想要整潔的主分支

```bash
git checkout main
git merge --squash feature/user-passkey-auth
git commit -m "新增 Passkey 生物辨識認證功能"
```

**優點**:
- 主分支歷史整潔
- 一個功能一個 commit
- 減少 git log 雜訊

**Git 歷史**:
```
* 新增 Passkey 生物辨識認證功能
* 更新系統版本號至 v0.9.5
```

### 3. Rebase (謹慎使用)

**使用時機**: 個人分支、尚未推送到遠端的分支

```bash
git checkout feature/user-passkey-auth
git rebase main
git checkout main
git merge feature/user-passkey-auth
```

**注意**:
- ⚠️ **絕對不要 rebase 已推送到遠端的分支**
- ⚠️ **絕對不要 rebase 多人協作的分支**

### Conflict 解決流程

當 merge 發生衝突時：

```bash
# 1. 嘗試 merge
git checkout main
git merge feature/user-passkey-auth

# 2. 如果有衝突，Git 會顯示衝突檔案
# Auto-merging src/store/authStore.js
# CONFLICT (content): Merge conflict in src/store/authStore.js

# 3. 開啟衝突檔案，手動解決衝突
# 衝突標記：
# <<<<<<< HEAD
# (main 分支的內容)
# =======
# (feature 分支的內容)
# >>>>>>> feature/user-passkey-auth

# 4. 編輯檔案，移除衝突標記，保留正確的內容

# 5. 標記衝突已解決
git add src/store/authStore.js

# 6. 完成 merge
git commit -m "Merge feature/user-passkey-auth into main

解決衝突：
- authStore.js: 合併 Passkey 認證邏輯與既有認證流程"
```

---

## 實用指令範例

### 分支管理

```bash
# 查看所有分支
git branch -a

# 查看遠端分支
git branch -r

# 建立並切換到新分支
git checkout -b feature/new-feature

# 切換分支
git checkout main

# 刪除本地分支
git branch -d feature/old-feature

# 強制刪除本地分支（未 merge 的分支）
git branch -D feature/abandoned-feature

# 刪除遠端分支
git push origin --delete feature/old-feature

# 重新命名分支
git branch -m old-name new-name
```

### 同步與更新

```bash
# 拉取遠端最新變更
git pull origin main

# 拉取遠端變更但不自動 merge
git fetch origin

# 查看遠端分支變更
git log main..origin/main

# 更新分支與遠端同步
git pull --rebase origin main
```

### 查看歷史

```bash
# 查看簡潔的 commit 歷史
git log --oneline -10

# 查看圖形化分支歷史
git log --graph --oneline --all

# 查看特定分支的歷史
git log feature/user-passkey-auth

# 查看特定檔案的變更歷史
git log -p src/store/authStore.js
```

### 暫存變更

```bash
# 暫存當前變更
git stash

# 暫存變更並加上描述
git stash save "WIP: Passkey UI 開發中"

# 查看暫存清單
git stash list

# 恢復最新的暫存
git stash pop

# 恢復特定暫存
git stash apply stash@{1}

# 刪除暫存
git stash drop stash@{0}
```

---

## 常見問題處理

### 1. 不小心在 main 分支上開發

```bash
# 1. 暫存當前變更
git stash

# 2. 建立新的 feature 分支
git checkout -b feature/correct-branch

# 3. 恢復變更
git stash pop

# 4. 提交到正確的分支
git add .
git commit -m "commit message"
```

### 2. 需要修改最後一次 commit 訊息

```bash
# 修改最後一次 commit 訊息
git commit --amend -m "正確的 commit 訊息"

# 如果已經推送，需要強制推送（謹慎使用）
git push --force-with-lease
```

### 3. 需要撤銷最後一次 commit

```bash
# 撤銷 commit 但保留變更
git reset --soft HEAD~1

# 撤銷 commit 並捨棄變更
git reset --hard HEAD~1
```

### 4. 分支落後 main 太多版本

```bash
# 方法 1: Merge main 到 feature 分支
git checkout feature/my-feature
git merge main

# 方法 2: Rebase（僅限個人分支）
git checkout feature/my-feature
git rebase main
```

### 5. 誤刪分支

```bash
# 查看最近的 commit 記錄（包含已刪除分支）
git reflog

# 找到分支最後的 commit hash（例如: abc123）
# 重新建立分支
git checkout -b feature/recovered-branch abc123
```

### 6. 推送被拒絕（遠端有新變更）

```bash
# 1. 拉取遠端變更
git pull origin feature/my-feature

# 2. 解決衝突（如果有）

# 3. 重新推送
git push origin feature/my-feature
```

---

## 環境與部署策略

### 分支與環境對應

| 分支 | 環境 | 自動部署 | 用途 |
|-----|------|---------|------|
| `main` | 正式環境 (Production) | ✅ 是 | 對外服務的穩定版本 |
| `develop` | 開發/測試環境 (Staging) | ✅ 是 | 整合測試、功能驗證 |
| `feature/*` | 本地開發 | ❌ 否 | 個人開發環境 |

### 部署流程

#### 1. develop 分支 → 測試環境

```bash
# 當 feature 分支合併到 develop 時，自動部署到測試站

# 開發者檢查清單：
1. 合併 PR 到 develop
2. CI/CD 自動執行測試
3. 測試通過後自動部署到測試環境
4. 在測試環境驗證功能
```

**測試環境 URL**（假設）：
- 前端：`https://staging.anes-management.com`
- 後端 API：`https://api-staging.anes-management.com`

#### 2. develop → main（正式發布）

```bash
# 方法 1: Cherry-pick（推薦，部分功能發布）
# 見「正式發布流程」章節

# 方法 2: Release 分支（完整發布）
# 見「正式發布流程」章節
```

**正式環境 URL**（假設）：
- 前端：`https://anes-management.com`
- 後端 API：`https://api.anes-management.com`

### CI/CD Pipeline 配置建議

**GitHub Actions 範例**（`.github/workflows/deploy.yml`）：

```yaml
name: Deploy

on:
  push:
    branches:
      - main
      - develop

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Determine Environment
        id: env
        run: |
          if [ "${{ github.ref }}" = "refs/heads/main" ]; then
            echo "environment=production" >> $GITHUB_OUTPUT
          else
            echo "environment=staging" >> $GITHUB_OUTPUT
          fi

      - name: Deploy to ${{ steps.env.outputs.environment }}
        run: |
          # 部署腳本...
          echo "Deploying to ${{ steps.env.outputs.environment }}"
```

### 回滾策略

#### 快速回滾（正式環境）

```bash
# 如果新版本有問題，立即回滾到前一個穩定版本

# 方法 1: 回滾到前一個標籤
git checkout v0.9.5
git tag -a v0.9.5-rollback -m "Rollback to v0.9.5"
git push origin v0.9.5-rollback

# 方法 2: Revert 最新的發布 commit
git revert <release-commit-hash>
git push origin main
```

---

## 最佳實務總結

### ✅ 應該做的事

1. **每個功能建立獨立分支（從 develop 切）**
2. **遵循分支命名規則**（`feature/功能描述`）
3. **定期與 develop 分支同步**
4. **寫清楚的 commit 訊息**（參考 CLAUDE.md）
5. **功能完成後立即提 PR 到 develop**
6. **merge 後刪除已完成的分支**
7. **在 develop 測試通過才發布到 main**
8. **啟用 GitHub 分支保護規則**
9. **發布前準備回滾計畫**

### ❌ 不應該做的事

1. **不要在 main 分支直接開發**
2. **不要將 feature 直接合併到 main**
3. **不要將 develop 合併到 main**（用 cherry-pick 或 release 分支）
4. **不要長期不更新的分支**
5. **不要累積太多 commit 才推送**
6. **不要 force push 到 main 或 develop**
7. **不要 rebase 已推送的分支**
8. **不要忽略 merge conflict**
9. **不要在 commit 訊息中提到 AI 助手**
10. **不要跳過 PR 審核流程**

### 🚨 緊急情況處理

| 情境 | 處理方式 | 參考章節 |
|-----|---------|---------|
| 正式環境緊急 bug | 建立 hotfix 分支 → 合併到 main + develop | [緊急修復流程](#緊急修復流程-hotfix) |
| 誤合併到 main | 根據情境使用 reset/revert | [退版流程](#誤合併到-main-的退版流程) |
| 新版本有問題 | 立即回滾到前一版本 | [回滾策略](#回滾策略) |
| develop 分支損壞 | 從 main 重新建立 develop | [分支恢復](#常見問題處理) |

---

## 相關文件

- `CLAUDE.md` - Git Commit 訊息規範
- `docs/USAGE.md` - 系統使用說明
- `docs/SECURITY.md` - 安全性指南
- `docs/PERMISSIONS.md` - 權限管理規範

---

**維護提醒**: 本文件應隨著專案開發流程演進而更新。如有新的 Git 工作流程或最佳實務，請及時反映到此文件中。
