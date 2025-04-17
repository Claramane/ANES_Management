# PostgreSQL 資料庫維護指南

## 概述

本文檔提供有關麻醉排班系統 PostgreSQL 資料庫維護的指南。從 SQLite 遷移到 PostgreSQL 可以提供更好的可擴展性、並發處理和數據一致性，適合多用戶環境和更大規模的數據處理。

## 環境需求

- PostgreSQL 12 或更高版本
- Python 3.8 或更高版本
- psycopg2 (Python PostgreSQL 適配器)

## 遷移過程

從 SQLite 遷移到 PostgreSQL 的過程分為以下幾個步驟：

1. **設置 PostgreSQL 數據庫**:
   ```bash
   # 安裝 PostgreSQL 並創建數據庫、用戶
   sudo -u postgres psql -f setup_postgres.sql
   ```

2. **創建表結構**:
   ```bash
   # 運行表結構創建腳本
   python create_postgres_tables.py
   ```

3. **遷移數據**:
   ```bash
   # 運行數據遷移腳本
   python migrate_to_postgres.py
   ```

4. **導入班表模式**:
   ```bash
   # 轉換並導入班表模式
   python convert_patterns.py
   ```

5. **更新數據庫配置**:
   更新後端配置文件，將數據庫連接設置為 PostgreSQL

## 數據庫結構

以下是系統中的主要表和它們的用途：

- **users**: 存儲用戶信息，包括帳號、密碼、角色等
- **schedule_versions**: 存儲各月份班表的版本信息
- **monthly_schedules**: 存儲每個護理師的月度排班信息
- **formula_schedules**: 存儲公式班表定義
- **formula_schedule_patterns**: 存儲公式班表的具體模式
- **nurse_formula_assignments**: 存儲護理師與公式班表的分配關係
- **pattern_nurse_assignments**: 存儲護理師與特定模式的分配
- **shift_swap_requests**: 存儲換班請求
- **announcement_categories**: 公告類別
- **announcements**: 系統公告
- **announcement_permissions**: 公告權限設置
- **logs**: 系統操作日誌
- **shift_rules**: 班次規則設置

## 日常維護任務

### 備份數據庫

定期備份數據庫是防止數據丟失的重要措施：

```bash
# 創建完整備份
pg_dump -U anes_user -d anes_db -F c -f backup_$(date +%Y%m%d).dump

# 恢復備份
pg_restore -U anes_user -d anes_db -c backup_filename.dump
```

### 數據庫優化

定期運行以下命令優化數據庫性能：

```sql
-- 分析表以更新統計信息
ANALYZE;

-- 回收空間
VACUUM FULL;

-- 重建索引
REINDEX DATABASE anes_db;
```

### 監控數據庫

監控數據庫性能和使用情況：

```sql
-- 查看活動連接
SELECT * FROM pg_stat_activity;

-- 查看表大小
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

## 故障排除

### 連接問題

如果應用無法連接到數據庫：

1. 確認 PostgreSQL 服務運行狀態：
   ```bash
   sudo systemctl status postgresql
   ```

2. 檢查配置文件中的連接參數
3. 確認用戶權限
4. 檢查防火牆設置

### 性能問題

如果遇到性能問題：

1. 檢查慢查詢日誌
2. 分析並優化問題查詢
3. 增加索引
4. 調整配置參數

## 版本更新

當需要更新數據庫結構時：

1. 創建備份
2. 編寫遷移腳本
3. 在測試環境中測試遷移
4. 在生產環境中應用遷移
5. 驗證應用功能

## 聯繫與支持

如有問題，請聯繫系統管理員或開發團隊。 