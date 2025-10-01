import { format, subDays, addDays } from 'date-fns';
import { 
  INVALID_SHIFT_COMBINATIONS, 
  SHIFT_NAMES, 
  statusColors,
  STATUS_DISPLAY_NAMES 
} from '../constants/shiftSwapConstants';

/**
 * 獲取狀態風格
 * @param {string} status - 狀態
 * @returns {object} 狀態樣式對象
 */
export const getStatusStyle = (status) => {
  return statusColors[status] || statusColors.default;
};

/**
 * 獲取狀態顯示名稱
 * @param {string} status - 狀態
 * @returns {string} 狀態顯示名稱
 */
export const getStatusDisplayName = (status) => {
  return STATUS_DISPLAY_NAMES[status] || status;
};

/**
 * 檢查請求是否過期
 * @param {object} request - 換班請求對象
 * @returns {boolean} 是否過期
 */
export const isRequestExpired = (request) => {
  if (!request || !request.from_date) return false;
  
  const requestDate = new Date(request.from_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // 設置今天的時間為00:00:00
  
  return requestDate < today;
};

/**
 * 獲取請求的顯示狀態 (包含過期判斷)
 * @param {object} request - 換班請求對象
 * @returns {string} 顯示狀態
 */
export const getRequestDisplayStatus = (request) => {
  if (request.status !== 'pending') {
    return request.status; // 如果不是待處理，返回原始狀態
  }
  
  // 如果是待處理，檢查是否過期
  if (isRequestExpired(request)) {
    return 'expired'; // 已過期
  }
  
  return 'pending'; // 未過期的待處理
};

/**
 * 檢查換班後的班表是否符合工時限制規則
 * @param {object} userSchedules - 用戶班表數據
 * @param {string} date - 日期
 * @param {string} newShift - 新班別
 * @param {string} userId - 用戶ID
 * @param {object} tempChanges - 臨時變更
 * @returns {object} 兼容性檢查結果
 */
export const checkShiftCompatibility = (userSchedules, date, newShift, userId, tempChanges = {}) => {
  if (!userSchedules || !date || !newShift || !userId) {
    return { valid: false, message: '無法檢查班表兼容性，資料不完整' };
  }

  const targetDate = new Date(date);
  const prevDay = subDays(targetDate, 1);
  const nextDay = addDays(targetDate, 1);
  
  const prevDateStr = format(prevDay, 'yyyy-MM-dd');
  const targetDateStr = format(targetDate, 'yyyy-MM-dd');
  const nextDateStr = format(nextDay, 'yyyy-MM-dd');
  
  // 考慮臨時變更中的班別（例如還未實際換班但需要預先計算的情況）
  const getTempOrActualShift = (dateStr, uid) => {
    // 檢查是否有臨時變更中的班別
    if (tempChanges[dateStr] && tempChanges[dateStr][uid]) {
      return tempChanges[dateStr][uid];
    }
    
    // 否則返回實際班表中的班別
    if (userSchedules[dateStr] && userSchedules[dateStr][uid]) {
      return userSchedules[dateStr][uid];
    }
    
    return null;
  };
  
  // 獲取前一天和後一天的班別，並考慮臨時變更
  let prevShift = getTempOrActualShift(prevDateStr, userId);
  let nextShift = getTempOrActualShift(nextDateStr, userId);
  
  // 獲取當前(待換班)日期的原班別
  let currentShift = getTempOrActualShift(targetDateStr, userId);
  
  console.log(`檢查班表兼容性:`, {
    用戶ID: userId,
    目標日期: targetDateStr,
    原班別: currentShift,
    新班別: newShift,
    前一天班別: prevShift,
    後一天班別: nextShift,
    已考慮臨時變更: Object.keys(tempChanges).length > 0
  });
  
  // 如果前一天是休假班"O"，則不需要檢查前一天的限制
  // 但需要檢查其他情況：即使當前是O班要換成其他班別，也要檢查與前一天的兼容性
  if (prevShift && prevShift !== 'O') {
    const prevCombination = `${prevShift}-${newShift}`;
    if (INVALID_SHIFT_COMBINATIONS[prevCombination] !== undefined) {
      const requiredHours = INVALID_SHIFT_COMBINATIONS[prevCombination];
      if (requiredHours === 0) {
        return { 
          valid: false, 
          message: `${SHIFT_NAMES[prevShift]}後不允許接${SHIFT_NAMES[newShift]}，這會違反工時限制規定` 
        };
      } else {
        return { 
          valid: false, 
          message: `${SHIFT_NAMES[prevShift]}後至少需要間隔${requiredHours}小時才能安排${SHIFT_NAMES[newShift]}` 
        };
      }
    }
  }
  
  // 如果後一天是休假班"O"，則不需要檢查後一天的限制
  // 但需要檢查其他情況：即使當前是O班要換成其他班別，也要檢查與後一天的兼容性
  if (nextShift && nextShift !== 'O') {
    const nextCombination = `${newShift}-${nextShift}`;
    if (INVALID_SHIFT_COMBINATIONS[nextCombination] !== undefined) {
      const requiredHours = INVALID_SHIFT_COMBINATIONS[nextCombination];
      if (requiredHours === 0) {
        return { 
          valid: false, 
          message: `${SHIFT_NAMES[newShift]}後不允許接${SHIFT_NAMES[nextShift]}，這會違反工時限制規定` 
        };
      } else {
        return { 
          valid: false, 
          message: `${SHIFT_NAMES[newShift]}後至少需要間隔${requiredHours}小時才能安排${SHIFT_NAMES[nextShift]}` 
        };
      }
    }
  }
  
  // 通過所有檢查，班表兼容
  return { valid: true, message: '' };
};

/**
 * 整理班表數據為便於檢查的格式
 * @param {object} monthlySchedules - 月度班表數據
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @param {string} userId - 用戶ID
 * @returns {object} 整理後的班表數據
 */
export const prepareShiftSchedule = (monthlySchedules, year, month, userId) => {
  if (!monthlySchedules || !year || !month || !userId) {
    console.error('無法準備班表數據，參數不完整');
    return {};
  }
  
  // 嘗試構造月份鍵名
  const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
  
  // 檢查是否有相應月份的數據
  if (!monthlySchedules[monthStr]) {
    console.warn(`沒有找到 ${monthStr} 的班表數據`);
    return {};
  }
  
  const scheduleData = monthlySchedules[monthStr];
  const userSchedules = {};
  
  try {
    // 嘗試從不同的數據結構中提取班表數據
    if (scheduleData && scheduleData.data && scheduleData.data[year] && scheduleData.data[year][month]) {
      const nurseSchedules = scheduleData.data[year][month].schedule || [];
      const userSchedule = nurseSchedules.find(nurse => String(nurse.id) === String(userId));
      
      if (userSchedule && Array.isArray(userSchedule.shifts)) {
        // 將班表數據轉換為以日期為鍵的對象
        const daysInMonth = new Date(year, month, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
          const shiftIndex = day - 1;
          if (shiftIndex < userSchedule.shifts.length) {
            const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            userSchedules[dateStr] = {};
            userSchedules[dateStr][userId] = userSchedule.shifts[shiftIndex] || 'O';
          }
        }
      } else {
        console.warn(`未找到用戶 ${userId} 的班表數據或格式不符合預期`);
      }
    } else {
      console.warn('班表數據結構不符合預期');
    }
  } catch (err) {
    console.error('處理班表數據時出錯:', err);
  }
  
  return userSchedules;
};

/**
 * 檢查用戶是否有資格接受換班申請
 * @param {object} request - 換班請求
 * @param {object} user - 當前用戶
 * @returns {object} 資格檢查結果
 */
export const checkSwapEligibility = (request, user) => {
  if (!request || !user) return { eligible: false, reason: '無法檢查資格' };
  
  // 檢查基本條件
  if (request.requestor_id === user.id) {
    return { eligible: false, reason: '不能接受自己的換班申請' };
  }
  
  if (request.status !== 'pending') {
    return { eligible: false, reason: '此申請已被處理' };
  }
  
  if (request.target_nurse_id && request.target_nurse_id !== user.id) {
    return { eligible: false, reason: '此申請已指定其他護理師接受' };
  }
  
  // 安全獲取用戶角色
  const userRole = user.role || '';
  // admin不能接受換班申請
  if (userRole === 'admin') {
    return { eligible: false, reason: '系統管理員不能接受換班申請' };
  }
  
  // 檢查班別相關條件
  const userIdentity = user.identity || '';
  const requestIdentity = request.requestor?.identity || '';
  
  // 如果是不同類型的護理師（麻醉專科與恢復室）
  if ((userIdentity.includes('恢復室') && requestIdentity.includes('麻醉')) || 
      (userIdentity.includes('麻醉') && requestIdentity.includes('恢復室'))) {
    return { eligible: false, reason: '不同類型的護理師無法互換班別' };
  }
  
  // 如果通過所有檢查
  return { eligible: true, reason: '' };
};

/**
 * 檢查是否可以刪除/取消換班請求
 * @param {object} request - 換班請求
 * @param {object} user - 當前用戶
 * @returns {boolean} 是否可以刪除
 */
export const canDeleteRequest = (request, user) => {
  if (!request || !user) return false;
  
  // 如果請求已過期，則不能刪除
  if (isRequestExpired(request) && request.status === 'pending') {
    return false;
  }
  
  // 以下人員可以操作換班請求:
  // 1. 換班申請人可以取消自己的請求
  // 2. 系統管理員可以駁回所有請求
  // 3. 護理長可以駁回所有請求

  const isAdmin = user.role === 'admin';
  const isLeader = user.identity === 'anesthesia_leader' || user.identity === '麻醉科Leader';
  const isHeadNurse = user.role === 'head_nurse';
  const isRequester = request.requestor_id === user.id;

  // 檢查權限
  if (isAdmin || isLeader || isHeadNurse) {
    return true; // 系統管理員、領導和護理長可以操作任何請求
  } else if (isRequester && request.status === 'pending') {
    return true; // 申請人可以取消待處理的請求
  }
  
  return false;
};

/**
 * 根據請求狀態和用戶角色獲取刪除按鈕文本
 * @param {object} request - 換班請求
 * @param {object} user - 當前用戶
 * @returns {string} 按鈕文本
 */
export const getDeleteButtonText = (request, user) => {
  if (!request || !user) return '刪除';
  
  const isAdmin = user.role === 'admin';
  const isLeader = user.identity === 'anesthesia_leader' || user.identity === '麻醉科Leader';
  const isHeadNurse = user.role === 'head_nurse';
  const isRequester = request.requestor_id === user.id;

  // 已接受的請求，系統管理員/護理長/領導可以駁回
  if (request.status === 'accepted' && (isAdmin || isLeader || isHeadNurse)) {
    return '駁回並恢復班表';
  }
  
  // 待處理的請求
  if (request.status === 'pending') {
    if (isRequester) {
      return '取消申請';
    } else if (isAdmin || isLeader || isHeadNurse) {
      return '駁回申請';
    }
  }
  
  return '刪除';
};

/**
 * 檢查是否有請求換班的權限
 * @param {object} user - 用戶對象
 * @returns {boolean} 是否有權限
 */
export const canRequestSwap = (user) => {
  if (!user) return false;
  
  // 獲取用戶身份，如果沒有則設為空字符串
  const identity = user.identity || '';
  
  // 任何護理師都可以創建換班
  return identity === '麻醉專科護理師' || 
         identity === 'anesthesia_specialist' ||
         identity === '恢復室護理師' || 
         identity === 'recovery_nurse';
}; 