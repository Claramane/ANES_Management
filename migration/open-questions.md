# 待確認問題 (Open Questions)

開始實作前需要你拍板或補資訊的項目。

## 🔴 需參考 DoctorShiftManagement 專案

> 目前這個 session 的 GitHub 權限只含 `anes_management`，無法讀取 `Claramane/DoctorShiftManagement`。
> 加入方式見下方「如何讓我讀到該專案」。需要從該專案確認：

- [ ] **登入**：DoctorShiftManagement 怎麼做 Supabase Google Auth？email ↔ 員工對應怎麼處理？有無白名單 / 後門帳號？是否有可直接沿用的 auth middleware / 前端整合。
- [ ] **換班**：換班的資料模型與成立流程？接受換班時如何連動更新班表？
- [ ] **班表版本控制**：版本 / diff 的結構與比較邏輯？每次存檔開新版本還是覆蓋？base version 規則？換班是否產生新版本？
- [ ] 是否已有可重用的 Hono / Drizzle / wrangler 設定範本可直接抄。

## 🟠 認證（Phase 1 卡點）

- [ ] 所有員工都有可用的公司 Google 帳號嗎？沒有的人怎麼登入？
- [ ] 是否需要保留一組本地管理員後門（Google 服務中斷時不被鎖死）？
- [ ] `webauthn_credentials` / `line_accounts` 歷史資料要保留還是直接廢棄？

## 🟠 醫師班表（精簡範圍）

- [ ] 自動下班偵測確定整組移除（ADR-001）。那**手動**操作（set-status / area-code / meeting-time / toggle-leave）還要由本系統提供嗎，還是也移到另一個專案？
- [ ] 外部 API 同步後「保留手動狀態覆蓋」與特殊業務規則（週三疼痛門診、週二~五自動加入特定醫師）還需要嗎？
- [ ] Cron 更新頻率與範圍（未來幾個月）維持現況即可嗎？

## 🟡 資料 / 其他

- [ ] 現有資料量級（users / monthly_schedules / overtime 筆數）→ 影響搬遷與批次策略。
- [ ] `logs`（操作日誌）是否續用？還是改用 Supabase 內建 log / 不記錄。
- [ ] 線上狀態改 Realtime presence 後，是否仍要把上線記錄寫回 DB 做歷史？

---

## 如何讓我讀到 DoctorShiftManagement

本 session 鎖定在 `anes_management`，中途無法自助加 repo。三選一：

1. **環境設多 repo（推薦）**：claude.ai/code → 環境設定 → 把 `DoctorShiftManagement` 加進 repository 清單 → 用該環境重開 session。
2. **新開 session 跑在該 repo**：直接在它上面問登入/換班/版本控制，把結論貼回。
3. **貼檔案**：把相關檔案內容貼給我。

> 並確認 Claude GitHub App 的安裝範圍涵蓋該 private repo（GitHub → Settings → Applications → Claude → Configure）。
