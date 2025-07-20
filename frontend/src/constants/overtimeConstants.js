/**
 * 加班分配相關常數
 */

// 分數系統常數
export const SHIFT_SCORES = {
  A: 2.0,   // A班價值是B班的2倍
  B: 1.0,   // 基準分數
  C: 0.8,   // 略低於B班
  D: 0.3,   // 低分值班別
  E: 0.0,   // 零分
  F: 0.0    // 零分
};

// 未加班白班的負分（經過數學計算得出的平衡值）
export const NO_OVERTIME_PENALTY = -0.365;

// 班別順序
export const SHIFT_ALLOCATION_ORDER = ['A', 'B', 'C', 'D', 'E', 'F'];

// 標記循環順序
export const MARK_SEQUENCE = ['A', 'B', 'C', 'D', 'E', 'F', ''];

// 最小間隔天數（用於A、B班）
export const MIN_INTERVAL_DAYS = 7;

// 分數閾值（用於選擇候選人時的誤差允許範圍）
export const SCORE_THRESHOLD = 0.3;

// 出勤率模擬（根據用戶ID % 4）
export const ATTENDANCE_RATES = [0.9, 0.95, 0.7, 0.85];

// 算法配置
export const ALGORITHM_CONFIG = {
  maxRetryAttempts: 10000,  // 保留給舊算法的兼容性
  enableIntervalCheck: true, // 是否啟用間隔檢查
  enableScoreBalancing: true // 是否啟用分數平衡
};