-- 建立醫師班表相關表格

-- 1. 建立 doctor_schedules 表格
CREATE TABLE IF NOT EXISTS doctor_schedules (
    id SERIAL PRIMARY KEY,
    date VARCHAR(8) NOT NULL UNIQUE,
    duty_doctor VARCHAR(50),
    schedule_notes JSON,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS ix_doctor_schedules_id ON doctor_schedules(id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_doctor_schedules_date ON doctor_schedules(date);

-- 2. 建立 day_shift_doctors 表格
CREATE TABLE IF NOT EXISTS day_shift_doctors (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL,
    name VARCHAR(50) NOT NULL,
    summary VARCHAR(200) NOT NULL,
    time VARCHAR(50) NOT NULL,
    area_code VARCHAR(20) NOT NULL,
    active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (schedule_id) REFERENCES doctor_schedules(id)
);

-- 建立索引
CREATE INDEX IF NOT EXISTS ix_day_shift_doctors_id ON day_shift_doctors(id);

-- 3. 建立 doctor_schedule_update_logs 表格
CREATE TABLE IF NOT EXISTS doctor_schedule_update_logs (
    id SERIAL PRIMARY KEY,
    update_time TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    start_date VARCHAR(8) NOT NULL,
    end_date VARCHAR(8) NOT NULL,
    success BOOLEAN NOT NULL,
    total_days INTEGER,
    error_message TEXT,
    processing_time VARCHAR(50)
);

-- 建立索引
CREATE INDEX IF NOT EXISTS ix_doctor_schedule_update_logs_id ON doctor_schedule_update_logs(id);

-- 檢查表格是否建立成功
SELECT 'doctor_schedules' as table_name, COUNT(*) as exists 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'doctor_schedules'
UNION ALL
SELECT 'day_shift_doctors' as table_name, COUNT(*) as exists 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'day_shift_doctors'
UNION ALL
SELECT 'doctor_schedule_update_logs' as table_name, COUNT(*) as exists 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'doctor_schedule_update_logs'; 