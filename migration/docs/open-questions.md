# 待確認問題 (Open Questions)

> 更新於 2026-06-17：所有認證與換班關鍵問題已解決。

---

## 已解決

- [x] **登入 / email 對應**：DSM 以 `user_profiles.email` 為業務主鍵，admin 預先建帳號，首次 Google OAuth 後由 DB trigger 自動連結 `auth.users.id`。無自助註冊。→ ANES 照抄。
- [x] **權限模型**：採 DSM `permissions[]` capability-based，RLS 靠 `has_permission()`。
- [x] **版本控制架構**：採 DSM branch/PR 模型（ADR-006），`schedule_versions + schedule_version_diffs` 廢棄。
- [x] **換班連動**：採 DSM 三階段審核 + branch merge 模型（ADR-007）。
- [x] **前端架構**：單一 SPA + `/admin/*` / `/app/*` 路由切分（ADR-008）。
- [x] **WebAuthn / Passkey**：全廢棄，不搬移歷史資料。`webauthn_credentials` / `line_accounts` dump 後丟棄。
- [x] **Worker 範本**：主流程走 Supabase RPC + RLS，Worker 只負責排班生成與醫師班表 Cron。
- [x] **所有護理師有 Google 帳號**：確認。Phase 1 認證無備案需求。
- [x] **TOTP 雙步驟驗證**：護理長不強制，全員只走 Google OAuth。
- [x] **舊資料搬遷時機**：使用者本機先 dump，之後再規劃 script 搬移，不影響目前開發進度。
- [x] **area_code 換班連動**：換班成立時 area_code 隨班別一起對調（參考 DSM 白班不同班別的整日對調邏輯）。
- [x] **shift_rules 整合**：工時規則（max_consecutive / min_rest_hours 等）要進資料庫，整合進 `validate_swap` PL/pgSQL。

---

## 🟠 醫師班表（精簡範圍，仍待確認）

- [ ] 自動下班偵測確定整組移除（ADR-001）。**手動**操作（set-status / area-code / meeting-time / toggle-leave）還要由 ANES 本系統提供嗎，還是全移到另一個專案？
- [ ] 外部 API 同步後「保留手動狀態覆蓋」與特殊業務規則（週三疼痛門診、週二~五自動加入特定醫師）還需要嗎？

---

## 🟡 資料 / 其他（不影響目前開發）

- [ ] **現有資料量級**（users / monthly_schedules / overtime 筆數）→ 影響搬遷批次策略，待本機 dump 後確認。
- [ ] **`logs` 表**：是否續用，或改用 `schedule_changes` audit 完全取代操作日誌？
- [ ] **Realtime presence**：線上/下線改 Supabase Realtime presence 後，是否仍要把上線記錄寫回 DB 做歷史？
- [ ] **Google OAuth Client ID / Secret**：使用者待設定後提供，Phase 1 認證上線前必要。
