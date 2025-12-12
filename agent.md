# Agent Quickstart (遵循 CLAUDE.md)

此檔給所有協助開發的代理/助理參考，摘要自 `CLAUDE.md` 與專案規範。任何衝突時以 `CLAUDE.md`、`docs/GIT_WORKFLOW.md` 為準。

## 必遵守
- **Python 套件**：後端強制使用 `uv`，禁止 `pip install`（除安裝 uv 本身）；更新依賴後以 `uv pip freeze > requirements.txt`。
- **前端套件**：使用 `pnpm` 管理所有 Node 依賴（請勿改用 npm/yarn）。
- **版本號一致性**：修改版本號時必須同步 5 處：`CLAUDE.md`、`README.md`、`frontend/src/pages/Settings.jsx`、`frontend/src/pages/Login.jsx`、`docs/USAGE.md`。
- **Git 提交**：依 `docs/GIT_WORKFLOW.md`；完成一個功能/修復就提交；訊息勿提及 AI 名稱；保持簡短標題+條列描述。
- **安全操作**：避免破壞性指令；不 revert 使用者現有更動；新增/修改資料庫或權限邏輯時同步更新對應 docs（`DATABASE_ARCHITECTURE.md`、`PERMISSIONS.md`、`SECURITY.md`、`ROUND_ALLOCATION_LOGIC.md`、`USAGE.md`）。
- **工具習慣**：搜尋用 `rg`；編輯優先 `apply_patch`；遵守現有編碼風格與 ASCII 優先。

## 開發重點
- **後端**：FastAPI + SQLAlchemy；認證含 JWT + WebAuthn/Passkey；設定位於 `backend/app/core/config.py`；`SessionMiddleware` 在 `backend/main.py`。
- **前端**：React 18 + MUI + Zustand；入口設定請參考 `frontend/src/pages/Settings.jsx`、`Login.jsx`。
- **部署/套件管理**：生產環境亦使用 `uv`/`pnpm`；依 `backend/zeabur.json`、`frontend/zeabur.json`。

## 工作流程建議
1) 讀 `CLAUDE.md`（版本規範、uv 強制、Git 流程）。  
2) 變更前確認是否需同步更新 docs 或版本號。  
3) 使用 `rg` 找相關檔案，修改時保持小步提交。  
4) 提交訊息遵循專案格式，避免提及助理名稱。  
5) 完工後簡述變更、測試方式與下一步建議。  
