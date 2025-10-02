# 用戶權限判定文件

本文件記錄前端所有需要用 `role` 和 `identity` 判定權限的位置。

**最後更新**: 2025-10-01

---

## 目錄

1. [權限系統概述](#權限系統概述)
2. [涉及權限判定的檔案清單](#涉及權限判定的檔案清單)
3. [權限判定位置詳細清單](#權限判定位置詳細清單)
4. [權限矩陣總覽](#權限矩陣總覽)
5. [開發注意事項](#開發注意事項)
6. [相關文件](#相關文件)

---

## 涉及權限判定的檔案清單

以下是所有包含 `role` 或 `identity` 權限判定邏輯的前端檔案：

### 核心路由與佈局
1. **`src/App.jsx`** - 路由層級權限控制
2. **`src/components/Layout.jsx`** - 導航選單權限顯示

### 頁面組件 (Pages)
3. **`src/pages/Dashboard.jsx`** - 首頁顯示邏輯（醫師/護理師班表）
4. **`src/pages/UserManagement.jsx`** - 用戶管理權限
5. **`src/pages/WeeklySchedule.jsx`** - 週班表編輯與工作分配權限
6. **`src/pages/MonthlySchedule.jsx`** - 月班表編輯權限
7. **`src/pages/DoctorSchedule.jsx`** - 醫師班表編輯權限
8. **`src/pages/OvertimeStaff.jsx`** - 加班人員管理權限
9. **`src/pages/ShiftSwap.jsx`** - 換班申請標準版權限
10. **`src/pages/ShiftSwapOptimized.jsx`** - 換班申請優化版權限
11. **`src/pages/Announcement.jsx`** - 公告刪除權限
12. **`src/pages/PublishAnnouncementForm.jsx`** - 公告發布權限
13. **`src/pages/Formula.jsx`** - 公式班表（無直接權限判定，但路由受保護）

### 自定義 Hooks
14. **`src/hooks/useShiftSwap.js`** - 換班請求篩選邏輯

### 工具函數 (Utils)
15. **`src/utils/shiftSwapUtils.js`** - 換班權限檢查函數
16. **`src/utils/overtimeAllocation.js`** - 加班分配邏輯（含身份判定）

### 狀態管理 (Store)
17. **`src/store/userStore.js`** - 用戶身份篩選
18. **`src/store/scheduleStore.js`** - 班表數據管理（含身份判定）

### 檔案統計
- **總計**: 18 個檔案
- **頁面組件**: 11 個
- **工具/Hook**: 3 個
- **Store**: 2 個
- **核心**: 2 個

---

## 權限系統概述

系統使用兩種屬性進行權限控制：

### Role (角色)
- `admin` - 系統管理員
- `head_nurse` - 護理長
- `boss` - 主管
- `nurse` - 一般護理師
- `leader` - Leader
- `supervise_nurse` - A組護理師
- `clerk` - 書記
- `doctor` - 醫師
- `supervisor` - 督導

### Identity (身份類型)
- `麻醉專科護理師` / `anesthesia_specialist`
- `恢復室護理師` / `recovery_nurse`
- `麻醉科Leader` / `anesthesia_leader`
- `麻醉科書記` / `anesthesia_secretary`
- `護理長`

## 權限判定位置詳細清單

### 1. 路由層級權限

**文件**: `src/App.jsx`

| 行號 | 判定邏輯 | 用途 |
|------|---------|------|
| 177 | `user?.role !== 'head_nurse' && user?.role !== 'boss' && user?.role !== 'admin'` | 控制某些路由的訪問權限（護理長、boss、admin） |

**說明**: 在路由層級阻擋未授權用戶訪問特定頁面。

---

### 2. 導航選單權限

**文件**: `src/components/Layout.jsx`

| 行號 | 判定邏輯 | 用途 |
|------|---------|------|
| 48 | `user?.role === 'head_nurse' \|\| user?.role === 'admin'` | 控制護理長專用選單項目顯示（公式班表、用戶管理） |
| 125-146 | `isHeadNurse` 條件渲染 | 渲染護理長專用選單區塊 |
| 229 | 顯示用戶身份標籤 | 在用戶資訊中顯示 identity 或 role |

**護理長專用選單項目**:
- 公式班表 (`/formula`)
- 用戶管理 (`/user-management`)

---

### 3. 用戶管理頁面

**文件**: `src/pages/UserManagement.jsx`

| 行號 | 判定邏輯 | 用途 |
|------|---------|------|
| 594, 597 | `user.role === 'head_nurse'` | 護理長行的背景色標示 (#f5f5f5) |
| 619, 643 | `user.role !== 'head_nurse' && user.role !== 'admin' && user.is_active !== false` | 控制是否可編輯名稱和身份 |
| 662 | `user.role !== 'admin' && user.is_active !== false` | 控制是否可編輯角色 |
| 677-684 | 角色顯示映射 | 將 role 代碼轉換為中文顯示名稱 |
| 689 | `user.role !== 'head_nurse' && user.role !== 'admin'` | 控制啟用/停用用戶按鈕顯示 |

**角色顯示映射**:
- `nurse` → 一般護理師
- `leader` → Leader
- `supervise_nurse` → A組護理師
- `head_nurse` → 護理長
- `clerk` → 書記
- `admin` → 管理員
- `doctor` → 醫師

**編輯權限規則**:
- 護理長和管理員的資料不可編輯
- 已停用的用戶資料不可編輯
- 只有管理員可以編輯所有用戶的角色

---

### 4. 週班表

**文件**: `src/pages/WeeklySchedule.jsx`

| 行號 | 判定邏輯 | 用途 |
|------|---------|------|
| 136 | `user?.role === 'head_nurse' \|\| user?.role === 'admin'` | 控制編輯權限 |
| 941 | `nurse.identity === '恢復室護理師'` | 3F工作分配時，恢復室護理師分配到3F2 |
| 984 | `identity === '恢復室護理師'` | 恢復室護理師只能排3F2 |
| 1370 | `identity === '麻醉專科護理師' \|\| identity === '麻醉科Leader' \|\| identity === '護理長'` | A班分配按鈕邏輯 |
| 1433 | `identity === '恢復室護理師'` | 恢復室護理師按鈕邏輯 |
| 2021, 2074 | `nurse.role === 'head_nurse'` (已註解) | 原本排除護理長的邏輯（現已移除） |
| 2102-2104 | `nurse.identity === '麻醉專科護理師' \|\| nurse.identity === '麻醉科Leader' \|\| nurse.role === 'head_nurse'` | 篩選可分配OR/DR的護理師 |
| 2127 | `nurse.identity === '恢復室護理師'` | 篩選可分配3F2的護理師 |
| 2839 | `nurse.identity === '恢復室護理師'` | 判斷是否為恢復室護理師 |

**工作分配邏輯**:
- **OR/DR/3F1**: 麻醉專科護理師、麻醉科Leader、護理長
- **3F2**: 恢復室護理師

---

### 5. 月班表

**文件**: `src/pages/MonthlySchedule.jsx`

| 行號 | 判定邏輯 | 用途 |
|------|---------|------|
| 265 | `user?.role === 'head_nurse' \|\| user?.role === 'admin'` | 控制編輯權限 |
| 70, 1041, 1133, 1311 | `nurse.role !== 'admin'` | 排除 admin 角色的用戶（使用 role 判定，不使用 identity） |
| 1320 | `user.role === 'supervise_nurse'` | 檢查啟用的 A組護理師 |
| 1375 | `user.role === 'head_nurse' ? '護理長' : user.identity` | 設定護理長的身份顯示 |

**編輯權限**: 只有護理長和管理員可以編輯月班表

**⚠️ 重要**: 月班表篩選時使用 `role !== 'admin'` 而非 `identity !== 'admin'`，確保 admin 角色的用戶（即使有其他 identity）不會被加入班表

---

### 6. 醫師班表

**文件**: `src/pages/DoctorSchedule.jsx`

| 行號 | 判定邏輯 | 用途 |
|------|---------|------|
| 250 | `currentUser.role === 'admin' \|\| currentUser.role === 'head_nurse' \|\| currentUser.role === 'doctor'` | 控制編輯權限 |

**編輯權限**: 管理員、護理長、醫師可以編輯醫師班表

---

### 7. 加班人員

**文件**: `src/pages/OvertimeStaff.jsx`

| 行號 | 判定邏輯 | 用途 |
|------|---------|------|
| 616 | `user.role === 'head_nurse' \|\| user.role === 'admin'` | 控制編輯權限 |
| 1335, 2427 | `nurse.role === 'head_nurse' \|\| nurse.position === 'CC'` | 排除護理長和CC職位不參與加班 |

**加班排除規則**:
- 護理長不參與加班分配
- CC職位不參與加班分配
- 非麻醉相關護理師不參與加班

---

### 8. 換班申請 (優化版)

**文件**: `src/pages/ShiftSwapOptimized.jsx`

| 行號 | 判定邏輯 | 用途 |
|------|---------|------|
| 116 | `user.identity.includes('麻醉專科') \|\| user.identity === 'anesthesia_specialist'` | 班別選項: D, A, N, O |
| 118 | `user.identity.includes('恢復室') \|\| user.identity === 'recovery_nurse'` | 班別選項: A, K, C, F, O |
| 120 | `user.identity.includes('Leader') \|\| user.identity === 'anesthesia_leader'` | 班別選項: A, E, O |
| 122 | `user.identity.includes('書記') \|\| user.identity === 'anesthesia_secretary'` | 班別選項: B, E, O |

**班別對應表**:
- **麻醉專科護理師**: D(日班), A(小夜班), N(大夜班), O(休假)
- **恢復室護理師**: A(日班), K(早班), C(中班), F(晚班), O(休假)
- **麻醉科Leader**: A(日班), E(半班), O(休假)
- **麻醉科書記**: B(日班), E(半班), O(休假)

---

### 9. 換班申請 (標準版)

**文件**: `src/pages/ShiftSwap.jsx`

| 行號 | 判定邏輯 | 用途 |
|------|---------|------|
| 854 | `identity === 'anesthesia_specialist' \|\| identity === '麻醉專科護理師'` | 判定為麻醉專科護理師類型 |
| 856 | `identity === 'recovery_nurse' \|\| identity === '恢復室護理師'` | 判定為恢復室護理師類型 |
| 2059 | `user.role === 'admin'` | 管理員權限檢查 |
| 2060 | `user.identity === 'anesthesia_leader' \|\| user.identity === '麻醉科Leader'` | Leader權限檢查 |
| 2061 | `user.role === 'head_nurse'` | 護理長權限檢查 |
| 2065 | `isAdmin \|\| isLeader \|\| isHeadNurse` | 可以操作任何請求 |
| 2067 | `isRequester && request.status === 'pending'` | 申請人可以取消待處理的請求 |
| 2078-2092 | 駁回/取消按鈕文字判定 | 根據角色和請求狀態顯示適當按鈕文字 |

**換班權限層級**:
1. **管理員**: 可以駁回/刪除所有請求
2. **麻醉科Leader**: 可以駁回/刪除所有請求
3. **護理長**: 可以駁回/刪除所有請求
4. **申請人**: 只能取消自己的待處理請求

**按鈕文字邏輯**:
- 已接受的請求 + 管理者 → "駁回並恢復班表"
- 待處理的請求 + 申請人 → "取消申請"
- 待處理的請求 + 管理者 → "駁回申請"
- 其他 → "刪除"

---

### 10. 換班工具函數

**文件**: `src/utils/shiftSwapUtils.js`

#### `canDeleteRequest` 函數

| 行號 | 判定邏輯 | 用途 |
|------|---------|------|
| 277 | `user.role === 'admin'` | 管理員權限 |
| 278 | `user.identity === 'anesthesia_leader' \|\| user.identity === '麻醉科Leader'` | Leader權限 |
| 279 | `user.role === 'head_nurse'` | 護理長權限 |
| 283 | `isAdmin \|\| isLeader \|\| isHeadNurse` | 可以操作任何請求 |
| 285 | `isRequester && request.status === 'pending'` | 申請人可以取消待處理的請求 |

#### `getDeleteButtonText` 函數

| 行號 | 判定邏輯 | 用途 |
|------|---------|------|
| 301-303 | 同上 | 權限檢查變數 |
| 307 | `request.status === 'accepted' && (isAdmin \|\| isLeader \|\| isHeadNurse)` | 已接受的請求駁回文字 |
| 313-317 | 待處理請求的按鈕文字判定 | 根據角色顯示適當文字 |

#### `canCreateShiftSwap` 函數

| 行號 | 判定邏輯 | 用途 |
|------|---------|------|
| 335-338 | `identity === '麻醉專科護理師' \|\| identity === 'anesthesia_specialist' \|\| identity === '恢復室護理師' \|\| identity === 'recovery_nurse'` | 檢查是否可以創建換班申請 |

**創建換班權限**: 只有麻醉專科護理師和恢復室護理師可以創建換班申請

---

### 11. 加班分配工具

**文件**: `src/utils/overtimeAllocation.js`

此文件包含根據 `identity` 和 `role` 進行加班分配計算的邏輯。

**主要判定**:
- 根據護理師身份類型計算加班班別
- 排除護理長和特殊職位
- 計算加班分數和排序

---

### 12. 公告系統

#### 公告頁面

**文件**: `src/pages/Announcement.jsx`

| 行號 | 判定邏輯 | 用途 |
|------|---------|------|
| 346 | `user.role === 'admin'` | 管理員可刪除任何公告 |
| 349 | `['head_nurse', 'supervisor'].includes(user.role)` | 護理長/督導可刪除自己的公告 |

#### 發布公告表單

**文件**: `src/pages/PublishAnnouncementForm.jsx`

| 行號 | 判定邏輯 | 用途 |
|------|---------|------|
| 51 | `user?.role === 'admin' \|\| user?.role === 'head_nurse'` | 查看所有分類 |
| 64 | `user?.role === 'admin' \|\| user?.role === 'head_nurse' \|\| user?.role === 'supervisor'` | 發布受限分類公告（交班、閒聊） |

**公告權限規則**:
- **管理員**: 可刪除任何公告，可發布所有分類
- **護理長**: 可刪除自己的公告，可發布所有分類
- **督導**: 可刪除自己的公告，可發布所有分類
- **一般用戶**: 只能發布非受限分類公告

---

### 13. 首頁 Dashboard

**文件**: `src/pages/Dashboard.jsx`

| 行號 | 判定邏輯 | 用途 |
|------|---------|------|
| 1132 | `user.role === 'doctor' \|\| user.role === 'admin'` | 載入醫師班表數據 |
| 1328 | 同上 | 點擊今日班表卡片時的導航路徑 |
| 1335 | 同上 | 顯示醫師班表或護理師班表 |
| 1621 | 同上 | 點擊本月班表卡片時的導航路徑 |
| 1628 | 同上 | 顯示醫師月班表或護理師月班表 |
| 2034 | `!(user?.role === 'doctor' \|\| user?.role === 'admin')` | 護理師才顯示換班請求卡片 |

**Dashboard 顯示規則**:
- **醫師/管理員**: 顯示醫師班表、隱藏換班請求卡片
- **護理師**: 顯示護理師班表、顯示換班請求卡片

---

### 14. useShiftSwap Hook

**文件**: `src/hooks/useShiftSwap.js`

| 行號 | 判定邏輯 | 用途 |
|------|---------|------|
| 72 | `req.requestor.identity === user.identity` | 篩選相同身份類型的換班請求 |

**篩選邏輯**: 當啟用「僅顯示相同身份」選項時，只顯示與當前用戶相同身份類型的換班請求

---

### 15. Store (狀態管理)

#### userStore.js

**文件**: `src/store/userStore.js`

| 行號 | 判定邏輯 | 用途 |
|------|---------|------|
| 316 | `nurse.identity === identity` | 根據身份篩選並排序用戶 |
| 354 | `nurse.identity === identity` | 根據身份獲取護理師列表 |
| 361 | `nurse.identity === identity` | 根據身份獲取護理師名稱字串 |

#### scheduleStore.js

**文件**: `src/store/scheduleStore.js`

此 store 包含根據 `identity` 和 `role` 管理班表數據的邏輯。

---

## 權限矩陣總覽

### 功能權限對照表

| 功能 | admin | head_nurse | boss | leader | supervise_nurse | nurse | doctor | clerk |
|------|-------|------------|------|--------|-----------------|-------|--------|-------|
| 訪問路由 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 用戶管理 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 公式班表 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 編輯週班表 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 編輯月班表 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 編輯醫師班表 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| 編輯加班人員 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 創建換班申請 | ✅ | ✅ | ❌ | ✅* | ❌ | ✅* | ❌ | ❌ |
| 駁回換班申請 | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 取消自己的申請 | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| 刪除任何公告 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 發布受限公告 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

*註: 創建換班申請需要同時滿足身份要求（麻醉專科護理師或恢復室護理師）

### 身份類型與班別對照表

| 身份類型 | 可用班別 | 說明 |
|---------|---------|------|
| 麻醉專科護理師 | D, A, N, O | 日班、小夜班、大夜班、休假 |
| 恢復室護理師 | A, K, C, F, O | 日班、早班、中班、晚班、休假 |
| 麻醉科Leader | A, E, O | 日班、半班、休假 |
| 麻醉科書記 | B, E, O | 日班、半班、休假 |
| 護理長 | 特殊 | 根據實際角色決定 |

### 工作分配權限對照表

| 工作區域 | 可分配身份 |
|---------|-----------|
| OR (開刀房) | 麻醉專科護理師、麻醉科Leader、護理長 |
| DR (恢復室) | 麻醉專科護理師、麻醉科Leader、護理長 |
| 3F1 | 麻醉專科護理師、麻醉科Leader、護理長 |
| 3F2 | 恢復室護理師 |

---

## 開發注意事項

### 1. 權限判定一致性

在新增或修改權限判定時，請確保：

- ✅ 前端和後端的權限邏輯保持一致
- ✅ 使用統一的角色和身份名稱
- ✅ 相同功能在不同頁面使用相同的權限判定
- ✅ 更新此文件以反映變更

### 2. 角色命名規範

**前端使用**:
- 優先使用中文身份名稱（如 `麻醉專科護理師`）
- 支援英文代碼以保持向後兼容（如 `anesthesia_specialist`）
- 使用 `includes()` 方法進行模糊匹配

**後端使用**:
- 使用英文代碼作為主要識別符
- 在顯示時轉換為中文名稱

**⚠️ 重要規則：Role vs Identity**
- **管理員判定**：必須使用 `role === 'admin'` 或 `role !== 'admin'`，**絕對不要**使用 `identity === 'admin'`
  - 原因：admin 是一種角色權限，而非身份類型
  - admin 角色的用戶可以有不同的 identity（如麻醉科醫師）
- **身份判定**：使用 `identity` 判定護理師類型（麻醉專科、恢復室、Leader 等）
- **權限判定**：使用 `role` 判定管理權限（admin、head_nurse、doctor 等）

### 3. 常用權限檢查模式

```javascript
// 檢查是否為管理角色
const isAdmin = user?.role === 'admin' || user?.role === 'head_nurse';

// 檢查身份類型（支援中英文）
const isAnesthesiaNurse =
  user?.identity === '麻醉專科護理師' ||
  user?.identity === 'anesthesia_specialist';

// 檢查 Leader 權限
const isLeader =
  user?.identity === '麻醉科Leader' ||
  user?.identity === 'anesthesia_leader';

// 檢查是否可以編輯
const canEdit = useMemo(() => {
  return user && (user.role === 'head_nurse' || user.role === 'admin');
}, [user]);
```

### 4. 測試檢查清單

在實作權限相關功能時，請確認：

- [ ] 不同角色看到的內容是否正確
- [ ] 未授權用戶是否被正確阻擋
- [ ] 路由保護是否生效
- [ ] UI 元素（按鈕、選單）是否根據權限顯示/隱藏
- [ ] 錯誤訊息是否明確告知權限不足
- [ ] 後端 API 是否有相應的權限驗證

---

## 相關文件

- [資料庫架構文件](./DATABASE_ARCHITECTURE.md) - 用戶表結構和角色定義
- [安全指南](./SECURITY.md) - 安全最佳實務和權限驗證
- [使用說明](./USAGE.md) - 各角色的系統使用指南
- [主要開發文件](../CLAUDE.md) - 專案整體架構和開發指南

---

## 快速參考：檔案功能索引

當你需要修改特定功能的權限時，請參考以下索引：

### 按功能分類

#### 路由與導航
- **路由保護**: `src/App.jsx`
- **選單顯示**: `src/components/Layout.jsx`

#### 班表管理
- **週班表編輯**: `src/pages/WeeklySchedule.jsx`
- **月班表編輯**: `src/pages/MonthlySchedule.jsx`
- **醫師班表編輯**: `src/pages/DoctorSchedule.jsx`
- **公式班表**: `src/pages/Formula.jsx` (路由保護)

#### 工作分配
- **A班工作分配**: `src/pages/WeeklySchedule.jsx` (行 1370-2839)
- **加班分配**: `src/pages/OvertimeStaff.jsx`, `src/utils/overtimeAllocation.js`

#### 換班系統
- **換班申請**: `src/pages/ShiftSwap.jsx`, `src/pages/ShiftSwapOptimized.jsx`
- **換班權限檢查**: `src/utils/shiftSwapUtils.js`
- **換班篩選**: `src/hooks/useShiftSwap.js`

#### 用戶與公告
- **用戶管理**: `src/pages/UserManagement.jsx`
- **公告管理**: `src/pages/Announcement.jsx`, `src/pages/PublishAnnouncementForm.jsx`

#### 首頁顯示
- **Dashboard**: `src/pages/Dashboard.jsx`

#### 狀態管理
- **用戶數據**: `src/store/userStore.js`
- **班表數據**: `src/store/scheduleStore.js`

### 按權限類型分類

#### Role 判定
- **admin 專用**: `src/App.jsx`, `src/pages/UserManagement.jsx`, `src/pages/Announcement.jsx`
- **head_nurse 專用**: `src/components/Layout.jsx`, `src/pages/WeeklySchedule.jsx`, `src/pages/MonthlySchedule.jsx`
- **doctor 專用**: `src/pages/DoctorSchedule.jsx`, `src/pages/Dashboard.jsx`

#### Identity 判定
- **麻醉專科護理師**: `src/pages/WeeklySchedule.jsx`, `src/pages/ShiftSwapOptimized.jsx`, `src/utils/shiftSwapUtils.js`
- **恢復室護理師**: `src/pages/WeeklySchedule.jsx`, `src/pages/ShiftSwapOptimized.jsx`
- **麻醉科Leader**: `src/pages/ShiftSwap.jsx`, `src/utils/shiftSwapUtils.js`

### 按檔案類型分類

| 類型 | 檔案數量 | 主要檔案 |
|------|---------|---------|
| 頁面組件 | 11 | Dashboard, WeeklySchedule, ShiftSwap 等 |
| 工具函數 | 2 | shiftSwapUtils.js, overtimeAllocation.js |
| Hooks | 1 | useShiftSwap.js |
| Store | 2 | userStore.js, scheduleStore.js |
| 核心 | 2 | App.jsx, Layout.jsx |

---

## 變更歷史

| 日期 | 版本 | 變更內容 | 更新者 |
|------|------|---------|--------|
| 2025-10-01 | 1.0.2 | 修改 MonthlySchedule.jsx：將 `identity !== 'admin'` 改為 `role !== 'admin'`（4處） | Claude |
| 2025-10-01 | 1.0.1 | 新增檔案清單和快速參考索引 | Claude |
| 2025-10-01 | 1.0.0 | 初始版本，整理所有前端權限判定位置 | Claude |

---

**⚠️ 重要提醒**: 當新增、修改或刪除任何權限判定邏輯時，請務必更新此文件以保持文件與代碼同步！包括：
- 更新涉及權限判定的檔案清單
- 更新權限判定位置詳細清單
- 更新快速參考索引
- 更新變更歷史記錄
