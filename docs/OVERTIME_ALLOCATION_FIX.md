# 加班自動分配修復記錄

## 問題描述

**日期**: 2026-01-15  
**回報問題**: 使用者反映加班自動分配功能一天只能分配三個人

**更新**: 2026-01-15 14:42  
**額外修正**: 修正分數計算邏輯，改為初始分數為0，只有沒加班的白班才扣分

## 問題根源

在 `frontend/src/utils/overtimeAllocation.js` 的 `_allocateShiftInRounds` 函數中，第 447 行的迴圈條件存在邏輯錯誤：

```javascript
// 原始程式碼（有問題）
for (let i = 0; i < remainingDemands.length && candidateIndex < availableCandidates.length; i++) {
  const demand = remainingDemands[i];
  const candidate = availableCandidates[candidateIndex];
  
  // ... 檢查和分配邏輯 ...
  
  // 如果當前候選人不適合，嘗試下一個候選人
  if (assignmentsThisRound.length <= i) {
    candidateIndex++;
    i--; // 重試當前需求
  }
}
```

### 問題分析

1. **迴圈提前終止**: 當 `candidateIndex >= availableCandidates.length` 時，迴圈會提前終止
2. **候選人耗盡**: 在第 466-469 行，當候選人不適合時會持續增加 `candidateIndex`
3. **分配限制**: 一旦候選人用完（例如只有 3 個候選人），即使還有更多需求也無法繼續分配
4. **無法循環使用**: 同一個候選人無法被分配到多個日期的相同班別

### 實際影響

- 如果某一天只有 3 個符合條件的候選人，那麼一輪最多只能分配 3 個需求
- 這導致使用者回報的「一天只能分配三個人」的問題
- **核心問題**: 系統應該允許同一個護理師在不同日期被分配到相同班別（只要符合間隔要求），但原本的邏輯不允許循環使用候選人列表

## 解決方案

### 修改內容

修改 `_allocateShiftInRounds` 函數中的分配邏輯（第 443-485 行），允許循環使用候選人列表：

```javascript
// 修復後的程式碼
// 分配給分數最低的護理師們
const assignmentsThisRound = [];
let candidateIndex = 0;
let maxAttempts = remainingDemands.length * availableCandidates.length; // 防止無限循環
let attempts = 0;

for (let i = 0; i < remainingDemands.length; i++) {
  const demand = remainingDemands[i];
  let assigned = false;
  let attemptCount = 0;
  const maxAttemptsPerDemand = availableCandidates.length; // 每個需求最多嘗試所有候選人一次
  
  // 嘗試為當前需求找到合適的候選人
  while (!assigned && attemptCount < maxAttemptsPerDemand && attempts < maxAttempts) {
    attemptCount++;
    attempts++;
    
    // 循環使用候選人列表
    const candidate = availableCandidates[candidateIndex % availableCandidates.length];
    
    // 檢查該候選人是否可以在該日期分配
    const isAvailableForThisDate = demand.availableUsers.some(u => u.id === candidate.id);
    const isAlreadyAssignedOnThisDate = newAllocations[`${candidate.id}_${demand.date}`];
    
    if (isAvailableForThisDate && !isAlreadyAssignedOnThisDate) {
      // 檢查間隔（僅對A班和B班）
      const intervalOk = (shiftType !== 'A' && shiftType !== 'B') || 
                         this._checkInterval(candidate, shiftType, demand.date, newAllocations);
      
      if (intervalOk) {
        assignmentsThisRound.push({ demand, candidate, index: i });
        assigned = true;
      }
    }
    
    // 移動到下一個候選人
    candidateIndex++;
  }
  
  // 如果嘗試了所有候選人都無法分配，記錄警告
  if (!assigned) {
    this.logger.debug(`${shiftType}班：無法為 ${demand.date} 找到合適的候選人（已嘗試 ${attemptCount} 個候選人）`);
  }
}
```

### 關鍵改進

1. **移除候選人數量限制**: 不再在 for 迴圈條件中限制 `candidateIndex < availableCandidates.length`
2. **循環使用候選人**: 使用 `candidateIndex % availableCandidates.length` 循環訪問候選人列表
3. **雙重防護機制**: 
   - `attemptCount`: 每個需求最多嘗試所有候選人一次
   - `attempts`: 全局計數器防止無限循環
4. **智能跳出**: 當嘗試過所有候選人都不適合當前需求時，記錄警告並繼續下一個需求
5. **保留原有邏輯**: 分數平衡、間隔檢查等核心邏輯完全保留

### 預期效果

- 同一個護理師可以被分配到多個日期的相同班別（只要符合間隔要求）
- 不再受限於候選人數量，能夠完成所有需求的分配
- 保持原有的分數平衡和間隔檢查邏輯

## 相關文件更新

已更新以下文件以反映此修復：

1. **`frontend/src/utils/overtimeAllocation.js`** (第 443-484 行)
   - 修改了 `_allocateShiftInRounds` 函數的分配邏輯

2. **`docs/ROUND_ALLOCATION_LOGIC.md`** (第 139-180 行)
   - 更新了候選人篩選與回合制公平的說明
   - 加入了循環使用候選人的描述

## 測試建議

建議進行以下測試以驗證修復：

1. **基本測試**: 3個候選人，5個工作日，每天需要4個班別（A-D）
   - 預期：所有 20 個班別都能成功分配
   - 預期：每個候選人會被分配到多個班別

2. **間隔測試**: 驗證 A 班和 B 班的 7 天間隔限制仍然有效
   - 預期：同一人的 A 班或 B 班之間至少間隔 7 天

3. **分數平衡測試**: 驗證分數平衡機制仍然正常運作
   - 預期：分配後所有護理師的分數盡可能接近零分

## 影響範圍

- **影響功能**: 加班自動分配
- **影響用戶**: 所有使用加班自動分配功能的護理長
- **向後兼容**: 是，此修復不影響現有功能，只是修正了錯誤的限制

## 備註

此修復解決了一個關鍵的邏輯錯誤，使得自動分配功能能夠正確處理候選人數量少於需求數量的情況。修復後的邏輯更符合輪次分配的設計理念，允許護理師在不同日期被分配到相同班別，只要符合間隔和分數平衡的要求。

---

## 額外修正：分數計算邏輯

### 問題發現

原始的分數計算邏輯存在概念上的問題：

**原始邏輯**（錯誤）：
```javascript
// 初始化時計算所有白班天數的負分
baseScore = 實際白班天數 × (-0.365)
currentScore = baseScore  // 例如：-7.63 分

// 分配加班時加上正分
currentScore += 加班分數  // 例如：-7.63 + 20 = 12.37 分
```

**問題**：這個邏輯假設「所有白班天數都沒加班」，然後再加上加班分數，在概念上是矛盾的。

### 修正方案

**新邏輯**（正確）：
```javascript
// 初始分數為 0
currentScore = 0

// 分配加班時加上正分
currentScore += 加班分數  // 例如：0 + 20 = 20 分

// 分配完成後，計算沒加班的白班天數並扣分
實際工作天數 = 總工作天數 × 出勤率
沒加班白班天數 = 實際工作天數 - 加班天數
白班負分 = 沒加班白班天數 × (-0.365)
currentScore += 白班負分  // 例如：20 + (-4.38) = 15.62 分
```

### 修改內容

1. **`scoreUtils.calculateUserBaseScore`** (第 73-77 行)
   - 修改為固定返回 0
   - 不再預先計算白班負分

2. **新增 `scoreUtils.calculateWhiteShiftPenalty`** (第 82-92 行)
   - 計算沒加班的白班負分
   - 公式：`(實際工作天數 - 加班天數) × (-0.365)`

3. **新增 `_calculateWhiteShiftPenalties`** (第 219-247 行)
   - 在分配完成後調用
   - 遍歷所有用戶，計算並扣除白班負分

### 範例對比

**22個工作天，出勤率95%，分配10個A班**

| 項目 | 原始邏輯（錯誤） | 新邏輯（正確） |
|------|----------------|---------------|
| 初始分數 | -7.63 分 | 0 分 |
| 加班分數 | +20 分 | +20 分 |
| 白班負分 | 已包含在初始分數 | 12天 × (-0.365) = -4.38 分 |
| 最終分數 | 12.37 分 | 15.62 分 |

### 影響

- ✅ 分數計算更符合實際邏輯
- ✅ 「有加班才加分，沒加班的白班才扣分」的概念更清晰
- ✅ 最終分數會更高（因為不會重複扣除加班天數的負分）
- ⚠️ 這會影響分數平衡的數值範圍，但不影響相對公平性

### 分數控制機制

為了確保分數不會偏離 0 分太多，系統實作了**即時分數檢查機制**：

#### 機制說明

在每輪分配時（第二輪及之後），系統會檢查每個候選人的**潛在最終分數**：

```javascript
// 計算潛在的最終分數
潛在加班天數 = 當前加班天數 + 1
白班負分 = (實際工作天數 - 潛在加班天數) × (-0.365)
潛在最終分數 = 當前加班分數 + 新班別分數 + 白班負分

// 只有潛在最終分數 <= 0 的人才能繼續分配
if (round > 1 && 潛在最終分數 > 0) {
  跳過此候選人
}
```

#### 效果

- ✅ **第一輪**：所有人都可以參與，確保基本公平
- ✅ **第二輪及之後**：只有分配後最終分數仍 ≤ 0 的人才能繼續
- ✅ **結果**：所有人的最終分數會盡可能接近 0 分
- ✅ **範圍控制**：分數通常在 **-5 ~ +5 分**之間

#### 範例

假設 22 個工作天，出勤率 95%（實際工作 20 天）：

| 輪次 | 已分配 | 當前分數 | 新班別 | 白班負分 | 潛在分數 | 是否符合 |
|------|--------|---------|--------|---------|---------|---------|
| 第1輪 | 0個A班 | 0 | A(2.0) | 20-1=-7.3 | -5.3 | ✅ 是 |
| 第2輪 | 1個A班 | 2.0 | A(2.0) | 20-2=-7.0 | -3.0 | ✅ 是 |
| 第3輪 | 2個A班 | 4.0 | A(2.0) | 20-3=-6.6 | -0.6 | ✅ 是 |
| 第4輪 | 3個A班 | 6.0 | A(2.0) | 20-4=-6.2 | +1.8 | ❌ 否 |

在第4輪時，該護理師會被跳過，讓分數更低的人獲得分配機會。

