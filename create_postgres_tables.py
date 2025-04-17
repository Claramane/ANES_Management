#!/usr/bin/env python
"""
直接在PostgreSQL中創建表結構
"""

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# PostgreSQL連接信息
DB_NAME = "anes_db"
DB_USER = "anes_user"
DB_PASSWORD = "anes_password"
DB_HOST = "localhost"

# 创建所有表的SQL命令
CREATE_TABLES_SQL = """
-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    email VARCHAR(100),
    password VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    identity VARCHAR(50),
    employee_number VARCHAR(20),
    hire_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 班表版本表
CREATE TABLE IF NOT EXISTS schedule_versions (
    id SERIAL PRIMARY KEY,
    month VARCHAR(7) NOT NULL,
    version INT NOT NULL,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (month, version)
);

-- 月班表
CREATE TABLE IF NOT EXISTS monthly_schedules (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    date DATE NOT NULL,
    shift_type VARCHAR(5),
    area_code VARCHAR(10),
    version_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (version_id) REFERENCES schedule_versions(id),
    UNIQUE (user_id, date, version_id)
);

-- 公式班表
CREATE TABLE IF NOT EXISTS formula_schedules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    identity VARCHAR(50) NOT NULL,
    num_groups INT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 公式班表模式
CREATE TABLE IF NOT EXISTS formula_schedule_patterns (
    id SERIAL PRIMARY KEY,
    formula_id INT NOT NULL,
    group_number INT NOT NULL,
    day_offset INT NOT NULL,
    shift_type VARCHAR(5) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (formula_id) REFERENCES formula_schedules(id),
    UNIQUE (formula_id, group_number, day_offset)
);

-- 護理師公式班表分配
CREATE TABLE IF NOT EXISTS nurse_formula_assignments (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    formula_id INT NOT NULL,
    group_number INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (formula_id) REFERENCES formula_schedules(id),
    UNIQUE (user_id, formula_id)
);

-- 模式護理師分配
CREATE TABLE IF NOT EXISTS pattern_nurse_assignments (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    pattern_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (pattern_id) REFERENCES formula_schedule_patterns(id),
    UNIQUE (user_id, pattern_id)
);

-- 換班請求
CREATE TABLE IF NOT EXISTS shift_swap_requests (
    id SERIAL PRIMARY KEY,
    requestor_id INT NOT NULL,
    acceptor_id INT,
    requestor_schedule_id INT NOT NULL,
    acceptor_schedule_id INT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requestor_id) REFERENCES users(id),
    FOREIGN KEY (acceptor_id) REFERENCES users(id),
    FOREIGN KEY (requestor_schedule_id) REFERENCES monthly_schedules(id),
    FOREIGN KEY (acceptor_schedule_id) REFERENCES monthly_schedules(id)
);

-- 公告類別
CREATE TABLE IF NOT EXISTS announcement_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 公告
CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    category_id INT,
    author_id INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_important BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES announcement_categories(id),
    FOREIGN KEY (author_id) REFERENCES users(id)
);

-- 公告權限
CREATE TABLE IF NOT EXISTS announcement_permissions (
    id SERIAL PRIMARY KEY,
    announcement_id INT NOT NULL,
    role VARCHAR(20),
    user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 日誌
CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 遷移記錄
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 班次規則
CREATE TABLE IF NOT EXISTS shift_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    shift_type VARCHAR(5) NOT NULL,
    max_consecutive INT,
    min_rest_hours INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

def main():
    print("正在創建PostgreSQL表結構...")
    
    # 連接到PostgreSQL
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    
    # 創建游標
    cursor = conn.cursor()
    
    # 執行創建表的SQL
    try:
        cursor.execute(CREATE_TABLES_SQL)
        print("表結構創建成功！")
    except Exception as e:
        print(f"創建表結構時出錯: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    main() 