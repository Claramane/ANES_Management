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
   * 為指定班別選擇最適合的人員 (舊版API，保留相容性)
   * 注意：新算法使用輪次分配，此方法僅供向後相容
   * @deprecated 使用新的輪次分配算法
   */
  static selectBestUserForShift(availableUsers, userScores, shiftType, date, allocations, minIntervalDays = MIN_INTERVAL_DAYS) {
    if (!availableUsers || availableUsers.length === 0) {
      return null;
    }
    
    // 簡單的分數最低優先邏輯，保持向後相容
    const candidates = [...availableUsers].sort((a, b) => 
      userScores[a.id].currentScore - userScores[b.id].currentScore
    );

    return candidates[0];
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
   * 執行分配邏輯 - 使用輪次分配確保公平性
   * @private
   */
  _performAllocation(overtimeData, userScores, newAllocations, preserveExisting) {
    // 收集所有需要分配的日期和班別
    const allShiftDemands = this._collectShiftDemands(overtimeData, newAllocations, preserveExisting);
    
    // 按班別重要性順序進行輪次分配
    const shiftOrder = ['A', 'B', 'C', 'D', 'E', 'F'];
    
    for (const shiftType of shiftOrder) {
      this._allocateShiftInRounds(shiftType, allShiftDemands, userScores, newAllocations, overtimeData);
    }
  }

  /**
   * 收集所有班別需求
   * @private
   */
  _collectShiftDemands(overtimeData, newAllocations, preserveExisting) {
    const demands = { A: [], B: [], C: [], D: [], E: [], F: [] };
    
    Object.keys(overtimeData).forEach(dateKey => {
      const dayData = overtimeData[dateKey];
      const isWeekend = dateUtils.isWeekend(dateKey);
      const isSunday = dateUtils.isSunday(dateKey);
      
      // 週日不需要加班
      if (isSunday) return;
      
      // 週六只需要A班
      if (dateUtils.isSaturday(dateKey)) {
        // 檢查是否已經分配A班
        if (!preserveExisting || !this._hasShiftAssigned(dateKey, 'A', newAllocations)) {
          demands.A.push({ 
            date: dateKey, 
            availableUsers: dayData.staffList.filter(staff => staff.identity !== '麻醉科Leader')
          });
        }
        return;
      }
      
      // 平日需要A-F班
      SHIFT_ALLOCATION_ORDER.forEach(shiftType => {
        if (!preserveExisting || !this._hasShiftAssigned(dateKey, shiftType, newAllocations)) {
          demands[shiftType].push({ 
            date: dateKey, 
            availableUsers: dayData.staffList.filter(staff => {
              // 麻醉科Leader只能分配E或F班
              if (staff.identity === '麻醉科Leader') {
                return shiftType === 'E' || shiftType === 'F';
              }
              return true;
            })
          });
        }
      });
    });
    
    this.logger.info(`班別需求統計: A=${demands.A.length}, B=${demands.B.length}, C=${demands.C.length}, D=${demands.D.length}, E=${demands.E.length}, F=${demands.F.length}`);
    return demands;
  }

  /**
   * 輪次分配指定班別
   * @private
   */
  _allocateShiftInRounds(shiftType, allShiftDemands, userScores, newAllocations, overtimeData) {
    const demands = allShiftDemands[shiftType];
    if (!demands || demands.length === 0) {
      this.logger.debug(`${shiftType}班：無需求`);
      return;
    }

    this.logger.info(`開始分配${shiftType}班，共${demands.length}個需求`);
    
    // 收集所有參與該班別分配的護理師
    const allEligibleUsers = new Map();
    demands.forEach(demand => {
      demand.availableUsers.forEach(user => {
        allEligibleUsers.set(user.id, user);
      });
    });
    
    const eligibleUsersList = Array.from(allEligibleUsers.values());
    this.logger.debug(`${shiftType}班可分配護理師: ${eligibleUsersList.map(u => u.name).join(', ')}`);
    
    // 輪次分配
    let round = 1;
    const remainingDemands = [...demands];
    
    while (remainingDemands.length > 0) {
      this.logger.debug(`${shiftType}班第${round}輪分配，剩餘需求: ${remainingDemands.length}`);
      
      // 獲取符合條件的候選人（分數 <= 0 或者是第一輪）
      const availableCandidates = eligibleUsersList.filter(user => {
        const currentScore = userScores[user.id].currentScore;
        const shiftScore = scoreUtils.calculateOvertimeScore(shiftType);
        const potentialScore = currentScore + shiftScore;
        
        // 第一輪或者分配後不會超過0分
        return round === 1 || potentialScore <= 0;
      });
      
      if (availableCandidates.length === 0) {
        this.logger.warn(`${shiftType}班第${round}輪：沒有符合條件的候選人，剩餘${remainingDemands.length}個需求未分配`);
        break;
      }
      
      // 按當前分數排序（分數越低越優先）
      availableCandidates.sort((a, b) => 
        userScores[a.id].currentScore - userScores[b.id].currentScore
      );
      
      // 分配給分數最低的護理師們
      const assignmentsThisRound = [];
      let candidateIndex = 0;
      
      for (let i = 0; i < remainingDemands.length && candidateIndex < availableCandidates.length; i++) {
        const demand = remainingDemands[i];
        const candidate = availableCandidates[candidateIndex];
        
        // 檢查該候選人是否可以在該日期分配
        const isAvailableForThisDate = demand.availableUsers.some(u => u.id === candidate.id);
        const isAlreadyAssignedOnThisDate = newAllocations[`${candidate.id}_${demand.date}`];
        
        if (isAvailableForThisDate && !isAlreadyAssignedOnThisDate) {
          // 檢查間隔（僅對A班和B班）
          const intervalOk = (shiftType !== 'A' && shiftType !== 'B') || this._checkInterval(candidate, shiftType, demand.date, newAllocations);
          
          if (intervalOk) {
            assignmentsThisRound.push({ demand, candidate, index: i });
            candidateIndex++;
          }
        }
        
        // 如果當前候選人不適合，嘗試下一個候選人
        if (assignmentsThisRound.length <= i) {
          candidateIndex++;
          i--; // 重試當前需求
        }
      }
      
      // 執行本輪分配
      if (assignmentsThisRound.length === 0) {
        this.logger.warn(`${shiftType}班第${round}輪：無法完成任何分配`);
        break;
      }
      
      // 按索引從大到小移除已分配的需求（避免索引錯位）
      assignmentsThisRound.sort((a, b) => b.index - a.index);
      
      assignmentsThisRound.forEach(({ demand, candidate, index }) => {
        this._assignShift(candidate, shiftType, demand.date, userScores, newAllocations);
        remainingDemands.splice(index, 1);
      });
      
      this.logger.debug(`${shiftType}班第${round}輪完成${assignmentsThisRound.length}個分配`);
      round++;
    }
    
    if (remainingDemands.length > 0) {
      this.logger.warn(`${shiftType}班分配完成，但仍有${remainingDemands.length}個需求未分配`);
    } else {
      this.logger.success(`${shiftType}班分配完成，所有需求已滿足`);
    }
  }

  /**
   * 檢查間隔時間是否滿足要求
   * @private
   */
  _checkInterval(user, shiftType, currentDate, allocations) {
    const userShiftDates = [];
    Object.entries(allocations).forEach(([key, shift]) => {
      const [userId, shiftDate] = key.split('_');
      if (parseInt(userId) === user.id && shift === shiftType) {
        userShiftDates.push(new Date(shiftDate));
      }
    });

    if (userShiftDates.length === 0) {
      return true; // 沒有該班別記錄，可以分配
    }

    const currentDateObj = new Date(currentDate);
    const minInterval = Math.min(...userShiftDates.map(shiftDate => 
      dateUtils.getDaysDifference(currentDateObj, shiftDate)
    ));

    return minInterval >= MIN_INTERVAL_DAYS;
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