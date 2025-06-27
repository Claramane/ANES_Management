-- 添加 last_activity_time 欄位到 users 表
-- 執行日期: 2024-12-XX

-- 檢查欄位是否已存在
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'last_activity_time'
    ) THEN
        -- 添加 last_activity_time 欄位
        ALTER TABLE users ADD COLUMN last_activity_time TIMESTAMP;
        
        -- 為現有用戶設置初始值（設為 last_login_time 或 created_at）
        UPDATE users 
        SET last_activity_time = COALESCE(last_login_time, created_at)
        WHERE last_activity_time IS NULL;
        
        RAISE NOTICE '成功添加 last_activity_time 欄位到 users 表';
    ELSE
        RAISE NOTICE 'last_activity_time 欄位已存在，跳過添加';
    END IF;
END
$$; 