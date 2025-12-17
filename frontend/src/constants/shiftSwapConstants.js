// 班別工作時段定義
export const SHIFT_TIME_RANGES = {
  'A': '8-16',  // A班
  'B': '8-17',  // B班
  'N': '14-22', // N班
  'D': '22-08', // D班
  'E': '8-12',  // E班
  'K': '9-17',  // K班
  'C': '10-18', // C班
  'F': '12-20', // F班
  'O': '休假',   // O班
};

// 班別名稱對應
export const SHIFT_NAMES = {
  'A': 'A班(8-16)',
  'B': 'B班(8-17)',
  'N': 'N班(14-22)',
  'D': 'D班(22-08)',
  'E': 'E班(8-12)',
  'K': 'K班(9-17)',
  'C': 'C班(10-18)',
  'F': 'F班(12-20)',
  'O': 'O班(休假)',
};

// 不允許的班別組合及其最小間隔時間（小時）
export const INVALID_SHIFT_COMBINATIONS = {
  // 只有這些特定組合才有限制
  'N-A': 11, // N班(14-22)後至少間隔11小時才能上A班(8-16)
  'N-B': 11, // N班(14-22)後至少間隔11小時才能上B班(8-17)
  'N-E': 11, // N班(14-22)後至少間隔11小時才能上E班(8-12)
  'D-A': 11, // D班(22-08)後至少間隔11小時才能上A班(8-16)
  'D-B': 11, // D班(22-08)後至少間隔11小時才能上B班(8-17)
  'D-E': 11, // D班(22-08)後至少間隔11小時才能上E班(8-12)
  'D-K': 11, // D班(22-08)後至少間隔11小時才能上K班(9-17)
  'D-C': 11, // D班(22-08)後至少間隔11小時才能上C班(10-18)
};

// 護理師身份類型
export const NURSE_TYPES = {
  ANESTHESIA_SPECIALIST: 'anesthesia_specialist', // 麻醉專科護理師
  RECOVERY_NURSE: 'recovery_nurse', // 恢復室護理師
  ANESTHESIA_LEADER: 'anesthesia_leader', // 麻醉科Leader
  ANESTHESIA_SECRETARY: 'anesthesia_secretary', // 麻醉科書記
};

// 不同班表類型的班次設定
export const SHIFT_TYPES_BY_FORMULA = {
  [NURSE_TYPES.ANESTHESIA_SPECIALIST]: ['D', 'A', 'N', 'C', 'O'],
  [NURSE_TYPES.RECOVERY_NURSE]: ['A', 'K', 'C', 'F', 'O'],
  [NURSE_TYPES.ANESTHESIA_LEADER]: ['A', 'E', 'O'],
  [NURSE_TYPES.ANESTHESIA_SECRETARY]: ['B', 'E', 'O'],
};

// 定義班別顏色
export const SHIFT_COLORS = {
  'D': '#c5b5ac', // 白班 22-08
  'A': '#c6c05f', // 小夜班 8-16  
  'N': '#aa77c4', // 大夜班 14-22
  'K': '#8AA6C1', // 早班 9-17
  'C': '#a9d0ab', // 中班 10-18
  'F': '#d8bd89', // 晚班 12-20
  'E': '#cb9cc8', // 半班 8-12
  'B': '#e7b284', // 日班 8-17
  'O': '#e7e7e7', // 排休 OFF
  'V': '#e0755f', // 休假 OFF
  'R': '#a9c4ce'  // 靜養假 OFF
};

// 低飽和度班別顏色 (用於未選中狀態)
export const DESATURATED_SHIFT_COLORS = {
  'D': '#a5d6a7', // 淡化的白班顏色
  'A': '#e7e6c3', // 淡化的A班顏色
  'N': '#90caf9', // 淡化的大夜顏色
  'K': '#c6d5e3', // 淡化的K班顏色
  'C': '#d4e9d5', // 淡化的C班顏色
  'F': '#f0e4d0', // 淡化的F班顏色
  'E': '#ffcc80', // 淡化的小夜顏色
  'B': '#f2d7c0', // 淡化的B班顏色
  'O': '#e0e0e0'  // 淡化的休假顏色
};

// 狀態顏色配置
export const STATUS_COLORS = {
  'pending': { backgroundColor: '#ffecb3', color: '#bf360c' },
  'accepted': { backgroundColor: '#c8e6c9', color: '#1b5e20' },
  'rejected': { backgroundColor: '#ffcdd2', color: '#b71c1c' },
  'cancelled': { backgroundColor: '#eeeeee', color: '#9e9e9e' },
  'expired': { backgroundColor: '#f3e5f5', color: '#9c27b0' }
};

// 狀態顏色映射（統一的樣式配置）
export const statusColors = {
  'pending': { backgroundColor: '#ff9800', color: 'black' }, // 橙色
  'accepted': { backgroundColor: '#4caf50', color: 'white' }, // 綠色
  'rejected': { backgroundColor: '#f44336', color: 'white' }, // 紅色
  'cancelled': { backgroundColor: '#9e9e9e', color: 'white' }, // 灰色
  'expired': { backgroundColor: '#ba68c8', color: 'white' }, // 紫色
  'default': { backgroundColor: '#bdbdbd', color: 'black' }  // 灰色
};

// 狀態顯示名稱映射
export const STATUS_DISPLAY_NAMES = {
  'pending': '待處理',
  'accepted': '已完成',
  'rejected': '已駁回',
  'expired': '已過期',
  'cancelled': '已取消'
};

// 隱藏狀態的標籤文本
export const HIDE_STATUS_LABELS = {
  'accepted': '隱藏已完成',
  'rejected': '隱藏已駁回',
  'cancelled': '隱藏已取消',
  'expired': '隱藏已過期'
};

// 所有可能的班別
export const ALL_SHIFTS = ['D', 'A', 'N', 'K', 'C', 'F', 'E', 'B', 'O'];

// 狀態列表（移除 'pending'）
export const STATUSES = ['accepted', 'rejected', 'cancelled', 'expired'];

// 工作區域選項
export const WORK_AREAS = [
  { value: "", label: "不指定 (由接受者決定)" },
  { value: "OR1", label: "OR1 - 手術室1" },
  { value: "OR2", label: "OR2 - 手術室2" },
  { value: "OR3", label: "OR3 - 手術室3" },
  { value: "OR5", label: "OR5 - 手術室5" },
  { value: "OR6", label: "OR6 - 手術室6" },
  { value: "OR7", label: "OR7 - 手術室7" },
  { value: "OR8", label: "OR8 - 手術室8" },
  { value: "OR9", label: "OR9 - 手術室9" },
  { value: "OR11", label: "OR11 - 手術室11" },
  { value: "OR13", label: "OR13 - 手術室13" },
  { value: "DR", label: "DR - 恢復室" },
  { value: "3F1", label: "3F1 - 三樓1" },
  { value: "3F2", label: "3F2 - 三樓2" },
  { value: "3F_Recovery", label: "3F_Recovery - 三樓恢復室" },
  { value: "CC", label: "CC - 疼痛控制中心" },
  { value: "F1", label: "F1 - 會診室1" },
  { value: "F2", label: "F2 - 會診室2" },
  { value: "P", label: "P - 備用" },
  { value: "PAR1", label: "PAR1 - 麻醉準備區1" },
  { value: "PAR2", label: "PAR2 - 麻醉準備區2" },
  { value: "C", label: "C - 備料區" },
  { value: "HC1", label: "HC1 - 一般照護1" },
  { value: "HC2", label: "HC2 - 一般照護2" },
  { value: "HC3", label: "HC3 - 一般照護3" }
];

// 週標頭（從週一開始）
export const WEEK_DAYS = ['一', '二', '三', '四', '五', '六', '日'];

// 分頁設定
export const PAGE_SIZE = 10; 