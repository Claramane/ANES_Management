# 版本更新日誌

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