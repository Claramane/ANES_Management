# Area Code 轉換邏輯詳細分析與 Debug 指南

## 📋 目錄
1. [轉換流程概覽](#轉換流程概覽)
2. [三個關鍵時間點](#三個關鍵時間點)
3. [映射表定義](#映射表定義)
4. [轉換邏輯詳解](#轉換邏輯詳解)
5. [常見問題與 Bug 分析](#常見問題與-bug-分析)
6. [Debug 檢查清單](#debug-檢查清單)
7. [測試案例](#測試案例)

---

## 轉換流程概覽

```
外部 API 資料 (summary)
    ↓
【時間點 1】extract_name_and_area_from_summary()
    ↓ 解析 summary → area_code
save_schedule_data()
    ↓ 儲存到資料庫
PostgreSQL (area_code 欄位)
    ↓
【時間點 2】查詢時保護邏輯 (save_schedule_data)
    ↓ 保護手動設置
【時間點 3】顯示時重新解析 (get_schedules_by_date_range)
    ↓ 動態決定顯示值
前端顯示
```

---

## 三個關鍵時間點

### ⏰ 時間點 1: 初次解析 (儲存時)
**位置:** `save_schedule_data()` → `extract_name_and_area_from_summary()`
**觸發:** 從外部 API 獲取新資料時

```python
# 第 445 行
name, area_code_from_api = cls.extract_name_and_area_from_summary(summary)
```

### ⏰ 時間點 2: 保護邏輯 (更新時)
**位置:** `save_schedule_data()` 
**觸發:** 更新已存在的班表資料時

```python
# 第 448-459 行
if name in existing_doctors:
    # 使用手動設置的資料,保護不被覆蓋
    area_code = preserved_data['area_code']
else:
    # 使用 API 解析的資料
    area_code = area_code_from_api
```

### ⏰ 時間點 3: 顯示邏輯 (查詢時)
**位置:** `get_schedules_by_date_range()`
**觸發:** 前端查詢班表資料時

```python
# 第 556-575 行
# 動態決定要顯示的 area_code
display_area_code = doctor.area_code  # 預設使用資料庫的值

# 但在某些情況下會重新解析...
```

---

## 映射表定義

### 📊 POSITION_TO_AREA_MAPPING (精確匹配)
```python
POSITION_TO_AREA_MAPPING = {
    'A': '控台醫師',
    'B': '手術室',
    'C': '外圍(3F)',
    'D': '外圍(高階)',
    'E': '手術室',
    'F': '外圍(TAE)',
}
```

### 📊 FUZZY_AREA_MAPPING (模糊匹配)
```python
FUZZY_AREA_MAPPING = {
    'A': '控台醫師',
    'B': '手術室', 
    'C': '外圍(3F)',
    'D': '手術室',      # ⚠️ 注意: D 在模糊匹配中是「手術室」
    'E': '手術室',
    'F': '外圍(TAE)',
}
```

**⚠️ 重要差異:**
- 精確匹配: `'D'` → `'外圍(高階)'`
- 模糊匹配: `'D'` → `'手術室'`

---

## 轉換邏輯詳解

### 🔍 extract_name_and_area_from_summary() 詳細流程

**完整程式碼位置:** 第 285-316 行

#### 步驟 1: 檢查是否包含 `/`
```python
if '/' in summary:
    # 有 / → 繼續解析
else:
    # 沒有 / → 返回 (summary.strip(), '未分類')
    return summary.strip(), '未分類'
```

**範例:**
- ✅ `"陳柏羽/A"` → 繼續解析
- ❌ `"陳柏羽"` → 返回 `("陳柏羽", "未分類")`

---

#### 步驟 2: 分割姓名和區域部分
```python
name = summary.split('/')[0].strip()      # "陳柏羽"
area_part = summary.split('/')[1].strip() # "A" 或 "A(控台)" 或 "D(外圍)"
```

**範例:**
- `"陳柏羽/A"` → name=`"陳柏羽"`, area_part=`"A"`
- `"陳柏羽/A(控台)"` → name=`"陳柏羽"`, area_part=`"A(控台)"`
- `"陳柏羽/D(外圍)"` → name=`"陳柏羽"`, area_part=`"D(外圍)"`

---

#### 步驟 3: 精確匹配 (移除括號內容)
```python
# 第 294 行
area_letter = area_part.split('(')[0].strip()

# 第 297-299 行
if area_letter in cls.POSITION_TO_AREA_MAPPING:
    area_code = cls.POSITION_TO_AREA_MAPPING[area_letter]
    return name, area_code
```

**處理邏輯:**
1. 移除括號及其內容: `"A(控台)"` → `"A"`
2. 在 `POSITION_TO_AREA_MAPPING` 中查找
3. 找到就返回

**範例:**
| summary | area_part | area_letter | 精確匹配結果 |
|---------|-----------|-------------|-------------|
| `"陳柏羽/A"` | `"A"` | `"A"` | ✅ `"控台醫師"` |
| `"陳柏羽/A(控台)"` | `"A(控台)"` | `"A"` | ✅ `"控台醫師"` |
| `"陳柏羽/D"` | `"D"` | `"D"` | ✅ `"外圍(高階)"` |
| `"陳柏羽/D(外圍)"` | `"D(外圍)"` | `"D"` | ✅ `"外圍(高階)"` |
| `"陳柏羽/D1"` | `"D1"` | `"D1"` | ❌ 不在映射表中 |

---

#### 步驟 4: 模糊匹配 (提取第一個字母)
```python
# 第 303 行
first_letter = area_part[0].upper() if area_part else ''

# 第 305-308 行
if first_letter in cls.FUZZY_AREA_MAPPING:
    area_code = cls.FUZZY_AREA_MAPPING[first_letter]
    logger.debug(f"模糊匹配: {summary} -> {first_letter} -> {area_code}")
    return name, area_code
```

**處理邏輯:**
1. 提取第一個字母並轉大寫
2. 在 `FUZZY_AREA_MAPPING` 中查找
3. 找到就返回,並記錄 debug 日誌

**範例:**
| summary | area_part | first_letter | 模糊匹配結果 |
|---------|-----------|--------------|-------------|
| `"陳柏羽/D1"` | `"D1"` | `"D"` | ✅ `"手術室"` ⚠️ |
| `"陳柏羽/D(外圍)"` | `"D(外圍)"` | `"D"` | (不會執行,已被精確匹配) |
| `"陳柏羽/a"` | `"a"` | `"A"` | ✅ `"控台醫師"` |
| `"陳柏羽/X"` | `"X"` | `"X"` | ❌ 不在映射表中 |

---

#### 步驟 5: 都匹配不到,返回原始字串
```python
# 第 311 行
return name, area_part
```

**範例:**
- `"陳柏羽/X"` → 返回 `("陳柏羽", "X")`
- `"陳柏羽/未知區域"` → 返回 `("陳柏羽", "未知區域")`

---

## 常見問題與 Bug 分析

### 🐛 問題 1: D 開頭的區域代碼轉換不一致

**症狀:**
- `"陳柏羽/D"` → `"外圍(高階)"` (精確匹配)
- `"陳柏羽/D1"` → `"手術室"` (模糊匹配) ⚠️

**原因:**
```python
# 精確匹配
POSITION_TO_AREA_MAPPING = {
    'D': '外圍(高階)',  # D 對應外圍(高階)
}

# 模糊匹配
FUZZY_AREA_MAPPING = {
    'D': '手術室',      # D 對應手術室 ⚠️ 不一致!
}
```

**影響範圍:**
- `D` → 精確匹配 → `"外圍(高階)"`
- `D1`, `D2`, `D(任何)` (精確匹配失敗後) → 模糊匹配 → `"手術室"`

**解決方案:**
```python
# 選項 1: 統一為「外圍(高階)」
FUZZY_AREA_MAPPING = {
    'D': '外圍(高階)',  # 與精確匹配一致
}

# 選項 2: 統一為「手術室」
POSITION_TO_AREA_MAPPING = {
    'D': '手術室',      # 與模糊匹配一致
}

# 選項 3: 根據實際需求,D1/D2 等變體可能真的應該是手術室
# 那就保持現狀,但要在文件中明確說明
```

---

### 🐛 問題 2: 查詢時的重複解析邏輯

**位置:** `get_schedules_by_date_range()` 第 556-575 行

**問題程式碼:**
```python
# 第 562-565 行
if doctor.summary and not doctor.area_code:
    # 如果沒有 area_code,從 summary 解析
    _, resolved_area_code = cls.extract_name_and_area_from_summary(doctor.summary)
    display_area_code = resolved_area_code
```

**問題:** 
- `area_code` 欄位在資料庫中定義為 `nullable=False`
- 理論上不應該出現 `not doctor.area_code` 的情況
- 這段程式碼可能是防禦性編程,但實際上可能永遠不會執行

**更嚴重的問題:**
```python
# 第 566-575 行
elif doctor.summary and doctor.area_code:
    # 檢查是否是原始的(未手動修改的)
    original_area_part = doctor.summary.split('/')[1].strip() if '/' in doctor.summary else ''
    if doctor.area_code == original_area_part:
        # 重新解析
        _, resolved_area_code = cls.extract_name_and_area_from_summary(doctor.summary)
        display_area_code = resolved_area_code
```

**Bug 場景:**
1. 外部 API 返回: `"陳柏羽/D1"`
2. 初次儲存時解析: `area_code = "手術室"` (模糊匹配)
3. 儲存到資料庫: `summary="陳柏羽/D1"`, `area_code="手術室"`
4. 查詢時檢查: `original_area_part = "D1"`, `doctor.area_code = "手術室"`
5. 判斷: `"手術室" != "D1"` → 認為已手動修改 → 保持 `"手術室"`
6. **結果:** 正常運作 ✅

**但如果:**
1. 外部 API 返回: `"陳柏羽/手術室"` (直接給中文)
2. 初次儲存時解析: `area_code = "手術室"` (無法匹配,返回原始值)
3. 儲存到資料庫: `summary="陳柏羽/手術室"`, `area_code="手術室"`
4. 查詢時檢查: `original_area_part = "手術室"`, `doctor.area_code = "手術室"`
5. 判斷: `"手術室" == "手術室"` → 認為未手動修改 → **重新解析**
6. 重新解析: `extract_name_and_area_from_summary("陳柏羽/手術室")`
   - `area_letter = "手術室"` → 不在 `POSITION_TO_AREA_MAPPING`
   - `first_letter = "手"` → 不在 `FUZZY_AREA_MAPPING`
   - 返回原始值: `"手術室"`
7. **結果:** 還是 `"手術室"`,但多做了一次無意義的解析

---

### 🐛 問題 3: 手動修改後的保護機制失效

**場景:**
1. 護理長手動將醫師的 `area_code` 從 `"手術室"` 改為 `"控台醫師"`
2. 資料庫: `summary="陳柏羽/B"`, `area_code="控台醫師"` (手動修改)
3. 下次更新班表時 (save_schedule_data):
   ```python
   # 第 448-454 行
   if name in existing_doctors:
       preserved_data = existing_doctors[name]
       area_code = preserved_data['area_code']  # ✅ 保護成功
   ```
4. **結果:** 手動修改被保護 ✅

**但是,如果護理長修改的是「新出現的醫師」:**
1. 今天手動新增醫師: `summary="新醫師/A"`, `area_code="手術室"` (手動設置)
2. 明天外部 API 也返回這位醫師: `"新醫師/A"`
3. 更新時:
   ```python
   if name in existing_doctors:  # ✅ 找到了
       area_code = preserved_data['area_code']  # "手術室"
   ```
4. **結果:** 手動修改被保護 ✅

**看起來沒問題,但有個邊界情況:**
- 如果外部 API 的 summary 改變了 (如 `"新醫師/A"` → `"新醫師/B"`)
- 但醫師姓名相同
- 這時會保護舊的 area_code,但 summary 會更新
- 可能導致 `summary` 和 `area_code` 不一致

---

### 🐛 問題 4: 大小寫敏感性

**程式碼:**
```python
# 第 303 行
first_letter = area_part[0].upper() if area_part else ''
```

**處理:**
- 模糊匹配時會轉大寫 ✅
- 但精確匹配時**不會**轉大寫

**測試:**
| summary | 精確匹配 | 模糊匹配 | 最終結果 |
|---------|---------|---------|---------|
| `"陳柏羽/a"` | ❌ (找不到 `"a"`) | ✅ `"A"` → `"控台醫師"` | `"控台醫師"` ✅ |
| `"陳柏羽/A"` | ✅ `"A"` → `"控台醫師"` | (不執行) | `"控台醫師"` ✅ |

**結論:** 大小寫處理正確 ✅

---

## Debug 檢查清單

### ✅ 檢查項目 1: 確認外部 API 返回的 summary 格式
```bash
# 查看最近的更新日誌
SELECT * FROM doctor_schedule_update_logs 
ORDER BY update_time DESC 
LIMIT 10;

# 查看實際儲存的 summary
SELECT date, name, summary, area_code 
FROM day_shift_doctors 
JOIN doctor_schedules ON day_shift_doctors.schedule_id = doctor_schedules.id
WHERE date >= '20260115'
ORDER BY date, name;
```

### ✅ 檢查項目 2: 檢查是否有 D 開頭的區域代碼
```sql
SELECT DISTINCT summary, area_code 
FROM day_shift_doctors
WHERE summary LIKE '%/D%'
ORDER BY summary;
```

**預期結果:**
- `"XXX/D"` → `area_code = "外圍(高階)"` (精確匹配)
- `"XXX/D1"` → `area_code = "手術室"` (模糊匹配)
- 如果不符合預期,說明映射表有問題

### ✅ 檢查項目 3: 檢查手動修改是否被保護
```sql
-- 查看最近更新的醫師
SELECT name, summary, area_code, updated_at
FROM day_shift_doctors
JOIN doctor_schedules ON day_shift_doctors.schedule_id = doctor_schedules.id
WHERE date = '20260116'
ORDER BY updated_at DESC;
```

### ✅ 檢查項目 4: 查看 debug 日誌
```bash
# 查看模糊匹配的日誌
grep "模糊匹配" /path/to/logfile

# 查看保護手動設置的日誌
grep "保護醫師" /path/to/logfile
```

### ✅ 檢查項目 5: 測試 extract_name_and_area_from_summary
```python
# 在 Python shell 中測試
from backend.app.services.doctor_schedule_service import DoctorScheduleService

test_cases = [
    "陳柏羽/A",
    "陳柏羽/A(控台)",
    "陳柏羽/D",
    "陳柏羽/D1",
    "陳柏羽/D(外圍)",
    "陳柏羽/手術室",
    "陳柏羽",
]

for summary in test_cases:
    name, area_code = DoctorScheduleService.extract_name_and_area_from_summary(summary)
    print(f"{summary:20} -> name={name:10}, area_code={area_code}")
```

---

## 測試案例

### 測試案例 1: 標準格式
```python
summary = "陳柏羽/A"
# 預期: name="陳柏羽", area_code="控台醫師"
```

### 測試案例 2: 帶括號
```python
summary = "陳柏羽/A(控台)"
# 預期: name="陳柏羽", area_code="控台醫師"
```

### 測試案例 3: D 精確匹配
```python
summary = "陳柏羽/D"
# 預期: name="陳柏羽", area_code="外圍(高階)"
```

### 測試案例 4: D 模糊匹配 ⚠️
```python
summary = "陳柏羽/D1"
# 預期: name="陳柏羽", area_code="手術室"
# 注意: 與 D 的精確匹配結果不同!
```

### 測試案例 5: 小寫
```python
summary = "陳柏羽/a"
# 預期: name="陳柏羽", area_code="控台醫師"
```

### 測試案例 6: 無法匹配
```python
summary = "陳柏羽/X"
# 預期: name="陳柏羽", area_code="X"
```

### 測試案例 7: 無斜線
```python
summary = "陳柏羽"
# 預期: name="陳柏羽", area_code="未分類"
```

### 測試案例 8: 中文區域
```python
summary = "陳柏羽/手術室"
# 預期: name="陳柏羽", area_code="手術室"
# 注意: 會返回原始值,因為無法匹配
```

---

## 建議修復方案

### 🔧 修復 1: 統一 D 的映射

**選擇 A: 統一為「外圍(高階)」**
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

**選擇 B: 統一為「手術室」**
```python
POSITION_TO_AREA_MAPPING = {
    'A': '控台醫師',
    'B': '手術室',
    'C': '外圍(3F)',
    'D': '手術室',      # 修改: 與模糊匹配一致
    'E': '手術室',
    'F': '外圍(TAE)',
}
```

**建議:** 根據實際業務需求決定,如果 D1, D2 等變體確實應該是手術室,那就保持現狀並在文件中說明。

---

### 🔧 修復 2: 簡化查詢時的重新解析邏輯

**問題:** 第 556-575 行的邏輯過於複雜

**建議修改:**
```python
# 簡化版本
display_area_code = doctor.area_code

# 只在真正需要時才重新解析
# 例如: area_code 為空或為 None (理論上不應該發生)
if not display_area_code and doctor.summary:
    _, display_area_code = cls.extract_name_and_area_from_summary(doctor.summary)
    if not display_area_code:
        display_area_code = '未分類'
```

**理由:**
1. `area_code` 欄位是 `nullable=False`,不應該為空
2. 手動修改的保護已在 `save_schedule_data` 中處理
3. 不需要在查詢時再次判斷是否手動修改
4. 減少不必要的重複解析

---

### 🔧 修復 3: 增加日誌以便 Debug

**在 save_schedule_data 中增加日誌:**
```python
# 第 445 行後
name, area_code_from_api = cls.extract_name_and_area_from_summary(summary)
logger.debug(f"解析 summary: {summary} -> name={name}, area_code={area_code_from_api}")

# 第 454 行後
if name in existing_doctors:
    logger.debug(f"保護醫師 {name} 的手動設置: area_code={area_code}, status={status}")
else:
    logger.debug(f"新醫師 {name}: area_code={area_code_from_api}")
```

---

## 總結

### 主要風險點:
1. ⚠️ **D 開頭的區域代碼映射不一致** (精確 vs 模糊)
2. ⚠️ **查詢時的重複解析邏輯過於複雜**
3. ⚠️ **缺少足夠的 debug 日誌**

### 建議行動:
1. ✅ 執行上述測試案例,確認實際行為
2. ✅ 檢查資料庫中的實際資料
3. ✅ 決定 D 的映射應該統一為哪個值
4. ✅ 簡化查詢時的重新解析邏輯
5. ✅ 增加更多 debug 日誌

### Debug 優先級:
1. **高:** 檢查 D 開頭的 summary 是否轉換錯誤
2. **中:** 檢查手動修改是否被正確保護
3. **低:** 優化查詢時的重新解析邏輯
