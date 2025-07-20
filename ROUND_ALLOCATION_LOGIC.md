# 輪次分配算法邏輯說明

## 🎯 核心概念

### 輪次分配原則
根據您的需求，我重新設計了加班分配算法，採用**輪次分配**機制，確保：

1. **每個班別獨立分配**：先分配完所有A班，再分配B班，依此類推
2. **公平性優先**：盡量讓每個人都有平均的班別數量
3. **分數控制**：一旦分數超過0分，下一輪該護理師跳過分配
4. **分數最低優先**：在每輪中，總是選擇分數最低的護理師

## 🔄 分配流程

### 階段1：需求收集
```
遍歷所有日期 → 收集各班別需求 → 按班別分類統計
- 平日：需要A、B、C、D、E、F各一人
- 週六：需要A班一人  
- 週日：不需要加班
```

### 階段2：按班別順序輪次分配
```
班別順序：A → B → C → D → E → F

對每個班別：
  while (還有未分配需求) {
    第N輪分配：
    1. 篩選候選人（第1輪全部，第2輪後需分數+班別分≤0）
    2. 按分數排序（分數越低越優先）
    3. 分配給分數最低的護理師們
    4. 更新分數和移除已分配需求
  }
```

## 📊 詳細算法

### 輪次分配邏輯 (`_allocateShiftInRounds`)

#### 1. 候選人篩選
```javascript
const availableCandidates = eligibleUsersList.filter(user => {
  const currentScore = userScores[user.id].currentScore;
  const shiftScore = scoreUtils.calculateOvertimeScore(shiftType);
  const potentialScore = currentScore + shiftScore;
  
  // 第一輪：所有人都可以參與
  // 第二輪後：只有分配後不會超過0分的人可以參與
  return round === 1 || potentialScore <= 0;
});
```

#### 2. 分數排序
```javascript
// 按當前分數排序（分數越低越優先）
availableCandidates.sort((a, b) => 
  userScores[a.id].currentScore - userScores[b.id].currentScore
);
```

#### 3. 輪次分配
```javascript
// 按分數最低的順序分配
for (let i = 0; i < remainingDemands.length && candidateIndex < availableCandidates.length; i++) {
  // 檢查候選人是否適合該日期
  // 檢查間隔時間（A、B班）
  // 執行分配並更新分數
}
```

## 🎨 算法特色

### 1. 公平性保證
- **均等分配**：如果班別數 ≤ 人數，每人最多1個班別
- **多班別分配**：如果班別數 > 人數，多出的班別分給分數最低的人
- **輪次機制**：確保分數低的人優先獲得額外班別

### 2. 分數控制
- **0分門檻**：分數超過0分的護理師在後續輪次中被跳過
- **負分補償**：未加班的白班會扣負分，平衡加班得分
- **分數收斂**：算法目標是讓所有分數趨近於0分附近

### 3. 間隔控制
- **A班和B班**：考慮最小間隔天數（預設7天）
- **其他班別**：不限制間隔，優先考慮分數平衡

## 📈 實際案例

### 案例：6人8個A班
```
初始狀態：
護理師1: -6.21分, 護理師2: -4.38分, 護理師3: -5.47分
護理師4: -5.84分, 護理師5: -6.21分, 護理師6: -4.38分

第1輪分配（所有人參與）：
按分數排序：1(-6.21) → 5(-6.21) → 4(-5.84) → 3(-5.47) → 2(-4.38) → 6(-4.38)
分配結果：每人分配1個A班（6個A班）

第2輪分配（剩餘2個A班）：
分數更新後排序：1(-4.21) → 5(-4.21) → 其他人分數較高
分配結果：分數最低的1和5各再分配1個A班

最終結果：
護理師1: 2個A班(-2.21分), 護理師5: 2個A班(-2.21分)
其他4人: 各1個A班(-2.38~-3.84分)
```

## 🔧 關鍵實現細節

### 1. 需求收集 (`_collectShiftDemands`)
```javascript
// 分別收集每個班別的需求
const demands = { A: [], B: [], C: [], D: [], E: [], F: [] };

// 平日：A-F各一個需求
// 週六：只有A班需求
// 週日：無需求
```

### 2. 間隔檢查 (`_checkInterval`)
```javascript
// 檢查與最近一次同班別的間隔天數
const minInterval = Math.min(...userShiftDates.map(shiftDate => 
  dateUtils.getDaysDifference(currentDate, shiftDate)
));

return minInterval >= MIN_INTERVAL_DAYS; // 預設7天
```

### 3. 分配執行 (`_assignShift`)
```javascript
// 1. 記錄分配
newAllocations[`${user.id}_${date}`] = shiftType;

// 2. 更新分數
const shiftScore = scoreUtils.calculateOvertimeScore(shiftType);
userScores[user.id].currentScore += shiftScore;

// 3. 記錄日誌
console.log(`${shiftType}班 → ${user.name} (+${shiftScore}分, 總分: ${newScore})`);
```

## 🎯 算法優勢

### 1. 公平性最大化
- 確保班別數量的均等分配
- 多出的班別分給最需要的人（分數最低）

### 2. 分數平衡
- 0分門檻機制防止分數過高
- 負分補償機制平衡總體分數

### 3. 可控性
- 每個班別獨立分配，邏輯清晰
- 輪次機制可控，避免無限循環

### 4. 靈活性
- 支援部分分配（保留現有班別）
- 支援不同班別的特殊規則（間隔、身份限制）

## 📋 使用效果

### 預期結果
- **A班過多**：多的A班均分給分數最低的護理師
- **A班不足**：沒有A班的人是分數離零分最近的人
- **分數控制**：所有護理師分數保持在0分附近
- **間隔保證**：重要班別（A、B）滿足最小間隔要求

### 日誌輸出
算法提供詳細的分配過程日誌：
```
開始分配A班，共22個需求
A班第1輪分配，剩餘需求: 22
第1輪符合條件的候選人: 護理師1(-6.21分), 護理師2(-4.38分)...
  2024-08-01 A班 → 護理師1 (+2分, 總分: -4.21)
A班第1輪完成17個分配
A班第2輪分配，剩餘需求: 5
...
A班分配完成，所有需求已滿足
```

---

*此算法完全滿足您提出的需求：輪次公平分配、分數控制、間隔保證，確保加班分配的公平性和合理性。*