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
  const [pmValues, setPmValues] = useState({}); // 新增PM值的狀態
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
      saveWorkAssignments();
    } else {
      // 進入編輯模式時，從currentWeekSchedule同步數據到missionValues
      syncApiDataToMissionValue(currentWeekSchedule);
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
      
      // 重置本地狀態 - 清空所有missionValues和pmValues
      setMissionValues({});
      setPmValues({});
      
      // 在本地立即更新area_codes，將所有護理師的area_codes設為null
      const updatedSchedule = [...monthlySchedule];
      
      // 更新本地數據，將所有area_codes重置為null
      updatedSchedule.forEach(nurse => {
        nurse.area_codes = Array(31).fill(null);
      });
      
      // 更新store中的數據
      useScheduleStore.setState({ monthlySchedule: updatedSchedule });
      
      setIsSaving(false);
      // setSuccess(`成功重置 ${response.data.reset_count} 個工作分配`);
      
      // setTimeout(() => setSuccess(null), 3000);
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

  // 從API數據同步到missionValue
  const syncApiDataToMissionValue = (scheduleData) => {
    const newMissionValues = {};
    const newPmValues = {}; // 新增PM值的狀態
    
    scheduleData.forEach(nurse => {
      if (nurse.area_codes) {
        nurse.area_codes.forEach((areaCode, dayIndex) => {
          if (areaCode) {
            // 計算這個日期屬於哪一週
            const dayOfMonth = dayIndex + 1;
            const weekIndex = Math.floor((dayOfMonth - 1) / 7);
            const dayInWeek = (dayOfMonth - 1) % 7;
            
            // 構建key: ${nurseId}-${weekNum}-${dayInWeek}
            const key = `${nurse.id}-${weekIndex + 1}-${dayInWeek}`;
            
            // 檢查是否包含斜線（複選格式）
            if (areaCode.includes('/')) {
              const parts = areaCode.split('/');
              newMissionValues[key] = parts[0]; // 主要工作分配
              newPmValues[key] = parts[1]; // PM工作分配
            } else {
              newMissionValues[key] = areaCode;
              // PM值不設定，表示沒有選擇
            }
          }
        });
      }
    });
    
    setMissionValues(newMissionValues);
    setPmValues(newPmValues); // 設定PM值
    console.log('已同步API數據到missionValue:', Object.keys(newMissionValues).length, '個工作分配');
    console.log('已同步API數據到pmValue:', Object.keys(newPmValues).length, '個PM工作分配');
  };

  // 保存工作分配更改
  const saveWorkAssignments = async () => {
    try {
      setIsSaving(true);

      // 取得當前年月
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;
      
      // 準備批量更新數據 - 結合missionValues和pmValues
      const bulkUpdates = [];
      
      // 收集所有需要處理的key
      const allKeys = new Set([...Object.keys(missionValues), ...Object.keys(pmValues)]);
      
      // 找出所有需要更新的工作分配
      for (const key of allKeys) {
        // 解析鍵值 `${nurseId}-${currentWeek}-${dayIndex}`
        const [nurseId, weekNum, dayIndex] = key.split('-');
        if (!nurseId || !weekNum || dayIndex === undefined) continue;
        
        // 計算實際日期
        const dayOfMonth = parseInt(getDateOfWeek(parseInt(weekNum) - 1, parseInt(dayIndex) + 1));
        if (!dayOfMonth) continue;
        
        // 格式化日期字符串
        const dateString = `${year}-${month < 10 ? '0' + month : month}-${dayOfMonth < 10 ? '0' + dayOfMonth : dayOfMonth}`;
        
        // 構建area_code值
        const missionValue = missionValues[key];
        const pmValue = pmValues[key];
        
        let areaCode = null;
        if (missionValue && pmValue) {
          // 兩者都有，使用斜線組合
          areaCode = `${missionValue}/${pmValue}`;
        } else if (missionValue) {
          // 只有主要工作分配
          areaCode = missionValue;
        } else if (pmValue) {
          // 只有PM工作分配（雖然理論上不應該發生，但為了完整性處理）
          areaCode = pmValue;
        }
        
        // 添加到批量更新列表
        bulkUpdates.push({
          user_id: parseInt(nurseId),
          date: dateString,
          area_code: areaCode,
          year: year,
          month: month
        });
      }
      
      // 執行批量更新
      if (bulkUpdates.length > 0) {
        const response = await apiService.schedule.bulkUpdateAreaCodes(bulkUpdates);
        if (!response.data.success) {
          throw new Error(response.data.message || "批量更新工作分配失敗");
        }
        
        // 更新本地area_codes數據
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
        
        // 保存成功後清除相關頁面快取
        console.log('保存成功，清除相關頁面快取');
        const { clearScheduleCache } = await import('../utils/scheduleCache');
        clearScheduleCache('dashboard', year, month);
        clearScheduleCache('weekly-schedule', year, month);
        clearScheduleCache('shift-swap', year, month);
        
        setIsSaving(false);
        // setSuccess(`成功儲存 ${bulkUpdates.length} 個工作分配`);
        // setTimeout(() => setSuccess(null), 3000);
      } else {
        setIsSaving(false);
        // setSuccess('沒有需要儲存的工作分配變更');
        // setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setIsSaving(false);
      console.error('保存工作分配失敗:', err);
      
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
      '3F1': null, '3F2': null, '3F3': null,
      CC: null, 
      F1: null, F2: null, 
      P: null, PAR1: null, PAR2: null, C: null,
      HC1: null, HC2: null, HC3: null,
      TAE: null, PCA: null, SEC: null, PAR: null,
      // PM相關的工作分配
      PMTAE: null, PMC: null, PMF2: null,
      PM: null
    };
    
    // 遍歷所有護理師的當天工作分配
    currentWeekSchedule.forEach(nurse => {
      // 檢查是否是A班
      if (nurse.shifts[dayIndex] !== 'A') return;
      
      // 獲取任務值的key
      const missionKey = `${nurse.id}-${currentWeek}-${dayIndex}`;
      
      // 獲取主要工作分配和PM工作分配
      const mission = missionValues[missionKey];
      const pmMission = pmValues[missionKey];
      
      // 處理主要工作分配
      if (mission) {
        if (mission === '3F' && nurse.identity === '恢復室護理師') {
          assignments['3F2'] = nurse.id;
        } else if (mission === '3F_Recovery') {
          // 兼容舊的3F_Recovery格式
          assignments['3F2'] = nurse.id;
        } else {
          assignments[mission] = nurse.id;
        }
      }
      
      // 處理PM工作分配
      if (pmMission) {
        assignments[pmMission] = nurse.id;
      }
    });
    
    return assignments;
  };

  // 檢查特定任務類型是否已滿
  const isMissionFull = (dayIndex, missionType, identity) => {
    const assignments = getCurrentDayAssignments(dayIndex);
    
    // 對於基本任務類型，檢查是否已經分配
    if (missionType === 'DR' || missionType === 'CC' || missionType === 'P' || 
        missionType === 'C' || missionType === 'TAE') {
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
        // 恢復室護理師只能排3F2
        return assignments['3F2'] !== null;
      } else {
        // 麻醉專科護理師檢查3F1、3F2和3F3
        return assignments['3F1'] !== null && assignments['3F2'] !== null && assignments['3F3'] !== null;
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
    
    // 任務值的key
    const key = `${nurseId}-${currentWeek}-${dayIndex}`;
    const currentMission = missionValues[key];
    
    // 計算當前是星期幾
    const currentDate = parseInt(getDateOfWeek(currentWeek - 1, dayIndex + 1));
    if (!currentDate) return null;
    
    const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), currentDate);
    const dayOfWeek = date.getDay();

    // 獲取當天所有已分配的工作
    const getAssignedMissions = () => {
      const assigned = new Set();
      currentWeekSchedule.forEach(nurse => {
        const missionKey = `${nurse.id}-${currentWeek}-${dayIndex}`;
        const mission = missionValues[missionKey];
        const pmMission = pmValues[missionKey];
        
        if (mission) {
          assigned.add(mission);
        }
        if (pmMission) {
          assigned.add(pmMission);
        }
      });
      return assigned;
    };

    // 獲取其他護理師已分配的工作（排除當前護理師）
    const getOtherAssignedMissions = () => {
      const assigned = new Set();
      currentWeekSchedule.forEach(nurse => {
        if (nurse.id === nurseId) return; // 排除當前護理師
        
        const missionKey = `${nurse.id}-${currentWeek}-${dayIndex}`;
        const mission = missionValues[missionKey];
        const pmMission = pmValues[missionKey];
        
        if (mission) {
          assigned.add(mission);
        }
        if (pmMission) {
          assigned.add(pmMission);
        }
      });
      return assigned;
    };

    // 檢查按鈕是否應該被隱藏
    const shouldHideButton = (buttonType) => {
      const assignedMissions = getOtherAssignedMissions(); // 使用排除當前護理師的函數
      
      if (buttonType === 'OR') {
        const baseOptions = ['OR2', 'OR3', 'OR5', 'OR6', 'OR7', 'OR8', 'OR9', 'OR11', 'OR13'];
        let options = baseOptions;
        
        if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) { // 週一、週三、週五
          options = ['OR1', ...baseOptions];
        }
        
        return options.every(option => assignedMissions.has(option));
        
      } else if (buttonType === 'DR') {
        // DR現在只有DR一個選項
        return assignedMissions.has('DR');
        
      } else if (buttonType === '3F') {
        const options = ['3F1', '3F2', '3F3'];
        return options.every(option => assignedMissions.has(option));
        
      } else if (buttonType === 'HC') {
        const options = ['HC1', 'HC2', 'HC3'];
        return options.every(option => assignedMissions.has(option));
        
      } else if (buttonType === 'F') {
        let options = ['F1', 'F2', 'PCA', 'SEC'];
        
        if (dayOfWeek === 3 || dayOfWeek === 4) { // 週三、週四加入TAE
          options = ['F1', 'F2', 'TAE', 'PCA', 'SEC'];
        }
        
        return options.every(option => assignedMissions.has(option));
        
      } else if (buttonType === 'C') {
        return assignedMissions.has('C');
        
      } else if (buttonType === 'CC') {
        return assignedMissions.has('CC');
        
      } else if (buttonType === 'PAR') {
        return assignedMissions.has('PAR');
        
      } else if (buttonType === 'PCA') {
        return assignedMissions.has('PCA');
        
      } else if (buttonType === '3F2') {
        return assignedMissions.has('3F2');
        
      } else if (buttonType === 'HC3') {
        return assignedMissions.has('HC3');
      }
      
      return false;
    };

    // 按鈕樣式
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
      whiteSpace: 'nowrap',
      overflow: 'hidden',
    };

    // 按鈕顏色配置
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
        'HC': { 
          active: { bg: '#6a1b9a', text: 'white', border: '#6a1b9a' },
          inactive: { bg: '#f0f0f0', text: '#757575', border: '#bdbdbd' }
        },
        'PAR': { 
          active: { bg: '#b71c1c', text: 'white', border: '#b71c1c' },
          inactive: { bg: '#f0f0f0', text: '#757575', border: '#bdbdbd' }
        },
        'PCA': { 
          active: { bg: '#1a237e', text: 'white', border: '#1a237e' },
          inactive: { bg: '#f0f0f0', text: '#757575', border: '#bdbdbd' }
        },
        'PM': { 
          active: { bg: '#e91e63', text: 'white', border: '#e91e63' },
          inactive: { bg: '#f0f0f0', text: '#757575', border: '#bdbdbd' }
        }
      };
      
      return colors[type] || colors['OR'];
    };
    
    // 檢查按鈕是否應該被高亮（選中狀態）
    const isButtonHighlighted = (buttonType) => {
      if (buttonType === 'PM') {
        return pmValues[key] !== undefined && pmValues[key] !== null && pmValues[key] !== '';
      }
      
      if (!currentMission) return false;
      
      if (buttonType === 'OR') {
        return currentMission && currentMission.startsWith('OR');
      } else if (buttonType === 'DR') {
        return currentMission === 'DR';
      } else if (buttonType === '3F') {
        return currentMission && currentMission.startsWith('3F');
      } else if (buttonType === 'F') {
        return currentMission && (currentMission.startsWith('F') || currentMission === 'PCA' || currentMission === 'SEC' || currentMission === 'TAE');
      } else if (buttonType === 'HC') {
        return currentMission && currentMission.startsWith('HC');
      }
      
      return currentMission === buttonType;
    };

    // 獲取按鈕顯示文字
    const getButtonDisplayText = (buttonType) => {
      if (buttonType === 'PM') {
        const pmValue = pmValues[key];
        return pmValue || 'PM';
      }
      
      if (!isButtonHighlighted(buttonType)) {
        return buttonType;
      }
      
      // 如果被選中，顯示具體的工作分配
      if (buttonType === 'OR' && currentMission?.startsWith('OR')) {
        return currentMission;
      } else if (buttonType === 'DR' && currentMission === 'DR') {
        return currentMission;
      } else if (buttonType === '3F' && currentMission?.startsWith('3F')) {
        return currentMission;
      } else if (buttonType === 'F' && (currentMission?.startsWith('F') || currentMission === 'PCA' || currentMission === 'SEC' || currentMission === 'TAE')) {
        return currentMission;
      } else if (buttonType === 'HC' && currentMission?.startsWith('HC')) {
        return currentMission;
      }
      
      return currentMission || buttonType;
    };

    // 創建按鈕的共用函式
    const createButton = (buttonType, onClick) => (
          <Button 
        key={buttonType}
            size="small"
            variant="contained"
        onClick={onClick}
            sx={{
              ...btnStyle,
          backgroundColor: isButtonHighlighted(buttonType)
            ? getButtonColor(buttonType, true).active.bg 
            : getButtonColor(buttonType, false).inactive.bg,
          color: isButtonHighlighted(buttonType)
            ? getButtonColor(buttonType, true).active.text 
            : getButtonColor(buttonType, false).inactive.text,
          borderColor: isButtonHighlighted(buttonType)
            ? getButtonColor(buttonType, true).active.border 
            : getButtonColor(buttonType, false).inactive.border,
        }}
      >
        {getButtonDisplayText(buttonType)}
          </Button>
        );

    // 麻醉專科護理師/麻醉科Leader/護理長的按鈕邏輯
      if (identity === '麻醉專科護理師' || identity === '麻醉科Leader' || identity === '護理長') {
      const buttons = [];
      
      // OR 按鈕 - 檢查是否應該隱藏
      if (!shouldHideButton('OR')) {
        buttons.push(createButton('OR', () => handleMissionCycle(nurseId, dayIndex, 'OR')));
      }
      
      // DR 按鈕 - 檢查是否應該隱藏
      if (!shouldHideButton('DR')) {
        buttons.push(createButton('DR', () => handleMissionCycle(nurseId, dayIndex, 'DR')));
      }
      
      // C 按鈕 - 檢查是否應該隱藏
      if (!shouldHideButton('C')) {
        buttons.push(createButton('C', () => handleMissionCycle(nurseId, dayIndex, 'C')));
      }
      
      // CC 按鈕 - 檢查是否應該隱藏
      if (!shouldHideButton('CC')) {
        buttons.push(createButton('CC', () => handleMissionCycle(nurseId, dayIndex, 'CC')));
      }
      
      // 3F 按鈕 - 檢查是否應該隱藏
      if (!shouldHideButton('3F')) {
        buttons.push(createButton('3F', () => handleMissionCycle(nurseId, dayIndex, '3F')));
      }
      
      // HC 按鈕 - 檢查是否應該隱藏
      if (!shouldHideButton('HC')) {
        buttons.push(createButton('HC', () => handleMissionCycle(nurseId, dayIndex, 'HC')));
      }
      
      // F 按鈕 - 檢查是否應該隱藏
      if (!shouldHideButton('F')) {
        buttons.push(createButton('F', () => handleMissionCycle(nurseId, dayIndex, 'F')));
      }
      
      // PM 按鈕 - 只在週一到週五顯示（dayOfWeek 1-5）
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        buttons.push(createButton('PM', () => handlePmCycle(nurseId, dayIndex)));
      }
    
      return (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'row', 
          flexWrap: 'wrap', 
          gap: 0.2, 
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          m: 0, 
          p: 0.2, 
          width: '100%', 
          height: '100%',
          overflow: 'visible',
        }}>
          {buttons}
        </Box>
      );
    }
    
    // 恢復室護理師的按鈕邏輯
    if (identity === '恢復室護理師') {
      const buttons = [];
      
      // PAR 按鈕 - 檢查是否應該隱藏
      if (!shouldHideButton('PAR')) {
        buttons.push(createButton('PAR', () => handleMissionCycle(nurseId, dayIndex, 'PAR')));
      }
      
      // PCA 按鈕 - 檢查是否應該隱藏
      if (!shouldHideButton('PCA')) {
        buttons.push(createButton('PCA', () => handleMissionCycle(nurseId, dayIndex, 'PCA')));
      }
      
      // C 按鈕 - 檢查是否應該隱藏
      if (!shouldHideButton('C')) {
        buttons.push(createButton('C', () => handleMissionCycle(nurseId, dayIndex, 'C')));
      }
      
      // 3F2 按鈕 - 檢查是否應該隱藏
      if (!shouldHideButton('3F2')) {
        buttons.push(createButton('3F2', () => handleMissionCycle(nurseId, dayIndex, '3F2')));
      }
      
      // HC3 按鈕 - 檢查是否應該隱藏
      if (!shouldHideButton('HC3')) {
        buttons.push(createButton('HC3', () => handleMissionCycle(nurseId, dayIndex, 'HC3')));
      }
      
      return (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'row', 
          flexWrap: 'wrap', 
          gap: 0.2, 
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          m: 0, 
          p: 0.2, 
          width: '100%', 
          height: '100%',
          overflow: 'visible',
        }}>
          {buttons}
        </Box>
      );
    }
    
    return null;
  };

  // 處理工作分配循環邏輯
  const handleMissionCycle = (nurseId, dayIndex, mission) => {
    // 查找該護理師該天的班次
    const nurseData = currentWeekSchedule.find(n => n.id === nurseId);
    if (!nurseData) return;
    
    const shift = nurseData.shifts[dayIndex];
    
    // 確保只有A班才能修改工作分區
    if (shift !== 'A') {
      console.log(`只有A班才能修改工作分區，當前班次為 ${shift}`);
      return;
    }

    // 任務值的key
    const key = `${nurseId}-${currentWeek}-${dayIndex}`;
    const currentMission = missionValues[key];
    
    // 計算當前是星期幾
    const currentDate = parseInt(getDateOfWeek(currentWeek - 1, dayIndex + 1));
    if (!currentDate) return;
    
    const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), currentDate);
    const dayOfWeek = date.getDay();

    // 獲取當天所有已分配的工作（排除當前護理師）
    const getAssignedMissions = () => {
      const assigned = new Set();
      currentWeekSchedule.forEach(nurse => {
        if (nurse.id === nurseId) return; // 排除當前護理師
        
        const otherMissionKey = `${nurse.id}-${currentWeek}-${dayIndex}`;
        const otherMission = missionValues[otherMissionKey];
        const otherPmMission = pmValues[otherMissionKey];
        
        if (otherMission) {
          assigned.add(otherMission);
        }
        if (otherPmMission) {
          assigned.add(otherPmMission);
        }
      });
      return assigned;
    };

    // 獲取新的工作分配值（考慮已分配的工作）
    const getNextMissionValue = (baseType) => {
      const assignedMissions = getAssignedMissions();
      
      if (baseType === 'OR') {
        // OR 循環邏輯：OR2, OR3, OR5, OR6, OR7, OR8, OR9, OR11, OR13, 取消
        // 週一、週三、週五額外有 OR1
        const baseOptions = ['OR2', 'OR3', 'OR5', 'OR6', 'OR7', 'OR8', 'OR9', 'OR11', 'OR13'];
        let options = baseOptions;
        
        if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) { // 週一、週三、週五
          options = ['OR1', ...baseOptions];
        }
        
        // 過濾掉已分配的選項
        const availableOptions = options.filter(option => !assignedMissions.has(option));
        
        if (!currentMission || !currentMission.startsWith('OR')) {
          // 如果沒有當前任務或不是OR類型，選擇第一個可用選項
          return availableOptions.length > 0 ? availableOptions[0] : null;
        }
        
        const currentIndex = options.indexOf(currentMission);
        if (currentIndex === -1) {
          // 當前任務不在列表中，選擇第一個可用選項
          return availableOptions.length > 0 ? availableOptions[0] : null;
        }
        
        // 從當前位置開始查找下一個可用選項
        for (let i = currentIndex + 1; i < options.length; i++) {
          if (!assignedMissions.has(options[i])) {
            return options[i];
          }
        }
        
        // 如果沒有找到可用選項，返回取消
        return null;
        
      } else if (baseType === 'DR') {
        // DR 循環邏輯：DR, 取消（移除TAE）
        if (currentMission === 'DR' || assignedMissions.has('DR')) {
          return null; // 取消
        }
        return 'DR';
        
      } else if (baseType === 'C') {
        // C 循環邏輯：C, 取消
        if (currentMission === 'C' || assignedMissions.has('C')) {
          return null; // 取消
        }
        return 'C';
        
      } else if (baseType === 'CC') {
        // CC 循環邏輯：CC, 取消
        if (currentMission === 'CC' || assignedMissions.has('CC')) {
          return null; // 取消
        }
        return 'CC';
        
      } else if (baseType === '3F') {
        // 3F 循環邏輯：3F1, 3F2, 3F3, 取消
        const options = ['3F1', '3F2', '3F3'];
        
        // 過濾掉已分配的選項
        const availableOptions = options.filter(option => !assignedMissions.has(option));
        
        if (!currentMission || !currentMission.startsWith('3F')) {
          return availableOptions.length > 0 ? availableOptions[0] : null;
        }
        
        const currentIndex = options.indexOf(currentMission);
        if (currentIndex === -1) {
          return availableOptions.length > 0 ? availableOptions[0] : null;
        }
        
        // 從當前位置開始查找下一個可用選項
        for (let i = currentIndex + 1; i < options.length; i++) {
          if (!assignedMissions.has(options[i])) {
            return options[i];
          }
        }
        
        return null; // 取消
        
      } else if (baseType === 'HC') {
        // HC 循環邏輯：HC1, HC2, HC3, 取消
        const options = ['HC1', 'HC2', 'HC3'];
        
        // 過濾掉已分配的選項
        const availableOptions = options.filter(option => !assignedMissions.has(option));
        
        if (!currentMission || !currentMission.startsWith('HC')) {
          return availableOptions.length > 0 ? availableOptions[0] : null;
        }
        
        const currentIndex = options.indexOf(currentMission);
        if (currentIndex === -1) {
          return availableOptions.length > 0 ? availableOptions[0] : null;
        }
        
        // 從當前位置開始查找下一個可用選項
        for (let i = currentIndex + 1; i < options.length; i++) {
          if (!assignedMissions.has(options[i])) {
            return options[i];
          }
        }
        
        return null; // 取消
        
      } else if (baseType === 'F') {
        // F 循環邏輯：F1, F2, TAE（週三週四）, PCA, SEC, 取消
        let options = ['F1', 'F2', 'PCA', 'SEC'];
        
        if (dayOfWeek === 3 || dayOfWeek === 4) { // 週三、週四加入TAE
          options = ['F1', 'F2', 'TAE', 'PCA', 'SEC'];
        }
        
        // 過濾掉已分配的選項
        const availableOptions = options.filter(option => !assignedMissions.has(option));
        
        if (!currentMission || (!currentMission.startsWith('F') && currentMission !== 'PCA' && currentMission !== 'SEC' && currentMission !== 'TAE')) {
          return availableOptions.length > 0 ? availableOptions[0] : null;
        }
        
        const currentIndex = options.indexOf(currentMission);
        if (currentIndex === -1) {
          return availableOptions.length > 0 ? availableOptions[0] : null;
        }
        
        // 從當前位置開始查找下一個可用選項
        for (let i = currentIndex + 1; i < options.length; i++) {
          if (!assignedMissions.has(options[i])) {
            return options[i];
          }
        }
        
        return null; // 取消
        
      } else if (baseType === 'PAR') {
        // PAR 循環邏輯：PAR, 取消
        if (currentMission === 'PAR' || assignedMissions.has('PAR')) {
          return null; // 取消
        }
        return 'PAR';
        
      } else if (baseType === 'PCA') {
        // PCA 循環邏輯：PCA, 取消
        if (currentMission === 'PCA' || assignedMissions.has('PCA')) {
          return null; // 取消
        }
        return 'PCA';
        
      } else if (baseType === '3F2') {
        // 3F2 循環邏輯：3F2, 取消
        if (currentMission === '3F2' || assignedMissions.has('3F2')) {
          return null; // 取消
        }
        return '3F2';
        
      } else if (baseType === 'HC3') {
        // HC3 循環邏輯：HC3, 取消
        if (currentMission === 'HC3' || assignedMissions.has('HC3')) {
          return null; // 取消
        }
        return 'HC3';
      }
      
      return null;
    };

    const nextValue = getNextMissionValue(mission);
    
    // 更新工作分配
    const newMissionValues = { ...missionValues };
    
    if (nextValue === null) {
      delete newMissionValues[key]; // 取消分配
    } else {
      newMissionValues[key] = nextValue;
    }
    
    setMissionValues(newMissionValues);
  };

  // 處理PM工作分配循環邏輯
  const handlePmCycle = (nurseId, dayIndex) => {
    // 查找該護理師該天的班次
    const nurseData = currentWeekSchedule.find(n => n.id === nurseId);
    if (!nurseData) return;
    
    const shift = nurseData.shifts[dayIndex];
    
    // 確保只有A班才能修改工作分區
    if (shift !== 'A') {
      console.log(`只有A班才能修改工作分區，當前班次為 ${shift}`);
      return;
    }

    // PM任務值的key
    const key = `${nurseId}-${currentWeek}-${dayIndex}`;
    const currentPmMission = pmValues[key];
    
    // 獲取當天所有其他護理師已分配的PM工作（排除當前護理師）
    const getOtherAssignedPmMissions = () => {
      const assigned = new Set();
      currentWeekSchedule.forEach(nurse => {
        if (nurse.id === nurseId) return; // 排除當前護理師
        
        const pmMissionKey = `${nurse.id}-${currentWeek}-${dayIndex}`;
        const pmMission = pmValues[pmMissionKey];
        
        if (pmMission) {
          assigned.add(pmMission);
        }
      });
      return assigned;
    };
    
    // PM循環邏輯：PMTAE → PMC → PMF2 → 取消
    const pmOptions = ['PMTAE', 'PMC', 'PMF2'];
    const assignedPmMissions = getOtherAssignedPmMissions();
    
    // 過濾掉已被其他護理師分配的PM選項
    const availablePmOptions = pmOptions.filter(option => !assignedPmMissions.has(option));
    
    let nextPmValue = null;
    
    if (!currentPmMission) {
      // 沒有當前PM任務，選擇第一個可用選項
      nextPmValue = availablePmOptions.length > 0 ? availablePmOptions[0] : null;
    } else {
      const currentIndex = pmOptions.indexOf(currentPmMission);
      if (currentIndex === -1) {
        // 當前任務不在列表中，選擇第一個可用選項
        nextPmValue = availablePmOptions.length > 0 ? availablePmOptions[0] : null;
      } else {
        // 從當前位置開始查找下一個可用選項
        let foundNext = false;
        for (let i = currentIndex + 1; i < pmOptions.length; i++) {
          if (!assignedPmMissions.has(pmOptions[i])) {
            nextPmValue = pmOptions[i];
            foundNext = true;
            break;
          }
        }
        
        // 如果沒有找到下一個可用選項，返回取消（null）
        if (!foundNext) {
          nextPmValue = null;
        }
      }
    }
    
    // 更新PM工作分配
    const newPmValues = { ...pmValues };
    
    if (nextPmValue === null) {
      delete newPmValues[key]; // 取消PM分配
    } else {
      newPmValues[key] = nextPmValue;
    }
    
    setPmValues(newPmValues);
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
        
        // 再獲取工作分配數據
        try {
          console.log('開始加載工作分配數據...');
          
          const result = await cachedScheduleDetailsRequest(apiService, 'weekly-schedule', year, month);
          
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
            
            // 同步API數據到missionValue
            syncApiDataToMissionValue(monthlyData);
            
            console.log('工作分配數據加載完成並同步到missionValue');
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
    
    // 完全依賴missionValue來顯示工作分配
    const mission = missionValues[missionKey];
    
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
      
      // A班在非編輯模式，直接顯示完整的area_code值
      // 從API數據中獲取原始的area_code值
      const nurseScheduleData = currentWeekSchedule.find(n => n.id === nurse.id);
      if (nurseScheduleData && nurseScheduleData.area_codes && nurseScheduleData.area_codes[dayIndex]) {
        const areaCode = nurseScheduleData.area_codes[dayIndex];
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
            {areaCode}
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

  return (
    <Box sx={{ padding: 1 }} id="weekly-schedule">
      <Typography variant="h4" gutterBottom sx={{ display: { xs: 'none', md: 'block' } }}>
        {formattedDate}週班表
      </Typography>
      
      <Box className="hide-for-pdf" sx={{ 
        display: 'flex', 
        gap: 1, 
        mb: 2, 
        flexWrap: { xs: 'wrap', md: 'nowrap' }, // 手機可換行，桌面不換行
        alignItems: 'center',
        justifyContent: { xs: 'space-between', md: 'flex-start' } // 手機分散對齊，桌面靠左
      }}>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
          <DatePicker
            views={['year', 'month']}
            label="選擇年月"
            minDate={new Date('2020-01-01')}
            maxDate={new Date('2030-12-31')}
            value={selectedDate}
            onChange={handleDateChange}
            onAccept={handleDateAccept}
            sx={{ 
              width: 200, 
              flexShrink: 0,
              order: { xs: 1, md: 0 } // 手機版排在前面
            }}
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
        <Box sx={{ 
          display: { xs: 'none', md: 'flex' }, 
          gap: 1, 
          ml: 2, 
          flexShrink: 0,
          flexWrap: 'wrap' // 允許按鈕換行
        }}>
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
        <FormControl sx={{ 
          display: { xs: 'block', md: 'none' }, 
          minWidth: 120,
          flexShrink: 0,
          order: { xs: 2, md: 0 } // 手機版排在後面
        }}>
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
        
        {/* 手機版生成PDF和班次顯示按鈕 */}
        <Box sx={{ 
          display: { xs: 'flex', md: 'none' }, 
          gap: 1, 
          flexWrap: 'wrap',
          order: { xs: 3, md: 0 },
          width: '100%',
          justifyContent: 'space-between'
        }}>
          {hasEditPermission && (
            <Button 
              variant="contained" 
              color="warning"
              onClick={generatePDF}
              disabled={!monthlySchedule.length}
              size="small"
              sx={{ flex: 1, maxWidth: '48%' }}
            >
              生成 PDF
            </Button>
          )}
          
          <Button 
            variant="contained" 
            color="secondary"
            onClick={toggleShiftDisplay}
            disabled={!monthlySchedule.length || editMode}
            size="small"
            sx={{ flex: 1, maxWidth: hasEditPermission ? '48%' : '100%' }}
          >
            {showShiftTime ? '顯示班次代碼' : '顯示班次時間'}
          </Button>
        </Box>
        
        {hasEditPermission && ( // 僅在有編輯權限時顯示
          <Button 
            variant="contained" 
            color="warning"
            onClick={generatePDF}
            disabled={!monthlySchedule.length}
            sx={{ 
              ml: { xs: 0, md: 2 }, 
              display: { xs: 'none', md: 'block' }, 
              height: 40,
              order: { xs: 3, md: 0 }
            }}
          >
            生成 PDF
          </Button>
        )}
        
        <Button 
          variant="contained" 
          color="secondary"
          onClick={toggleShiftDisplay}
          disabled={!monthlySchedule.length || editMode}
          sx={{ 
            ml: { xs: 0, md: 2 }, 
            display: { xs: 'none', md: 'block' }, 
            height: 40,
            order: { xs: 4, md: 0 }
          }}
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