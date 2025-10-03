-- ============================================================================
-- PostgreSQL 邏輯複製設定腳本
-- ============================================================================
-- 此腳本用於設定正式環境到測試/本地環境的單向資料同步
--
-- 架構：
--   正式環境 (Zeabur) --> 本地/測試環境
--   Publisher           --> Subscriber
--
-- 使用方式：
--   1. 在正式環境執行 "PART 1: 發布端設定"
--   2. 在本地/測試環境執行 "PART 2: 訂閱端設定"
--
-- 注意事項：
--   - 確保 wal_level 設定為 'logical'
--   - 確保有 REPLICATION 權限
--   - 訂閱端資料庫需要先執行 init_db.py 建立表格結構
-- ============================================================================

-- ============================================================================
-- PART 1: 發布端設定 (正式環境 - Zeabur)
-- ============================================================================

-- 1.1 檢查當前設定
SELECT name, setting FROM pg_settings WHERE name IN ('wal_level', 'max_replication_slots', 'max_wal_senders');

-- 1.2 刪除舊的 publication (如果存在)
DROP PUBLICATION IF EXISTS anes_prod_publication;

-- 1.3 建立 publication - 方案 A: 發布所有表格
-- 優點：簡單，自動包含新建立的表格
-- 缺點：無法排除敏感表格
CREATE PUBLICATION anes_prod_publication FOR ALL TABLES;

-- 1.4 建立 publication - 方案 B: 只發布特定表格 (推薦)
-- 優點：精確控制同步範圍，可排除敏感資料
-- 缺點：新表格需要手動加入

-- 注意：只能選擇方案 A 或 B 其中一個，請註解掉不使用的方案

/*
DROP PUBLICATION IF EXISTS anes_prod_publication;

CREATE PUBLICATION anes_prod_publication FOR TABLE
    users,
    schedules,
    shift_swap_requests,
    overtime_records,
    announcements,
    doctor_schedules,
    doctor_schedule_details,
    formula_schedules,
    notifications,
    shift_swap_notifications,
    application_logs,
    webauthn_credentials;
*/

-- 1.5 查看 publication 資訊
SELECT * FROM pg_publication WHERE pubname = 'anes_prod_publication';

-- 1.6 查看 publication 包含的表格
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'anes_prod_publication'
ORDER BY tablename;

-- ============================================================================
-- PART 2: 訂閱端設定 (本地/測試環境)
-- ============================================================================

-- ⚠️ 重要：在執行此部分之前，請確保：
--   1. 已在本地/測試環境執行 init_db.py 建立所有表格結構
--   2. 表格結構與正式環境完全一致
--   3. 已正確設定連線資訊（替換下方的連線字串）

-- 2.1 刪除舊的 subscription (如果存在)
DROP SUBSCRIPTION IF EXISTS anes_local_subscription;

-- 2.2 建立 subscription
-- ⚠️ 請替換以下連線字串為實際的正式環境資料庫連線資訊
CREATE SUBSCRIPTION anes_local_subscription
CONNECTION 'postgresql://root:SGPdg26Npyc35KtzHoW1x4U0YC7TkL98@hnd1.clusters.zeabur.com:32221/zeabur'
PUBLICATION anes_prod_publication
WITH (
    copy_data = true,          -- 初次訂閱時複製現有資料
    create_slot = true,        -- 自動建立複製槽位
    enabled = true,            -- 立即啟用訂閱
    slot_name = 'anes_local_slot'  -- 複製槽位名稱
);

-- 2.3 查看 subscription 狀態
SELECT * FROM pg_subscription WHERE subname = 'anes_local_subscription';

-- 2.4 查看複製槽位狀態
SELECT
    slot_name,
    plugin,
    slot_type,
    database,
    active,
    restart_lsn
FROM pg_replication_slots
WHERE slot_name = 'anes_local_slot';

-- 2.5 查看訂閱統計資訊
SELECT
    subname,
    pid,
    received_lsn,
    last_msg_send_time,
    last_msg_receipt_time,
    latest_end_lsn,
    latest_end_time
FROM pg_stat_subscription
WHERE subname = 'anes_local_subscription';

-- ============================================================================
-- PART 3: 監控與維護指令
-- ============================================================================

-- 3.1 暫停同步 (在訂閱端執行)
-- ALTER SUBSCRIPTION anes_local_subscription DISABLE;

-- 3.2 恢復同步 (在訂閱端執行)
-- ALTER SUBSCRIPTION anes_local_subscription ENABLE;

-- 3.3 重新整理 publication (當發布端新增表格時)
-- ALTER SUBSCRIPTION anes_local_subscription REFRESH PUBLICATION;

-- 3.4 查看複製延遲 (在訂閱端執行)
SELECT
    subname,
    EXTRACT(EPOCH FROM (now() - latest_end_time))::INT AS lag_seconds,
    latest_end_time
FROM pg_stat_subscription
WHERE subname = 'anes_local_subscription';

-- 3.5 查看發布端的複製槽位使用情況 (在發布端執行)
SELECT
    slot_name,
    database,
    active,
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS replication_lag
FROM pg_replication_slots
WHERE slot_name = 'anes_local_slot';

-- ============================================================================
-- PART 4: 清理指令 (謹慎使用)
-- ============================================================================

-- 4.1 完全移除訂閱 (在訂閱端執行)
-- DROP SUBSCRIPTION IF EXISTS anes_local_subscription;

-- 4.2 完全移除發布 (在發布端執行)
-- DROP PUBLICATION IF EXISTS anes_prod_publication;

-- 4.3 清理未使用的複製槽位 (在發布端執行)
-- SELECT pg_drop_replication_slot('anes_local_slot');

-- ============================================================================
-- PART 5: 測試驗證
-- ============================================================================

-- 5.1 在發布端插入測試資料
/*
INSERT INTO application_logs (level, message, created_at)
VALUES ('INFO', 'Test replication at ' || now(), now());
*/

-- 5.2 在訂閱端查詢，應該會看到同步的資料 (可能有 1-2 秒延遲)
/*
SELECT * FROM application_logs
WHERE message LIKE 'Test replication%'
ORDER BY created_at DESC
LIMIT 5;
*/

-- ============================================================================
-- 安全性建議
-- ============================================================================

-- 1. 防止訂閱端回寫到發布端：
--    - 訂閱端的連線應使用唯讀使用者
--    - 或在訂閱端設定唯讀模式 (僅用於測試)

-- 2. 敏感資料處理：
--    - 如果有敏感欄位 (如密碼)，考慮在訂閱端使用觸發器自動脫敏
--    - 或使用方案 B (特定表格) 排除敏感表格

-- 3. 網路安全：
--    - 確保連線使用 SSL (在 CONNECTION 字串加入 sslmode=require)
--    - 限制發布端的防火牆規則，只允許訂閱端 IP

-- ============================================================================
-- 故障排除
-- ============================================================================

-- 問題 1: 訂閱無法建立
-- 原因: 可能是權限不足或 wal_level 設定錯誤
-- 解決: 執行 check_replication_support.py 檢查設定

-- 問題 2: 同步延遲過大
-- 原因: 網路延遲或發布端負載過高
-- 解決: 檢查網路狀況，考慮調整 max_wal_senders

-- 問題 3: 複製槽位佔用過多空間
-- 原因: 訂閱端長時間離線
-- 解決: 刪除訂閱後重新建立，或清理複製槽位

-- ============================================================================
-- 連線字串格式說明
-- ============================================================================

-- 標準格式：
-- postgresql://username:password@host:port/database

-- 加入 SSL：
-- postgresql://username:password@host:port/database?sslmode=require

-- 多個參數：
-- postgresql://username:password@host:port/database?sslmode=require&connect_timeout=10

-- ============================================================================
