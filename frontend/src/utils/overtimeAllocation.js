/**
 * 統一分數導向加班分配算法
 * 專門處理加班分配的核心邏輯
 */

import { parseISO } from 'date-fns';
import {
  SHIFT_SCORES,
  NO_OVERTIME_PENALTY,
  SHIFT_ALLOCATION_ORDER,
  MIN_INTERVAL_DAYS,
  SCORE_THRESHOLD,
  ATTENDANCE_RATES,
  ALGORITHM_CONFIG
} from '../constants/overtimeConstants';

/**
 * 日期工具函數
 */
export const dateUtils = {
  isSunday: (date) => {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;
    return parsedDate.getDay() === 0;
  },
  
  isSaturday: (date) => {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;
    return parsedDate.getDay() === 6;
  },
  
  isWeekend: (date) => {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;
    const day = parsedDate.getDay();
    return day === 0 || day === 6;
  },
  
  getDaysDifference: (date1, date2) => {
    const d1 = typeof date1 === 'string' ? parseISO(date1) : date1;
    const d2 = typeof date2 === 'string' ? parseISO(date2) : date2;
    return Math.abs((d1 - d2) / (1000 * 60 * 60 * 24));
  }
};

/**
 * 分數計算函數
 */
export const scoreUtils = {
  /**
   * 計算加班分數
   * @param {string} overtimeShift - 班別 (A, B, C, D, E, F)
   * @returns {number} 分數
   */
  calculateOvertimeScore: (overtimeShift) => {
    return SHIFT_SCORES[overtimeShift] || 0.0;
  },

  /**
   * 計算用戶基礎分數（白班負分）
   * @param {Object} user - 用戶對象
   * @param {number} workDays - 工作天數
   * @returns {number} 基礎分數
   */
  calculateUserBaseScore: (user, workDays) => {
    const userType = user.id % 4;
    const attendanceRate = ATTENDANCE_RATES[userType];
    const actualWhiteShifts = Math.floor(workDays * attendanceRate);
    return actualWhiteShifts * NO_OVERTIME_PENALTY;
  },

  /**
   * 計算分數統計
   * @param {Array} scores - 分數數組
   * @returns {Object} 統計結果
   */
  calculateScoreStatistics: (scores) => {
    if (!scores || scores.length === 0) {
      return {
        minScore: 0,
        maxScore: 0,
        avgScore: 0,
        scoreRange: 0,
        avgDeviationFromZero: 0,
        maxDeviationFromZero: 0
      };
    }

    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const scoreRange = maxScore - minScore;
    const deviations = scores.map(score => Math.abs(score));
    const avgDeviationFromZero = deviations.reduce((a, b) => a + b, 0) / deviations.length;
    const maxDeviationFromZero = Math.max(...deviations);

    return {
      minScore,
      maxScore,
      avgScore,
      scoreRange,
      avgDeviationFromZero,
      maxDeviationFromZero
    };
  }
};

/**
 * 人員選擇算法
 */
export class UserSelector {
  /**
   * 為指定班別選擇最適合的人員
   * @param {Array} availableUsers - 可用人員列表
   * @param {Object} userScores - 用戶分數對象
   * @param {string} shiftType - 班別類型
   * @param {string} date - 日期
   * @param {Object} allocations - 已分配記錄 {userId_date: shift}
   * @param {number} minIntervalDays - 最小間隔天數
   * @returns {Object|null} 選中的用戶
   */
  static selectBestUserForShift(availableUsers, userScores, shiftType, date, allocations, minIntervalDays = MIN_INTERVAL_DAYS) {
    if (!availableUsers || availableUsers.length === 0) {
      return null;
    }

    const shiftScore = scoreUtils.calculateOvertimeScore(shiftType);
    
    // 1. 按當前分數排序（分數越低越優先）
    const candidates = [...availableUsers].sort((a, b) => 
      userScores[a.id].currentScore - userScores[b.id].currentScore
    );

    // 2. 在分數相近的人中進行進一步篩選
    const lowestScore = userScores[candidates[0].id].currentScore;
    const closeScoreCandidates = candidates.filter(u => 
      userScores[u.id].currentScore <= lowestScore + SCORE_THRESHOLD
    );

    // 3. 對於重要班別（A、B），考慮間隔時間
    if ((shiftType === 'A' || shiftType === 'B') && closeScoreCandidates.length > 1) {
      return this._selectWithIntervalCheck(closeScoreCandidates, userScores, shiftType, date, allocations, minIntervalDays);
    }

    // 4. 對於其他班別或單一候選人，直接選擇分數最低的
    return candidates[0];
  }

  /**
   * 帶間隔檢查的選擇
   * @private
   */
  static _selectWithIntervalCheck(candidates, userScores, shiftType, date, allocations, minIntervalDays) {
    const intervalCandidates = [];

    for (const user of candidates) {
      // 找出該用戶該班別的所有日期
      const userShiftDates = [];
      Object.entries(allocations).forEach(([key, shift]) => {
        const [userId, shiftDate] = key.split('_');
        if (parseInt(userId) === user.id && shift === shiftType) {
          userShiftDates.push(new Date(shiftDate));
        }
      });

      if (userShiftDates.length === 0) {
        // 沒有該班別，優先級最高
        intervalCandidates.push({ user, interval: 999 });
      } else {
        // 計算與最近日期的間隔
        const currentDate = new Date(date);
        const minInterval = Math.min(...userShiftDates.map(shiftDate => 
          dateUtils.getDaysDifference(currentDate, shiftDate)
        ));
        intervalCandidates.push({ user, interval: minInterval });
      }
    }

    // 選擇間隔最大的人（但至少要滿足最小間隔要求）
    const validCandidates = intervalCandidates.filter(item => 
      item.interval >= minIntervalDays || item.interval === 999
    );

    if (validCandidates.length > 0) {
      // 有滿足間隔要求的候選人，選擇間隔最大的
      validCandidates.sort((a, b) => b.interval - a.interval);
      return validCandidates[0].user;
    } else {
      // 沒有滿足間隔要求的候選人，選擇間隔最大的（即使不滿足要求）
      intervalCandidates.sort((a, b) => b.interval - a.interval);
      return intervalCandidates[0].user;
    }
  }
}

/**
 * 統一分數導向分配算法核心類
 */
export class UnifiedScoreAllocation {
  constructor(logger = console) {
    this.logger = logger;
  }

  /**
   * 執行統一分數導向分配
   * @param {Object} overtimeData - 加班數據 {date: {staffList: []}}
   * @param {Object} options - 選項
   * @returns {Object} 分配結果 {dateKey: {userId: shift}}
   */
  allocate(overtimeData, options = {}) {
    const { preserveExisting = false, existingMarkings = {} } = options;

    if (!overtimeData || Object.keys(overtimeData).length === 0) {
      throw new Error('沒有足夠的排班資料來生成加班人選');
    }

    this.logger.info('開始統一分數導向分配...');
    
    const newAllocations = {}; // {userId_date: shift}
    const workDays = Object.keys(overtimeData).filter(dateKey => 
      !dateUtils.isSunday(dateKey)
    ).length;

    // 初始化用戶分數
    const { userScores, allUsers } = this._initializeUserScores(overtimeData, workDays, preserveExisting, existingMarkings, newAllocations);

    this.logger.info(`總共${allUsers.length}人參與分配`);

    // 執行分配
    this._performAllocation(overtimeData, userScores, newAllocations, preserveExisting);

    // 轉換為前端需要的格式
    const newMarkings = this._convertToMarkingsFormat(newAllocations);

    // 分析結果
    this._analyzeResults(userScores);

    return newMarkings;
  }

  /**
   * 初始化用戶分數
   * @private
   */
  _initializeUserScores(overtimeData, workDays, preserveExisting, existingMarkings, newAllocations) {
    const userScores = {};
    const allUsers = [];
    
    // 收集所有用戶
    Object.values(overtimeData).forEach(dayData => {
      dayData.staffList.forEach(staff => {
        if (staff.identity !== '麻醉科Leader' && !allUsers.find(u => u.id === staff.id)) {
          allUsers.push(staff);
        }
      });
    });

    // 如果保留現有分配，先處理現有標記
    if (preserveExisting && existingMarkings) {
      Object.entries(existingMarkings).forEach(([dateKey, staffMarks]) => {
        Object.entries(staffMarks).forEach(([userId, shift]) => {
          newAllocations[`${userId}_${dateKey}`] = shift;
        });
      });
    }

    // 初始化分數
    allUsers.forEach(user => {
      const baseScore = scoreUtils.calculateUserBaseScore(user, workDays);
      userScores[user.id] = {
        user: user,
        baseScore: baseScore,
        currentScore: baseScore,
        allocations: []
      };

      // 如果保留現有分配，加入現有分配的分數
      if (preserveExisting) {
        Object.entries(newAllocations).forEach(([key, shift]) => {
          const [userId, dateKey] = key.split('_');
          if (parseInt(userId) === user.id) {
            const shiftScore = scoreUtils.calculateOvertimeScore(shift);
            userScores[user.id].currentScore += shiftScore;
            userScores[user.id].allocations.push({ date: dateKey, shift: shift });
          }
        });
      }
    });

    return { userScores, allUsers };
  }

  /**
   * 執行分配邏輯
   * @private
   */
  _performAllocation(overtimeData, userScores, newAllocations, preserveExisting) {
    // === 階段1：平日分配（A, B, C, D, E, F各一人）===
    const weekdays = Object.keys(overtimeData)
      .filter(dateKey => !dateUtils.isSunday(dateKey) && !dateUtils.isSaturday(dateKey))
      .sort();

    this._allocateWeekdays(weekdays, overtimeData, userScores, newAllocations, preserveExisting);

    // === 階段2：週六分配（僅A班）===
    const saturdays = Object.keys(overtimeData)
      .filter(dateKey => dateUtils.isSaturday(dateKey))
      .sort();

    this._allocateSaturdays(saturdays, overtimeData, userScores, newAllocations, preserveExisting);
  }

  /**
   * 分配平日班別
   * @private
   */
  _allocateWeekdays(weekdays, overtimeData, userScores, newAllocations, preserveExisting) {
    weekdays.forEach(dateKey => {
      const dayData = overtimeData[dateKey];
      const availableStaff = dayData.staffList.filter(staff => 
        staff.identity !== '麻醉科Leader'
      );

      this.logger.debug(`${dateKey} 班別分配：`);

      const shiftsToAllocate = preserveExisting ? 
        this._getMissingShifts(dateKey, newAllocations) : 
        SHIFT_ALLOCATION_ORDER;

      shiftsToAllocate.forEach(shiftType => {
        // 找出當天還沒分配班別的人員
        const availableUsers = availableStaff.filter(staff => 
          !newAllocations[`${staff.id}_${dateKey}`]
        );

        if (availableUsers.length === 0) {
          this.logger.debug(`  ${shiftType}班：無可用人員`);
          return;
        }

        // 使用統一的選擇邏輯
        const selectedUser = UserSelector.selectBestUserForShift(
          availableUsers, userScores, shiftType, dateKey, newAllocations
        );

        if (selectedUser) {
          this._assignShift(selectedUser, shiftType, dateKey, userScores, newAllocations);
        }
      });
    });
  }

  /**
   * 分配週六班別
   * @private
   */
  _allocateSaturdays(saturdays, overtimeData, userScores, newAllocations, preserveExisting) {
    saturdays.forEach(dateKey => {
      // 如果保留現有分配且已有A班分配，跳過
      if (preserveExisting && this._hasShiftAssigned(dateKey, 'A', newAllocations)) {
        return;
      }

      const dayData = overtimeData[dateKey];
      const availableUsers = dayData.staffList.filter(staff => 
        staff.identity !== '麻醉科Leader'
      );

      this.logger.debug(`${dateKey} (週六) A班分配：`);

      const selectedUser = UserSelector.selectBestUserForShift(
        availableUsers, userScores, 'A', dateKey, newAllocations
      );

      if (selectedUser) {
        this._assignShift(selectedUser, 'A', dateKey, userScores, newAllocations);
      }
    });
  }

  /**
   * 分配班別給用戶
   * @private
   */
  _assignShift(user, shiftType, dateKey, userScores, newAllocations) {
    // 分配班別
    newAllocations[`${user.id}_${dateKey}`] = shiftType;

    // 更新分數
    const shiftScore = scoreUtils.calculateOvertimeScore(shiftType);
    userScores[user.id].currentScore += shiftScore;
    userScores[user.id].allocations.push({ date: dateKey, shift: shiftType });

    this.logger.debug(`  ${shiftType}班 → ${user.name} (+${shiftScore}分, 總分: ${userScores[user.id].currentScore.toFixed(2)})`);
  }

  /**
   * 獲取缺少的班別
   * @private
   */
  _getMissingShifts(dateKey, newAllocations) {
    const assignedShifts = new Set();
    Object.entries(newAllocations).forEach(([key, shift]) => {
      const [userId, allocDateKey] = key.split('_');
      if (allocDateKey === dateKey) {
        assignedShifts.add(shift);
      }
    });

    return SHIFT_ALLOCATION_ORDER.filter(shift => !assignedShifts.has(shift));
  }

  /**
   * 檢查是否已分配指定班別
   * @private
   */
  _hasShiftAssigned(dateKey, shiftType, newAllocations) {
    return Object.keys(newAllocations).some(key => {
      const [userId, allocDateKey] = key.split('_');
      return allocDateKey === dateKey && newAllocations[key] === shiftType;
    });
  }

  /**
   * 轉換為前端標記格式
   * @private
   */
  _convertToMarkingsFormat(newAllocations) {
    const newMarkings = {};
    Object.entries(newAllocations).forEach(([key, shift]) => {
      const [userId, dateKey] = key.split('_');
      if (!newMarkings[dateKey]) {
        newMarkings[dateKey] = {};
      }
      newMarkings[dateKey][parseInt(userId)] = shift;
    });
    return newMarkings;
  }

  /**
   * 分析結果
   * @private
   */
  _analyzeResults(userScores) {
    const scores = Object.values(userScores).map(data => data.currentScore);
    const stats = scoreUtils.calculateScoreStatistics(scores);

    this.logger.info('統一分數導向分配完成：');
    this.logger.info(`分數範圍：${stats.scoreRange.toFixed(2)}分 (${stats.minScore.toFixed(2)} 到 ${stats.maxScore.toFixed(2)})`);
    this.logger.info(`平均偏離零分：${stats.avgDeviationFromZero.toFixed(2)}分`);

    return stats;
  }
}

/**
 * 便利函數：創建分配器實例
 * @param {Object} logger - 日誌記錄器
 * @returns {UnifiedScoreAllocation} 分配器實例
 */
export function createAllocator(logger = console) {
  return new UnifiedScoreAllocation(logger);
}

/**
 * 便利函數：執行完整分配
 * @param {Object} overtimeData - 加班數據
 * @param {Object} logger - 日誌記錄器
 * @returns {Object} 分配結果
 */
export function allocateFullOvertime(overtimeData, logger = console) {
  const allocator = createAllocator(logger);
  return allocator.allocate(overtimeData, { preserveExisting: false });
}

/**
 * 便利函數：執行部分分配（保留現有）
 * @param {Object} overtimeData - 加班數據
 * @param {Object} existingMarkings - 現有標記
 * @param {Object} logger - 日誌記錄器
 * @returns {Object} 分配結果
 */
export function allocatePartialOvertime(overtimeData, existingMarkings, logger = console) {
  const allocator = createAllocator(logger);
  return allocator.allocate(overtimeData, { 
    preserveExisting: true, 
    existingMarkings 
  });
}