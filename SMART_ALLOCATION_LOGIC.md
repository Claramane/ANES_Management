# 智能分配排班邏輯架構文檔

## 📊 核心概念

### 統一分數導向算法
智能分配排班系統基於「統一分數導向算法」，目標是實現最佳的分數平衡，讓所有護理師的分數盡可能接近零分。

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

#### c) 人員選擇算法 (`UserSelector`)
```javascript
class UserSelector {
  static selectBestUserForShift(availableUsers, userScores, shiftType, date, allocations) {
    // 1. 按當前分數排序（分數越低越優先）
    // 2. 在分數相近的人中進行進一步篩選
    // 3. 對於重要班別（A、B），考慮間隔時間
    // 4. 選擇最適合的候選人
  }
}
```

#### d) 統一分配算法 (`UnifiedScoreAllocation`)
```javascript
class UnifiedScoreAllocation {
  allocate(overtimeData, options) {
    // 1. 初始化用戶分數
    // 2. 執行分配邏輯
    // 3. 分析結果
    // 4. 返回分配結果
  }
}
```

### 3. 組件層 (`components/OvertimeAllocation/`)

#### a) 分配按鈕 (`OvertimeAllocationButton.jsx`)
- 觸發智能分配的主要入口
- 顯示分配狀態和進度

#### b) 分配對話框 (`OvertimeAllocationDialog.jsx`)
- **確認對話框**: 選擇分配模式
- **進度對話框**: 顯示分配進度和系統說明

#### c) 分配Hook (`useOvertimeAllocation.js`)
- 封裝分配邏輯的React Hook
- 管理對話框狀態和分配流程

### 4. 業務邏輯層 (`hooks/useOvertimeAllocation.js`)
```javascript
export const useOvertimeAllocation = (logger) => {
  // 對話框狀態管理
  // 執行完整分配
  // 執行部分分配
  // 錯誤處理和日誌記錄
}
```

## 🔄 分配流程

### 兩種分配模式

#### 1. 全部重新智能分配
```
清空現有分配 → 初始化所有用戶分數 → 按優先級分配所有班別 → 返回完整結果
```

#### 2. 智能補齊未分配班別
```
保留現有分配 → 計算當前分數狀態 → 只分配缺少的班別 → 返回更新結果
```

### 分配算法詳細步驟

#### 階段1: 平日分配（週一至週五）
```
1. 遍歷所有平日
2. 對每一天按班別優先級順序 [A, B, C, D, E, F] 分配
3. 為每個班別選擇最適合的護理師：
   - 排除麻醉科Leader（只能分配E或F班）
   - 按當前分數排序（分數越低越優先）
   - 在分數相近候選人中考慮其他因素
   - 對A、B班考慮間隔時間（避免連續分配）
4. 更新選中護理師的分數和分配記錄
```

#### 階段2: 週六分配（僅A班）
```
1. 遍歷所有週六
2. 為每個週六分配一位A班護理師
3. 使用相同的選擇邏輯，但只分配A班
4. 更新分數和記錄
```

### 人員選擇邏輯
```javascript
selectBestUserForShift(availableUsers, userScores, shiftType, date, allocations) {
  // 1. 分數排序：選擇當前分數最低的護理師
  candidates = availableUsers.sort((a, b) => userScores[a.id] - userScores[b.id])
  
  // 2. 分數相近篩選：在誤差範圍內的候選人
  closeScoreCandidates = candidates.filter(score <= lowestScore + 0.3)
  
  // 3. 間隔檢查：對重要班別（A、B）考慮最小間隔天數
  if (shiftType === 'A' || shiftType === 'B') {
    return selectWithIntervalCheck(closeScoreCandidates, minInterval: 7天)
  }
  
  // 4. 返回分數最低的候選人
  return candidates[0]
}
```

## 📈 分數平衡機制

### 目標
讓所有護理師的分數盡可能接近零分，實現最大化的公平性。

### 平衡策略
1. **分數最低優先**: 總是選擇當前分數最低的護理師
2. **負分補償**: 未加班的白班扣負分，平衡加班得分
3. **間隔控制**: 重要班別避免短期內重複分配給同一人
4. **零分接近**: 算法目標是讓分數分佈的平均偏離零分最小

### 數學平衡
```
理論平均分數 ≈ 0
NO_OVERTIME_PENALTY = -0.365 （經過計算的平衡值）
總體分數趨勢：向零分收斂
```

## 🛠️ 技術特色

### 1. 模組化設計
- 每個功能模組獨立，便於測試和維護
- 清晰的職責分離

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

## 🔧 使用方式

### 前端調用
```javascript
// 1. 觸發智能分配
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

1. **公平性**: 確保加班分配的公平性
2. **平衡性**: 維持護理師間的分數平衡
3. **智能性**: 考慮多種因素的智能選擇
4. **靈活性**: 支援多種分配模式
5. **可維護性**: 模組化設計，便於擴展和維護

---

*此文檔說明了智能分配排班系統的完整邏輯架構，為系統維護和功能擴展提供參考。*