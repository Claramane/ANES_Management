# Area Code 轉換測試與 Debug 指令

## 快速測試指令

### 方法 1: 使用 Python 直接測試

在專案根目錄執行:

```bash
cd /Users/jasmac/Projects/ANES_Management

# 進入 Python shell
python3 -c "
import sys
sys.path.insert(0, 'backend')
from app.services.doctor_schedule_service import DoctorScheduleService

# 測試案例
test_cases = [
    '陳柏羽/A',
    '陳柏羽/D',
    '陳柏羽/D1',
    '陳柏羽/D(外圍)',
    '陳柏羽/手術室',
]

print('=' * 80)
print('Area Code 轉換測試')
print('=' * 80)
print()

for summary in test_cases:
    name, area_code = DoctorScheduleService.extract_name_and_area_from_summary(summary)
    print(f'{summary:25} -> name={name:15}, area_code={area_code}')
"
```

### 方法 2: 查詢資料庫中的實際資料

```bash
# 連接到資料庫
psql -h your_host -U your_user -d your_database

# 查看所有 D 開頭的 summary
SELECT DISTINCT summary, area_code 
FROM day_shift_doctors
WHERE summary LIKE '%/D%'
ORDER BY summary;

# 查看最近的班表資料
SELECT ds.date, dsd.name, dsd.summary, dsd.area_code, dsd.status
FROM day_shift_doctors dsd
JOIN doctor_schedules ds ON dsd.schedule_id = ds.id
WHERE ds.date >= '20260115'
ORDER BY ds.date, dsd.name;

# 查看是否有 area_code 與 summary 不一致的情況
SELECT ds.date, dsd.name, dsd.summary, dsd.area_code
FROM day_shift_doctors dsd
JOIN doctor_schedules ds ON dsd.schedule_id = ds.id
WHERE ds.date >= '20260101'
  AND dsd.summary LIKE '%/D%'
ORDER BY ds.date, dsd.name;
```

### 方法 3: 檢查日誌

```bash
# 查看模糊匹配的日誌
grep "模糊匹配" backend/app.log | tail -20

# 查看保護手動設置的日誌
grep "保護醫師" backend/app.log | tail -20

# 查看解析 summary 的日誌 (如果有的話)
grep "解析 summary" backend/app.log | tail -20
```

---

## 詳細測試案例

### 測試 1: 標準格式
```python
summary = "陳柏羽/A"
# 預期: name="陳柏羽", area_code="控台醫師"
```

### 測試 2: D 精確匹配
```python
summary = "陳柏羽/D"
# 預期: name="陳柏羽", area_code="外圍(高階)"
```

### 測試 3: D 模糊匹配 ⚠️
```python
summary = "陳柏羽/D1"
# 預期: name="陳柏羽", area_code="手術室"
# 注意: 與 D 的精確匹配結果不同!
```

### 測試 4: D 帶括號
```python
summary = "陳柏羽/D(外圍)"
# 預期: name="陳柏羽", area_code="外圍(高階)"
# 因為會先移除括號,變成 "D",然後精確匹配
```

---

## 常見問題排查

### 問題 1: D 開頭的區域代碼轉換不一致

**檢查步驟:**

1. 查看映射表定義:
```bash
grep -A 10 "POSITION_TO_AREA_MAPPING" backend/app/services/doctor_schedule_service.py
grep -A 10 "FUZZY_AREA_MAPPING" backend/app/services/doctor_schedule_service.py
```

2. 查看資料庫中的實際資料:
```sql
SELECT summary, area_code, COUNT(*) as count
FROM day_shift_doctors
WHERE summary LIKE '%/D%'
GROUP BY summary, area_code
ORDER BY summary;
```

3. 預期結果:
   - `XXX/D` → `外圍(高階)` (精確匹配)
   - `XXX/D1`, `XXX/D2` → `手術室` (模糊匹配)

**如果發現不一致:**
- 檢查是否有手動修改過 area_code
- 檢查外部 API 返回的 summary 格式是否改變

---

### 問題 2: 手動修改被覆蓋

**檢查步驟:**

1. 查看更新日誌:
```sql
SELECT * FROM doctor_schedule_update_logs
ORDER BY update_time DESC
LIMIT 10;
```

2. 查看特定醫師的歷史:
```sql
SELECT ds.date, dsd.name, dsd.area_code, dsd.updated_at
FROM day_shift_doctors dsd
JOIN doctor_schedules ds ON dsd.schedule_id = ds.id
WHERE dsd.name = '陳柏羽'
  AND ds.date >= '20260101'
ORDER BY ds.date;
```

3. 檢查是否是今天的資料:
   - 今天的資料應該被跳過更新 (第 399-403 行)
   - 如果今天的資料被更新了,說明保護機制失效

---

### 問題 3: 查詢時顯示錯誤的 area_code

**檢查步驟:**

1. 查看資料庫中儲存的值:
```sql
SELECT name, summary, area_code
FROM day_shift_doctors
WHERE schedule_id = (
    SELECT id FROM doctor_schedules WHERE date = '20260115'
);
```

2. 檢查查詢邏輯 (第 556-575 行):
   - 是否有重新解析 summary?
   - 重新解析的條件是什麼?

3. 測試重新解析邏輯:
```python
# 模擬查詢時的邏輯
doctor_summary = "陳柏羽/D1"
doctor_area_code = "手術室"

original_area_part = doctor_summary.split('/')[1].strip()  # "D1"
if doctor_area_code == original_area_part:  # "手術室" == "D1" ? False
    # 不會重新解析
    pass
else:
    # 保持原值
    display_area_code = doctor_area_code  # "手術室"
```

---

## 修復建議

### 建議 1: 統一 D 的映射

如果 D1, D2 等變體應該與 D 一致,修改 `FUZZY_AREA_MAPPING`:

```python
FUZZY_AREA_MAPPING = {
    'A': '控台醫師',
    'B': '手術室', 
    'C': '外圍(3F)',
    'D': '外圍(高階)',  # 修改: 與精確匹配一致
    'E': '手術室',
    'F': '外圍(TAE)',
}
```

### 建議 2: 增加 Debug 日誌

在 `extract_name_and_area_from_summary` 中增加日誌:

```python
logger.debug(f"解析 summary: {summary}")
logger.debug(f"  - area_part: {area_part}")
logger.debug(f"  - area_letter: {area_letter}")
logger.debug(f"  - 精確匹配: {cls.POSITION_TO_AREA_MAPPING.get(area_letter, '無')}")
logger.debug(f"  - 模糊匹配: {cls.FUZZY_AREA_MAPPING.get(first_letter, '無')}")
logger.debug(f"  - 最終結果: name={name}, area_code={area_code}")
```

### 建議 3: 簡化查詢時的邏輯

移除不必要的重新解析:

```python
# 簡化版本
display_area_code = doctor.area_code

# 只在真正需要時才重新解析
if not display_area_code and doctor.summary:
    _, display_area_code = cls.extract_name_and_area_from_summary(doctor.summary)
```

---

## 執行測試

### 完整測試流程

```bash
# 1. 測試轉換邏輯
python3 -c "
import sys
sys.path.insert(0, 'backend')
from app.services.doctor_schedule_service import DoctorScheduleService

test_cases = [
    ('陳柏羽/A', '控台醫師'),
    ('陳柏羽/D', '外圍(高階)'),
    ('陳柏羽/D1', '手術室'),
    ('陳柏羽/D(外圍)', '外圍(高階)'),
]

print('測試結果:')
for summary, expected in test_cases:
    name, area_code = DoctorScheduleService.extract_name_and_area_from_summary(summary)
    status = '✅' if area_code == expected else '❌'
    print(f'{status} {summary:25} -> {area_code:20} (預期: {expected})')
"

# 2. 查看資料庫實際資料
# (需要先設定資料庫連線)

# 3. 查看日誌
tail -100 backend/app.log | grep -E "(模糊匹配|保護醫師|解析 summary)"
```
