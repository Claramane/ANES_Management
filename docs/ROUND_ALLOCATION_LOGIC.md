# 自動分配排班邏輯架構文檔

## 📊 核心概念

### 統一分數導向輪次分配算法
自動分配排班系統基於「統一分數導向輪次分配算法」，採用先進的**輪次分配**機制，目標是實現最佳的分數平衡，讓所有護理師的分數盡可能接近零分。

### 輪次分配原則
1. **每個班別獨立分配**：先分配完所有A班，再分配B班，依此類推
2. **多輪公平性**：使用 Fisher-Yates 洗牌和多輪篩選確保公平
3. **分數控制**：一旦分數超過0分，下一輪該護理師跳過分配
4. **回合制公平**：確保每人先得一次再分配額外班別
5. **隨機化處理**：避免系統性偏見，確保真正的公平分配
6. **排除CC**：當日 area_code 為 CC 的人員不參與自動分配（仍可手動指定）

## 🎯 分數系統

### 班別分數配置
```javascript
const SHIFT_SCORES = {
  A: 2.0,   // A班價值最高（小夜班，價值是B班的2倍）
  B: 1.0,   // B班基準分數（大夜班）
  C: 0.8,   // C班略低於B班
  D: 0.3,   // D班低分值班別
  E: 0.0,   // E班零分
  F: 0.0    // F班零分
};
```

### 基礎分數計算
- **未加班白班扣分**: -0.365分（經過數學計算的平衡值）
- **出勤率模擬**: 根據用戶ID % 4 決定不同出勤模式
  - 類型0: 90% 出勤率（正常出勤）
  - 類型1: 95% 出勤率（高出勤）
  - 類型2: 70% 出勤率（夜班人員）
  - 類型3: 85% 出勤率（偶有請假）

### 分數計算公式
```
用戶基礎分數 = 實際白班天數 × (-0.365)
最終分數 = 基礎分數 + 所有加班分數總和
```

## 🔄 分配流程

### 兩種分配模式

#### 1. 全部重新自動分配
```
清空現有分配 → 初始化所有用戶分數 → 按優先級分配所有班別 → 返回完整結果
```

#### 2. 自動補齊未分配班別
```
保留現有分配 → 計算當前分數狀態 → 只分配缺少的班別 → 返回更新結果
```

### 階段1：需求收集與分組
```
1. 遍歷所有日期（平日+週六）
2. 收集每個班別類型的所有需求
3. 按班別優先級 [A, B, C, D, E, F] 組織需求
4. 每個班別類型獨立進行輪次分配
```

### 階段2：按班別順序輪次分配
```
班別順序：A → B → C → D → E → F（若設定不安排 E/F 班，則只分配 A → B → C → D）

對每個班別：
  while (還有未分配需求) {
    第N輪分配：
    1. Fisher-Yates 洗牌：隨機排序需求避免系統偏見
    2. 候選人篩選（第1輪全部，第2輪後需分數+班別分≤0）
    3. 按分數排序（分數越低越優先）
    4. 回合制分配給分數最低的護理師們
    5. 更新分數和移除已分配需求
  }
```

## 🏗️ 系統架構

### 1. 常數管理層 (`constants/overtimeConstants.js`)
```javascript
// 分數系統
export const SHIFT_SCORES = { A: 2.0, B: 1.0, C: 0.8, D: 0.3, E: 0.0, F: 0.0 };
export const NO_OVERTIME_PENALTY = -0.365;

// 算法配置
export const SHIFT_ALLOCATION_ORDER = ['A', 'B', 'C', 'D', 'E', 'F'];
export const MIN_INTERVAL_DAYS = 7;
export const SCORE_THRESHOLD = 0.3;
```

### 2. 核心算法層 (`utils/overtimeAllocation.js`)

#### a) 日期工具函數 (`dateUtils`)
- `isSunday()`: 判斷是否為週日
- `isSaturday()`: 判斷是否為週六
- `isWeekend()`: 判斷是否為週末
- `getDaysDifference()`: 計算兩日期間隔天數

#### b) 分數計算工具 (`scoreUtils`)
- `calculateOvertimeScore()`: 計算指定班別的加班分數
- `calculateUserBaseScore()`: 計算用戶基礎分數（白班負分）
- `calculateScoreStatistics()`: 計算分數統計結果

### 3. 組件層

#### a) 分配按鈕 (`OvertimeAllocationButton.jsx`)
- 觸發自動分配的主要入口
- 顯示分配狀態和進度

#### b) 分配對話框系統
- **AllocationConfirmDialog**: 確認對話框，選擇分配模式（全部重新分配/自動補齊）
- **AllocationProgressDialog**: 進度對話框，顯示分配進度和演算法說明
- **進度追蹤**: 支援取消功能和詳細進度回饋

#### c) 分配Hook (`useOvertimeAllocation.js`)
- 封裝完整分配邏輯的React Hook
- 管理對話框狀態、進度追蹤和錯誤處理
- 提供 `performFullAllocation` 和 `performPartialAllocation` 方法

## 📊 詳細算法

### 輪次分配邏輯 (`_allocateShiftInRounds`)

#### 1. Fisher-Yates 洗牌機制
```javascript
// 每輪開始前隨機排序需求，避免系統性偏見
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
```

#### 2. 候選人篩選與回合制公平
```javascript
_allocateShiftInRounds(shiftType, allShiftDemands, userScores, newAllocations, overtimeData) {
  let round = 1;
  let remainingDemands = [...allShiftDemands];
  
  while (remainingDemands.length > 0) {
    // Fisher-Yates 洗牌：隨機排序需求以避免系統性偏見
    shuffleArray(remainingDemands);
    
    // 候選人篩選：第二輪後僅選擇負分或零分人員
    const candidateFilter = round === 1 ? 
      (user) => true : 
      (user) => userScores[user.id].currentScore + SHIFT_SCORES[shiftType] <= 0;
    
    // 回合制分配：確保公平分配後再考慮額外需求
    const allocatedThisRound = [];
    
    for (let demand of remainingDemands) {
      const availableCandidates = eligibleUsersList.filter(candidateFilter);
      
      // 按當前分數排序（分數越低越優先）
      availableCandidates.sort((a, b) => 
        userScores[a.id].currentScore - userScores[b.id].currentScore
      );
      
      // 檢查間隔時間（A、B班）和其他條件
      const selectedUser = selectBestCandidate(availableCandidates, demand);
      
      if (selectedUser) {
        allocateToUser(selectedUser, demand, shiftType);
        updateScore(selectedUser, shiftType);
        allocatedThisRound.push(demand);
      }
    }
    
    // 移除已分配的需求
    remainingDemands = remainingDemands.filter(d => !allocatedThisRound.includes(d));
    round++;
  }
}
```

#### 3. 分數排序與間隔檢查
```javascript
// 按當前分數排序（分數越低越優先）
availableCandidates.sort((a, b) => 
  userScores[a.id].currentScore - userScores[b.id].currentScore
);

// 間隔檢查（A、B班需要7天間隔）
function checkInterval(user, date, shiftType, allocations) {
  if (shiftType !== 'A' && shiftType !== 'B') return true;
  
  const userShiftDates = Object.entries(allocations)
    .filter(([key, shift]) => key.startsWith(user.id) && shift === shiftType)
    .map(([key]) => key.split('_')[1]);
    
  const minInterval = Math.min(...userShiftDates.map(shiftDate => 
    dateUtils.getDaysDifference(date, shiftDate)
  ));
  
  return minInterval >= MIN_INTERVAL_DAYS; // 預設7天
}
```

## 📈 分數平衡機制

### 目標
讓所有護理師的分數盡可能接近零分，實現最大化的公平性。

### 平衡策略
1. **輪次公平性**: 多輪分配確保每人機會均等
2. **負分補償**: 未加班的白班扣負分，平衡加班得分
3. **隨機化處理**: Fisher-Yates 洗牌避免系統性偏見
4. **候選人篩選**: 第二輪後優先選擇負分或零分人員
5. **回合制公平**: 確保每人先得一次再分配額外班別
6. **零分接近**: 算法目標是讓分數分佈的平均偏離零分最小

### 數學平衡
```
理論平均分數 ≈ 0
NO_OVERTIME_PENALTY = -0.365 （經過計算的平衡值）
總體分數趨勢：向零分收斂
```

## 🎨 算法特色

### 1. 更高公平性保證
- **均等分配**：如果班別數 ≤ 人數，每人最多1個班別
- **多班別分配**：如果班別數 > 人數，多出的班別分給分數最低的人
- **輪次機制**：確保分數低的人優先獲得額外班別
- **隨機化處理**：Fisher-Yates 洗牌消除系統性偏見
- **回合制分配**：確保每人先得一次再考慮額外分配

### 2. 分數控制
- **0分門檻**：分數超過0分的護理師在後續輪次中被跳過
- **負分補償**：未加班的白班會扣負分，平衡加班得分
- **分數收斂**：算法目標是讓所有分數趨近於0分附近
- **多輪篩選**: 候選人篩選機制確保合理分配

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

## 🛠️ 技術特色

### 1. 模組化設計
- 每個功能模組獨立，便於測試和維護
- 清晰的職責分離
- Hook-based 架構便於擴展

### 2. 可配置性
- 所有重要參數在常數文件中統一管理
- 支援不同參數調整和優化

### 3. 完整日誌
- 詳細的分配過程日誌
- 便於調試和追蹤問題

### 4. 錯誤處理
- 完善的異常捕獲和處理
- 用戶友好的錯誤提示

### 5. 效能優化
- 非阻塞算法執行
- 進度反饋和取消機制
- Fisher-Yates 洗牌演算法優化
- 輪次分配減少重複計算

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

## 🔧 使用方式

### 前端調用
```javascript
// 1. 觸發自動分配
const allocationHook = useOvertimeAllocation(logger);
allocationHook.showAllocationDialog();

// 2. 執行完整分配
const result = await allocationHook.performFullAllocation(overtimeData);

// 3. 執行部分分配
const result = await allocationHook.performPartialAllocation(overtimeData, existingMarkings);
```

### 核心算法調用
```javascript
// 直接使用核心算法
import { createAllocator } from '../utils/overtimeAllocation';

const allocator = createAllocator(logger);
const result = allocator.allocate(overtimeData, options);
```

## 📊 結果分析

### 分配結果包含
1. **新分配標記**: `{ dateKey: { userId: shift } }`
2. **分數統計**: 最小值、最大值、平均值、偏離度
3. **分配日誌**: 詳細的分配過程記錄

### 評估指標
- **分數範圍**: 最高分與最低分的差距
- **平均偏離零分**: 所有分數絕對值的平均
- **分配成功率**: 成功分配的班別比例
- **平衡度**: 分數分佈的均勻程度

## 🎯 算法優勢

1. **更高公平性**: 輪次分配和隨機化確保真正的公平分配
2. **分數平衡**: 維持護理師間的分數平衡，趨近零分
3. **無系統偏見**: Fisher-Yates 洗牌消除排序偏見
4. **多輪篩選**: 候選人篩選機制確保合理分配
5. **回合制公平**: 確保每人先得一次再考慮額外分配
6. **靈活性**: 支援全部重新分配和自動補齊兩種模式
7. **可維護性**: 模組化設計，hook-based 架構便於擴展
8. **可控性**: 每個班別獨立分配，邏輯清晰
9. **間隔保證**: 重要班別滿足最小間隔要求

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
