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
  Badge
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

// 班次顏色設定
const ShiftCell = styled(TableCell)(({ shift }) => {
  const colors = { 
    'D': '#a08887', // 白班
    'A': '#D5E8DC', // 小夜班 - 更淡的綠色
    'N': '#8387da', // 大夜班
    'K': '#8AA6C1', // 早班(恢復室)
    'C': '#67dcbd', // 中班(恢復室)
    'F': '#FFA07A', // 晚班(恢復室)
    'E': '#FFB6C1', // 半班(Leader/書記)
    'B': '#FFDAB9', // 日班(書記)
    'O': '#FFFFFF', // 休假 - 白底
    'V': '#FFFFFF',  // 休假 - 白底
    'R': '#FFFFFF'  // 靜養假 - 白底
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
  const [showNurseNames, setShowNurseNames] = useState(false);
  
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
    const sorted = [...monthlySchedule];
    
    // 從userStore獲取用戶排序信息
    const userStore = useUserStore.getState();
    const userOrder = userStore.userOrder || {};
    
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
        '麻醉科書記': 5
      };
      return weights[identity] || 999;
    };
    
    // 對每個身份組的護理師進行排序
    Object.keys(nursesByIdentity).forEach(identity => {
      const orderIds = userOrder[identity] || [];
      
      if (orderIds.length > 0) {
        // 如果有保存的排序，按排序順序排列
        nursesByIdentity[identity].sort((a, b) => {
          const indexA = orderIds.indexOf(a.id);
          const indexB = orderIds.indexOf(b.id);
          
          // 如果ID不在排序列表中，放在最後
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          
          return indexA - indexB;
        });
      } else {
        // 如果沒有保存的排序，按姓名排序
        nursesByIdentity[identity].sort((a, b) => 
          (a.name || '').localeCompare(b.name || '')
        );
      }
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
    
    // 添加未知身份的護理師
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
      
      // 獲取排班詳細數據
      const scheduleDetails = await apiService.schedule.getScheduleDetails(year, month);
      if (!scheduleDetails.data?.success) {
        throw new Error("無法獲取排班詳細數據");
      }
      
      // 排班資料 ID 映射表
      const scheduleMapping = {};
      
      // 建立映射: { "用戶ID-日期": scheduleId }
      const details = scheduleDetails.data.data || [];
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
          area_code: mission === null ? null : mission.toString()
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
        
        setSuccess(`成功儲存 ${response.data.updated_count} 個工作分配`);
        if (response.data.failed_count > 0) {
          setSuccess(`成功儲存 ${response.data.updated_count} 個工作分配，但有 ${response.data.failed_count} 個失敗`);
        }
      } else {
        setSuccess("沒有需要更新的工作分配");
      }
      
      setIsSaving(false);
      setEditMode(false);
      
      // 清空暫存的編輯值
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
        }
      };
      
      return colors[type] || colors['OR'];
    };
    
    // 麻醉專科護理師和麻醉科Leader的选项
    if (identity === '麻醉專科護理師' || identity === '麻醉科Leader') {
      // 如果是週五，OR選項要包含「1」
      const orNumbers = isFriday 
        ? ['1', '2', '3', '5', '6', '7', '8', '9', '11', '13'] 
        : ['2', '3', '5', '6', '7', '8', '9', '11', '13'];
        
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
          <Button 
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
          <Button 
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
          <Button 
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
          {isWeekday && (
            <Button 
              size="small"
              variant="contained"
              onClick={() => handleMissionChange(nurseId, dayIndex, 'F')}
              sx={{
                ...btnStyle,
                backgroundColor: currentMission === 'F' 
                  ? getButtonColor('F', true).active.bg 
                  : getButtonColor('F', false).inactive.bg,
                color: currentMission === 'F' 
                  ? getButtonColor('F', true).active.text 
                  : getButtonColor('F', false).inactive.text,
                borderColor: currentMission === 'F' 
                  ? getButtonColor('F', true).active.border 
                  : getButtonColor('F', false).inactive.border,
              }}
            >
              F
            </Button>
          )}
        </Box>
      );
    }
    
    // 恢復室護理師的选项
    if (identity === '恢復室護理師') {
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
            onClick={() => handleMissionChange(nurseId, dayIndex, 'P')}
            sx={{
              ...btnStyle,
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
          <Button 
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
          <Button 
            size="small"
            variant="contained"
            onClick={() => handleMissionChange(nurseId, dayIndex, 'PAR')}
            sx={{
              ...btnStyle,
              backgroundColor: currentMission === 'PAR' 
                ? getButtonColor('PAR', true).active.bg 
                : getButtonColor('PAR', false).inactive.bg,
              color: currentMission === 'PAR' 
                ? getButtonColor('PAR', true).active.text 
                : getButtonColor('PAR', false).inactive.text,
              borderColor: currentMission === 'PAR' 
                ? getButtonColor('PAR', true).active.border 
                : getButtonColor('PAR', false).inactive.border,
            }}
          >
            PAR
          </Button>
          <Button 
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
          {isWeekday && (
            <Button 
              size="small"
              variant="contained"
              onClick={() => handleMissionChange(nurseId, dayIndex, 'F')}
              sx={{
                ...btnStyle,
                backgroundColor: currentMission === 'F' 
                  ? getButtonColor('F', true).active.bg 
                  : getButtonColor('F', false).inactive.bg,
                color: currentMission === 'F' 
                  ? getButtonColor('F', true).active.text 
                  : getButtonColor('F', false).inactive.text,
                borderColor: currentMission === 'F' 
                  ? getButtonColor('F', true).active.border 
                  : getButtonColor('F', false).inactive.border,
              }}
            >
              F
            </Button>
          )}
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
      const orNumbers = isFriday 
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
          // 循環回 null
          delete newMissionValues[key];
          // 如果資料庫中有值，需要標記為null以便取消
          if (savedMission) {
            newMissionValues[key] = null;
          }
          // 這是取消操作
          await updateDatabaseAreaCode(nurseId, dayIndex, null);
        } else {
          newMissionValues[key] = `OR${orNumbers[nextIndex]}`;
        }
      } else {
        // 沒有OR，設置為第一個值
        newMissionValues[key] = `OR${orNumbers[0]}`;
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
        area_code: value
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
      // 如果新日期和當前日期是同一個月，則不重新加載資料
      const isSameMonth = 
        selectedDate.getFullYear() === newDate.getFullYear() && 
        selectedDate.getMonth() === newDate.getMonth();
      
      // 更新日期並設置週次
      updateSelectedDate(newDate);
      setCurrentWeek(1);
      
      // 清空舊的 missionValues
      setMissionValues({});
      
      console.log(`日期變更: ${format(newDate, 'yyyy-MM-dd')}, 是否同月: ${isSameMonth}`);
    } else {
      console.error('嘗試設置無效的日期:', newDate);
      updateSelectedDate(new Date());
    }
  };

  // 所有可能的工作分配選項
  const allMissionTypes = [
    'OR1', 'OR2', 'OR3', 'OR5', 'OR6', 'OR7', 'OR8', 'OR9', 'OR11', 'OR13',
    'DR', '3F', 'CC', 'C', 'F', 'P', 'PAR'
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
    
    // 遍歷當前週的每個護理師
    currentWeekSchedule.forEach(nurse => {
      // 遍歷每天
      nurse.shifts.forEach((shift, dayIndex) => {
        // 獲取該天的工作分配
        const missionKey = `${nurse.id}-${currentWeek}-${dayIndex}`;
        const mission = missionValues[missionKey] || nurse.area_codes?.[dayIndex];
        
        // 如果有工作分配，則統計
        if (mission && stats[dayIndex][mission] !== undefined) {
          stats[dayIndex][mission]++;
        } else if (mission) {
          // 如果是新的工作分配類型（不在預定義列表中）
          stats[dayIndex][mission] = 1;
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
    
    // 收集所有在該日期執行該任務的護理師
    const nurses = currentWeekSchedule.filter(nurse => {
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
          const scheduleDetails = await apiService.schedule.getScheduleDetails(year, month);
          
          // 如果組件已卸載，不繼續執行
          if (!isMounted) return;
          
          if (scheduleDetails.data?.success) {
            // 將工作分配資料更新到排班資料中
            const monthlyData = [...useScheduleStore.getState().monthlySchedule];
            const details = scheduleDetails.data.data || [];
            
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
      
      // 優先顯示 mission 值 (非編輯模式下使用粗體顯示)
      if (mission) {
        // A班且有工作分配，使用深一點的背景色
        return (
          <Box component="span" sx={{ 
            fontWeight: 'bold', // 非編輯模式下顯示area_code時使用粗體
            whiteSpace: 'nowrap', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis',
            width: '100%',
            display: 'block',
            fontSize: '0.85rem',
            height: '22px',
            lineHeight: '22px',
            backgroundColor: '#B3CFC1', // 使用條件背景色
            border: '2px solid #96BB9C', // 添加明顯但淺色的邊框
            borderRadius: '3px', // 輕微圓角
            margin: '-1px', // 調整邊距以適應邊框增加的尺寸
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
          {showShiftTime ? convertShiftToTime(shift) : shift}
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
    <Box sx={{ padding: 3 }} id="weekly-schedule">
      <Typography variant="h4" gutterBottom>
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
            sx={{ width: 200 }}
          />
        </LocalizationProvider>
        
        <ButtonGroup variant="contained" sx={{ ml: 2 }}>
          {Array.from({ length: weeksInMonth }, (_, i) => i + 1).map(week => (
            <Button 
              key={week}
              color={currentWeek === week ? "success" : "primary"}
              onClick={() => selectWeek(week)}
            >
              第{week}週
            </Button>
          ))}
        </ButtonGroup>
        
        {hasEditPermission && ( // 僅在有編輯權限時顯示
          <Button 
            variant="contained" 
            color="warning"
            onClick={generatePDF}
            disabled={!monthlySchedule.length}
            sx={{ ml: 2 }}
          >
            生成 PDF
          </Button>
        )}
        
        <Button 
          variant="contained" 
          color="secondary"
          onClick={toggleShiftDisplay}
          disabled={!monthlySchedule.length || editMode}
          sx={{ ml: 2 }}
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
              sx={{ ml: 2 }}
            >
              {isSaving ? '儲存中...' : (editMode ? '儲存工作分配' : '編輯工作分配')}
            </Button>
            <Button 
              variant="contained" 
              color="warning"
              onClick={resetWorkAssignments}
              disabled={!monthlySchedule.length || isSaving || editMode}
              sx={{ ml: 2 }}
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
                  <TableCell align="center" width="60px" sx={{ padding: '1px 1px', fontSize: '0.8rem' }}>姓名</TableCell>
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
                    <TableCell align="center" component="th" scope="row" sx={{ padding: '0px 2px', height: '22px', maxHeight: '22px', fontSize: '0.8rem' }}>
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
          
          {/* 單獨的工作分配統計表 */}
          <Box sx={{ mt: 3, mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 'bold' }}>
              本週工作分配統計
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={showNurseNames}
                  onChange={(e) => setShowNurseNames(e.target.checked)}
                  color="primary"
                />
              }
              label={showNurseNames ? "顯示護理師名單" : "顯示統計數字"}
              sx={{ ml: 2 }}
            />
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
                        backgroundColor: '#e8f5e9'
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
                              backgroundColor: hasValue ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
                              maxWidth: '120px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: showNurseNames && nurseNames.length > 2 ? 'normal' : 'nowrap'
                            }}
                          >
                            {hasValue ? (
                              showNurseNames ? (
                                <Tooltip title={nurseNames.join(', ')} arrow placement="top">
                                  <span>{nurseNames.join(', ')}</span>
                                </Tooltip>
                              ) : (
                                count
                              )
                            ) : (
                              showNurseNames ? '-' : '0'
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                }

                {/* 其他常規工作類型 */}
                {allMissionTypes
                  .filter(type => !type.startsWith('OR'))
                  .map((missionType) => (
                    <TableRow key={missionType}>
                      <TableCell sx={{ 
                        fontSize: '0.8rem',
                        backgroundColor: '#f5f5f5'
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
                              backgroundColor: hasValue ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
                              maxWidth: '120px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: showNurseNames && nurseNames.length > 2 ? 'normal' : 'nowrap'
                            }}
                          >
                            {hasValue ? (
                              showNurseNames ? (
                                <Tooltip title={nurseNames.join(', ')} arrow placement="top">
                                  <span>{nurseNames.join(', ')}</span>
                                </Tooltip>
                              ) : (
                                count
                              )
                            ) : (
                              showNurseNames ? '-' : '0'
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                }
                
                {/* 統計未預定義的工作類型 */}
                {calculateMissionStats.some(dayStat => 
                  Object.keys(dayStat).some(type => !allMissionTypes.includes(type))
                ) && (
                  <TableRow sx={{ borderTop: '2px solid #bbb' }}>
                    <TableCell colSpan={8} sx={{ fontWeight: 'bold', fontSize: '0.8rem', backgroundColor: '#fff8e1' }}>
                      其他工作類型
                    </TableCell>
                  </TableRow>
                )}
                
                {calculateMissionStats[0] && Object.keys(calculateMissionStats[0])
                  .filter(type => !allMissionTypes.includes(type) && type !== 'undefined')
                  .map(missionType => (
                    <TableRow key={missionType}>
                      <TableCell sx={{ fontSize: '0.8rem', backgroundColor: '#fff8e1' }}>
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
                              color: hasValue ? '#ff6d00' : '#bdbdbd',
                              backgroundColor: hasValue ? 'rgba(255, 167, 38, 0.1)' : 'transparent',
                              maxWidth: '120px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: showNurseNames && nurseNames.length > 2 ? 'normal' : 'nowrap'
                            }}
                          >
                            {hasValue ? (
                              showNurseNames ? (
                                <Tooltip title={nurseNames.join(', ')} arrow placement="top">
                                  <span>{nurseNames.join(', ')}</span>
                                </Tooltip>
                              ) : (
                                count
                              )
                            ) : (
                              showNurseNames ? '-' : '0'
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                }
                
                {/* 未安排白班人員統計 */}
                <TableRow sx={{ borderTop: '2px solid #bbb' }}>
                  <TableCell sx={{ 
                    fontSize: '0.8rem', 
                    backgroundColor: '#fce4ec', 
                    color: '#c2185b',
                    fontWeight: 'bold'
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
                          color: hasValue ? '#c2185b' : '#9e9e9e',
                          backgroundColor: hasValue ? 'rgba(194, 24, 91, 0.1)' : 'transparent',
                          maxWidth: '120px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: showNurseNames && unassignedNurses.length > 2 ? 'normal' : 'nowrap'
                        }}
                      >
                        {hasValue ? (
                          showNurseNames ? (
                            <Tooltip title={unassignedNurses.join(', ')} arrow placement="top">
                              <span>{unassignedNurses.join(', ')}</span>
                            </Tooltip>
                          ) : (
                            count
                          )
                        ) : (
                          showNurseNames ? '-' : '0'
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
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