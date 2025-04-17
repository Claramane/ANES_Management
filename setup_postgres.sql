-- 創建用戶
CREATE USER anes_user WITH PASSWORD 'anes_password';

-- 創建數據庫
CREATE DATABASE anes_db;

-- 設置用戶權限
ALTER DATABASE anes_db OWNER TO anes_user;

-- 授予所有權限
GRANT ALL PRIVILEGES ON DATABASE anes_db TO anes_user; 