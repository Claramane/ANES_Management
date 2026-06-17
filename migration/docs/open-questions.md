# 待確認問題 (Open Questions)

> 更新於 2026-06-17：本 session 已讀取 `DoctorShiftManagement`，主要卡點已解決。

---

## 已解決

- [x] **登入 / email 對應**：DSM 以 `user_profiles.email` 為業務主鍵，admin 預先建帳號，首次 Google OAuth 後由 DB trigger 自動連結 `auth.users.id`。無自助註冊。→ ANES 照抄。（見 `09-dsm-reference.md` §認證）
- [x] **權限模型**：DSM 已從 role-only 演進為 `permissions[]` capability-based，RLS 靠 `app_private.has_permission()`。ANES 應跟進，不繼續綁死 role/identity。
- [x] **版本控制架構**：已決定採 DSM branch/PR 模型（ADR-006），`schedule_versions + schedule_version_diffs` 廢棄。
- [x] **換班連動**：已決定採 DSM 三階段審核 + branch merge 模型（ADR-007）。
- [x] **前端架構**：單一 SPA + `/admin/*` / `/app/*` 路由切分（ADR-008），不分兩個 repo。
- [x] **WebAuthn 後門**：DSM 驗證 TOTP 能用（break-glass），Passkey 因 WebView 限制暫停。ANES 不需要本地密碼後門，走 Google + TOTP 即可。
- [x] **Hono/Drizzle/Worker 範本**：DSM 有多個 Cloudflare Worker（passkey / notification / shift / doc_dutyAPI），可直接當結構範本。但主流程不走 Worker gateway，改走 Supabase RPC + RLS（見 `09-dsm-reference.md`）。

---

## 🟠 仍需你拍板（認證 Phase 1 卡點）

- [ ] **所有護理師都有公司 Google 帳號嗎？** 如果沒有，Phase 1 會卡。沒 Google 帳號的人要怎麼登入？
- [ ] **TOTP 要設嗎？** DSM 對 admin/supervisor 強制 TOTP；ANES 要對護理長（head_nurse）做同樣的事嗎？
- [ ] **`webauthn_credentials` / `line_accounts` 歷史資料**：直接廢棄（不搬），還是保留唯讀備份？

---

## 🟠 醫師班表（精簡範圍，需確認）

- [ ] 自動下班偵測確定整組移除（ADR-001）。**手動**操作（set-status / area-code / meeting-time / toggle-leave）還要由 ANES 本系統提供嗎，還是全移到另一個專案？
- [ ] 外部 API 同步後「保留手動狀態覆蓋」與特殊業務規則（週三疼痛門診、週二~五自動加入特定醫師）還需要嗎？

---

## 🟡 資料 / 其他

- [ ] **現有資料量級**（users / monthly_schedules / overtime 筆數）→ 影響搬遷與批次策略。
- [ ] **`logs` 表**：是否續用，或改用 `schedule_changes` audit 取代操作日誌？
- [ ] **Realtime presence**：線上/下線改 Supabase Realtime presence 後，是否仍要把上線記錄寫回 DB 做歷史？DSM 沒有這個功能，需要自行設計。
- [ ] **`shift_rules` 整合**：換班驗證（`app_private.validate_swap`）要整合現有的 `shift_rules` 表（工時規則）嗎？DSM 沒有對應的工時規則表，這塊要自己設計。
- [ ] **area_code 換班連動**：換班成立時，area_code（OR/DR/3F）要一起對調嗎？
