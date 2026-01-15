# 外部 API 實際資料分析報告

**測試時間:** 2026-01-15 11:58  
**API 端點:** https://docdutyapi.claramane.com  
**測試日期範圍:** 2026-01-15 ~ 2026-02-14 (31 天)

---

## ✅ API 連接成功

**正確的 API 端點:**
```
https://docdutyapi.claramane.com/schedule/{start_date}/{end_date}
```

**舊的錯誤端點:**
```
https://docdutyapi.zeabur.app/schedule/{start_date}/{end_date}  ❌ (404)
```

**需要更新配置:**
- 檔案: `backend/app/core/config.py`
- 第 128 行: `EXTERNAL_API_BASE: str = "https://docdutyapi.zeabur.app"`
- 應改為: `EXTERNAL_API_BASE: str = "https://docdutyapi.claramane.com"`

---

## 📊 資料分析結果

### 總覽
- ✅ 成功獲得 **31 天**的班表資料
- 📝 發現 **40 種**不同的 summary 格式
- 🔍 發現 **21 個** D 開頭的 summary
- ⚠️ 發現 **5 個**特殊格式 (帶 "oncall")

---

## 🔍 關鍵發現: D oncall 格式

### 問題 Summary 格式

外部 API 實際返回的特殊格式:

```
史若蘭/D oncall
陳柏羽/D oncall
陳燁晨/D oncall
陳品臣/D oncall
```

### 轉換行為分析

| Summary | 區域部分 | 移除括號後 | 精確匹配 | 模糊匹配 | 最終結果 |
|---------|---------|-----------|---------|---------|---------|
| `吳佩諭/D` | `D` | `D` | ✅ `外圍(高階)` | - | `外圍(高階)` |
| `史若蘭/D oncall` | `D oncall` | `D oncall` | ❌ | ✅ `手術室` | `手術室` ⚠️ |

### 詳細轉換過程

#### 案例 1: `吳佩諭/D` (正常)
```
1. 分割: name="吳佩諭", area_part="D"
2. 移除括號: area_letter="D"
3. 精確匹配: "D" in POSITION_TO_AREA_MAPPING → ✅
4. 結果: "外圍(高階)"
```

#### 案例 2: `史若蘭/D oncall` (問題)
```
1. 分割: name="史若蘭", area_part="D oncall"
2. 移除括號: area_letter="D oncall"  (沒有括號,保持原樣)
3. 精確匹配: "D oncall" in POSITION_TO_AREA_MAPPING → ❌ 失敗
4. 模糊匹配: first_letter="D" → FUZZY_AREA_MAPPING["D"] → "手術室"
5. 結果: "手術室" ⚠️
```

---

## 🚨 問題根源

### 映射表不一致

```python
# 精確匹配
POSITION_TO_AREA_MAPPING = {
    'D': '外圍(高階)',  # D → 外圍(高階)
}

# 模糊匹配
FUZZY_AREA_MAPPING = {
    'D': '手術室',      # D → 手術室 ⚠️ 不一致!
}
```

### 影響範圍

**受影響的 Summary:**
1. `史若蘭/D oncall` (2026-01-16)
2. `陳柏羽/D oncall` (2026-01-23)
3. `陳燁晨/D oncall` (2026-01-30)
4. `陳品臣/D oncall` (2026-02-06)
5. `史若蘭/D oncall` (2026-02-13)

**轉換結果:**
- `XXX/D` → `外圍(高階)` ✅ (精確匹配)
- `XXX/D oncall` → `手術室` ⚠️ (模糊匹配)

**問題:**
同一位醫師在不同日期可能有不同的 area_code!

---

## 📈 統計數據

### Area Code 分布
```
手術室      : 16 種 summary (包含 4 個 "D oncall")
控台醫師     : 9 種 summary
外圍(3F)    : 8 種 summary
外圍(高階)   : 7 種 summary (不包含 "D oncall")
```

### 匹配方式分布
```
精確匹配: 36 種 (90.0%)
模糊匹配: 4 種 (10.0%)  ← 全部是 "D oncall"
```

---

## 💡 修復建議

### 選項 1: 統一 D 的映射為「外圍(高階)」(推薦)

**修改檔案:** `backend/app/services/doctor_schedule_service.py`

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

**效果:**
- `XXX/D` → `外圍(高階)` ✅
- `XXX/D oncall` → `外圍(高階)` ✅
- 保持一致性

**優點:**
- 同一位醫師的 D 區域代碼始終一致
- 符合精確匹配的定義

**缺點:**
- 如果 "oncall" 實際上應該對應「手術室」,這個修改就不對

---

### 選項 2: 改進解析邏輯,處理 "oncall" 後綴

**修改檔案:** `backend/app/services/doctor_schedule_service.py`

```python
@classmethod
def extract_name_and_area_from_summary(cls, summary: str) -> tuple:
    """從summary中提取醫師姓名和區域代碼"""
    try:
        if '/' in summary:
            name = summary.split('/')[0].strip()
            area_part = summary.split('/')[1].strip()
            
            # 先移除括號內容
            area_letter = area_part.split('(')[0].strip()
            
            # 新增: 移除 "oncall" 等後綴
            area_letter = area_letter.split()[0].strip() if ' ' in area_letter else area_letter
            
            # 檢查是否為精確匹配
            if area_letter in cls.POSITION_TO_AREA_MAPPING:
                area_code = cls.POSITION_TO_AREA_MAPPING[area_letter]
                return name, area_code
            
            # ... 其餘邏輯不變
```

**效果:**
- `XXX/D` → `外圍(高階)` ✅
- `XXX/D oncall` → `外圍(高階)` ✅ (移除 "oncall" 後精確匹配)

**優點:**
- 更智能的解析邏輯
- 可以處理其他類似的後綴

**缺點:**
- 如果 "oncall" 有特殊意義,可能會丟失資訊

---

### 選項 3: 保留 "oncall" 資訊到其他欄位

**最完整的解決方案:**

1. 改進解析邏輯,移除 "oncall" 後綴進行匹配
2. 將 "oncall" 資訊保存到 `schedule_notes` 或新增 `is_oncall` 欄位
3. 在前端顯示時標記 oncall 醫師

```python
@classmethod
def extract_name_and_area_from_summary(cls, summary: str) -> tuple:
    """從summary中提取醫師姓名、區域代碼和額外資訊"""
    try:
        if '/' in summary:
            name = summary.split('/')[0].strip()
            area_part = summary.split('/')[1].strip()
            
            # 檢查是否有 oncall 標記
            is_oncall = 'oncall' in area_part.lower()
            
            # 移除括號和 oncall 等後綴
            area_letter = area_part.split('(')[0].strip()
            area_letter = area_letter.split()[0].strip() if ' ' in area_letter else area_letter
            
            # ... 其餘邏輯
            
            # 返回額外資訊
            return name, area_code, is_oncall
```

---

## 🔧 立即需要的修復

### 1. 更新 API 端點 (必須)

**檔案:** `backend/app/core/config.py`

```python
# 第 128 行
EXTERNAL_API_BASE: str = "https://docdutyapi.claramane.com"  # 修改
```

### 2. 修復 D 的映射不一致 (建議)

**檔案:** `backend/app/services/doctor_schedule_service.py`

**選擇修復方案 1 或 2**

---

## 📋 完整的 Summary 格式列表

### A 開頭 (9 種)
```
史若蘭/A, 吳佩諭/A, 林怡芸/A, 游雅盛 /A, 游雅盛/A,
陳品臣/A, 陳柏羽/A, 陳燁晨/A, 顏任軒/A
```
→ 全部轉換為: `控台醫師` ✅

### B 開頭 (10 種)
```
史若蘭/B, 吳佩諭/B, 林怡芸/B, 游雅盛 /B, 游雅盛/B,
陳品臣/B, 陳柏羽/B, 陳燁晨/B, 顏任軒 /B, 顏任軒/B
```
→ 全部轉換為: `手術室` ✅

### C 開頭 (8 種)
```
史若蘭/C, 吳佩諭/C, 林怡芸/C, 游雅盛/C,
陳品臣/C, 陳柏羽/C, 陳燁晨/C, 顏任軒/C
```
→ 全部轉換為: `外圍(3F)` ✅

### D 開頭 (11 種)
```
史若蘭/D → 外圍(高階) ✅
史若蘭/D oncall → 手術室 ⚠️
吳佩諭/D → 外圍(高階) ✅
林怡芸/D → 外圍(高階) ✅
游雅盛/D → 外圍(高階) ✅
陳品臣/D → 外圍(高階) ✅
陳品臣/D oncall → 手術室 ⚠️
陳柏羽/D → 外圍(高階) ✅
陳柏羽/D oncall → 手術室 ⚠️
陳燁晨/D → 外圍(高階) ✅
陳燁晨/D oncall → 手術室 ⚠️
```

### E 開頭 (2 種)
```
吳佩諭/E, 陳建榮/E
```
→ 全部轉換為: `手術室` ✅

---

## ✅ 測試結論

1. **API 端點錯誤** - 需要更新為 `https://docdutyapi.claramane.com`
2. **發現特殊格式** - `XXX/D oncall` 會觸發模糊匹配
3. **映射不一致** - D 的精確匹配和模糊匹配結果不同
4. **影響範圍** - 約 10% 的 summary 使用模糊匹配

---

## 📝 下一步行動

### 優先級 1 (必須)
- [ ] 更新 `backend/app/core/config.py` 中的 API 端點

### 優先級 2 (建議)
- [ ] 決定修復方案 (選項 1, 2 或 3)
- [ ] 修改 `backend/app/services/doctor_schedule_service.py`
- [ ] 測試修復後的轉換邏輯

### 優先級 3 (可選)
- [ ] 增加更多 debug 日誌
- [ ] 在前端顯示 oncall 標記
- [ ] 更新文件說明

---

**報告生成時間:** 2026-01-15 11:58  
**測試狀態:** ✅ 完成  
**發現問題:** 2 個 (API 端點錯誤 + D 映射不一致)  
**建議優先級:** 高
