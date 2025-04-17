# 排班表版本管理：差異存儲+基準版本法

## 概述

本系統採用「差異存儲+基準版本法」進行排班表的版本管理，這種方法具有以下優點：

1. **節省儲存空間**：只需儲存完整的基準版本和其他版本與基準版本的差異，大幅減少數據儲存需求
2. **快速版本切換**：可以從基準版本快速計算出任何其他版本的完整排班表
3. **追蹤變更**：清晰記錄排班表各版本間的具體差異，便於審核和追蹤
4. **版本還原**：可以輕鬆將排班表還原至任何歷史版本

## 如何使用

### 1. 建立基準版本

基準版本是完整儲存的排班表版本，其他版本只會儲存與基準版本的差異。

#### 方法一：將現有版本設為基準版本

```
POST /api/schedules/versions/create-base?version_id={version_id}
```

#### 方法二：創建新的基準版本

```
POST /api/schedules/versions/create-base?month_str={YYYYMM}
```

### 2. 從基準版本創建新版本

當需要對排班表進行修改時，可以從基準版本創建新版本，然後在新版本上進行修改。

```
POST /api/schedules/versions/create-from-base
Body: {
  "base_version_id": 基準版本ID,
  "new_version_number": "新版本編號",
  "notes": "版本說明（可選）"
}
```

### 3. 計算並儲存版本差異

修改完排班表後，可以計算並儲存與基準版本的差異。

```
POST /api/schedules/versions/calculate-diff
Body: {
  "version_id": 要計算差異的版本ID,
  "base_version_id": 基準版本ID
}
```

### 4. 查看版本差異

#### 查看所有差異記錄

```
GET /api/schedules/versions/diffs
```

#### 查看特定月份的差異記錄

```
GET /api/schedules/versions/diffs?month={YYYYMM}
```

#### 查看特定差異記錄

```
GET /api/schedules/versions/diffs/{diff_id}
```

### 5. 從差異記錄恢復版本

當需要恢復或重新生成某個版本時，可以從基準版本和差異記錄恢復。

```
POST /api/schedules/versions/restore-from-diff
Body: {
  "base_version_id": 基準版本ID,
  "diff_id": 差異記錄ID,
  "new_version_number": "新版本編號",
  "notes": "版本說明（可選）"
}
```

## 使用建議

1. **定期更換基準版本**：隨著排班表的不斷修改，差異可能會越來越大，建議定期將當前最新版本設為基準版本
2. **為每個月份保留一個基準版本**：每個月份應至少有一個基準版本，便於日後對該月排班進行修改
3. **使用有意義的版本編號**：建議使用格式如 `v1.0_202401` 的版本編號，便於識別和管理
4. **在版本說明中記錄變更內容**：詳細記錄排班表各版本的變更內容，便於日後查閱

## 內部工作原理

1. 基準版本完整儲存所有排班記錄
2. 差異記錄包含「新增」、「修改」和「刪除」三類變更
3. 系統可根據基準版本和差異記錄，計算出任何版本的完整排班表
4. 當發布排班表時，系統總是使用完整的排班記錄，確保最終用戶看到的是完整的排班表

## 系統要求

使用此版本管理功能前，請確保已執行資料庫遷移腳本 `backend/migrations/add_version_diff_table.py` 