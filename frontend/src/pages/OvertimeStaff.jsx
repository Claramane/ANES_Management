import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Alert,
  CircularProgress,
  Chip,
  Tooltip,
  Button,
  Snackbar,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { zhTW } from 'date-fns/locale';
import { useScheduleStore } from '../store/scheduleStore';
import { useUserStore } from '../store/userStore';
import { useAuthStore } from '../store/authStore';
import { format, getDaysInMonth, getDay, isValid, parseISO } from 'date-fns';
import apiService from '../utils/api';

// 確保日期有效性的工具函數
const ensureValidDate = (date) => {
  if (date && date instanceof Date && !isNaN(date.getTime())) {
    return date;
  }
  console.warn('發現無效日期，使用當前日期替代:', date);
  return new Date();
};

// 標記循環順序
const MARK_SEQUENCE = ['A', 'B', 'C', 'D', 'E', 'F', ''];

// 檢查日期是否為週末
const isWeekend = (date) => {
  const day = getDay(date);
  return day === 0 || day === 6; // 0是週日，6是週六
};

// 檢查日期是否為週六
const isSaturday = (date) => {
  return getDay(date) === 6;
};

// 檢查日期是否為週日
const isSunday = (date) => {
  return getDay(date) === 0;
};

// 加班分數計算邏輯
const calculateOvertimeScore = (overtimeShift) => {
  switch (overtimeShift) {
    case 'A': return 1.0;
    case 'B': return 0.8;
    case 'C': return 0.7;
    case 'D': return 0.2;
    case 'E': 
    case 'F': return 0.0;
    default: return 0.0;
  }
};

const OvertimeStaff = () => {
  const { 
    monthlySchedule: storeMonthlySchedule, 
    isLoading, 
    error: storeError, 
    selectedDate: storeSelectedDate, 
    updateSelectedDate,
    fetchMonthlySchedule
  } = useScheduleStore();

  const { nurseUsers, fetchUsers } = useUserStore();
  const { user } = useAuthStore();
  const [overtimeData, setOvertimeData] = useState({});
  const [filteredSchedule, setFilteredSchedule] = useState([]);
  
  // 新增狀態追蹤各日期的標記情況
  const [markings, setMarkings] = useState({});
  
  // 新增API相關狀態
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingOvertimeRecords, setIsLoadingOvertimeRecords] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [openSnackbar, setOpenSnackbar] = useState(false);

  // 新增統計數據狀態
  const [statisticsData, setStatisticsData] = useState([]);
  const [isLoadingStatistics, setIsLoadingStatistics] = useState(false);

  // 新增隨機生成相關狀態
  const [isGeneratingRandom, setIsGeneratingRandom] = useState(false);
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  
  // 新增班表檢查狀態
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [hasSchedule, setHasSchedule] = useState(false);
  
  // 新增加班記錄更新狀態
  const [invalidRecordsFixed, setInvalidRecordsFixed] = useState(false);

  // 新增重設加班表相關狀態
  const [isResetting, setIsResetting] = useState(false);
  const [openResetConfirmDialog, setOpenResetConfirmDialog] = useState(false);

  // 權限檢查 - 只有護理長和admin可以編輯
  const canEdit = useMemo(() => {
    return user && (user.role === 'head_nurse' || user.role === 'admin');
  }, [user]);
  
  // 確保選擇的日期是有效的
  const selectedDate = useMemo(() => {
    try {
      return ensureValidDate(storeSelectedDate);
    } catch (error) {
      console.error('處理日期時出錯:', error);
      return new Date();
    }
  }, [storeSelectedDate]);

  // 獲取當前選擇月份的天數
  const daysInMonth = useMemo(() => {
    try {
      return getDaysInMonth(selectedDate);
    } catch (error) {
      console.error('獲取月份天數失敗:', error);
      return 30; // 默認返回30天
    }
  }, [selectedDate]);

  // 獲取當前月份格式化字符串
  const formattedDate = useMemo(() => {
    try {
      if (!isValid(selectedDate)) return '無效日期';
      return format(selectedDate, 'yyyy年MM月');
    } catch (error) {
      console.error('格式化日期失敗:', error);
      return '無效日期';
    }
  }, [selectedDate]);

  // 處理日期變更
  const handleDateChange = (newDate) => {
    if (newDate && newDate instanceof Date && !isNaN(newDate.getTime())) {
      updateSelectedDate(newDate);
      // 清除之前的標記
      setMarkings({});
    } else {
      console.error('嘗試設置無效的日期:', newDate);
      updateSelectedDate(new Date());
    }
  };

  // 獲取星期幾名稱
  const getDayName = (day) => {
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    return dayNames[day] || '?';
  };
  
  // 處理點擊標記
  const handleMarkStaff = (dateKey, staffId) => {
    try {
      const date = parseISO(dateKey);
      
      // 處理週六的特殊邏輯，只允許有一個A班加班人員
      if (isSaturday(date)) {
        setMarkings(prevMarkings => {
          // 深拷貝當前標記狀態
          const newMarkings = { ...prevMarkings };
          
          // 初始化該日期的標記對象，如果不存在
          if (!newMarkings[dateKey]) {
            newMarkings[dateKey] = {};
          }
          
          // 查看該護理師當前的標記
          const currentMark = newMarkings[dateKey][staffId] || '';
          
          // 檢查當天是否已有其他A班加班人員
          const existingAStaffId = Object.entries(newMarkings[dateKey] || {})
            .find(([id, mark]) => mark === 'A' && id !== staffId)?.[0];
          
          if (existingAStaffId && currentMark !== 'A') {
            // 已有其他A班加班人員，不允許設置
            setApiError('週六只能有一位加班人員A');
            setOpenSnackbar(true);
            return prevMarkings;
          }
          
          // 如果當前護理師是A班，則取消標記；否則設為A班
          if (currentMark === 'A') {
            // 移除該護理師的標記
            delete newMarkings[dateKey][staffId];
            // 如果該日期沒有任何標記，則移除該日期
            if (Object.keys(newMarkings[dateKey]).length === 0) {
              delete newMarkings[dateKey];
            }
          } else {
            // 設置為A班
            newMarkings[dateKey][staffId] = 'A';
          }
          
          return newMarkings;
        });
        
        return;
      }
      
      // 平日的處理邏輯保持不變
      setMarkings(prevMarkings => {
        // 深拷貝當前標記狀態
        const newMarkings = { ...prevMarkings };
        
        // 初始化該日期的標記對象，如果不存在
        if (!newMarkings[dateKey]) {
          newMarkings[dateKey] = {};
        }
        
        // 獲取該員工當前的標記
        const currentMark = newMarkings[dateKey][staffId] || '';
        
        // 獲取該日期已使用的所有標記
        const usedMarks = Object.values(newMarkings[dateKey]);
        
        // 找出下一個可用標記
        let nextMarkIndex = MARK_SEQUENCE.indexOf(currentMark) + 1;
        if (nextMarkIndex >= MARK_SEQUENCE.length) {
          nextMarkIndex = 0;
        }
        
        let nextMark = MARK_SEQUENCE[nextMarkIndex];
        
        // 如果下一個標記已被使用且不為空，則繼續尋找下一個未使用的標記
        while (nextMark !== '' && usedMarks.includes(nextMark)) {
          nextMarkIndex = (nextMarkIndex + 1) % MARK_SEQUENCE.length;
          nextMark = MARK_SEQUENCE[nextMarkIndex];
        }
        
        // 更新標記
        if (nextMark === '') {
          // 如果是空標記，則移除該員工的標記
          delete newMarkings[dateKey][staffId];
          // 如果該日期沒有任何標記，則移除該日期
          if (Object.keys(newMarkings[dateKey]).length === 0) {
            delete newMarkings[dateKey];
          }
        } else {
          newMarkings[dateKey][staffId] = nextMark;
        }
        
        return newMarkings;
      });
    } catch (error) {
      console.error('處理標記時出錯:', error);
      setApiError('處理標記時發生錯誤');
      setOpenSnackbar(true);
    }
  };

  // 保存加班記錄
  const saveOvertimeRecords = async () => {
    if (!canEdit) {
      setApiError('只有護理長和管理員可以保存加班記錄');
      setOpenSnackbar(true);
      return;
    }
    
    setIsSaving(true);
    setApiError(null);
    
    try {
      // 組織數據，收集所有更新
      const updateRecords = [];
      const updateLog = [];  // 添加日誌陣列，以便除錯
      
      // 1. 處理已設置的加班記錄
      Object.entries(markings).forEach(([dateKey, staffMarks]) => {
        // 按加班類型分組
        const shiftGroups = {};
        
        Object.entries(staffMarks).forEach(([userId, shift]) => {
          if (!shiftGroups[shift]) {
            shiftGroups[shift] = [];
          }
          shiftGroups[shift].push(parseInt(userId));
        });
        
        // 為每個加班類型創建一個更新記錄
        Object.entries(shiftGroups).forEach(([shift, userIds]) => {
          const updateRecord = {
            date: dateKey,
            overtime_shift: shift,
            user_ids: userIds
          };
          
          updateRecords.push(updateRecord);
          updateLog.push(updateRecord);
        });
      });
      
      // 2. 處理應該清空加班記錄的情況
      // 找出該月具有白班但未設置加班的人員，將他們的加班設為空
      Object.entries(overtimeData).forEach(([dateKey, dayData]) => {
        const staffList = dayData.staffList;
        
        staffList.forEach(staff => {
          // 檢查是否已有加班標記
          const hasOvertimeMark = markings[dateKey]?.[staff.id];
          
          // 如果沒有加班標記，則清空其加班記錄
          if (!hasOvertimeMark) {
            updateRecords.push({
              date: dateKey,
              overtime_shift: "",  // 空字符串表示清除加班
              user_ids: [parseInt(staff.id)]
            });
            
            updateLog.push({
              date: dateKey,
              overtime_shift: "清空",
              user_ids: [parseInt(staff.id)]
            });
          }
        });
      });
      
      // 記錄請求詳情
      console.log('整月批量更新請求:', updateLog);
      
      // 執行批量更新
      if (updateRecords.length > 0) {
        const result = await apiService.overtime.bulkUpdate(updateRecords);
        console.log('整月批量更新結果:', result);
        
        setSuccessMessage(`加班記錄保存成功！共更新 ${result.data || updateRecords.length} 條記錄`);
        setOpenSnackbar(true);
        
        // 重新加載加班記錄，確保前端顯示與後端同步
        await loadOvertimeRecords();
        
        // 保存後更新統計數據
        generateStatistics();
      } else {
        setSuccessMessage('無變更需要保存');
        setOpenSnackbar(true);
      }
    } catch (error) {
      console.error('保存加班記錄失敗:', error);
      
      // 提取更有用的錯誤信息
      let errorMsg = '保存加班記錄失敗';
      
      if (error.response) {
        const responseData = error.response.data;
        console.error('錯誤響應數據:', responseData);
        
        if (typeof responseData === 'string') {
          errorMsg = responseData;
        } else if (responseData && responseData.detail) {
          if (Array.isArray(responseData.detail)) {
            errorMsg = responseData.detail.map(err => 
              `${err.msg} (${err.loc.join('.')})`
            ).join('; ');
          } else {
            errorMsg = responseData.detail;
          }
        }
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setApiError(errorMsg);
      setOpenSnackbar(true);
    } finally {
      setIsSaving(false);
    }
  };

  // 載入月排班表
  const loadMonthlySchedule = async () => {
    try {
      await fetchMonthlySchedule();
      setScheduleLoaded(true);
      
      // 檢查是否有班表數據
      if (storeMonthlySchedule && 
          Array.isArray(storeMonthlySchedule) && 
          storeMonthlySchedule.length > 0) {
        setHasSchedule(true);
      } else {
        setHasSchedule(false);
      }
    } catch (error) {
      console.error('獲取月排班表失敗:', error);
      setScheduleLoaded(true);
      setHasSchedule(false);
    }
  };

  // 從後端加載加班記錄
  const loadOvertimeRecords = async () => {
    if (!selectedDate || !isValid(selectedDate) || !hasSchedule) return;
    
    setIsLoadingOvertimeRecords(true);
    setApiError(null);
    
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      
      // 獲取該月第一天和最後一天
      const startDate = format(new Date(year, month, 1), 'yyyy-MM-dd');
      const endDate = format(new Date(year, month + 1, 0), 'yyyy-MM-dd');
      
      // 使用API服務獲取加班記錄
      const response = canEdit 
        ? await apiService.overtime.getAllRecords(startDate, endDate)
        : await apiService.overtime.getMyRecords(startDate, endDate);
      
      // 將後端數據轉換為前端需要的格式
      const newMarkings = {};
      response.data.forEach(record => {
        // 確保日期格式正確
        const dateKey = typeof record.date === 'string' 
          ? record.date  // 如果已經是字符串
          : format(parseISO(record.date), 'yyyy-MM-dd');  // 如果是Date對象
          
        if (!newMarkings[dateKey]) {
          newMarkings[dateKey] = {};
        }
        
        newMarkings[dateKey][record.user_id] = record.overtime_shift;
      });
      
      setMarkings(newMarkings);
      
      // 標記初始加載完成，準備檢查加班記錄一致性
      setInvalidRecordsFixed(false);
    } catch (error) {
      console.error('獲取加班記錄失敗:', error);
      // 確保錯誤信息是字符串
      const errorMessage = typeof error === 'object' ? 
        (error.response?.data?.detail || JSON.stringify(error)) : 
        String(error);
      setApiError(errorMessage);
      setOpenSnackbar(true);
    } finally {
      setIsLoadingOvertimeRecords(false);
    }
  };

  // 初始化加載數據 - 確保先載入班表，再載入加班記錄
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await loadMonthlySchedule();
        await fetchUsers();
      } catch (error) {
        console.error('初始數據載入失敗:', error);
      }
    };
    
    loadInitialData();
  }, []);

  // 月份變化時重新加載數據
  useEffect(() => {
    const loadData = async () => {
      setScheduleLoaded(false);
      setHasSchedule(false);
      await loadMonthlySchedule();
    };
    
    loadData();
  }, [selectedDate]);

  // 班表載入後加載加班記錄
  useEffect(() => {
    if (scheduleLoaded && hasSchedule) {
      loadOvertimeRecords();
    }
  }, [scheduleLoaded, hasSchedule, selectedDate]);

  // 檢查並清理無效的加班記錄
  useEffect(() => {
    // 只有在班表和加班記錄都已加載，且尚未進行過清理時執行
    if (!hasSchedule || isLoadingOvertimeRecords || invalidRecordsFixed || Object.keys(markings).length === 0) {
      return;
    }
    
    // 創建一個工作日與白班護理師ID的映射
    const dayToWhiteShiftStaffMap = {};
    
    if (storeMonthlySchedule && Array.isArray(storeMonthlySchedule)) {
      storeMonthlySchedule.forEach(nurse => {
        // 跳過護理長、控台CC和非麻醉專科護理師
        if (nurse.role === 'head_nurse' || nurse.position === 'CC' || nurse.identity !== '麻醉專科護理師') {
          return;
        }
        
        if (nurse.shifts && Array.isArray(nurse.shifts)) {
          nurse.shifts.forEach((shift, index) => {
            if (shift === 'A') { // 只處理白班
              const day = index + 1;
              if (day <= daysInMonth) {
                const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
                
                // 跳過週日
                if (isSunday(currentDate)) {
                  return;
                }
                
                const dateKey = format(currentDate, 'yyyy-MM-dd');
                
                if (!dayToWhiteShiftStaffMap[dateKey]) {
                  dayToWhiteShiftStaffMap[dateKey] = new Set();
                }
                
                dayToWhiteShiftStaffMap[dateKey].add(nurse.id);
              }
            }
          });
        }
      });
    }
    
    // 檢查每個加班記錄，移除無效的記錄
    const newMarkings = { ...markings };
    let hasInvalidRecords = false;
    
    Object.entries(newMarkings).forEach(([dateKey, staffMarks]) => {
      const whiteShiftStaffIds = dayToWhiteShiftStaffMap[dateKey] || new Set();
      
      // 檢查每個加班標記
      Object.keys(staffMarks).forEach(staffId => {
        // 如果該護理師當天沒有白班，但有加班記錄，則移除該記錄
        if (!whiteShiftStaffIds.has(parseInt(staffId))) {
          delete newMarkings[dateKey][staffId];
          hasInvalidRecords = true;
          console.warn(`移除無效加班記錄: ${dateKey} 護理師ID: ${staffId} (該日未排白班)`);
        }
      });
      
      // 如果該日期沒有任何標記，則移除該日期
      if (Object.keys(newMarkings[dateKey]).length === 0) {
        delete newMarkings[dateKey];
      }
    });
    
    // 如果有無效記錄被移除，更新標記狀態並通知用戶
    if (hasInvalidRecords) {
      setMarkings(newMarkings);
      setSuccessMessage('已自動移除排班表不一致的加班記錄');
      setOpenSnackbar(true);
      
      // 如果有權限編輯，建議用戶保存更新後的記錄
      if (canEdit) {
        setTimeout(() => {
          setApiError('發現與班表不一致的加班記錄已被調整，請記得保存變更');
          setOpenSnackbar(true);
        }, 3000);
      }
    }
    
    // 標記已完成清理
    setInvalidRecordsFixed(true);
  }, [markings, storeMonthlySchedule, hasSchedule, isLoadingOvertimeRecords, invalidRecordsFixed]);

  // 處理排班數據，篩選出加班人員
  useEffect(() => {
    if (!hasSchedule || !storeMonthlySchedule || !Array.isArray(storeMonthlySchedule) || storeMonthlySchedule.length === 0) {
      setFilteredSchedule([]);
      return;
    }

    // 過濾出有班次數據的護理師
    const nursesWithShifts = storeMonthlySchedule.filter(nurse => 
      nurse && nurse.shifts && Array.isArray(nurse.shifts) && nurse.shifts.length > 0
    );

    setFilteredSchedule(nursesWithShifts);

    // 按日期組織加班人員數據
    const overtimeByDate = {};
    
    // 初始化每一天的數據結構
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
      
      // 跳過週日
      if (isSunday(currentDate)) {
        continue;
      }
      
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      const weekday = getDay(currentDate);
      
      overtimeByDate[dateKey] = {
        date: dateKey,
        day: day,
        weekday: getDayName(weekday),
        staffList: []
      };
    }
    
    // 篩選加班人員（只選擇身份為「麻醉專科護理師」的人員，排除護理長和控台CC）
    nursesWithShifts.forEach(nurse => {
      // 只選擇麻醉專科護理師
      if (nurse.role === 'head_nurse' || nurse.position === 'CC' || nurse.identity !== '麻醉專科護理師') {
        return; // 跳過護理長、控台CC和非麻醉專科護理師
      }
      
      nurse.shifts.forEach((shift, index) => {
        if (shift === 'A') { // 加班
          const day = index + 1;
          if (day <= daysInMonth) {
            const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
            
            // 跳過週日
            if (isSunday(currentDate)) {
              return;
            }
            
            const dateKey = format(currentDate, 'yyyy-MM-dd');
            
            if (overtimeByDate[dateKey]) {
              overtimeByDate[dateKey].staffList.push({
                id: nurse.id,
                name: nurse.name || nurse.full_name,
                position: nurse.position || '一般護理師',
                identity: nurse.identity || '未知身份'
              });
            }
          }
        }
      });
    });
    
    setOvertimeData(overtimeByDate);
  }, [storeMonthlySchedule, selectedDate, daysInMonth, hasSchedule]);

  // 生成統計數據
  const generateStatistics = () => {
    setIsLoadingStatistics(true);
    
    try {
      if (!filteredSchedule || !filteredSchedule.length) {
        setStatisticsData([]);
        return;
      }
      
      // 篩選出麻醉專科護理師
      const anesthesiaStaff = filteredSchedule.filter(nurse => 
        nurse.identity === '麻醉專科護理師'
      );
      
      const statistics = anesthesiaStaff.map(nurse => {
        const userStats = {
          id: nurse.id,
          name: nurse.name || nurse.full_name,
          position: nurse.position || '一般護理師',
          dailyScores: [],
          totalScore: 0
        };
        
        // 計算每天的分數
        for (let day = 1; day <= daysInMonth; day++) {
          const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
          const dateKey = format(currentDate, 'yyyy-MM-dd');
          const shift = nurse.shifts[day - 1]; // 該護理師當天的班別
          
          let dayScore = 0;
          
          // 如果是白班(A)，檢查加班情況
          if (shift === 'A') {
            // 檢查是否有加班記錄
            const overtimeShift = markings[dateKey]?.[nurse.id];
            
            if (overtimeShift) {
              // 有加班記錄，根據加班類型計算分數
              dayScore = calculateOvertimeScore(overtimeShift);
            } else {
              // 沒有加班記錄，扣0.264分
              dayScore = -0.264;
            }
          }
          // 如果是夜班(D或N)或休假(O、V、R)，分數為0
          // 不需要特別處理，因為默認已經是0
          
          userStats.dailyScores.push({
            date: dateKey,
            day,
            score: dayScore,
            shift,
            overtimeShift: markings[dateKey]?.[nurse.id] || ''
          });
          
          // 累加總分
          userStats.totalScore += dayScore;
        }
        
        // 格式化總分到小數點後2位
        userStats.totalScore = parseFloat(userStats.totalScore.toFixed(2));
        
        return userStats;
      });
      
      // 按總分從高到低排序
      statistics.sort((a, b) => b.totalScore - a.totalScore);
      
      setStatisticsData(statistics);
    } catch (error) {
      console.error('生成統計數據失敗:', error);
      setApiError('生成統計數據時發生錯誤');
      setOpenSnackbar(true);
    } finally {
      setIsLoadingStatistics(false);
    }
  };

  // 當排班數據或加班記錄變化時，重新生成統計
  useEffect(() => {
    if (filteredSchedule.length > 0 && Object.keys(markings).length > 0) {
      generateStatistics();
    }
  }, [filteredSchedule, selectedDate]);

  // 格式化錯誤信息為字符串
  const formatErrorMessage = (error) => {
    if (!error) return null;
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    return JSON.stringify(error);
  };

  // 檢查日期是否符合加班規則
  const checkDateCompliance = (dateKey, staffMarks) => {
    if (!dateKey || !staffMarks) return false;
    
    try {
      const date = parseISO(dateKey);
      
      // 週六只需要1位A加班人員
      if (isSaturday(date)) {
        const hasOneA = Object.values(staffMarks).filter(mark => mark === 'A').length === 1;
        return hasOneA;
      }
      
      // 週日不需要加班人員，所以永遠返回true
      if (isSunday(date)) {
        return true;
      }
      
      // 平日需要6位加班人員，A-F各一位
      const marksSet = new Set(Object.values(staffMarks));
      const hasAllMarks = marksSet.size === 6 && 
        ['A', 'B', 'C', 'D', 'E', 'F'].every(mark => marksSet.has(mark));
        
      return hasAllMarks;
    } catch (error) {
      console.error('檢查日期合規性失敗:', error);
      return false;
    }
  };

  // 隨機生成加班人選
  const generateRandomOvertimeStaff = () => {
    if (!canEdit) {
      setApiError('只有護理長和管理員可以生成加班記錄');
      setOpenSnackbar(true);
      return;
    }
    
    setOpenConfirmDialog(true);
  };
  
  // 全部重新生成加班人選
  const generateFullRandomAssignments = () => {
    setOpenConfirmDialog(false);
    setIsGeneratingRandom(true);
    
    try {
      // 最大嘗試次數，防止無限循環
      const MAX_ATTEMPTS = 100000;
      let attempts = 0;
      let isBalanced = false;
      let newMarkings = {};
      
      // 不斷嘗試生成，直到達到平衡分配或達到最大嘗試次數
      while (!isBalanced && attempts < MAX_ATTEMPTS) {
        attempts++;
        console.log(`嘗試生成加班人選 (第 ${attempts} 次)`);
        
        // 清空所有標記，全部重新生成
        newMarkings = {};
        
        // 對每一天進行處理
        Object.values(overtimeData)
          .sort((a, b) => a.day - b.day)
          .forEach(dayData => {
            const dateKey = dayData.date;
            const staffList = dayData.staffList;
            const currentDate = parseISO(dateKey);
            
            // 跳過週日
            if (isSunday(currentDate)) {
              return;
            }
            
            // 只有有加班人員的日期才處理
            if (staffList.length > 0) {
              // 初始化該日期的標記對象
              newMarkings[dateKey] = {};
              
              // 洗牌算法 - 隨機排序所有人員
              const shuffledStaff = [...staffList].sort(() => Math.random() - 0.5);
              
              // 週六只分配一位A加班
              if (isSaturday(currentDate)) {
                // 如果有人員可分配
                if (shuffledStaff.length > 0) {
                  const staff = shuffledStaff[0];
                  newMarkings[dateKey][staff.id] = 'A';
                }
              } else {
                // 平日分配A-F六位加班人員
                const marksToAssign = ['A', 'B', 'C', 'D', 'E', 'F'];
                
                // 確保人數足夠
                const staffCount = Math.min(marksToAssign.length, shuffledStaff.length);
                
                // 隨機分配標記給人員
                for (let i = 0; i < staffCount; i++) {
                  const staff = shuffledStaff[i];
                  const mark = marksToAssign[i];
                  
                  newMarkings[dateKey][staff.id] = mark;
                }
              }
            }
          });
          
        // 使用臨時的markings計算分數
        const tempMarkings = newMarkings;
        
        // 篩選出麻醉專科護理師
        const anesthesiaStaff = filteredSchedule.filter(nurse => 
          nurse.identity === '麻醉專科護理師'
        );
        
        // 計算每個護理師的分數
        const nursesScores = anesthesiaStaff.map(nurse => {
          let totalScore = 0;
          
          // 計算每天的分數
          for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
            const dateKey = format(currentDate, 'yyyy-MM-dd');
            const shift = nurse.shifts[day - 1]; // 該護理師當天的班別
            
            let dayScore = 0;
            
            // 如果是白班(A)，檢查加班情況
            if (shift === 'A') {
              // 檢查是否有加班記錄
              const overtimeShift = tempMarkings[dateKey]?.[nurse.id];
              
              if (overtimeShift) {
                // 有加班記錄，根據加班類型計算分數
                dayScore = calculateOvertimeScore(overtimeShift);
              } else {
                // 沒有加班記錄，扣0.264分
                dayScore = -0.264;
              }
            }
            
            totalScore += dayScore;
          }
          
          return {
            id: nurse.id,
            name: nurse.name || nurse.full_name,
            totalScore: parseFloat(totalScore.toFixed(2))
          };
        });
        
        // 檢查是否有人的分數超出範圍
        const hasOutOfRangeScore = nursesScores.some(nurse => 
          nurse.totalScore > 2 || nurse.totalScore < -2
        );
        
        if (!hasOutOfRangeScore) {
          isBalanced = true;
          console.log('生成的加班人選分數已平衡', nursesScores);
        } else {
          const outOfRangeNurses = nursesScores.filter(nurse => 
            nurse.totalScore > 2 || nurse.totalScore < -2
          );
          console.log('有護理師分數超出範圍，需要重新生成:', outOfRangeNurses);
        }
      }
      
      if (!isBalanced) {
        setSuccessMessage(`已嘗試 ${MAX_ATTEMPTS} 次全部重新生成加班人選，但無法達到完全平衡。目前結果為最接近平衡的方案。`);
      } else {
        setSuccessMessage(`已全部重新生成加班人選！在第 ${attempts} 次嘗試達到平衡分配（點數不超過2或-2）。請記得保存變更`);
      }
      
      // 更新標記狀態
      setMarkings(newMarkings);
      setOpenSnackbar(true);
      
      // 保存後更新統計數據
      generateStatistics();
    } catch (error) {
      console.error('全部重新生成加班人選失敗:', error);
      setApiError('全部重新生成加班人選時發生錯誤');
      setOpenSnackbar(true);
    } finally {
      setIsGeneratingRandom(false);
    }
  };
  
  // 生成尚未指定加班人員
  const generatePartialRandomAssignments = () => {
    setOpenConfirmDialog(false);
    setIsGeneratingRandom(true);
    
    try {
      // 最大嘗試次數，防止無限循環
      const MAX_ATTEMPTS = 10;
      let attempts = 0;
      let isBalanced = false;
      let newMarkings = {};
      
      // 不斷嘗試生成，直到達到平衡分配或達到最大嘗試次數
      while (!isBalanced && attempts < MAX_ATTEMPTS) {
        attempts++;
        console.log(`嘗試生成尚未指定加班人員 (第 ${attempts} 次)`);
        
        // 保留現有標記
        newMarkings = { ...markings };
        
        // 對每一天進行處理
        Object.values(overtimeData)
          .sort((a, b) => a.day - b.day)
          .forEach(dayData => {
            const dateKey = dayData.date;
            const staffList = dayData.staffList;
            const currentDate = parseISO(dateKey);
            
            // 跳過週日
            if (isSunday(currentDate)) {
              if (newMarkings[dateKey]) {
                delete newMarkings[dateKey];
              }
              return;
            }
            
            // 只有有加班人員的日期才處理
            if (staffList.length > 0) {
              // 初始化該日期的標記對象（如果不存在）
              if (!newMarkings[dateKey]) {
                newMarkings[dateKey] = {};
              }
              
              // 找出該日期已經分配的標記
              const assignedMarks = new Set(Object.values(newMarkings[dateKey] || {}));
              
              // 週六只需要一位A加班
              if (isSaturday(currentDate)) {
                // 檢查是否已有人被指定為A班加班
                const hasAssignedA = assignedMarks.has('A');
                
                // 如果尚未有人被指定為A班加班
                if (!hasAssignedA) {
                  // 篩選出尚未分配加班的人員
                  const unassignedStaff = staffList.filter(staff => 
                    !newMarkings[dateKey][staff.id]
                  );
                  
                  // 如果有未分配的人員
                  if (unassignedStaff.length > 0) {
                    // 洗牌算法 - 隨機排序未分配的人員
                    const shuffledStaff = [...unassignedStaff].sort(() => Math.random() - 0.5);
                    const staff = shuffledStaff[0];
                    newMarkings[dateKey][staff.id] = 'A';
                  }
                }
              } else {
                // 平日需要A-F六位加班人員
                const marksToAssign = ['A', 'B', 'C', 'D', 'E', 'F'];
                
                // 找出尚未分配的標記
                const unassignedMarks = marksToAssign.filter(mark => !assignedMarks.has(mark));
                
                if (unassignedMarks.length > 0) {
                  // 篩選出尚未分配加班的人員
                  const unassignedStaff = staffList.filter(staff => 
                    !newMarkings[dateKey][staff.id]
                  );
                  
                  // 如果有未分配的人員
                  if (unassignedStaff.length > 0) {
                    // 洗牌算法 - 隨機排序未分配的人員
                    const shuffledStaff = [...unassignedStaff].sort(() => Math.random() - 0.5);
                    
                    // 確保人數足夠
                    const staffCount = Math.min(unassignedMarks.length, shuffledStaff.length);
                    
                    // 隨機分配標記給未分配的人員
                    for (let i = 0; i < staffCount; i++) {
                      const staff = shuffledStaff[i];
                      const mark = unassignedMarks[i];
                      
                      newMarkings[dateKey][staff.id] = mark;
                    }
                  }
                }
              }
            }
          });
          
        // 使用臨時的markings計算分數
        const tempMarkings = newMarkings;
        
        // 篩選出麻醉專科護理師
        const anesthesiaStaff = filteredSchedule.filter(nurse => 
          nurse.identity === '麻醉專科護理師'
        );
        
        // 計算每個護理師的分數
        const nursesScores = anesthesiaStaff.map(nurse => {
          let totalScore = 0;
          
          // 計算每天的分數
          for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
            const dateKey = format(currentDate, 'yyyy-MM-dd');
            const shift = nurse.shifts[day - 1]; // 該護理師當天的班別
            
            let dayScore = 0;
            
            // 如果是白班(A)，檢查加班情況
            if (shift === 'A') {
              // 檢查是否有加班記錄
              const overtimeShift = tempMarkings[dateKey]?.[nurse.id];
              
              if (overtimeShift) {
                // 有加班記錄，根據加班類型計算分數
                dayScore = calculateOvertimeScore(overtimeShift);
              } else {
                // 沒有加班記錄，扣0.264分
                dayScore = -0.264;
              }
            }
            
            totalScore += dayScore;
          }
          
          return {
            id: nurse.id,
            name: nurse.name || nurse.full_name,
            totalScore: parseFloat(totalScore.toFixed(2))
          };
        });
        
        // 檢查是否有人的分數超出範圍
        const hasOutOfRangeScore = nursesScores.some(nurse => 
          nurse.totalScore > 2 || nurse.totalScore < -2
        );
        
        if (!hasOutOfRangeScore) {
          isBalanced = true;
          console.log('生成的加班人選分數已平衡', nursesScores);
        } else {
          const outOfRangeNurses = nursesScores.filter(nurse => 
            nurse.totalScore > 2 || nurse.totalScore < -2
          );
          console.log('有護理師分數超出範圍，需要重新生成:', outOfRangeNurses);
        }
      }
      
      if (!isBalanced) {
        setSuccessMessage(`已嘗試 ${MAX_ATTEMPTS} 次生成尚未指定加班人員，但無法達到完全平衡。目前結果為最接近平衡的方案。`);
      } else {
        setSuccessMessage(`已成功生成尚未指定加班人員！在第 ${attempts} 次嘗試達到平衡分配。請記得保存變更`);
      }
      
      // 更新標記狀態
      setMarkings(newMarkings);
      setOpenSnackbar(true);
      
      // 保存後更新統計數據
      generateStatistics();
    } catch (error) {
      console.error('生成尚未指定加班人員失敗:', error);
      setApiError('生成尚未指定加班人員時發生錯誤');
      setOpenSnackbar(true);
    } finally {
      setIsGeneratingRandom(false);
    }
  };

  // 重設加班表
  const resetOvertimeSchedule = () => {
    if (!canEdit) {
      setApiError('只有護理長和管理員可以重設加班記錄');
      setOpenSnackbar(true);
      return;
    }
    
    setOpenResetConfirmDialog(true);
  };
  
  // 確認重設加班表
  const confirmResetOvertimeSchedule = async () => {
    setOpenResetConfirmDialog(false);
    setIsResetting(true);
    
    try {
      // 清空前端的標記狀態
      setMarkings({});
      
      setSuccessMessage('加班表已在前端重設，請記得按保存加班記錄按鈕以更新資料庫');
      setOpenSnackbar(true);
    } catch (error) {
      console.error('重設加班表失敗:', error);
      
      // 提取更有用的錯誤信息
      let errorMsg = '重設加班表失敗';
      if (error.message) {
        errorMsg = error.message;
      }
      
      setApiError(errorMsg);
      setOpenSnackbar(true);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Box sx={{ padding: 2 }}>
      <Typography variant="h4" gutterBottom>
        {formattedDate}加班人員管理
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
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
        
        {canEdit && hasSchedule && (
          <>
            <Button 
              variant="contained" 
              color="warning"  
              onClick={generateRandomOvertimeStaff}
              disabled={isGeneratingRandom || Object.keys(overtimeData).length === 0}
              startIcon={isGeneratingRandom ? <CircularProgress size={20} color="inherit" /> : <ShuffleIcon />}
            >
              {isGeneratingRandom ? '生成中...' : '隨機生成'}
            </Button>
            
            <Button 
              variant="contained" 
              color="primary" 
              onClick={saveOvertimeRecords}
              disabled={isSaving || !(hasSchedule && Object.keys(overtimeData).length > 0)}
              startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            >
              {isSaving ? '保存中...' : '保存加班記錄'}
            </Button>
            
            <Button 
              variant="contained" 
              color="error" 
              onClick={resetOvertimeSchedule}
              disabled={isResetting}
              startIcon={isResetting ? <CircularProgress size={20} color="inherit" /> : <RestartAltIcon />}
            >
              {isResetting ? '重設中...' : '重設加班表'}
            </Button>
          </>
        )}
      </Box>
      
      {canEdit && hasSchedule && (
        <Alert severity="info" sx={{ mb: 2 }}>
          點擊護理師姓名可標記排序 (A → B → C → D → E → F → 取消)，每個平日需要六位加班人員(A-F)，週六需要一位加班人員(A)，週日不需要加班人員
        </Alert>
      )}
      
      {!canEdit && hasSchedule && (
        <Alert severity="info" sx={{ mb: 2 }}>
          您可以查看加班記錄，但只有護理長和管理員可以修改
        </Alert>
      )}
      
      {(isLoading || isLoadingOvertimeRecords) && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
          <CircularProgress />
        </Box>
      )}
      
      {storeError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {formatErrorMessage(storeError)}
        </Alert>
      )}
      
      {scheduleLoaded && !hasSchedule && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          尚未生成班表，請先在「月排班」頁面生成當月班表
        </Alert>
      )}
      
      {hasSchedule && !isLoading && Object.keys(overtimeData).length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          當前月份沒有可用的排班數據，請確認月排班表是否已正確產生
        </Alert>
      )}
      
      {/* 以下內容只有當班表存在時才顯示 */}
      {hasSchedule && !isLoading && Object.keys(overtimeData).length > 0 && (
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table stickyHeader aria-label="加班人員列表">
            <TableHead>
              <TableRow>
                <TableCell width="150px">日期</TableCell>
                <TableCell width="80px">人數</TableCell>
                <TableCell>加班人員</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.values(overtimeData)
                .sort((a, b) => a.day - b.day) // 確保按日期排序
                .map((dayData) => {
                  // 檢查該日期是否符合加班規則
                  const isCompliant = checkDateCompliance(dayData.date, markings[dayData.date]);
                  
                  return (
                    <TableRow 
                      key={dayData.date}
                      sx={{ 
                        '&:nth-of-type(odd)': { bgcolor: 'rgba(0, 0, 0, 0.03)' },
                        ...(dayData.weekday === '六' ? { bgcolor: 'rgba(255, 220, 220, 0.1)' } : {})
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {selectedDate.getMonth() + 1}/{dayData.day}({dayData.weekday})
                          {isCompliant && (
                            <Tooltip title="符合加班規則">
                              <CheckCircleIcon 
                                color="success" 
                                sx={{ ml: 1, fontSize: 18 }} 
                              />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {dayData.staffList.length}人
                      </TableCell>
                      <TableCell>
                        {dayData.staffList.length > 0 ? (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {dayData.staffList.map((staff) => {
                              const mark = markings[dayData.date]?.[staff.id] || '';
                              const chipLabel = mark ? `${staff.name}${mark}` : staff.name;
                              
                              return (
                                <Tooltip key={staff.id} title={canEdit ? "點擊標記排序" : "只有護理長和管理員可以修改"}>
                                  <Chip 
                                    label={chipLabel}
                                    variant={mark ? "filled" : "outlined"}
                                    color={mark ? "primary" : "default"}
                                    size="small"
                                    onClick={canEdit ? () => handleMarkStaff(dayData.date, staff.id) : undefined}
                                    sx={{ 
                                      m: 0.3, 
                                      cursor: canEdit ? 'pointer' : 'default',
                                      fontWeight: mark ? 'bold' : 'normal'
                                    }}
                                  />
                                </Tooltip>
                              );
                            })}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            無加班人員
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {/* 加班統計表格 - 只有當班表存在時才顯示 */}
      {hasSchedule && (
        <>
          <Divider sx={{ my: 4 }} />
          
          <Typography variant="h5" gutterBottom>
            {formattedDate}加班統計
          </Typography>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            統計規則：A班加班 = 1.0分，B班加班 = 0.8分，C班加班 = 0.7分，D班加班 = 0.2分，E和F班加班 = 0分，白班未排加班 = -0.264分，夜班或休假 = 0分
          </Alert>
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button 
              variant="outlined" 
              color="primary" 
              onClick={generateStatistics}
              disabled={isLoadingStatistics}
              startIcon={isLoadingStatistics ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {isLoadingStatistics ? '計算中...' : '刷新分數'}
            </Button>
          </Box>
          
          {(isLoading || isLoadingStatistics) && (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
              <CircularProgress />
            </Box>
          )}
          
          {!isLoading && !isLoadingStatistics && statisticsData.length > 0 && (
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table stickyHeader aria-label="加班統計表格">
                <TableHead>
                  <TableRow>
                    <TableCell>護理師</TableCell>
                    <TableCell>總分</TableCell>
                    {[...Array(daysInMonth)].map((_, index) => {
                      const day = index + 1;
                      const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
                      
                      // 跳過週日
                      if (isSunday(currentDate)) {
                        return null;
                      }
                      
                      const weekday = getDayName(getDay(currentDate));
                      return (
                        <TableCell key={day} align="center">
                          {day}<br/>({weekday})
                        </TableCell>
                      );
                    }).filter(Boolean)} {/* 過濾掉null值 */}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {statisticsData.map((staff) => (
                    <TableRow 
                      key={staff.id}
                      sx={{ 
                        '&:nth-of-type(odd)': { bgcolor: 'rgba(0, 0, 0, 0.03)' }
                      }}
                    >
                      <TableCell component="th" scope="row">
                        {staff.name}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={staff.totalScore} 
                          color={staff.totalScore >= 0 ? "success" : "error"}
                          size="small"
                        />
                      </TableCell>
                      {staff.dailyScores
                        .filter(dayData => {
                          // 過濾掉週日
                          const date = parseISO(dayData.date);
                          return !isSunday(date);
                        })
                        .map((dayData) => {
                          // 計算顏色 - 正分數為綠色，負分數為紅色，零分為灰色
                          let color = 'text.secondary';
                          if (dayData.score > 0) color = 'success.main';
                          if (dayData.score < 0) color = 'error.main';
                          
                          // 顯示班別和加班信息
                          const displayText = dayData.overtimeShift ? 
                            `${dayData.shift}→${dayData.overtimeShift}` : 
                            dayData.shift;
                            
                          const displayScore = dayData.score === 0 ? 
                            '-' : 
                            dayData.score.toFixed(1);
                          
                          return (
                            <TableCell 
                              key={dayData.date} 
                              align="center"
                              sx={{ color }}
                            >
                              <Tooltip title={`班別: ${dayData.shift}${dayData.overtimeShift ? `, 加班: ${dayData.overtimeShift}` : ''}, 分數: ${dayData.score}`}>
                                <Box>
                                  <Typography variant="caption">{displayText}</Typography>
                                  <Typography variant="body2">{displayScore}</Typography>
                                </Box>
                              </Tooltip>
                            </TableCell>
                          );
                        })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          
          {!isLoading && !isLoadingStatistics && statisticsData.length === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              沒有可用的統計數據，請確保排班表和加班記錄都已加載
            </Alert>
          )}
        </>
      )}
      
      {/* 確認隨機生成對話框 */}
      <Dialog
        open={openConfirmDialog}
        onClose={() => setOpenConfirmDialog(false)}
      >
        <DialogTitle>確認隨機生成</DialogTitle>
        <DialogContent>
          <DialogContentText>
            請選擇隨機生成的方式，系統將根據您的選擇生成加班人選。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfirmDialog(false)} color="primary">
            取消
          </Button>
          <Button onClick={generatePartialRandomAssignments} color="info" autoFocus>
            生成尚未指定加班人員
          </Button>
          <Button onClick={generateFullRandomAssignments} color="warning">
            全部重新生成
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 確認重設對話框 */}
      <Dialog
        open={openResetConfirmDialog}
        onClose={() => setOpenResetConfirmDialog(false)}
      >
        <DialogTitle>確認重設加班表</DialogTitle>
        <DialogContent>
          <DialogContentText>
            這將清空{formattedDate}的所有加班記錄。此操作無法撤銷，確定要繼續嗎？
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenResetConfirmDialog(false)} color="primary">
            取消
          </Button>
          <Button onClick={confirmResetOvertimeSchedule} color="error" autoFocus>
            確定重設
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 成功/錯誤提示 */}
      <Snackbar
        open={openSnackbar}
        autoHideDuration={6000}
        onClose={() => setOpenSnackbar(false)}
        message={successMessage || formatErrorMessage(apiError)}
        ContentProps={{
          sx: {
            bgcolor: successMessage 
              ? 'rgba(76, 175, 80, 0.7)'  // 淡綠色（success淡色版）
              : 'rgba(244, 67, 54, 0.7)',  // 淡紅色（error淡色版）
            color: 'white'
          }
        }}
      />
    </Box>
  );
};

export default OvertimeStaff; 