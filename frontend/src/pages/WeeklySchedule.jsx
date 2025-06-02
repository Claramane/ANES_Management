import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Alert,
  CircularProgress,
  styled,
  ButtonGroup,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Chip,
  Badge,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { zhTW } from 'date-fns/locale';
import { useScheduleStore } from '../store/scheduleStore';
import { useUserStore } from '../store/userStore';
import { useAuthStore } from '../store/authStore';
import { format, getDaysInMonth, getDay, isValid, addDays, startOfMonth } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import apiService from '../utils/api';
import { cachedScheduleDetailsRequest } from '../utils/scheduleCache';

// 班次顏色設定
const ShiftCell = styled(TableCell)(({ shift }) => {
  const colors = { 
    'D': '#c5b5ac', // 白班 22-08
    'A': '#c6c05f', // 小夜班 8-16
    'N': '#aa77c4', // 大夜班 14-22
    'K': '#8AA6C1', // 早班 9-17
    'C': '#a9d0ab', // 中班 10-18
    'F': '#d8bd89', // 晚班 12-20
    'E': '#cb9cc8', // 半班 8-12
    'B': '#e7b284', // 日班 8-17
    'O': '#e7e7e7', // 排休 OFF
    'V': '#e0755f',  // 休假 OFF
    'R': '#a9c4ce'  // 靜養假 OFF
  };
  
  return {
    backgroundColor: colors[shift] || 'inherit',
    color: 'black',
    cursor: 'pointer',
    padding: '0px 0px',
    height: '22px',
    maxHeight: '22px',
    minHeight: '22px', // 確保最小高度固定
    lineHeight: '1',
    textAlign: 'center',
    fontWeight: 'normal',
    fontSize: '0.85rem',
    border: '1px solid #ddd',
    whiteSpace: 'nowrap', // 防止內容換行
    overflow: 'hidden', // 超出部分隱藏
    textOverflow: 'ellipsis', // 顯示省略號
    '& .MuiBox-root': {
      margin: 0,
      padding: 0,
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      whiteSpace: 'nowrap', // 子元素也不換行
      overflow: 'hidden', // 子元素超出部分隱藏
    },
    ...(shift === 'O' || shift === 'V' ? { border: '1px solid #ddd' } : {})
  };
});

// 確保日期有效性的工具函數
const ensureValidDate = (date) => {
  if (date && date instanceof Date && !isNaN(date.getTime())) {
    return date;
  }
  console.warn('發現無效日期，使用當前日期替代:', date);
  return new Date();
};

const WeeklySchedule = () => {
  const { 
    monthlySchedule, 
    isLoading, 
    error, 
    selectedDate: storeSelectedDate, 
    updateSelectedDate,
    fetchMonthlySchedule,
    updateShift
  } = useScheduleStore();

  const { nurseUsers, fetchUsers } = useUserStore();
  const { user } = useAuthStore();
  
  const [currentWeek, setCurrentWeek] = useState(1);
  const [success, setSuccess] = useState(null);
  const [localError, setLocalError] = useState(null);
  const [showShiftTime, setShowShiftTime] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [missionValues, setMissionValues] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  
  // 添加臨時日期狀態
  const [tempDate, setTempDate] = useState(null);
  
  // 檢查是否有編輯權限
  const hasEditPermission = user?.role === 'head_nurse' || user?.role === 'admin';
  
  // 確保選擇的日期是有效的
  const selectedDate = useMemo(() => {
    console.log('WeeklySchedule - storeSelectedDate:', storeSelectedDate,
               'instanceof Date:', storeSelectedDate instanceof Date);
    try {
      return ensureValidDate(storeSelectedDate);
    } catch (err) {
      console.error('處理日期時出錯:', err);
      return new Date();
    }
  }, [storeSelectedDate]);

  // 獲取當前選擇月份的天數
  const daysInMonth = useMemo(() => {
    try {
      return getDaysInMonth(selectedDate);
    } catch (err) {
      console.error('獲取月份天數失敗:', err);
      return 30; // 默認返回30天
    }
  }, [selectedDate]);

  // 获取月份第一天是星期几（1-7，周一到周日）
  const firstDayOfMonth = useMemo(() => {
    try {
      const day = getDay(startOfMonth(selectedDate));
      return day === 0 ? 7 : day; // 將週日(0)轉換為7，以便於計算
    } catch (err) {
      console.error('獲取月份第一天星期失敗:', err);
      return 1;
    }
  }, [selectedDate]);

  // 計算月份有幾週
  const weeksInMonth = useMemo(() => {
    return Math.ceil((daysInMonth + firstDayOfMonth - 1) / 7);
  }, [daysInMonth, firstDayOfMonth]);

  // 獲取當前月份格式化字符串
  const formattedDate = useMemo(() => {
    try {
      if (!isValid(selectedDate)) return '無效日期';
      return format(selectedDate, 'yyyy年MM月');
    } catch (err) {
      console.error('格式化日期失敗:', err);
      return '無效日期';
    }
  }, [selectedDate]);

  // 獲取星期幾名稱
  const getDayName = (day) => {
    const dayNames = ['一', '二', '三', '四', '五', '六', '日'];
    return dayNames[day] || '?';
  };

  // 週表数据
  const weeklySchedule = useMemo(() => {
    if (!monthlySchedule.length) return [];

    // 複製一份避免直接修改原數據
    let sorted = [...monthlySchedule];
    
    // 從userStore獲取用戶排序信息
    const userStore = useUserStore.getState();
    
    // 準備數據：給每個護理師添加完整的用戶信息
    sorted = sorted.map(nurse => {
      // 從nurseUsers中查找相同ID的用戶數據
      const userInfo = nurseUsers.find(user => user.id === nurse.id);
      if (userInfo) {
        // 合併用戶數據，優先使用排班中已有的值
        return {
          ...userInfo,  // 先添加用戶完整信息（含hire_date, username等）
          ...nurse,     // 再添加排班信息（覆蓋共有的字段）
        };
      }
      return nurse;
    });
    
    // 按身份分組
    const nursesByIdentity = {};
    const unknownIdentity = [];
    
    // 將護理師按身份分組
    sorted.forEach(nurse => {
      if (nurse.identity) {
        if (!nursesByIdentity[nurse.identity]) {
          nursesByIdentity[nurse.identity] = [];
        }
        nursesByIdentity[nurse.identity].push({...nurse}); // 使用展開運算符創建新對象
      } else {
        unknownIdentity.push({...nurse}); // 使用展開運算符創建新對象
      }
    });
    
    // 身份排序權重
    const getIdentityWeight = (identity) => {
      const weights = {
        '護理長': 1,
        '麻醉科Leader': 2,
        '麻醉專科護理師': 3,
        '恢復室護理師': 4,
        '麻醉科書記': 5,
        'admin': 6
      };
      return weights[identity] || 999;
    };
    
    // 角色排序權重
    const getRoleWeight = (role) => {
      const weights = {
        'leader': 1,
        'supervise_nurse': 2,
        'nurse': 3,
        'head_nurse': 1, // 護理長通常用identity區分，但為了完整性也給一個權重
        'admin': 4
      };
      return weights[role] || 999;
    };
    
    // 護理師排序函數 - 結合多層級排序規則
    const sortNurses = (a, b) => {
      // 1. 首先按照身份(identity)排序
      const weightA = getIdentityWeight(a.identity);
      const weightB = getIdentityWeight(b.identity);
      
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      
      // 2. 相同身份下，按照角色(role)排序
      const roleWeightA = getRoleWeight(a.role);
      const roleWeightB = getRoleWeight(b.role);
      
      if (roleWeightA !== roleWeightB) {
        return roleWeightA - roleWeightB;
      }
      
      // 3. 相同角色下，按照入職日期排序（越早越前面）
      if (a.hire_date && b.hire_date) {
        const dateA = new Date(a.hire_date);
        const dateB = new Date(b.hire_date);
        
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA - dateB;
        }
      } else if (a.hire_date) {
        return -1; // a有日期，b沒有，a排前面
      } else if (b.hire_date) {
        return 1;  // b有日期，a沒有，b排前面
      }
      
      // 4. 相同入職日期下，按照員工編號排序（越小越前面）
      if (a.username && b.username) {
        const numA = parseInt(a.username, 10);
        const numB = parseInt(b.username, 10);
        
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        
        // 如果不能轉為數字，就按字串比較
        return String(a.username).localeCompare(String(b.username));
      }
      
      // 5. 默認按姓名排序
      return (a.name || '').localeCompare(b.name || '');
    };
    
    // 對每個身份組的護理師進行排序
    Object.keys(nursesByIdentity).forEach(identity => {
      // 直接使用sortNurses函數排序，不再使用userOrder
      nursesByIdentity[identity].sort(sortNurses);
    });
    
    // 按身份權重合併所有組
    const sortedNurses = [];
    
    // 獲取排序後的身份列表
    const sortedIdentities = Object.keys(nursesByIdentity).sort(
      (a, b) => getIdentityWeight(a) - getIdentityWeight(b)
    );
    
    // 按順序添加各身份的護理師
    sortedIdentities.forEach(identity => {
      sortedNurses.push(...nursesByIdentity[identity]);
    });
    
    // 添加未知身份的護理師（按照相同的排序規則排序後添加）
    unknownIdentity.sort(sortNurses);
    sortedNurses.push(...unknownIdentity);
    
    console.log('週班表護理師排序後:', sortedNurses.map(n => `${n.full_name || n.name || '未知'}(id:${n.id},role:${n.role})`));

    const weeks = [];
    for (let week = 0; week < weeksInMonth; week++) {
      const weekSchedule = sortedNurses.map(nurse => {
        const startIndex = week * 7 - (firstDayOfMonth - 1);
        const endIndex = startIndex + 7;
        const weekShifts = nurse.shifts ? nurse.shifts.slice(Math.max(0, startIndex), endIndex) : [];
        
        // 從 nurse 中獲取 area_codes，如果沒有則創建空數組
        const weekAreaCodes = nurse.area_codes 
          ? nurse.area_codes.slice(Math.max(0, startIndex), endIndex) 
          : Array(weekShifts.length).fill(null);
        
        const weekMissions = nurse.missions 
          ? nurse.missions.slice(Math.max(0, startIndex), endIndex) 
          : Array(weekShifts.length).fill(null);

        // 如果不足7天，补充空白
        while (weekShifts.length < 7) {
          if (week === 0) {
            weekShifts.unshift('');
            weekMissions.unshift(null);
            weekAreaCodes.unshift(null);
          } else {
            weekShifts.push('');
            weekMissions.push(null);
            weekAreaCodes.push(null);
          }
        }
        
        return {
          id: nurse.id,
          name: nurse.name,
          identity: nurse.identity,
          role: nurse.role,
          shifts: weekShifts,
          missions: weekMissions,
          area_codes: weekAreaCodes
        };
      });
      weeks.push(weekSchedule);
    }
    
    return weeks;
  }, [monthlySchedule, weeksInMonth, firstDayOfMonth]);

  // 當前週的排班表
  const currentWeekSchedule = useMemo(() => {
    return weeklySchedule[currentWeek - 1] || [];
  }, [weeklySchedule, currentWeek]);

  // 獲得本週的日期
  const getDateOfWeek = (weekIndex, day) => {
    const date = weekIndex * 7 + day - (firstDayOfMonth - 1);
    if (date < 1 || date > daysInMonth) return '';
    return date;
  };

  // 班次時間轉換
  const convertShiftToTime = (shift) => {
    const shiftTimes = {
      'A': '8-16',
      'B': '8-17',
      'N': '14-22',
      'D': '22-08',
      'E': '8-12',
      'K': '9-17',
      'C': '10-18',
      'F': '12-20',
      'O': 'OFF',
      'V': 'OFF',
      'R': 'REPO'
    };
    return shiftTimes[shift] || shift;
  };

  // 切換班次顯示形式
  const toggleShiftDisplay = () => {
    setShowShiftTime(!showShiftTime);
  };

  // 切換編輯模式
  const toggleEditMode = () => {
    if (editMode) {
      // 編輯模式關閉時保存更改
      // 先清除選取狀態和暫存的任務值，確保藍色選取框消失
      const valuesToSave = { ...missionValues };
      setMissionValues({});
      // 然後再保存更改
      saveWorkAssignments();
    }
    setEditMode(!editMode);
  };

  // 重置工作分配
  const resetWorkAssignments = async () => {
    if (!window.confirm('確定要重置所有工作分配嗎？此操作無法撤銷。')) {
      return;
    }
    
    try {
      setIsSaving(true);

      // 取得當前年月
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;
      
      // 使用新的批量重置API
      const response = await apiService.schedule.resetAreaCodes(year, month);
      
      if (!response.data.success) {
        throw new Error(response.data.message || "重置工作分配失敗");
      }
      
      // 重置本地狀態
      setMissionValues({});
      
      // 在本地立即更新area_codes，將所有護理師的area_codes設為null
      const updatedSchedule = [...monthlySchedule];
      
      // 更新本地數據，將所有area_codes重置為null
      updatedSchedule.forEach(nurse => {
        nurse.area_codes = Array(31).fill(null);
      });
      
      // 更新store中的數據
      useScheduleStore.setState({ monthlySchedule: updatedSchedule });
      
      setIsSaving(false);
      setSuccess(`成功重置 ${response.data.reset_count} 個工作分配`);
      
      // 不需要重新獲取數據，因為我們已經在上面更新了本地數據
      // await fetchMonthlySchedule();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setIsSaving(false);
      console.error('重置工作分配失敗:', err);
      
      // 避免直接渲染錯誤對象，而是顯示錯誤信息字串
      let errorMessage = '重置工作分配失敗，請稍後重試';
      
      if (typeof err === 'string') {
        errorMessage = err;
      } else if (err && typeof err.message === 'string') {
        errorMessage = err.message;
      } else if (err && err.data && typeof err.data.message === 'string') {
        errorMessage = err.data.message;
      }
      
      setLocalError(errorMessage);
      setTimeout(() => setLocalError(null), 5000);
    }
  };

  // 保存工作分配更改
  const saveWorkAssignments = async () => {
    try {
      setIsSaving(true);

      // 取得當前年月
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;
      
      // 獲取排班詳細數據（使用緩存）
      const result = await cachedScheduleDetailsRequest(apiService, 'weekly-schedule', year, month);
      if (!result.data?.success) {
        throw new Error("無法獲取排班詳細數據");
      }
      
      if (result.fromCache) {
        console.log('saveWorkAssignments: 使用緩存數據');
      }
      
      // 排班資料 ID 映射表
      const scheduleMapping = {};
      
      // 建立映射: { "用戶ID-日期": scheduleId }
      const details = result.data.data || [];
      details.forEach(item => {
        const dateObj = new Date(item.date);
        const day = dateObj.getDate();
        const key = `${item.user_id}-${day}`;
        scheduleMapping[key] = item.id;
      });
      
      // 準備批量更新數據
      const bulkUpdates = [];
      
      // 找出所有需要更新的工作分配
      for (const [key, mission] of Object.entries(missionValues)) {
        // 解析鍵值 `${nurseId}-${currentWeek}-${dayIndex}`
        const [nurseId, weekNum, dayIndex] = key.split('-');
        if (!nurseId || !weekNum || dayIndex === undefined) continue;
        
        // 計算實際日期
        const dayOfMonth = parseInt(getDateOfWeek(parseInt(weekNum) - 1, parseInt(dayIndex) + 1));
        if (!dayOfMonth) continue;
        
        // 格式化日期字符串
        const dateString = `${year}-${month < 10 ? '0' + month : month}-${dayOfMonth < 10 ? '0' + dayOfMonth : dayOfMonth}`;
        
        // 添加到批量更新列表
        bulkUpdates.push({
          user_id: parseInt(nurseId),
          date: dateString,
          area_code: mission === null ? null : mission.toString(),
          year: year,  // 添加年份參數
          month: month  // 添加月份參數
        });
      }
      
      // 執行批量更新
      if (bulkUpdates.length > 0) {
        const response = await apiService.schedule.bulkUpdateAreaCodes(bulkUpdates);
        if (!response.data.success) {
          throw new Error(response.data.message || "批量更新工作分配失敗");
        }
        
        // 在本地立即更新area_codes，無需等待重新獲取數據
        const updatedSchedule = [...monthlySchedule];
        
        // 更新本地數據
        for (const update of bulkUpdates) {
          const nurseId = update.user_id;
          const dateObj = new Date(update.date);
          const day = dateObj.getDate() - 1; // 轉為0-based索引
          
          const nurseIndex = updatedSchedule.findIndex(nurse => nurse.id === nurseId);
          if (nurseIndex >= 0) {
            if (!updatedSchedule[nurseIndex].area_codes) {
              updatedSchedule[nurseIndex].area_codes = Array(31).fill(null);
            }
            
            if (day >= 0 && day < 31) {
              updatedSchedule[nurseIndex].area_codes[day] = update.area_code;
            }
          }
        }
        
        // 更新store中的數據
        useScheduleStore.setState({ monthlySchedule: updatedSchedule });
        
        // 保存成功後，清除所有相關頁面的快取，確保其他使用者能看到最新資料
        console.log('保存成功，清除相關頁面快取');
        const { clearScheduleCache } = await import('../utils/scheduleCache');
        clearScheduleCache('dashboard', year, month);
        clearScheduleCache('weekly-schedule', year, month);
        clearScheduleCache('shift-swap', year, month);
        
        setSuccess(`成功儲存 ${response.data.updated_count} 個工作分配`);
        if (response.data.failed_count > 0) {
          setSuccess(`成功儲存 ${response.data.updated_count} 個工作分配，但有 ${response.data.failed_count} 個失敗`);
        }
      } else {
        setSuccess("沒有需要更新的工作分配");
      }
      
      setIsSaving(false);
      setEditMode(false);
      
      // 清空暫存的編輯值和編輯狀態
      setMissionValues({});
      
      // 不需要重新獲取數據，因為我們已經在上面更新了本地數據
      // await fetchMonthlySchedule();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setIsSaving(false);
      console.error('保存工作分配失敗:', err);
      
      // 避免直接渲染錯誤對象，而是顯示錯誤信息字串
      let errorMessage = '保存工作分配失敗，請稍後重試';
      
      if (typeof err === 'string') {
        errorMessage = err;
      } else if (err && typeof err.message === 'string') {
        errorMessage = err.message;
      } else if (err && err.data && typeof err.data.message === 'string') {
        errorMessage = err.data.message;
      }
      
      setLocalError(errorMessage);
      setTimeout(() => setLocalError(null), 5000);
    }
  };

  // 檢查當日工作分配情況
  const getCurrentDayAssignments = (dayIndex) => {
    // 初始化所有可能的工作分配為null
    const assignments = {
      OR1: null, OR2: null, OR3: null, OR5: null, OR6: null, 
      OR7: null, OR8: null, OR9: null, OR11: null, OR13: null,
      DR: null, 
      '3F1': null, '3F2': null, '3F_Recovery': null,
      CC: null, 
      F1: null, F2: null, 
      P: null, PAR1: null, PAR2: null, C: null,
      HC1: null, HC2: null, HC3: null
    };
    
    // 遍歷所有護理師的當天工作分配
    currentWeekSchedule.forEach(nurse => {
      // 檢查是否是A班
      if (nurse.shifts[dayIndex] !== 'A') return;
      
      // 獲取任務值的key
      const missionKey = `${nurse.id}-${currentWeek}-${dayIndex}`;
      
      // 獲取任務值，優先使用暫存區的值
      let mission;
      
      // 獲取任務值，優先使用暫存區的值
      if (missionKey in missionValues) {
        mission = missionValues[missionKey];
      } else {
        mission = nurse.area_codes?.[dayIndex];
      }
      
      // 如果有分配任務，則記錄
      if (mission) {
        // 特殊處理恢復室護理師的3F
        if (mission === '3F' && nurse.identity === '恢復室護理師') {
          assignments['3F_Recovery'] = nurse.id;
        } else {
          assignments[mission] = nurse.id;
        }
      }
    });
    
    return assignments;
  };

  // 檢查特定任務類型是否已滿
  const isMissionFull = (dayIndex, missionType, identity) => {
    const assignments = getCurrentDayAssignments(dayIndex);
    
    // 對於基本任務類型，檢查是否已經分配
    if (missionType === 'DR' || missionType === 'CC' || missionType === 'P' || 
        missionType === 'C') {
      return assignments[missionType] !== null;
    }
    
    // 對於OR類型，檢查特定房號是否已分配
    if (missionType.startsWith('OR')) {
      const orNumber = missionType.replace('OR', '');
      if (orNumber) {
        return assignments[`OR${orNumber}`] !== null;
      } else {
        // 如果只是'OR'，檢查是否有OR子類型未分配
        return !['OR1', 'OR2', 'OR3', 'OR5', 'OR6', 'OR7', 'OR8', 'OR9', 'OR11', 'OR13']
          .some(or => assignments[or] === null);
      }
    }
    
    // 對於3F類型，分別檢查麻醉專科護理師和恢復室護理師
    if (missionType === '3F') {
      if (identity === '恢復室護理師') {
        // 恢復室護理師只檢查3F_Recovery
        return assignments['3F_Recovery'] !== null;
      } else {
        // 麻醉專科護理師檢查3F1和3F2
        return assignments['3F1'] !== null && assignments['3F2'] !== null;
      }
    }
    
    // 對於F類型
    if (missionType === 'F') {
      return assignments['F1'] !== null && assignments['F2'] !== null;
    }
    
    // 對於PAR類型
    if (missionType === 'PAR') {
      return assignments['PAR1'] !== null && assignments['PAR2'] !== null;
    }
    
    // 對於HC類型
    if (missionType === 'HC') {
      return assignments['HC1'] !== null && assignments['HC2'] !== null && assignments['HC3'] !== null;
    }
    
    return false;
  };

  // 获取任务按钮
  const getMissionButtons = (identity, nurseId, dayIndex) => {
    // 查找該護理師該天的班次
    const nurseData = currentWeekSchedule.find(n => n.id === nurseId);
    if (!nurseData) return null;
    
    const shift = nurseData.shifts[dayIndex];
    
    // 確保只有A班才顯示工作分區按鈕
    if (shift !== 'A') {
      return null;
    }
    
    // 計算當前是星期幾 (0-6)
    const currentDate = parseInt(getDateOfWeek(currentWeek - 1, dayIndex + 1));
    if (!currentDate) return null; // 如果日期無效，不顯示按鈕
    
    const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), currentDate);
    const dayOfWeek = date.getDay(); // 0是週日，1-5是週一到週五，6是週六
    
    // 檢查是否為工作日（週一到週五）
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    // 檢查是否為週五
    const isFriday = dayOfWeek === 5;
    
    // 通用按鈕樣式
    const btnStyle = { 
      minWidth: '22px', 
      padding: '0px 2px', 
      height: '18px', 
      fontSize: '0.65rem', 
      m: 0.1, 
      lineHeight: 0.8,
      borderRadius: '3px',
      fontWeight: 'bold',
      border: '1px solid',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
      whiteSpace: 'nowrap', // 防止按鈕文字換行
      overflow: 'hidden', // 溢出隱藏
    };
    
    // 獲取目前儲存在資料庫的工作分配值
    const missionKey = `${nurseId}-${currentWeek}-${dayIndex}`;
    const savedMission = currentWeekSchedule.find(n => n.id === nurseId)?.area_codes?.[dayIndex];
    
    // 改進處理missionValues中的null值的邏輯：
    // - 如果missionValues[missionKey]存在且為null，表示用戶已取消此值
    // - 如果missionValues[missionKey]有其他值，使用該值
    // - 如果missionValues[missionKey]不存在，使用savedMission
    let currentMission;
    
    if (missionKey in missionValues) {
      // 如果在暫存狀態中有此鍵值（包括值為null的情況）
      currentMission = missionValues[missionKey];
    } else {
      // 如果在暫存狀態中沒有此鍵值，使用資料庫值
      currentMission = savedMission;
    }
    
    // 獲取按鈕活動/非活動狀態的顏色
    const getButtonColor = (type, isActive) => {
      const colors = {
        'OR': { 
          active: { bg: '#1b5e20', text: 'white', border: '#1b5e20' },
          inactive: { bg: '#f0f0f0', text: '#757575', border: '#bdbdbd' }
        },
        'DR': { 
          active: { bg: '#0d47a1', text: 'white', border: '#0d47a1' },
          inactive: { bg: '#f0f0f0', text: '#757575', border: '#bdbdbd' }
        },
        '3F': { 
          active: { bg: '#e65100', text: 'white', border: '#e65100' },
          inactive: { bg: '#f0f0f0', text: '#757575', border: '#bdbdbd' }
        },
        'CC': { 
          active: { bg: '#4a148c', text: 'white', border: '#4a148c' },
          inactive: { bg: '#f0f0f0', text: '#757575', border: '#bdbdbd' }
        },
        'C': { 
          active: { bg: '#004d40', text: 'white', border: '#004d40' },
          inactive: { bg: '#f0f0f0', text: '#757575', border: '#bdbdbd' }
        },
        'F': { 
          active: { bg: '#bf360c', text: 'white', border: '#bf360c' },
          inactive: { bg: '#f0f0f0', text: '#757575', border: '#bdbdbd' }
        },
        'P': { 
          active: { bg: '#1a237e', text: 'white', border: '#1a237e' },
          inactive: { bg: '#f0f0f0', text: '#757575', border: '#bdbdbd' }
        },
        'PAR': { 
          active: { bg: '#b71c1c', text: 'white', border: '#b71c1c' },
          inactive: { bg: '#f0f0f0', text: '#757575', border: '#bdbdbd' }
        },
        'HC': { 
          active: { bg: '#6a1b9a', text: 'white', border: '#6a1b9a' },
          inactive: { bg: '#f0f0f0', text: '#757575', border: '#bdbdbd' }
        }
      };
      
      return colors[type] || colors['OR'];
    };
    
    // 麻醉專科護理師、麻醉科Leader和護理長的选项
    if (identity === '麻醉專科護理師' || identity === '麻醉科Leader' || identity === '護理長') {
      // 如果是週五，OR選項要包含「1」
      const orNumbers = (isFriday || dayOfWeek === 3) 
        ? ['1', '2', '3', '5', '6', '7', '8', '9', '11', '13'] 
        : ['2', '3', '5', '6', '7', '8', '9', '11', '13'];
      
      // 判斷是否為週末（週六或週日）
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 0是週日，6是週六
        
      // 獲取當前日期的工作分配情況
      const assignments = getCurrentDayAssignments(dayIndex);
      
      // 週末只顯示CC選項
      if (isWeekend) {
        // 如果CC已分配且不是給當前護理師，則不顯示CC按鈕
        if (assignments['CC'] !== null && assignments['CC'] !== nurseId) {
          return (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              width: '100%', 
              height: '100%',
              color: '#9e9e9e',
              fontSize: '0.6rem'
            }}>
              工作已滿
            </Box>
          );
        }
        
      return (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'row', 
          flexWrap: 'wrap', 
          gap: 0.2, 
          justifyContent: 'center', 
          m: 0, 
          p: 0.2, 
          width: '100%', 
          height: '100%',
          overflow: 'hidden' // 確保超出部分不會影響佈局
        }}>
          <Button 
              size="small"
              variant="contained"
              onClick={() => handleMissionChange(nurseId, dayIndex, 'CC')}
              sx={{
                ...btnStyle,
                backgroundColor: currentMission === 'CC' 
                  ? getButtonColor('CC', true).active.bg 
                  : getButtonColor('CC', false).inactive.bg,
                color: currentMission === 'CC' 
                  ? getButtonColor('CC', true).active.text 
                  : getButtonColor('CC', false).inactive.text,
                borderColor: currentMission === 'CC' 
                  ? getButtonColor('CC', true).active.border 
                  : getButtonColor('CC', false).inactive.border,
              }}
            >
              CC
            </Button>
          </Box>
        );
      }
      
      // 準備要顯示的按鈕
      const buttons = [];
      
      // 檢查OR選項
      const availableORs = orNumbers.filter(num => assignments[`OR${num}`] === null || assignments[`OR${num}`] === nurseId);
      if (availableORs.length > 0 || currentMission?.startsWith('OR')) {
        buttons.push(
          <Button 
            key="OR"
            size="small"
            variant="contained"
            onClick={() => handleMissionChange(nurseId, dayIndex, 'OR')}
            sx={{
              ...btnStyle,
              backgroundColor: (currentMission?.startsWith('OR')) 
                ? getButtonColor('OR', true).active.bg 
                : getButtonColor('OR', false).inactive.bg,
              color: (currentMission?.startsWith('OR')) 
                ? getButtonColor('OR', true).active.text 
                : getButtonColor('OR', false).inactive.text,
              borderColor: (currentMission?.startsWith('OR')) 
                ? getButtonColor('OR', true).active.border 
                : getButtonColor('OR', false).inactive.border,
            }}
          >
            {currentMission?.startsWith('OR') ? currentMission : 'OR'}
          </Button>
        );
      }
      
      // 檢查DR選項
      if (assignments['DR'] === null || assignments['DR'] === nurseId) {
        buttons.push(
          <Button 
            key="DR"
            size="small"
            variant="contained"
            onClick={() => handleMissionChange(nurseId, dayIndex, 'DR')}
            sx={{
              ...btnStyle,
              backgroundColor: currentMission === 'DR' 
                ? getButtonColor('DR', true).active.bg 
                : getButtonColor('DR', false).inactive.bg,
              color: currentMission === 'DR' 
                ? getButtonColor('DR', true).active.text 
                : getButtonColor('DR', false).inactive.text,
              borderColor: currentMission === 'DR' 
                ? getButtonColor('DR', true).active.border 
                : getButtonColor('DR', false).inactive.border,
            }}
          >
            DR
          </Button>
        );
      }
      
      // 檢查3F選項 (3F1和3F2)
      if (identity === '麻醉專科護理師' || identity === '麻醉科Leader' || identity === '護理長') {
        // 檢查3F1和3F2是否已經滿了，如果兩個都滿了且都不是當前護理師，則不顯示3F按鈕
        const is3FFull = assignments['3F1'] !== null && assignments['3F2'] !== null && 
                          assignments['3F1'] !== nurseId && assignments['3F2'] !== nurseId;
        
        if (!is3FFull) {
          buttons.push(
            <Button 
              key="3F"
              size="small"
              variant="contained"
              onClick={() => handleMissionChange(nurseId, dayIndex, '3F')}
              sx={{
                ...btnStyle,
                backgroundColor: currentMission?.startsWith('3F') 
                  ? getButtonColor('3F', true).active.bg 
                  : getButtonColor('3F', false).inactive.bg,
                color: currentMission?.startsWith('3F') 
                  ? getButtonColor('3F', true).active.text 
                  : getButtonColor('3F', false).inactive.text,
                borderColor: currentMission?.startsWith('3F') 
                  ? getButtonColor('3F', true).active.border 
                  : getButtonColor('3F', false).inactive.border,
              }}
            >
              {currentMission?.startsWith('3F') ? currentMission : '3F'}
            </Button>
          );
        }
      } else if (assignments['3F_Recovery'] === null || assignments['3F_Recovery'] === nurseId) {
        buttons.push(
          <Button 
            key="3F"
            size="small"
            variant="contained"
            onClick={() => handleMissionChange(nurseId, dayIndex, '3F')}
            sx={{
              ...btnStyle,
              backgroundColor: currentMission === '3F' 
                ? getButtonColor('3F', true).active.bg 
                : getButtonColor('3F', false).inactive.bg,
              color: currentMission === '3F' 
                ? getButtonColor('3F', true).active.text 
                : getButtonColor('3F', false).inactive.text,
              borderColor: currentMission === '3F' 
                ? getButtonColor('3F', true).active.border 
                : getButtonColor('3F', false).inactive.border,
            }}
          >
            3F
          </Button>
        );
      }
      
      // 檢查CC選項
      if (assignments['CC'] === null || assignments['CC'] === nurseId) {
        buttons.push(
          <Button 
            key="CC"
            size="small"
            variant="contained"
            onClick={() => handleMissionChange(nurseId, dayIndex, 'CC')}
            sx={{
              ...btnStyle,
              backgroundColor: currentMission === 'CC' 
                ? getButtonColor('CC', true).active.bg 
                : getButtonColor('CC', false).inactive.bg,
              color: currentMission === 'CC' 
                ? getButtonColor('CC', true).active.text 
                : getButtonColor('CC', false).inactive.text,
              borderColor: currentMission === 'CC' 
                ? getButtonColor('CC', true).active.border 
                : getButtonColor('CC', false).inactive.border,
            }}
          >
            CC
          </Button>
        );
      }
      
      // 檢查C選項
      if (assignments['C'] === null || assignments['C'] === nurseId) {
        buttons.push(
          <Button 
            key="C"
            size="small"
            variant="contained"
            onClick={() => handleMissionChange(nurseId, dayIndex, 'C')}
            sx={{
              ...btnStyle,
              backgroundColor: currentMission === 'C' 
                ? getButtonColor('C', true).active.bg 
                : getButtonColor('C', false).inactive.bg,
              color: currentMission === 'C' 
                ? getButtonColor('C', true).active.text 
                : getButtonColor('C', false).inactive.text,
              borderColor: currentMission === 'C' 
                ? getButtonColor('C', true).active.border 
                : getButtonColor('C', false).inactive.border,
            }}
          >
            C
          </Button>
        );
      }
      
      // 檢查F選項 (F1和F2)
      if (identity === '麻醉專科護理師' || identity === '麻醉科Leader' || identity === '護理長') {
        // 檢查F1和F2是否都已被分配且都不是當前護理師
        const isFfull = assignments['F1'] !== null && assignments['F2'] !== null && 
                        assignments['F1'] !== nurseId && assignments['F2'] !== nurseId;
        
        if (!isFfull) {
          buttons.push(
            <Button 
              key="F"
              size="small"
              variant="contained"
              onClick={() => handleMissionChange(nurseId, dayIndex, 'F')}
              sx={{
                ...btnStyle,
                backgroundColor: currentMission?.startsWith('F') 
                  ? getButtonColor('F', true).active.bg 
                  : getButtonColor('F', false).inactive.bg,
                color: currentMission?.startsWith('F') 
                  ? getButtonColor('F', true).active.text 
                  : getButtonColor('F', false).inactive.text,
                borderColor: currentMission?.startsWith('F') 
                  ? getButtonColor('F', true).active.border 
                  : getButtonColor('F', false).inactive.border,
              }}
            >
              {currentMission?.startsWith('F') ? currentMission : 'F'}
            </Button>
          );
        }
      }
      
      // 檢查HC選項 (適用於麻醉專科護理師和護理長)
      if ((identity === '麻醉專科護理師' || identity === '護理長') && isWeekday) {
        // 檢查HC1、HC2和HC3是否都已被分配且都不是當前護理師
        const isHCFull = assignments['HC1'] !== null && assignments['HC2'] !== null && assignments['HC3'] !== null && 
                          assignments['HC1'] !== nurseId && assignments['HC2'] !== nurseId && assignments['HC3'] !== nurseId;
        
        if (!isHCFull) {
          buttons.push(
            <Button 
              key="HC"
              size="small"
              variant="contained"
              onClick={() => handleMissionChange(nurseId, dayIndex, 'HC')}
              sx={{
                ...btnStyle,
                backgroundColor: currentMission?.startsWith('HC') 
                  ? getButtonColor('HC', true).active.bg 
                  : getButtonColor('HC', false).inactive.bg,
                color: currentMission?.startsWith('HC') 
                  ? getButtonColor('HC', true).active.text 
                  : getButtonColor('HC', false).inactive.text,
                borderColor: currentMission?.startsWith('HC') 
                  ? getButtonColor('HC', true).active.border 
                  : getButtonColor('HC', false).inactive.border,
              }}
            >
              {currentMission?.startsWith('HC') ? currentMission : 'HC'}
            </Button>
          );
        }
      }
      
      // 如果沒有可用按鈕，顯示提示
      if (buttons.length === 0) {
        return (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            width: '100%', 
            height: '100%',
            color: '#9e9e9e',
            fontSize: '0.6rem'
          }}>
            工作已滿
        </Box>
      );
    }
    
      return (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'row', 
          flexWrap: 'wrap', 
          gap: 0.2, 
          justifyContent: 'center', 
          m: 0, 
          p: 0.2, 
          width: '100%', 
          height: '100%',
          overflow: 'hidden' // 確保超出部分不會影響佈局
        }}>
          {buttons}
        </Box>
      );
    }
    
    // 恢復室護理師的选项
    if (identity === '恢復室護理師') {
      // 恢復室護理師使用與麻醉專科護理師相同的按鈕樣式
      const recoveryBtnStyle = { 
        ...btnStyle
        // 移除特殊的樣式設定，使其與麻醉專科護理師按鈕樣式相同
      };
      
      // 獲取當前日期的工作分配情況
      const assignments = getCurrentDayAssignments(dayIndex);
      
      // 準備要顯示的按鈕
      const buttons = [];
      
      // 檢查P選項
      if (assignments['P'] === null || assignments['P'] === nurseId) {
        buttons.push(
          <Button 
            key="P"
            size="small"
            variant="contained"
            onClick={() => handleMissionChange(nurseId, dayIndex, 'P')}
            sx={{
              ...recoveryBtnStyle,
              backgroundColor: currentMission === 'P' 
                ? getButtonColor('P', true).active.bg 
                : getButtonColor('P', false).inactive.bg,
              color: currentMission === 'P' 
                ? getButtonColor('P', true).active.text 
                : getButtonColor('P', false).inactive.text,
              borderColor: currentMission === 'P' 
                ? getButtonColor('P', true).active.border 
                : getButtonColor('P', false).inactive.border,
            }}
          >
            P
          </Button>
        );
      }
      
      // 工作日顯示更多選項
      if (isWeekday) {
        // 檢查3F選項
        if (assignments['3F_Recovery'] === null || assignments['3F_Recovery'] === nurseId) {
          buttons.push(
          <Button 
              key="3F"
            size="small"
            variant="contained"
            onClick={() => handleMissionChange(nurseId, dayIndex, '3F')}
            sx={{
                ...recoveryBtnStyle,
                backgroundColor: currentMission === '3F' 
                ? getButtonColor('3F', true).active.bg 
                : getButtonColor('3F', false).inactive.bg,
                color: currentMission === '3F' 
                ? getButtonColor('3F', true).active.text 
                : getButtonColor('3F', false).inactive.text,
                borderColor: currentMission === '3F' 
                ? getButtonColor('3F', true).active.border 
                : getButtonColor('3F', false).inactive.border,
            }}
          >
              3F
          </Button>
          );
        }
        
        // 檢查PAR選項
        if (assignments['PAR1'] === null || assignments['PAR2'] === null ||
            assignments['PAR1'] === nurseId || assignments['PAR2'] === nurseId) {
          buttons.push(
          <Button 
              key="PAR"
            size="small"
            variant="contained"
            onClick={() => handleMissionChange(nurseId, dayIndex, 'PAR')}
            sx={{
                ...recoveryBtnStyle,
              backgroundColor: currentMission?.startsWith('PAR') || currentMission === 'PAR'
                ? getButtonColor('PAR', true).active.bg 
                : getButtonColor('PAR', false).inactive.bg,
              color: currentMission?.startsWith('PAR') || currentMission === 'PAR'
                ? getButtonColor('PAR', true).active.text 
                : getButtonColor('PAR', false).inactive.text,
              borderColor: currentMission?.startsWith('PAR') || currentMission === 'PAR'
                ? getButtonColor('PAR', true).active.border 
                : getButtonColor('PAR', false).inactive.border,
            }}
          >
            {currentMission?.startsWith('PAR') ? currentMission : 'PAR'}
          </Button>
          );
        }
        
        // 檢查C選項
        if (assignments['C'] === null || assignments['C'] === nurseId) {
          buttons.push(
          <Button 
              key="C"
            size="small"
            variant="contained"
            onClick={() => handleMissionChange(nurseId, dayIndex, 'C')}
            sx={{
                ...recoveryBtnStyle,
              backgroundColor: currentMission === 'C' 
                ? getButtonColor('C', true).active.bg 
                : getButtonColor('C', false).inactive.bg,
              color: currentMission === 'C' 
                ? getButtonColor('C', true).active.text 
                : getButtonColor('C', false).inactive.text,
              borderColor: currentMission === 'C' 
                ? getButtonColor('C', true).active.border 
                : getButtonColor('C', false).inactive.border,
            }}
          >
            C
          </Button>
          );
        }
      }
      
      // 如果沒有可用按鈕，顯示提示
      if (buttons.length === 0) {
        return (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            width: '100%', 
            height: '100%',
            color: '#9e9e9e',
            fontSize: '0.6rem'
          }}>
            工作已滿
          </Box>
        );
      }
      
      return (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'row', 
          flexWrap: 'wrap', 
          gap: 0.2, 
          justifyContent: 'center', 
          m: 0, 
          p: 0.2, 
          width: '100%', 
          height: '100%',
          overflow: 'hidden' // 確保超出部分不會影響佈局
        }}>
          {buttons}
        </Box>
      );
    }
    
    return null;
  };

  // 處理工作分配變更
  const handleMissionChange = async (nurseId, dayIndex, value) => {
    // 查找該護理師該天的班次
    const nurseData = currentWeekSchedule.find(n => n.id === nurseId);
    if (!nurseData) return;
    
    const shift = nurseData.shifts[dayIndex];
    
    // 確保只有A班才能修改工作分區
    if (shift !== 'A') {
      console.log(`只有A班才能修改工作分區，當前班次為 ${shift}`);
      return;
    }
    
    // 確保HC只能被麻醉專科護理師和護理長分配
    if (value === 'HC' && nurseData.identity !== '麻醉專科護理師' && nurseData.identity !== '護理長') {
      console.log(`HC只能分配給麻醉專科護理師或護理長，當前護理師身份為 ${nurseData.identity}`);
      return;
    }
    
    // 任務值的key
    const key = `${nurseId}-${currentWeek}-${dayIndex}`;
    
    // 克隆当前的任务值对象
    const newMissionValues = { ...missionValues };
    
    // 獲取當前資料庫中的值（從nurse.area_codes中獲取）
    const savedMission = currentWeekSchedule.find(n => n.id === nurseId)?.area_codes?.[dayIndex];
    
    // 檢查是否是取消操作（點擊了與當前選中值相同的按鈕）
    // 需考慮兩種情況：1. 用戶剛選的值 2. 資料庫中已存在的值
    const isCancel = newMissionValues[key] === value || (savedMission === value && !newMissionValues[key]);
    
    // 如果選擇的是 OR，判斷是新增還是循環
    if (value === 'OR') {
      // 計算當前是星期幾
      const currentDate = parseInt(getDateOfWeek(currentWeek - 1, dayIndex + 1));
      if (!currentDate) {
        newMissionValues[key] = 'OR2'; // 預設值
        setMissionValues(newMissionValues);
        return;
      }
      
      const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), currentDate);
      const dayOfWeek = date.getDay();
      const isFriday = dayOfWeek === 5;
      
      // 依據星期選擇不同的OR數字
      const orNumbers = (isFriday || dayOfWeek === 3) 
        ? ['1', '2', '3', '5', '6', '7', '8', '9', '11', '13'] 
        : ['2', '3', '5', '6', '7', '8', '9', '11', '13'];
      
      // 需要考慮資料庫中已存在的OR值
      const currentValueIsOR = newMissionValues[key]?.startsWith('OR') || (savedMission?.startsWith('OR') && !newMissionValues[key]);
      
      if (currentValueIsOR) {
        // 已經有OR，循環到下一個值
        // 先確定當前的OR值，優先使用暫存狀態中的值，如果沒有則使用資料庫中的值
        const currentValue = newMissionValues[key] || savedMission;
        const currentOR = currentValue?.replace('OR', '') || '';
        const currentIndex = orNumbers.indexOf(currentOR);
        const nextIndex = (currentIndex + 1) % (orNumbers.length + 1); // +1 是為了讓最後能回到 null
        
        if (nextIndex === orNumbers.length) {
          // 循環回 null，並跳到下一個任務種類
          delete newMissionValues[key];
          // 如果資料庫中有值，需要標記為null以便取消
          if (savedMission) {
            newMissionValues[key] = null;
          }
          // 這是取消操作
          await updateDatabaseAreaCode(nurseId, dayIndex, null);
          // 跳到下一個任務種類
          handleMissionChange(nurseId, dayIndex, 'DR');
          return;
        } else {
          // 檢查下一個OR房間是否已有人
          const nextOR = `OR${orNumbers[nextIndex]}`;
          const assignments = getCurrentDayAssignments(dayIndex);
          
          // 如果下一個房間已有人，則找尋下一個可用的房間
          if (assignments[nextOR] !== null && assignments[nextOR] !== nurseId) {
            // 尋找可用的房間
            let foundAvailableOR = false;
            let checkIndex = (nextIndex + 1) % orNumbers.length;
            
            // 最多循環一輪
            for (let i = 0; i < orNumbers.length; i++) {
              const checkOR = `OR${orNumbers[checkIndex]}`;
              
              if (assignments[checkOR] === null || assignments[checkOR] === nurseId) {
                // 找到可用的房間
                newMissionValues[key] = checkOR;
                foundAvailableOR = true;
                break;
              }
              
              checkIndex = (checkIndex + 1) % orNumbers.length;
            }
            
            // 如果沒有找到可用的房間，則清除任務並跳到下一個任務種類
            if (!foundAvailableOR) {
              delete newMissionValues[key];
              if (savedMission) {
                newMissionValues[key] = null;
              }
              await updateDatabaseAreaCode(nurseId, dayIndex, null);
              // 跳到下一個任務種類
              handleMissionChange(nurseId, dayIndex, 'DR');
              return;
            }
          } else {
            // 下一個房間可用，直接設置
            newMissionValues[key] = nextOR;
          }
        }
      } else {
        // 沒有OR，設置為第一個值，但需要檢查該值是否已有人
        const assignments = getCurrentDayAssignments(dayIndex);
        let foundAvailableOR = false;
        
        // 尋找第一個可用的OR房間
        for (const num of orNumbers) {
          const orKey = `OR${num}`;
          if (assignments[orKey] === null) {
            newMissionValues[key] = orKey;
            foundAvailableOR = true;
            break;
          }
        }
        
        // 如果沒有找到可用的OR房間，則不分配並跳到下一個任務種類
        if (!foundAvailableOR) {
          console.log('所有OR房間已被分配，無法分配新的OR');
          // 跳到下一個任務種類
          handleMissionChange(nurseId, dayIndex, 'DR');
          return;
        }
      }
    }
    // 如果選擇的是 HC，判斷是新增還是循環
    else if (value === 'HC') {
      // 確保是麻醉專科護理師或護理長
      if (nurseData.identity !== '麻醉專科護理師' && nurseData.identity !== '護理長') {
        return;
      }
      
      // HC有三個位置（HC1、HC2和HC3）
      const hcNumbers = ['1', '2', '3'];
      
      // 需要考慮資料庫中已存在的HC值
      const currentValueIsHC = newMissionValues[key]?.startsWith('HC') || (savedMission?.startsWith('HC') && !newMissionValues[key]);
      
      if (currentValueIsHC) {
        // 已經有HC，循環到下一個值
        // 先確定當前的HC值，優先使用暫存狀態中的值，如果沒有則使用資料庫中的值
        const currentValue = newMissionValues[key] || savedMission;
        const currentHC = currentValue?.replace('HC', '') || '';
        const currentIndex = hcNumbers.indexOf(currentHC);
        const nextIndex = (currentIndex + 1) % (hcNumbers.length + 1); // +1 是為了讓最後能回到 null
        
        if (nextIndex === hcNumbers.length) {
          // 循環回 null，並清除任務
          delete newMissionValues[key];
          // 如果資料庫中有值，需要標記為null以便取消
          if (savedMission) {
            newMissionValues[key] = null;
          }
          // 這是取消操作
          await updateDatabaseAreaCode(nurseId, dayIndex, null);
        } else {
          // 檢查下一個HC位置是否已有人
          const nextHC = `HC${hcNumbers[nextIndex]}`;
          const assignments = getCurrentDayAssignments(dayIndex);
          
          // 如果下一個位置已有人，則找尋另一個可用位置
          if (assignments[nextHC] !== null && assignments[nextHC] !== nurseId) {
            // 尋找可用的位置
            let foundAvailableHC = false;
            
            for (const num of hcNumbers) {
              const hcKey = `HC${num}`;
              if (assignments[hcKey] === null || assignments[hcKey] === nurseId) {
                // 找到可用的位置
                newMissionValues[key] = hcKey;
                foundAvailableHC = true;
                break;
              }
            }
            
            // 如果沒有找到可用的位置，則清除任務
            if (!foundAvailableHC) {
              delete newMissionValues[key];
              if (savedMission) {
                newMissionValues[key] = null;
              }
              await updateDatabaseAreaCode(nurseId, dayIndex, null);
            }
          } else {
            // 下一個位置可用，直接設置
            newMissionValues[key] = nextHC;
          }
        }
      } else {
        // 沒有HC，設置為第一個值，但需檢查是否已有人
        const assignments = getCurrentDayAssignments(dayIndex);
        let foundAvailableHC = false;
        
        // 尋找第一個可用的HC位置
        for (const num of hcNumbers) {
          const hcKey = `HC${num}`;
          if (assignments[hcKey] === null) {
            newMissionValues[key] = hcKey;
            foundAvailableHC = true;
            break;
          }
        }
        
        // 如果沒有找到可用的HC位置，則不分配
        if (!foundAvailableHC) {
          console.log('所有HC位置已被分配，無法分配新的HC');
          return;
        }
      }
    }
    // 處理3F類型的循環 (3F1, 3F2)
    else if (value === '3F') {
      // 恢復室護理師和麻醉專科護理師的3F邏輯不同
      if (nurseData.identity === '恢復室護理師') {
        // 檢查是否已經有恢復室護理師分配了3F
        const has3FRecoveryNurse = currentWeekSchedule.some(n => 
          n.identity === '恢復室護理師' && 
          n.id !== nurseId && 
          (n.area_codes?.[dayIndex] === '3F' || 
           missionValues[`${n.id}-${currentWeek}-${dayIndex}`] === '3F')
        );
        
        if (has3FRecoveryNurse) {
          // 如果已經有恢復室護理師分配了3F，則不允許再分配
          console.log('已經有恢復室護理師分配了3F，不允許再分配');
          return;
        }
        
        // 恢復室護理師的3F只有一個位置，直接設置為3F（不帶數字）
        const currentValueIs3F = newMissionValues[key] === '3F' || (savedMission === '3F' && !newMissionValues[key]);
        
        if (currentValueIs3F) {
          // 已經有3F，取消分配並跳到下一個任務種類
          delete newMissionValues[key];
          if (savedMission) {
            newMissionValues[key] = null;
          }
          await updateDatabaseAreaCode(nurseId, dayIndex, null);
          // 跳到下一個任務種類
          handleMissionChange(nurseId, dayIndex, 'PAR');
          return;
        } else {
          // 設置為3F
          newMissionValues[key] = '3F';
        }
      } else {
        // 麻醉專科護理師的3F有兩個位置 (3F1和3F2)
        const threeFNumbers = ['1', '2'];
        
        // 需要考慮資料庫中已存在的3F值
        const currentValueIs3F = newMissionValues[key]?.startsWith('3F') || (savedMission?.startsWith('3F') && !newMissionValues[key]);
        
        if (currentValueIs3F) {
          // 已經有3F，循環到下一個值
          // 先確定當前的3F值，優先使用暫存狀態中的值，如果沒有則使用資料庫中的值
          const currentValue = newMissionValues[key] || savedMission;
          const current3F = currentValue?.replace('3F', '') || '';
          const currentIndex = threeFNumbers.indexOf(current3F);
          const nextIndex = (currentIndex + 1) % (threeFNumbers.length + 1); // +1 是為了讓最後能回到 null
          
          if (nextIndex === threeFNumbers.length) {
            // 循環回 null，並跳到下一個任務種類
            delete newMissionValues[key];
            // 如果資料庫中有值，需要標記為null以便取消
            if (savedMission) {
              newMissionValues[key] = null;
            }
            // 這是取消操作
            await updateDatabaseAreaCode(nurseId, dayIndex, null);
            // 跳到下一個任務種類
            handleMissionChange(nurseId, dayIndex, 'CC');
            return;
          } else {
            // 檢查下一個3F位置是否已有人
            const next3F = `3F${threeFNumbers[nextIndex]}`;
            const assignments = getCurrentDayAssignments(dayIndex);
            
            // 如果下一個位置已有人，則找尋另一個可用位置
            if (assignments[next3F] !== null && assignments[next3F] !== nurseId) {
              // 尋找可用的位置
              let foundAvailable3F = false;
              
              for (const num of threeFNumbers) {
                const threeFKey = `3F${num}`;
                if (assignments[threeFKey] === null || assignments[threeFKey] === nurseId) {
                  // 找到可用的位置
                  newMissionValues[key] = threeFKey;
                  foundAvailable3F = true;
                  break;
                }
              }
              
              // 如果沒有找到可用的位置，則清除任務並跳到下一個任務種類
              if (!foundAvailable3F) {
                delete newMissionValues[key];
                if (savedMission) {
                  newMissionValues[key] = null;
                }
                await updateDatabaseAreaCode(nurseId, dayIndex, null);
                // 跳到下一個任務種類
                handleMissionChange(nurseId, dayIndex, 'CC');
                return;
              }
            } else {
              // 下一個位置可用，直接設置
              newMissionValues[key] = next3F;
            }
          }
        } else {
          // 沒有3F，設置為第一個值，但需檢查是否已有人
          const assignments = getCurrentDayAssignments(dayIndex);
          let foundAvailable3F = false;
          
          // 尋找第一個可用的3F位置
          for (const num of threeFNumbers) {
            const threeFKey = `3F${num}`;
            if (assignments[threeFKey] === null) {
              newMissionValues[key] = threeFKey;
              foundAvailable3F = true;
              break;
            }
          }
          
          // 如果沒有找到可用的3F位置，則不分配並跳到下一個任務種類
          if (!foundAvailable3F) {
            console.log('所有3F位置已被分配，無法分配新的3F');
            // 跳到下一個任務種類
            handleMissionChange(nurseId, dayIndex, 'CC');
            return;
          }
        }
      }
    }
    // 處理F類型的循環 (F1, F2)
    else if (value === 'F') {
      // F有兩個位置 (F1和F2)
      const fNumbers = ['1', '2'];
      
      // 需要考慮資料庫中已存在的F值
      const currentValueIsF = newMissionValues[key]?.startsWith('F') || (savedMission?.startsWith('F') && !newMissionValues[key]);
      
      if (currentValueIsF) {
        // 已經有F，循環到下一個值
        // 先確定當前的F值，優先使用暫存狀態中的值，如果沒有則使用資料庫中的值
        const currentValue = newMissionValues[key] || savedMission;
        const currentF = currentValue?.replace('F', '') || '';
        const currentIndex = fNumbers.indexOf(currentF);
        const nextIndex = (currentIndex + 1) % (fNumbers.length + 1); // +1 是為了讓最後能回到 null
        
        if (nextIndex === fNumbers.length) {
          // 循環回 null，並跳到下一個任務種類
          delete newMissionValues[key];
          // 如果資料庫中有值，需要標記為null以便取消
          if (savedMission) {
            newMissionValues[key] = null;
          }
          // 這是取消操作
          await updateDatabaseAreaCode(nurseId, dayIndex, null);
          // 跳到下一個任務種類
          if (nurseData.identity === '麻醉專科護理師' || nurseData.identity === '護理長') {
            handleMissionChange(nurseId, dayIndex, 'HC');
          } else {
            // 麻醉科Leader不分配HC，直接清除
            handleMissionChange(nurseId, dayIndex, null);
          }
          return;
        } else {
          // 檢查下一個F位置是否已有人
          const nextF = `F${fNumbers[nextIndex]}`;
          const assignments = getCurrentDayAssignments(dayIndex);
          
          // 如果下一個位置已有人，則找尋另一個可用位置
          if (assignments[nextF] !== null && assignments[nextF] !== nurseId) {
            // 尋找可用的位置
            let foundAvailableF = false;
            
            for (const num of fNumbers) {
              const fKey = `F${num}`;
              if (assignments[fKey] === null || assignments[fKey] === nurseId) {
                // 找到可用的位置
                newMissionValues[key] = fKey;
                foundAvailableF = true;
                break;
              }
            }
            
            // 如果沒有找到可用的位置，則清除任務並跳到下一個任務種類
            if (!foundAvailableF) {
              delete newMissionValues[key];
              if (savedMission) {
                newMissionValues[key] = null;
              }
              await updateDatabaseAreaCode(nurseId, dayIndex, null);
              // 跳到下一個任務種類
              if (nurseData.identity === '麻醉專科護理師' || nurseData.identity === '護理長') {
                handleMissionChange(nurseId, dayIndex, 'HC');
              } else {
                // 麻醉科Leader不分配HC，直接清除
                handleMissionChange(nurseId, dayIndex, null);
              }
              return;
            }
          } else {
            // 下一個位置可用，直接設置
            newMissionValues[key] = nextF;
          }
        }
      } else {
        // 沒有F，設置為第一個值，但需檢查是否已有人
        const assignments = getCurrentDayAssignments(dayIndex);
        let foundAvailableF = false;
        
        // 尋找第一個可用的F位置
        for (const num of fNumbers) {
          const fKey = `F${num}`;
          if (assignments[fKey] === null) {
            newMissionValues[key] = fKey;
            foundAvailableF = true;
            break;
          }
        }
        
        // 如果沒有找到可用的F位置，則不分配並跳到下一個任務種類
        if (!foundAvailableF) {
          console.log('所有F位置已被分配，無法分配新的F');
          // 跳到下一個任務種類
          if (nurseData.identity === '麻醉專科護理師' || nurseData.identity === '護理長') {
            handleMissionChange(nurseId, dayIndex, 'HC');
          } else {
            // 麻醉科Leader不分配HC，直接清除
            handleMissionChange(nurseId, dayIndex, null);
          }
          return;
        }
      }
    }
    // 處理PAR類型的循環 (PAR1, PAR2)
    else if (value === 'PAR') {
      // PAR有兩個位置 (PAR1和PAR2)
      const parNumbers = ['1', '2'];
      
      // 需要考慮資料庫中已存在的PAR值
      const currentValueIsPAR = newMissionValues[key]?.startsWith('PAR') || (savedMission?.startsWith('PAR') && !newMissionValues[key]);
      
      if (currentValueIsPAR) {
        // 已經有PAR，循環到下一個值
        // 先確定當前的PAR值，優先使用暫存狀態中的值，如果沒有則使用資料庫中的值
        const currentValue = newMissionValues[key] || savedMission;
        const currentPAR = currentValue?.replace('PAR', '') || '';
        const currentIndex = parNumbers.indexOf(currentPAR);
        const nextIndex = (currentIndex + 1) % (parNumbers.length + 1); // +1 是為了讓最後能回到 null
        
        if (nextIndex === parNumbers.length) {
          // 循環回 null，並跳到下一個任務種類
          delete newMissionValues[key];
          // 如果資料庫中有值，需要標記為null以便取消
          if (savedMission) {
            newMissionValues[key] = null;
          }
          // 這是取消操作
          await updateDatabaseAreaCode(nurseId, dayIndex, null);
          // 跳到下一個任務種類
          handleMissionChange(nurseId, dayIndex, 'C');
          return;
        } else {
          newMissionValues[key] = `PAR${parNumbers[nextIndex]}`;
        }
      } else {
        // 沒有PAR，設置為第一個值
        newMissionValues[key] = `PAR${parNumbers[0]}`;
      }
    } else {
      // 其他任務值的處理
      if (isCancel) {
        // 如果是取消操作，清除值並更新資料庫
        delete newMissionValues[key];
        // 如果資料庫中有值，需要標記為null以便取消
        if (savedMission) {
          newMissionValues[key] = null;
        }
        // 這是取消操作
        await updateDatabaseAreaCode(nurseId, dayIndex, null);
      } else {
        // 否則設置新值
        newMissionValues[key] = value;
      }
    }
    
    setMissionValues(newMissionValues);
  };
  
  // 更新資料庫中的area_code
  const updateDatabaseAreaCode = async (nurseId, dayIndex, value) => {
    try {
      // 計算實際日期
      const dayOfMonth = parseInt(getDateOfWeek(currentWeek - 1, dayIndex + 1));
      if (!dayOfMonth) return;
      
      // 獲取年月日
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;
      const dateString = `${year}-${month < 10 ? '0' + month : month}-${dayOfMonth < 10 ? '0' + dayOfMonth : dayOfMonth}`;
      
      // 直接使用updateShift API更新area_code
      await apiService.schedule.updateShift({
        user_id: nurseId,
        date: dateString,
        shift_type: 'A', // 確保是A班
        area_code: value,
        year: year,  // 添加年份參數
        month: month  // 添加月份參數
      });
      
      console.log(`成功更新 user_id=${nurseId}, date=${dayOfMonth} 的area_code為${value}`);
      
      // 更新本地數據，避免重新載入整個頁面
      // 但不更新missionValues，因為那是編輯中的暫存狀態
      const updatedSchedule = [...monthlySchedule];
      const nurseIndex = updatedSchedule.findIndex(nurse => nurse.id === nurseId);
      if (nurseIndex >= 0) {
        if (!updatedSchedule[nurseIndex].area_codes) {
          updatedSchedule[nurseIndex].area_codes = Array(31).fill(null);
        }
        updatedSchedule[nurseIndex].area_codes[dayOfMonth - 1] = value;
        
        // 同時更新store中的數據
        useScheduleStore.setState({ monthlySchedule: updatedSchedule });
      }
      
    } catch (err) {
      console.error('更新area_code失敗:', err);
      
      // 避免直接渲染錯誤對象，而是顯示錯誤信息字串
      let errorMessage = '更新工作分配失敗，請稍後重試';
      
      if (typeof err === 'string') {
        errorMessage = err;
      } else if (err && typeof err.message === 'string') {
        errorMessage = err.message;
      } else if (err && err.data && typeof err.data.message === 'string') {
        errorMessage = err.data.message;
      }
      
      setLocalError(errorMessage);
      setTimeout(() => setLocalError(null), 5000);
    }
  };

  // 選擇週次
  const selectWeek = (week) => {
    setCurrentWeek(week);
  };

  // 生成PDF
  const generatePDF = async () => {
    const element = document.getElementById('pdf-content');
    
    if (!element) return;
    
    try {
      // 調整PDF內容顯示
      element.style.display = 'block';
      
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 5;
      
      const weekContainers = element.querySelectorAll('.week-container');
      
      for (let i = 0; i < weekContainers.length; i++) {
        const weekContainer = weekContainers[i];
        
        const canvas = await html2canvas(weekContainer, {
          scale: 2,
          useCORS: true,
          logging: false
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        
        // 計算適當的圖片尺寸，保持原始比例
        let imgWidth = pdfWidth - 2 * margin;
        let imgHeight = (canvas.height / canvas.width) * imgWidth;
        
        if (imgHeight > pdfHeight - 2 * margin) {
          imgHeight = pdfHeight - 2 * margin;
          imgWidth = (canvas.width / canvas.height) * imgHeight;
        }
        
        // 計算居中位置
        const xPosition = (pdfWidth - imgWidth) / 2;
        const yPosition = (pdfHeight - imgHeight) / 2;
        
        pdf.addImage(imgData, 'JPEG', xPosition, yPosition, imgWidth, imgHeight);
        
        if (i < weekContainers.length - 1) {
          pdf.addPage();
        }
      }
      
      pdf.save(`麻醉科護理人員值班週表_${formattedDate}.pdf`);
      
      // 隱藏PDF內容
      element.style.display = 'none';
      
      setSuccess('PDF 文件已生成');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('生成PDF失敗:', err);
      
      // 避免直接渲染錯誤對象，而是顯示錯誤信息字串
      let errorMessage = '生成PDF失敗，請稍後重試';
      
      if (typeof err === 'string') {
        errorMessage = err;
      } else if (err && typeof err.message === 'string') {
        errorMessage = err.message;
      } else if (err && err.data && typeof err.data.message === 'string') {
        errorMessage = err.data.message;
      }
      
      setLocalError(errorMessage);
      setTimeout(() => setLocalError(null), 5000);
      
      // 確保PDF內容被隱藏
      if (element) {
        element.style.display = 'none';
      }
    }
  };

  // 處理日期變更
  const handleDateChange = (newDate) => {
    if (newDate && newDate instanceof Date && !isNaN(newDate.getTime())) {
      // 只更新臨時日期，不觸發API調用
      setTempDate(newDate);
    } else {
      console.error('嘗試設置無效的日期:', newDate);
      setTempDate(new Date());
    }
  };
  
  // 處理日期確認
  const handleDateAccept = () => {
    if (tempDate && tempDate instanceof Date && !isNaN(tempDate.getTime())) {
      // 如果新日期和當前日期是同一個月，則不重新加載資料
      const isSameMonth = 
        selectedDate.getFullYear() === tempDate.getFullYear() && 
        selectedDate.getMonth() === tempDate.getMonth();
      
      // 更新日期並設置週次
      updateSelectedDate(tempDate);
      setCurrentWeek(1);
      
      // 清空舊的 missionValues
      setMissionValues({});
      
      console.log(`日期變更: ${format(tempDate, 'yyyy-MM-dd')}, 是否同月: ${isSameMonth}`);
    }
  };

  // 所有可能的工作分配選項
  const allMissionTypes = [
    'OR1', 'OR2', 'OR3', 'OR5', 'OR6', 'OR7', 'OR8', 'OR9', 'OR11', 'OR13',
    'DR', '3F', 'CC', 'C', 'F', 'P', 'PAR', 'HC'
  ];

  // 計算工作分配統計
  const calculateMissionStats = useMemo(() => {
    if (!currentWeekSchedule.length) return [];
    
    // 初始化統計數據，為每天創建包含所有工作類型的對象
    const stats = Array(7).fill(null).map(() => {
      const dayStats = {};
      // 先將所有可能的工作類型設置為0
      allMissionTypes.forEach(type => {
        dayStats[type] = 0;
      });
      return dayStats;
    });
    
    // 遍歷當前週的每個護理師，移除排除護理長的條件
    currentWeekSchedule.forEach(nurse => {
      // 移除原本的護理長排除條件
      // if (nurse.role === 'head_nurse') return;
      
      // 遍歷每天
      nurse.shifts.forEach((shift, dayIndex) => {
        // 獲取該天的工作分配
        const missionKey = `${nurse.id}-${currentWeek}-${dayIndex}`;
        const mission = missionValues[missionKey] || nurse.area_codes?.[dayIndex];
        
        // 如果有工作分配，則統計
        if (mission) {
          // 首先檢查是否是數字後綴的類型（如HC1, HC2, HC3）
          const baseType = mission.replace(/\d+$/, '');
          
          // 如果是HC1, HC2, HC3等，增加HC的計數
          if (baseType === 'HC' && mission !== 'HC') {
            if (stats[dayIndex]['HC'] !== undefined) {
              stats[dayIndex]['HC']++;
            } else {
              stats[dayIndex]['HC'] = 1;
            }
            
            // 同時為具體的HC1, HC2等添加統計
            if (stats[dayIndex][mission] !== undefined) {
          stats[dayIndex][mission]++;
            } else {
              stats[dayIndex][mission] = 1;
            }
          } 
          // 正常處理其他任務類型
          else if (stats[dayIndex][mission] !== undefined) {
            stats[dayIndex][mission]++;
          } else {
          // 如果是新的工作分配類型（不在預定義列表中）
          stats[dayIndex][mission] = 1;
          }
        }
      });
    });
    
    return stats;
  }, [currentWeekSchedule, missionValues, currentWeek, allMissionTypes]);

  // 獲取指定日期和工作類型的護理師名單
  const getNurseNamesByMission = (dayIndex, missionType) => {
    if (!currentWeekSchedule || currentWeekSchedule.length === 0) return [];
    
    // 計算實際日期
    const dayOfMonth = parseInt(getDateOfWeek(currentWeek - 1, dayIndex + 1));
    if (!dayOfMonth) return [];
    
    // 收集所有在該日期執行該任務的護理師，移除排除護理長的條件
    const nurses = currentWeekSchedule.filter(nurse => {
      // 移除原本的護理長排除條件
      // if (nurse.role === 'head_nurse') return false;
      
      const missionKey = `${nurse.id}-${currentWeek}-${dayIndex}`;
      const mission = missionValues[missionKey] || nurse.area_codes?.[dayIndex];
      return mission === missionType;
    });
    
    // 返回護理師名字
    return nurses.map(nurse => nurse.name);
  };

  // 計算未安排工作的A班(白班)人員
  const getUnassignedAShiftNurses = (dayIndex) => {
    if (!currentWeekSchedule || currentWeekSchedule.length === 0) return [];
    
    // 計算實際日期
    const dayOfMonth = parseInt(getDateOfWeek(currentWeek - 1, dayIndex + 1));
    if (!dayOfMonth) return [];
    
    // 收集所有排A班但沒有工作分配的護理師
    const nurses = currentWeekSchedule.filter(nurse => {
      const shift = nurse.shifts[dayIndex];
      if (shift !== 'A') return false; // 只考慮A班
      
      const missionKey = `${nurse.id}-${currentWeek}-${dayIndex}`;
      const mission = missionValues[missionKey] || nurse.area_codes?.[dayIndex];
      return !mission; // 返回沒有工作分配的護理師
    });
    
    // 返回護理師名字
    return nurses.map(nurse => nurse.name);
  };

  // 初始加載用戶和班表數據
  useEffect(() => {
    const loadData = async () => {
      try {
        // 在第一次加載時確保store已初始化
        if (typeof useScheduleStore.getState().initialize === 'function') {
          useScheduleStore.getState().initialize();
        }
        await fetchUsers();
      } catch (err) {
        console.error('加載用戶數據失敗:', err);
      }
    };
    
    loadData();
  }, [fetchUsers]); // 只依賴fetchUsers，避免重複執行

  // 處理班表和工作分配數據加載，整合到一個useEffect中
  useEffect(() => {
    // 確保日期有效
    if (!isValid(selectedDate)) return;
    
    // 設置標記防止重複請求
    let isMounted = true;
    
    const loadScheduleData = async () => {
      try {
        console.log('開始加載班表數據...');
        
        // 獲取當前年月
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth() + 1;
        
        // 先獲取月班表數據
        await fetchMonthlySchedule();
        
        // 如果組件已卸載，不繼續執行
        if (!isMounted) return;
        
        // 再獲取工作分配數據（首次載入強制刷新）
        try {
          console.log('開始加載工作分配數據...');
          
          // 檢查是否為首次載入或重新載入
          const currentSchedule = useScheduleStore.getState().monthlySchedule;
          const hasAreaCodes = currentSchedule.some(nurse => 
            nurse.area_codes && nurse.area_codes.some(code => code !== null)
          );
          
          // 如果沒有工作分配資料或者是新的月份，強制刷新
          const forceRefresh = !hasAreaCodes;
          
          const result = await cachedScheduleDetailsRequest(apiService, 'weekly-schedule', year, month, forceRefresh);
          
          // 如果組件已卸載，不繼續執行
          if (!isMounted) return;
          
          if (result.fromCache) {
            console.log('loadScheduleData: 使用緩存數據');
          } else {
            console.log('loadScheduleData: 從API獲取最新數據');
          }
          
          if (result.data?.success) {
            // 將工作分配資料更新到排班資料中
            const monthlyData = [...useScheduleStore.getState().monthlySchedule];
            const details = result.data.data || [];
            
            // 遍歷每個排班記錄，更新area_code
            details.forEach(item => {
              const nurseIndex = monthlyData.findIndex(nurse => nurse.id === item.user_id);
              if (nurseIndex >= 0) {
                const dateObj = new Date(item.date);
                const day = dateObj.getDate() - 1; // 轉換為0-based索引
                
                if (!monthlyData[nurseIndex].area_codes) {
                  monthlyData[nurseIndex].area_codes = Array(31).fill(null);
                }
                
                if (day >= 0 && day < 31) {
                  monthlyData[nurseIndex].area_codes[day] = item.area_code;
                }
              }
            });
            
            // 更新store中的數據
            useScheduleStore.setState({ monthlySchedule: monthlyData });
            console.log('工作分配數據加載完成');
          }
        } catch (areaCodeErr) {
          console.error('獲取工作分配資料失敗:', areaCodeErr);
        }
      } catch (err) {
        console.error('日期變更後獲取班表失敗:', err);
      }
    };
    
    loadScheduleData();
    
    // 清理函數，組件卸載時設置標記
    return () => {
      isMounted = false;
    };
  }, [selectedDate, fetchMonthlySchedule]); // 只在selectedDate或fetchMonthlySchedule變化時執行

  // 渲染單元格內容
  const renderCellContent = (nurse, dayIndex) => {
    const shift = nurse.shifts[dayIndex];
    
    // 使用相同的鍵格式來獲取任務值
    const missionKey = `${nurse.id}-${currentWeek}-${dayIndex}`;
    
    // 優先顯示順序：
    // 1. 編輯模式下的 missionValues (新輸入的值)
    // 2. area_codes (從資料庫讀取的 area_code 欄位)
    // 3. 正常班次顯示
    // 注意：如果 missionValues[missionKey] 存在且為 null，表示用戶已經取消了工作分配
    let mission;
    
    if (missionKey in missionValues) {
      // 如果在編輯狀態中有此鍵值（即使值為null）
      mission = missionValues[missionKey];
    } else {
      // 否則使用資料庫中的值
      mission = nurse.area_codes?.[dayIndex];
    }
    
    if (!shift) return '';
    
    // 僅當班次為'A'時才顯示編輯按鈕和使用area_code
    if (shift === 'A') {
      // A班且處於編輯模式
      if (editMode && hasEditPermission) {
        return (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            p: 0, 
            m: 0, 
            height: '22px', // 確保固定高度
            maxHeight: '22px',
            minHeight: '22px',
            backgroundColor: '#f9f9f9',  // 添加淺灰色背景，突出編輯區域
            overflow: 'hidden', // 確保內容不會溢出
            whiteSpace: 'nowrap', // 防止換行
            textOverflow: 'ellipsis' // 顯示省略號
          }}>
            {getMissionButtons(nurse.identity, nurse.id, dayIndex)}
          </Box>
        );
      }
      
      // A班並有工作分配，顯示工作分配
      if (mission) {
        return (
          <Box component="span" sx={{ 
            whiteSpace: 'nowrap', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis',
            width: '100%',
            display: 'block',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            height: '22px',
            lineHeight: '22px',
          }}>
            {mission}
          </Box>
        );
      }
      
      // A班但沒有工作分配，使用灰色顯示，讓使用者容易看出還沒有工作分配
      return (
        <Box component="span" sx={{ 
          color: '#9e9e9e', // 灰色字體
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          width: '100%',
          display: 'block',
          fontSize: '0.85rem',
          height: '22px',
          lineHeight: '22px'
        }}>
          A
        </Box>
      );
    }
    
    // 非A班的班次，直接顯示shift_type
    return (
      <Box component="span" sx={{ 
        whiteSpace: 'nowrap', 
        overflow: 'hidden', 
        textOverflow: 'ellipsis',
        width: '100%',
        display: 'block',
        fontSize: '0.85rem',
        height: '22px',
        lineHeight: '22px'
      }}>
        {showShiftTime ? convertShiftToTime(shift) : shift}
      </Box>
    );
  };

  // 處理工作分配點擊循環
  const handleMissionCycle = (nurse, dayIndex, mission) => {
    // 計算當前是星期幾
    const currentDate = parseInt(getDateOfWeek(currentWeek - 1, dayIndex + 1));
    if (!currentDate) return;
    
    const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), currentDate);
    const dayOfWeek = date.getDay(); // 0是週日，1-5是週一到週五，6是週六
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 週六或週日
    const isSaturday = dayOfWeek === 6;
    const isFriday = dayOfWeek === 5;
    
    // 獲取當前工作分配情況
    const assignments = getCurrentDayAssignments(dayIndex);
    
    // 檢查特定任務類型是否已滿
    const checkMissionAvailability = (baseType) => {
      // 基本類型直接檢查
      if (baseType === 'DR' || baseType === 'CC' || baseType === 'P' || 
          baseType === 'C') {
        return assignments[baseType] === null || assignments[baseType] === nurse.id;
      }
      
      // 對於3F類型，分別檢查麻醉專科護理師和恢復室護理師
      if (baseType === '3F') {
        if (nurse.identity === '恢復室護理師') {
          // 恢復室護理師只檢查3F_Recovery
          return assignments['3F_Recovery'] === null || assignments['3F_Recovery'] === nurse.id ? '3F' : false;
        } else {
          // 麻醉專科護理師檢查3F1和3F2
          if (assignments['3F1'] === null) return '3F1';
          if (assignments['3F2'] === null) return '3F2';
          return assignments['3F1'] === nurse.id ? '3F1' : 
                (assignments['3F2'] === nurse.id ? '3F2' : false);
        }
      }
      
      // 對於PAR類型，檢查PAR1和PAR2
      if (baseType === 'PAR') {
        if (assignments['PAR1'] === null) return 'PAR1';
        if (assignments['PAR2'] === null) return 'PAR2';
        return assignments['PAR1'] === nurse.id ? 'PAR1' : 
              (assignments['PAR2'] === nurse.id ? 'PAR2' : false);
      }
      
      // 對於F類型，檢查F1和F2
      if (baseType === 'F') {
        if (assignments['F1'] === null) return 'F1';
        if (assignments['F2'] === null) return 'F2';
        return assignments['F1'] === nurse.id ? 'F1' : 
              (assignments['F2'] === nurse.id ? 'F2' : false);
      }
      
      // 對於HC類型，檢查HC1、HC2和HC3
      if (baseType === 'HC') {
        if (assignments['HC1'] === null) return 'HC1';
        if (assignments['HC2'] === null) return 'HC2';
        if (assignments['HC3'] === null) return 'HC3';
        return assignments['HC1'] === nurse.id ? 'HC1' : 
              (assignments['HC2'] === nurse.id ? 'HC2' : 
               (assignments['HC3'] === nurse.id ? 'HC3' : false));
      }
      
      // 對於OR類型，檢查各個房間
      if (baseType === 'OR') {
        const orNumbers = (isFriday || dayOfWeek === 3) 
          ? ['1', '2', '3', '5', '6', '7', '8', '9', '11', '13'] 
          : ['2', '3', '5', '6', '7', '8', '9', '11', '13'];
        
        for (const num of orNumbers) {
          const orKey = `OR${num}`;
          if (assignments[orKey] === null) return orKey;
        }
        
        // 檢查是否有當前護理師已分配的OR
        for (const num of orNumbers) {
          const orKey = `OR${num}`;
          if (assignments[orKey] === nurse.id) return orKey;
        }
        
        return false;
      }
      
      return false;
    };
    
    // 週末麻醉專科護理師只能切換CC和清除
    if (isWeekend && nurse.identity === '麻醉專科護理師') {
      // 週末麻醉專科護理師只能切換CC和清除
      if (!mission || mission === '') {
        // 未分配任務時，分配CC
        if (assignments['CC'] === null) {
          handleMissionChange(nurse.id, dayIndex, 'CC');
        }
      } else if (mission === 'CC') {
        // 已分配CC時，清除任務
        handleMissionChange(nurse.id, dayIndex, null);
      } else {
        // 其他任務改為CC
        if (assignments['CC'] === null || assignments['CC'] === nurse.id) {
          handleMissionChange(nurse.id, dayIndex, 'CC');
        } else {
          handleMissionChange(nurse.id, dayIndex, null);
        }
      }
      return;
    }
    
    // 週六的恢復室護理師需要排P一人
    if (isSaturday && nurse.identity === '恢復室護理師') {
      if (!mission) {
        // 尚未有P任務但恢復室護理師，則安排P
        if (assignments['P'] === null) {
          handleMissionChange(nurse.id, dayIndex, 'P');
        }
      } else if (mission === 'P') {
        // 已經是P，取消任務
        handleMissionChange(nurse.id, dayIndex, null);
      } else {
        // 其他任務，改為P如果沒有人排P
        if (assignments['P'] === null) {
          handleMissionChange(nurse.id, dayIndex, 'P');
        } else if (assignments['P'] === nurse.id) {
          // 如果護理師自己已經是P，則取消任務
          handleMissionChange(nurse.id, dayIndex, null);
        }
      }
      return;
    }
    
    // 週日的恢復室護理師也需要安排P一人
    if (dayOfWeek === 0 && nurse.identity === '恢復室護理師') {
      if (!mission) {
        // 尚未有P任務但恢復室護理師，則安排P
        if (assignments['P'] === null) {
          handleMissionChange(nurse.id, dayIndex, 'P');
        }
      } else if (mission === 'P') {
        // 已經是P，取消任務
        handleMissionChange(nurse.id, dayIndex, null);
      } else {
        // 其他任務，改為P如果沒有人排P
        if (assignments['P'] === null) {
          handleMissionChange(nurse.id, dayIndex, 'P');
        } else if (assignments['P'] === nurse.id) {
          // 如果護理師自己已經是P，則取消任務
          handleMissionChange(nurse.id, dayIndex, null);
        }
      }
      return;
    }
    
    // 根據護理師身份處理不同的循環順序
    if (nurse.identity === '麻醉專科護理師' || nurse.identity === '麻醉科Leader' || nurse.identity === '護理長') {
      // 麻醉專科護理師、麻醉科Leader和護理長的循環: OR系列 → DR → 3F → CC → C → F → HC → 清除
      
      // 根據當前任務決定下一個任務
      if (!mission) {
        // 如果當前沒有任務，嘗試從OR開始循環
        const nextOR = checkMissionAvailability('OR');
        if (nextOR) {
          handleMissionChange(nurse.id, dayIndex, nextOR);
        } else {
          // 如果OR已滿，嘗試DR
          handleNextMission('DR');
        }
      } else {
        // 如果當前有任務，依照循環順序：OR系列 → DR → 3F → CC → C → F → HC → 清除
        const baseType = mission.replace(/\d+$/, '');
        
        switch (baseType) {
          case 'OR':
            // 處理OR子類型的循環
            handleMissionChange(nurse.id, dayIndex, 'OR');
            break;
          case 'DR':
            // DR後面是3F
            handleNextMission('3F');
            break;
          case '3F':
            // 處理3F子類型的循環
            handleMissionChange(nurse.id, dayIndex, '3F');
            break;
          case 'CC':
            // CC後面是C
            handleNextMission('C');
            break;
          case 'C':
            // C後面是F
            handleNextMission('F');
            break;
          case 'F':
            // 處理F子類型的循環
            handleMissionChange(nurse.id, dayIndex, 'F');
            break;
          case 'HC':
            // 處理HC子類型的循環
            handleMissionChange(nurse.id, dayIndex, 'HC');
            break;
          default:
            // 如果是其他任務，清除
            handleMissionChange(nurse.id, dayIndex, null);
        }
      }
    } else if (nurse.identity === '恢復室護理師') {
      // 恢復室護理師的循環，週末只有P，工作日有P → 3F → PAR → C → 清除
      
      if (isWeekend) {
        // 週末只允許分配P任務
        if (!mission) {
          // 如果尚未分配任務，且P還沒有人分配，則分配P
          if (assignments['P'] === null) {
            handleMissionChange(nurse.id, dayIndex, 'P');
          }
        } else if (mission === 'P') {
          // 如果已經分配P，則清除
          handleMissionChange(nurse.id, dayIndex, null);
        } else {
          // 如果是其他任務，檢查P是否已分配
          if (assignments['P'] === null) {
            handleMissionChange(nurse.id, dayIndex, 'P');
          } else {
            // P已有人分配，則清除當前任務
            handleMissionChange(nurse.id, dayIndex, null);
          }
        }
      } else {
        // 工作日循環：P → 3F → PAR → C → 清除
        if (!mission) {
          // 第一次點擊，檢查P是否可分配
          handleNextMission('P');
        } else if (mission === 'P') {
          // P後面是3F
          handleNextMission('3F');
        } else if (mission?.startsWith('3F') || mission === '3F') {
          // 3F後面是PAR
          handleNextMission('PAR');
        } else if (mission?.startsWith('PAR')) {
          // PAR後面是C
          handleNextMission('C');
        } else if (mission === 'C') {
          // C後面是清除
          handleMissionChange(nurse.id, dayIndex, null);
        }
      }
    }
    
    function handleNextMission(baseType) {
      const availability = checkMissionAvailability(baseType);
      
      if (availability) {
        // 如果基本任務類型有空位，分配該任務
        handleMissionChange(nurse.id, dayIndex, availability === true ? baseType : availability);
      } else {
        // 根據任務類型處理下一個循環
        switch (baseType) {
          case 'OR':
            handleNextMission('DR');
            break;
          case 'DR':
            handleNextMission('3F');
            break;
          case '3F':
            if (nurse.identity === '麻醉專科護理師' || nurse.identity === '麻醉科Leader' || nurse.identity === '護理長') {
              handleNextMission('CC');
            } else if (nurse.identity === '恢復室護理師') {
              handleNextMission('PAR');
            }
            break;
          case 'CC':
            handleNextMission('C');
            break;
          case 'PAR':
            handleNextMission('C');
            break;
          case 'C':
            if (nurse.identity === '麻醉專科護理師' || nurse.identity === '麻醉科Leader' || nurse.identity === '護理長') {
              handleNextMission('F');
            } else {
              // 恢復室護理師在C之後直接清除
              handleMissionChange(nurse.id, dayIndex, null);
            }
            break;
          case 'F':
            if (nurse.identity === '麻醉專科護理師' || nurse.identity === '護理長') {
              handleNextMission('HC');
            } else {
              // 麻醉科Leader不分配HC，直接清除
              handleMissionChange(nurse.id, dayIndex, null);
            }
            break;
          case 'HC':
          case 'P':
          default:
            // 沒有下一個循環，清除任務
            handleMissionChange(nurse.id, dayIndex, null);
        }
      }
    }
  };

  return (
    <Box sx={{ padding: 1 }} id="weekly-schedule">
      <Typography variant="h4" gutterBottom sx={{ display: { xs: 'none', md: 'block' } }}>
        {formattedDate}週班表
      </Typography>
      
      <Box className="hide-for-pdf" sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
          <DatePicker
            views={['year', 'month']}
            label="選擇年月"
            minDate={new Date('2020-01-01')}
            maxDate={new Date('2030-12-31')}
            value={selectedDate}
            onChange={handleDateChange}
            onAccept={handleDateAccept}
            sx={{ width: 200 }}
            openTo="month"
            closeOnSelect={false}
            slotProps={{
              actionBar: {
                actions: ['cancel', 'accept'],
              },
              toolbar: {
                hidden: false,
              },
              textField: {
                size: 'small',
                sx: { '& .MuiInputBase-root': { height: 40 } }
              }
            }}
          />
        </LocalizationProvider>
        
        {/* 週別切換區域 - 桌面版使用按鈕組，手機版使用下拉選單 */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, ml: 2 }}>
          {Array.from({ length: weeksInMonth }, (_, i) => i + 1).map(week => (
            <Button 
              key={week}
              variant={currentWeek === week ? "contained" : "outlined"}
              color={currentWeek === week ? "primary" : "inherit"}
              onClick={() => selectWeek(week)}
              sx={{ minWidth: '60px', height: 40 }}
            >
              第{week}週
            </Button>
          ))}
        </Box>
        
        {/* 手機版下拉選單 */}
        <FormControl sx={{ display: { xs: 'block', md: 'none' }, minWidth: 120, ml: 2 }}>
          <InputLabel>週別</InputLabel>
          <Select
            value={currentWeek}
            onChange={(e) => selectWeek(e.target.value)}
            label="週別"
            size="small"
            sx={{ height: 40 }}
          >
            {Array.from({ length: weeksInMonth }, (_, i) => i + 1).map(week => (
              <MenuItem key={week} value={week}>
                第{week}週
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        {hasEditPermission && ( // 僅在有編輯權限時顯示
          <Button 
            variant="contained" 
            color="warning"
            onClick={generatePDF}
            disabled={!monthlySchedule.length}
            sx={{ ml: 2, display: { xs: 'none', md: 'block' }, height: 40 }}
          >
            生成 PDF
          </Button>
        )}
        
        <Button 
          variant="contained" 
          color="secondary"
          onClick={toggleShiftDisplay}
          disabled={!monthlySchedule.length || editMode}
          sx={{ ml: 2, display: { xs: 'none', md: 'block' }, height: 40 }}
        >
          {showShiftTime ? '顯示班次代碼' : '顯示班次時間'}
        </Button>
        
        {hasEditPermission && (
          <>
            <Button 
              variant="contained" 
              color={editMode ? "success" : "info"}
              onClick={toggleEditMode}
              disabled={!monthlySchedule.length || isSaving}
              sx={{ ml: 2, height: 40 }}
            >
              {isSaving ? '儲存中...' : (editMode ? '儲存工作分配' : '編輯工作分配')}
            </Button>
            <Button 
              variant="contained" 
              color="warning"
              onClick={resetWorkAssignments}
              disabled={!monthlySchedule.length || isSaving || editMode}
              sx={{ ml: 2, height: 40 }}
            >
              重置工作分配
            </Button>
          </>
        )}
      </Box>
      
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
          <CircularProgress />
        </Box>
      )}
      
      {localError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {typeof localError === 'string' ? localError : 
           (localError?.message || '操作過程中發生錯誤')}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      
      {currentWeekSchedule.length > 0 ? (
        <Box sx={{ position: 'relative' }}>
          <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 650, '& .MuiTableCell-root': { padding: '2px 2px' }, tableLayout: 'fixed' }} size="small">
              <TableHead>
                <TableRow sx={{ height: '28px' }}>
                  <TableCell 
                    align="center" 
                    width="60px" 
                    sx={{ 
                      padding: '1px 1px', 
                      fontSize: '0.8rem',
                      position: 'sticky',
                      left: 0,
                      backgroundColor: '#f5f5f5',
                      zIndex: 1
                    }}
                  >
                    姓名
                  </TableCell>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <TableCell key={i} align="center" padding="none" sx={{ padding: '1px 1px', fontSize: '0.8rem' }}>
                      <Box sx={{ lineHeight: 1 }}>
                        {getDayName(i)}
                        <br />
                        {getDateOfWeek(currentWeek - 1, i + 1)}
                      </Box>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {currentWeekSchedule.map((nurse) => (
                  <TableRow key={nurse.id} sx={{ height: '22px', maxHeight: '22px' }}>
                    <TableCell 
                      align="center" 
                      component="th" 
                      scope="row" 
                      sx={{ 
                        padding: '0px 2px', 
                        height: '22px', 
                        maxHeight: '22px', 
                        fontSize: '0.8rem',
                        position: 'sticky',
                        left: 0,
                        backgroundColor: 'white',
                        zIndex: 1
                      }}
                    >
                      {nurse.name}
                    </TableCell>
                    {nurse.shifts.map((shift, index) => (
                      <ShiftCell key={index} shift={shift} padding="none">
                        {renderCellContent(nurse, index)}
                      </ShiftCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* 工作快速分配區 - 只有當班表存在時才顯示，手機版隱藏 */}
          {currentWeekSchedule.length > 0 && !isLoading && (
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <Box sx={{ mt: 3, mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 'bold' }}>
                  工作快速分配區
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {/* 週次切換按鈕 */}
                  <ButtonGroup size="small" sx={{ mr: 2 }}>
                    {[...Array(weeksInMonth)].map((_, index) => (
                      <Button
                        key={index}
                        variant={currentWeek === index + 1 ? "contained" : "outlined"}
                        color={currentWeek === index + 1 ? "primary" : "inherit"}
                        onClick={() => selectWeek(index + 1)}
                        sx={{ 
                          minWidth: '40px', 
                          fontSize: '0.85rem',
                          fontWeight: currentWeek === index + 1 ? 'bold' : 'normal',
                          py: 0.5
                        }}
                      >
                        {`第${index + 1}週`}
                      </Button>
                    ))}
                  </ButtonGroup>
                  
                  {hasEditPermission && (
                    <Button 
                      variant="contained" 
                      color={editMode ? "success" : "info"}
                      onClick={toggleEditMode}
                      disabled={!monthlySchedule.length || isSaving}
                    >
                      {isSaving ? '儲存中...' : (editMode ? '儲存工作分配' : '編輯工作分配')}
                    </Button>
                  )}
                </Box>
              </Box>
              
              {editMode && hasEditPermission && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  點擊護理師名稱可循環切換工作分配。麻醉專科護理師循環順序：OR→DR→3F→CC→C→F→清除，週末只能分配CC；恢復室護理師工作日循環：P→3F→PAR→C→清除，週末僅有P選項。同一日內每個工作項目只能有一人分配（OR各房間、P、DR、PAR、C、HC均限一人），3F和F各限兩人（3F1/3F2、F1/F2）。
                </Alert>
              )}
              
              <TableContainer component={Paper} sx={{ mt: 1, mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#e0f2f1' }}>
                      <TableCell width="150px" sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                        日期
                      </TableCell>
                      <TableCell width="80px" sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                        人數
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                        白班工作人員
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.from({ length: 7 }).map((_, dayIndex) => {
                      const dayOfMonth = getDateOfWeek(currentWeek - 1, dayIndex + 1);
                      if (!dayOfMonth) return null; // 跳過無效日期
                      
                      // 從當前週排班中過濾出當天值白班的護理師，移除排除護理長的條件
                      const aShiftNurses = currentWeekSchedule.filter(nurse => 
                        nurse.shifts[dayIndex] === 'A'
                      );
                      
                      // 計算未分配人數
                      const unassignedCount = aShiftNurses.filter(nurse => {
                        const missionKey = `${nurse.id}-${currentWeek}-${dayIndex}`;
                        const mission = missionKey in missionValues ? missionValues[missionKey] : nurse.area_codes?.[dayIndex];
                        return !mission;
                      }).length;
                      
                      // 檢查是否為週末或特殊日期
                      const isWeekend = getDayName(dayIndex) === '六' || getDayName(dayIndex) === '日';
                      const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), dayOfMonth);
                      const dayOfWeek = date.getDay(); // 0是週日，1-5是週一到週五，6是週六
                      
                      return (
                        <TableRow key={dayIndex} sx={{ 
                          '&:nth-of-type(odd)': { bgcolor: 'rgba(0, 0, 0, 0.03)' },
                          ...(isWeekend ? { 
                            bgcolor: 'rgba(255, 220, 220, 0.1)',
                            borderLeft: '3px solid #ffb6c1',
                            '& td:first-of-type': { fontWeight: 'bold' }
                          } : {})
                        }}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {selectedDate.getMonth() + 1}/{dayOfMonth}({getDayName(dayIndex)})
                              {isWeekend && (
                                <Chip 
                                  label="週末" 
                                  size="small" 
                                  color="error" 
                                  variant="outlined"
                                  sx={{ ml: 1, height: '18px', fontSize: '0.7rem' }}
                                />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              badgeContent={unassignedCount} 
                              color="warning"
                              invisible={!editMode || unassignedCount === 0}
                              sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: '16px', minWidth: '16px', padding: '0 4px' } }}
                            >
                              <Typography variant="body2">
                                {aShiftNurses.length}人
                              </Typography>
                            </Badge>
                          </TableCell>
                          <TableCell sx={{ 
                            padding: '8px',
                            borderTop: '1px solid rgba(224, 224, 224, 0.5)',
                            borderBottom: '1px solid rgba(224, 224, 224, 0.5)',
                            backgroundColor: isWeekend ? 'rgba(255, 220, 220, 0.05)' : 'transparent'
                          }}>
                            {aShiftNurses.length > 0 ? (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {aShiftNurses.map((nurse) => {
                                  // 獲取該護理師的工作分配
                                  const missionKey = `${nurse.id}-${currentWeek}-${dayIndex}`;
                                  let mission;
                                  if (missionKey in missionValues) {
                                    mission = missionValues[missionKey];
                                  } else {
                                    mission = nurse.area_codes?.[dayIndex];
                                  }
                                  
                                  // 根據工作分配類型設置顏色
                                  let chipColor = mission ? "primary" : "default";
                                  if (mission?.startsWith('OR')) chipColor = "success";
                                  else if (mission === 'DR') chipColor = "primary";
                                  else if (mission?.startsWith('3F') || mission === 'PAR3F') chipColor = "warning";
                                  else if (mission === 'CC') chipColor = "secondary";
                                  else if (mission === 'C') chipColor = "info";
                                  else if (mission?.startsWith('F')) chipColor = "error";
                                  else if (mission === 'P') chipColor = "primary";
                                  else if (mission?.startsWith('HC')) chipColor = "secondary";
                                  
                                  const chipLabel = mission ? `${nurse.name}(${mission})` : nurse.name;
                                  
                                  // 判斷是否為恢復室護理師
                                  const isRecoveryNurse = nurse.identity === '恢復室護理師';
                                  
                                  return (
                                    <Tooltip key={nurse.id} title={editMode && hasEditPermission ? "點擊分配工作" : "工作分配狀態"}>
                                      <Chip 
                                        label={chipLabel}
                                        variant={mission ? "filled" : "outlined"}
                                        color={chipColor}
                                        size="small"
                                        onClick={editMode && hasEditPermission ? 
                                          () => handleMissionCycle(nurse, dayIndex, mission)
                                          : undefined}
                                        sx={{ 
                                          m: 0.3, 
                                          cursor: editMode && hasEditPermission ? 'pointer' : 'default',
                                          fontWeight: mission ? 'bold' : 'normal',
                                          // 恢復室護理師使用長方形風格
                                          ...(isRecoveryNurse && {
                                            borderRadius: '4px',  // 長方形風格
                                            height: '24px',       // 與其他護理師相同高度
                                            // 不調整字體大小，保持與麻醉專科護理師一致
                                          })
                                        }}
                                      />
                                    </Tooltip>
                                  );
                                })}
                              </Box>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                無白班工作人員
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
          
          {/* 單獨的工作分配統計表 - 只有當班表存在時才顯示 */}
          {currentWeekSchedule.length > 0 && !isLoading && (
            <>
          <Box sx={{ mt: 3, mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 'bold' }}>
              本週工作分配統計
            </Typography>
          </Box>
          <TableContainer component={Paper} sx={{ mt: 1, mb: 3 }}>
            <Table size="small" sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#e0f2f1' }}>
                  <TableCell width="80px" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                    工作類型
                  </TableCell>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <TableCell key={i} align="center" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                      {getDayName(i)}<br />
                      {getDateOfWeek(currentWeek - 1, i + 1)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {/* 麻醉專科護理師工作類型區域 */}
                <TableRow sx={{ borderTop: '2px solid #1976d2' }}>
                  <TableCell colSpan={8} sx={{ 
                    fontWeight: 'bold', 
                    fontSize: '0.9rem', 
                    backgroundColor: '#e3f2fd',
                    color: '#1976d2',
                    textAlign: 'center'
                  }}>
                    麻醉專科護理師工作分配
                  </TableCell>
                </TableRow>
                
                {/* OR開頭的工作類型 */}
                {allMissionTypes
                  .filter(type => type.startsWith('OR'))
                  .sort((a, b) => {
                    const numA = parseInt(a.replace('OR', '')) || 0;
                    const numB = parseInt(b.replace('OR', '')) || 0;
                    return numA - numB;
                  })
                  .map((missionType) => (
                    <TableRow key={missionType}>
                      <TableCell sx={{ 
                        fontSize: '0.8rem',
                        backgroundColor: '#e8f5e9',
                        paddingLeft: '16px'
                      }}>
                        {missionType}
                      </TableCell>
                      {calculateMissionStats.map((dayStat, dayIndex) => {
                        const count = dayStat[missionType] || 0;
                        const hasValue = count > 0;
                        const nurseNames = getNurseNamesByMission(dayIndex, missionType);
                        
                        return (
                          <TableCell 
                            key={dayIndex} 
                            align="center" 
                            sx={{ 
                              fontSize: '0.8rem',
                              fontWeight: hasValue ? 'bold' : 'normal',
                              color: hasValue ? '#2e7d32' : '#9e9e9e',
                              backgroundColor: hasValue ? 'rgba(33, 150, 243, 0.08)' : 'transparent',
                              maxWidth: '120px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: nurseNames.length > 2 ? 'normal' : 'nowrap'
                            }}
                          >
                            {hasValue ? (
                              <Tooltip title={nurseNames.join(', ')} arrow placement="top">
                                <span>{nurseNames.join(', ')}</span>
                              </Tooltip>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                }
                
                {/* 麻醉專科護理師的其他工作類型 */}
                {['DR', '3F', 'CC', 'C', 'F', 'HC'].map((missionType) => (
                  <TableRow key={missionType}>
                    <TableCell sx={{ 
                      fontSize: '0.8rem',
                      backgroundColor: '#e3f2fd',
                      paddingLeft: '16px'
                    }}>
                      {missionType}
                    </TableCell>
                    {calculateMissionStats.map((dayStat, dayIndex) => {
                      const count = dayStat[missionType] || 0;
                      const hasValue = count > 0;
                      const nurseNames = getNurseNamesByMission(dayIndex, missionType);
                      
                      return (
                        <TableCell 
                          key={dayIndex} 
                          align="center" 
                          sx={{ 
                            fontSize: '0.8rem',
                            fontWeight: hasValue ? 'bold' : 'normal',
                            color: hasValue ? '#1976d2' : '#9e9e9e',
                            backgroundColor: hasValue ? 'rgba(33, 150, 243, 0.08)' : 'transparent',
                            maxWidth: '120px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: nurseNames.length > 2 ? 'normal' : 'nowrap'
                          }}
                        >
                          {hasValue ? (
                            <Tooltip title={nurseNames.join(', ')} arrow placement="top">
                              <span>{nurseNames.join(', ')}</span>
                            </Tooltip>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}

                {/* 恢復室護理師工作類型區域 */}
                <TableRow sx={{ borderTop: '2px solid #ff9800' }}>
                  <TableCell colSpan={8} sx={{ 
                    fontWeight: 'bold', 
                    fontSize: '0.9rem', 
                    backgroundColor: '#fff8e1',
                    color: '#ff9800',
                    textAlign: 'center'
                  }}>
                    恢復室護理師工作分配
                  </TableCell>
                </TableRow>
                
                {/* 恢復室護理師的工作類型 */}
                {['P', 'PAR'].map((missionType) => (
                  <TableRow key={missionType}>
                    <TableCell sx={{ 
                      fontSize: '0.8rem',
                      backgroundColor: '#fff8e1',
                      paddingLeft: '16px'
                    }}>
                      {missionType}
                    </TableCell>
                    {calculateMissionStats.map((dayStat, dayIndex) => {
                      const count = dayStat[missionType] || 0;
                      const hasValue = count > 0;
                      const nurseNames = getNurseNamesByMission(dayIndex, missionType);
                      
                      return (
                        <TableCell 
                          key={dayIndex} 
                          align="center" 
                          sx={{ 
                            fontSize: '0.8rem',
                            fontWeight: hasValue ? 'bold' : 'normal',
                            color: hasValue ? '#ff9800' : '#9e9e9e',
                            backgroundColor: hasValue ? 'rgba(33, 150, 243, 0.08)' : 'transparent',
                            maxWidth: '120px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: nurseNames.length > 2 ? 'normal' : 'nowrap'
                          }}
                        >
                          {hasValue ? (
                            <Tooltip title={nurseNames.join(', ')} arrow placement="top">
                              <span>{nurseNames.join(', ')}</span>
                            </Tooltip>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                
                {/* 統計未預定義的工作類型 */}
                {calculateMissionStats.some(dayStat => 
                  Object.keys(dayStat).some(type => !allMissionTypes.includes(type))
                ) && (
                  <>
                    <TableRow sx={{ borderTop: '2px solid #9c27b0' }}>
                      <TableCell colSpan={8} sx={{ 
                        fontWeight: 'bold', 
                        fontSize: '0.9rem', 
                        backgroundColor: '#f3e5f5',
                        color: '#9c27b0',
                        textAlign: 'center'
                      }}>
                        其他工作分配
                      </TableCell>
                    </TableRow>
                    
                    {calculateMissionStats[0] && Object.keys(calculateMissionStats[0])
                      .filter(type => !allMissionTypes.includes(type) && type !== 'undefined')
                      .map(missionType => (
                        <TableRow key={missionType}>
                          <TableCell sx={{ 
                            fontSize: '0.8rem', 
                            backgroundColor: '#f3e5f5',
                            paddingLeft: '16px'
                          }}>
                            {missionType}
                          </TableCell>
                          {calculateMissionStats.map((dayStat, dayIndex) => {
                            const count = dayStat[missionType] || 0;
                            const hasValue = count > 0;
                            const nurseNames = getNurseNamesByMission(dayIndex, missionType);
                            
                            return (
                              <TableCell 
                                key={dayIndex} 
                                align="center" 
                                sx={{ 
                                  fontSize: '0.8rem',
                                  fontWeight: hasValue ? 'bold' : 'normal',
                                  color: hasValue ? '#9c27b0' : '#9e9e9e',
                                  backgroundColor: hasValue ? 'rgba(33, 150, 243, 0.08)' : 'transparent',
                                  maxWidth: '120px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: nurseNames.length > 2 ? 'normal' : 'nowrap'
                                }}
                              >
                                {hasValue ? (
                                  <Tooltip title={nurseNames.join(', ')} arrow placement="top">
                                    <span>{nurseNames.join(', ')}</span>
                                  </Tooltip>
                                ) : (
                                  '-'
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    }
                  </>
                )}
                
                {/* 未安排白班人員統計 */}
                <TableRow sx={{ borderTop: '2px solid #e91e63' }}>
                  <TableCell colSpan={8} sx={{ 
                    fontWeight: 'bold', 
                    fontSize: '0.9rem', 
                    backgroundColor: '#fce4ec',
                    color: '#e91e63',
                    textAlign: 'center'
                  }}>
                    未安排白班人員統計
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell sx={{ 
                    fontSize: '0.8rem', 
                    backgroundColor: '#fce4ec', 
                    color: '#c2185b',
                    fontWeight: 'bold',
                    paddingLeft: '16px'
                  }}>
                    未安排白班人員
                  </TableCell>
                  {Array.from({ length: 7 }).map((_, dayIndex) => {
                    const unassignedNurses = getUnassignedAShiftNurses(dayIndex);
                    const count = unassignedNurses.length;
                    const hasValue = count > 0;
                    
                    return (
                      <TableCell 
                        key={dayIndex} 
                        align="center" 
                        sx={{ 
                          fontSize: '0.8rem',
                          fontWeight: hasValue ? 'bold' : 'normal',
                          color: hasValue ? '#e91e63' : '#9e9e9e',
                          backgroundColor: hasValue ? 'rgba(33, 150, 243, 0.08)' : 'transparent',
                          maxWidth: '120px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: unassignedNurses.length > 2 ? 'normal' : 'nowrap'
                        }}
                      >
                        {hasValue ? (
                          <Tooltip title={unassignedNurses.join(', ')} arrow placement="top">
                            <span>{unassignedNurses.join(', ')}</span>
                          </Tooltip>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
            </>
          )}
        </Box>
      ) : !isLoading && (
        <Paper sx={{ padding: 3, marginTop: 2 }}>
          <Typography variant="body1" align="center">
            尚未生成班表，請先在月班表頁面生成月班表
          </Typography>
        </Paper>
      )}
      
      {/* 隱藏的PDF內容 */}
      <Box id="pdf-content" sx={{ display: 'none' }}>
        {weeklySchedule.map((weekSchedule, weekIndex) => (
          <Box key={weekIndex} className="week-container" sx={{ position: 'relative', mb: 4 }}>
            <Typography variant="h5" sx={{ textAlign: 'center', mb: 2 }}>
              麻醉科護理人員值班週表
            </Typography>
            
            <Typography 
              variant="body1" 
              sx={{ 
                textAlign: 'center',
                mb: 1,
                fontSize: '14px' 
              }}
            >
              {formattedDate}
            </Typography>
            
            <TableContainer component={Paper}>
              <Table sx={{ width: '100%' }}>
                <TableHead>
                  <TableRow>
                    <TableCell align="center" width="80px">姓名</TableCell>
                    {Array.from({ length: 7 }).map((_, i) => (
                      <TableCell key={i} align="center" padding="none">
                        {getDayName(i)}<br />
                        {getDateOfWeek(weekIndex, i + 1)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {weekSchedule.map((nurse) => (
                    <TableRow key={nurse.id}>
                      <TableCell align="center">
                        {nurse.name}
                      </TableCell>
                      {nurse.shifts.map((shift, index) => (
                        <ShiftCell key={index} shift={shift} padding="none">
                          {shift ? (
                            nurse.missions?.[index] || missionValues[`${nurse.id}-${weekIndex+1}-${index}`] || 
                            (showShiftTime ? convertShiftToTime(shift) : shift)
                          ) : ''}
                        </ShiftCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ))}
      </Box>
      
      <style jsx="true">{`
        @media print {
          .hide-for-pdf {
            display: none !important;
          }
          
          .week-container {
            page-break-after: always;
          }
        }
      `}</style>
    </Box>
  );
};

export default WeeklySchedule; 