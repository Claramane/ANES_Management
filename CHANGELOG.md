# 版本更新日誌

## v0.9.2 (2024-12-19)

### 新功能
- **PM工作分配複選功能**：重寫工作分配模式規則，新增PM工作分配複選系統
  - 新增PM按鈕，支援 PMTAE → PMC → PMF2 → 取消 的循環選擇
  - PM工作分配可與主要工作分配並存，不會互相衝突
  - 週一到週五限定顯示PM按鈕，符合實際業務需求
  - 智能衝突檢測：同一天不能有兩個護理師選擇相同的PM工作分配

### 改進
- **工作分配顯示優化**：
  - 非編輯模式：直接顯示原始area_code值
  - 編輯模式：自動解析並分離主要工作分配和PM工作分配
  - 支援「主要工作/PM工作」格式的儲存和讀取
- **智能選項過濾**：PM按鈕會自動跳過已被其他護理師選擇的選項
- **適用對象限制**：恢復室護理師不顯示PM按鈕，僅麻醉專科護理師、麻醉科Leader和護理長可使用

### 技術改進
- 重構工作分配相關函數邏輯，提升代碼維護性
- 新增pmValues狀態管理，獨立處理PM工作分配
- 優化按鈕高亮顯示邏輯
- 改進衝突檢測機制，支援主要工作分配和PM工作分配的雙重檢測

## v0.8.3 (2024-07-08)

### 修復
- 修正 `orm_mode = True` 改為 `from_attributes = True`，解決 Pydantic V2 相容問題
- 修正 models/formula.py 中唯一約束設定，將 `{"unique_constraint": (...)}` 改為 `UniqueConstraint(...)`
- 移除 models/overtime.py 中不必要的 Config 類別

### 改進
- 改進生成月班表功能，保留夜班人員(SNP/LNP)的現有班表，避免帶入排班公式時覆蓋夜班人員的班表資料
- 將系統中的 print 語句替換為標準的日誌記錄 (logging)，包括:
  - add_overtime_shift_column.py
  - backend/migrations/initial_data.py
  - backend/app/routes/schedules.py

### 開發與維護
- 更新程式碼風格與標準
- 代碼註釋優化
- 提高系統穩定性 