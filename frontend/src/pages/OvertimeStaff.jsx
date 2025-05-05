import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  DialogTitle,
  LinearProgress
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
import { format, getDaysInMonth, getDay, isValid, parseISO, getDate } from 'date-fns';
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

// 將全局範圍的MAX_ATTEMPTS常量提取出來，避免在每個函數中重複宣告
const MAX_OVERTIME_GENERATION_ATTEMPTS = 10000;

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
  
  // 新增年度統計相關狀態
  const [showYearlyStats, setShowYearlyStats] = useState(false);
  const [yearlyStatisticsData, setYearlyStatisticsData] = useState([]);
  const [isLoadingYearlyStatistics, setIsLoadingYearlyStatistics] = useState(false);
  const [apiData, setApiData] = useState(null);  // 存儲共享的API數據，避免重複請求
  
  // 新增確認對話框狀態
  const [openSaveConfirmDialog, setOpenSaveConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  
  // 新增標記變更狀態
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalMarkings, setOriginalMarkings] = useState({});
  
  // 新增隨機生成相關狀態
  const [isGeneratingRandom, setIsGeneratingRandom] = useState(false);
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [generationAttempts, setGenerationAttempts] = useState(0);
  // 使用 useRef 替代 useState 以確保同步更新
  const shouldCancelGenerationRef = useRef(false);
  
  // 班表檢查狀態
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [hasSchedule, setHasSchedule] = useState(false);
  
  // 加班記錄更新狀態
  const [invalidRecordsFixed, setInvalidRecordsFixed] = useState(true);

  // 重設加班表相關狀態
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

  // 添加臨時日期狀態
  const [tempDate, setTempDate] = useState(null);

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
      updateSelectedDate(tempDate);
      // 清除之前的標記
      setMarkings({});
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
      
      // 檢查護理師信息
      const nurse = filteredSchedule.find(n => n.id === staffId);
      if (!nurse) {
        console.error(`未找到護理師數據 (staffId: ${staffId})`);
        setApiError('未找到護理師數據');
        setOpenSnackbar(true);
        return;
      }
      
      // 檢查是否為麻醉科Leader的情況
      const isLeader = nurse.identity === '麻醉科Leader';
      
      // 處理週六的特殊邏輯，只允許有一個A班加班人員，並且麻醉科Leader不能排週六加班
      if (isSaturday(date)) {
        // 如果是Leader，不允許在週六加班
        if (isLeader) {
          setApiError('麻醉科Leader不能在週六加班');
          setOpenSnackbar(true);
          return;
        }
        
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
      
      // 平日的處理邏輯（不對Leader做特殊限制）
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
      
      if (Object.keys(markings).length === 0) {
        console.log('加班表已被重設，準備清空所有記錄');
        // 如果 markings 為空，表示用戶可能進行了重設操作，需要清空該月所有加班記錄
        
        // 獲取當月所有存在加班記錄的日期
        Object.entries(overtimeData).forEach(([dateKey, dayData]) => {
          const staffList = dayData.staffList;
          
          staffList.forEach(staff => {
            // 對該月每一位醫護人員設置空白加班記錄
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
          });
        });
      } else {
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
      }
      
      // 記錄請求詳情
      console.log('整月批量更新請求:', updateLog);
      
      // 執行批量更新
      if (updateRecords.length > 0) {
        const result = await apiService.overtime.bulkUpdate(updateRecords);
        console.log('整月批量更新結果:', result);
        
        // 在保存加班記錄成功後，計算並保存月度加班分數
        const scoresSaved = await calculateAndSaveMonthlyScores();
        
        setSuccessMessage(`加班記錄保存成功！共更新 ${result.data || updateRecords.length} 條記錄${scoresSaved ? '，且月度加班分數已更新' : ''}`);
        setOpenSnackbar(true);
        
        // 更新原始標記，重置未保存變更狀態
        setOriginalMarkings(JSON.parse(JSON.stringify(markings)));
        setHasUnsavedChanges(false);
        
        // 重新加載加班記錄，確保前端顯示與後端同步
        // 清空 apiData 緩存，確保下次會重新獲取數據
        setApiData(null);
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
    if (!selectedDate || !isValid(selectedDate) || !hasSchedule) return Promise.resolve();
    
    // 如果已經有API數據，直接使用它而不再發送請求
    if (apiData) {
      console.log('使用緩存的加班記錄數據');
      processApiData(apiData);
      return Promise.resolve(markings);
    }
    
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
      
      // 存儲API數據以供共享
      setApiData(response.data);
      
      // 處理API數據
      processApiData(response.data);
      
      return Promise.resolve(markings);
    } catch (error) {
      console.error('獲取加班記錄失敗:', error);
      // 確保錯誤信息是字符串
      const errorMessage = typeof error === 'object' ? 
        (error.response?.data?.detail || JSON.stringify(error)) : 
        String(error);
      setApiError(errorMessage);
      setOpenSnackbar(true);
      return Promise.reject(error);
    } finally {
      setIsLoadingOvertimeRecords(false);
    }
  };
  
  // 處理API數據的函數
  const processApiData = (data) => {
    // 將後端數據轉換為前端需要的格式
    const newMarkings = {};
    data.forEach(record => {
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
    // 儲存原始標記以檢測變更
    setOriginalMarkings(JSON.parse(JSON.stringify(newMarkings)));
    // 初始化沒有未保存變更
    setHasUnsavedChanges(false);
    
    // 標記初始加載完成，準備檢查加班記錄一致性
    setInvalidRecordsFixed(false);
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
      setApiData(null); // 清除API數據緩存
      await loadMonthlySchedule();
    };
    
    loadData();
  }, [selectedDate]);

  // 班表載入後加載加班記錄
  useEffect(() => {
    if (scheduleLoaded && hasSchedule) {
      console.log('班表載入完成，準備加載加班記錄');
      loadOvertimeRecords()
        .then(() => {
          console.log('加班記錄加載完成，準備生成統計');
          if (filteredSchedule.length > 0) {
            generateStatistics();
          }
        })
        .catch(error => {
          console.error('加載加班記錄或生成統計失敗:', error);
        });
    }
  }, [scheduleLoaded, hasSchedule, filteredSchedule.length]);

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
        // 跳過護理長、控台CC和非麻醉相關護理師
        if (nurse.role === 'head_nurse' || nurse.position === 'CC' || 
            (nurse.identity !== '麻醉專科護理師' && nurse.identity !== '麻醉科Leader')) {
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
    
    // 篩選加班人員（包含麻醉專科護理師和麻醉科Leader）
    nursesWithShifts.forEach(nurse => {
      // 檢查護理師是否有必要的屬性
      const isAnesthesiaNurse = nurse.identity === '麻醉專科護理師' || nurse.identity === '麻醉科Leader';
      const isNotHeadNurse = nurse.role !== 'head_nurse';
      const isNotCC = nurse.position !== 'CC';
      
      // 只選擇麻醉專科護理師或麻醉科Leader
      if (!isNotHeadNurse || !isNotCC || !isAnesthesiaNurse) {
        return; // 跳過護理長、控台CC和非麻醉相關護理師
      }
      
      // 如果是Leader且是週六，跳過（Leader週六不排加班）
      const isLeader = nurse.identity === '麻醉科Leader';
      
      // 確保shifts存在且是數組
      if (!nurse.shifts || !Array.isArray(nurse.shifts)) {
        console.warn('護理師缺少shifts數據:', nurse);
        return;
      }
      
      nurse.shifts.forEach((shift, index) => {
        if (shift === 'A') { // 白班可以加班
          const day = index + 1;
          if (day <= daysInMonth) {
            const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
            
            // 跳過週日
            if (isSunday(currentDate)) {
              return;
            }
            
            // 如果是Leader且是週六，跳過（Leader週六不排加班）
            if (isLeader && isSaturday(currentDate)) {
              return;
            }
            
            const dateKey = format(currentDate, 'yyyy-MM-dd');
            
            if (overtimeByDate[dateKey]) {
              overtimeByDate[dateKey].staffList.push({
                id: nurse.id,
                name: nurse.name || nurse.full_name || '未知姓名', // 提供默認名稱避免出錯
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

  // 生成統計數據 - 只考慮當月數據
  const generateStatistics = () => {
    setIsLoadingStatistics(true);
    
    try {
      if (!filteredSchedule || !filteredSchedule.length) {
        setStatisticsData([]);
        return;
      }
      
      // 篩選出麻醉專科護理師（不包含麻醉科Leader，因為他們不參與分數計算）
      const anesthesiaStaff = filteredSchedule.filter(nurse => 
        nurse.identity === '麻醉專科護理師' && 
        nurse.role !== 'head_nurse' && 
        nurse.position !== 'CC'
      );
      
      // 篩選出麻醉科Leader（單獨處理，不計算分數）
      const leaderStaff = filteredSchedule.filter(nurse => 
        nurse.identity === '麻醉科Leader' && 
        nurse.role !== 'head_nurse' && 
        nurse.position !== 'CC'
      );
      
      // 處理普通麻醉專科護理師的統計數據（計算分數）
      const normalStatistics = anesthesiaStaff.map(nurse => {
        const userStats = {
          id: nurse.id,
          name: nurse.name || nurse.full_name || nurse.id.toString(),
          position: nurse.position || '一般護理師',
          identity: nurse.identity,
          dailyScores: [],
          totalScore: 0
        };
        
        // 只計算當月的分數 - 遍歷當月每一天
        for (let day = 1; day <= daysInMonth; day++) {
          const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
          const dateKey = format(currentDate, 'yyyy-MM-dd');
          
          // 確保day-1不會超出shifts數組範圍
          let shift = '';
          if (nurse.shifts && Array.isArray(nurse.shifts) && day <= nurse.shifts.length) {
            shift = nurse.shifts[day - 1]; // 該護理師當天的班別
          }
          
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
      
      // 處理麻醉科Leader的統計數據（不計算分數）
      const leaderStatistics = leaderStaff.map(nurse => {
        const userStats = {
          id: nurse.id,
          name: nurse.name || nurse.full_name || nurse.id.toString(),
          position: nurse.position || '一般護理師',
          identity: nurse.identity,
          dailyScores: [],
          totalScore: 0 // Leader固定為0分
        };
        
        // 只記錄加班情況，不計算分數
        for (let day = 1; day <= daysInMonth; day++) {
          const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
          const dateKey = format(currentDate, 'yyyy-MM-dd');
          
          // 確保day-1不會超出shifts數組範圍
          let shift = '';
          if (nurse.shifts && Array.isArray(nurse.shifts) && day <= nurse.shifts.length) {
            shift = nurse.shifts[day - 1]; // 該護理師當天的班別
          }
          
          userStats.dailyScores.push({
            date: dateKey,
            day,
            score: 0, // Leader固定為0分
            shift,
            overtimeShift: markings[dateKey]?.[nurse.id] || ''
          });
        }
        
        return userStats;
      });
      
      // 合併普通護理師和Leader的統計數據
      const statistics = [...normalStatistics, ...leaderStatistics];
      
      // 按總分從高到低排序（Leader會排在後面，因為是0分）
      statistics.sort((a, b) => b.totalScore - a.totalScore);
      
      setStatisticsData(statistics);
    } catch (error) {
      console.error('生成統計數據失敗:', error);
      setApiError('生成統計數據時發生錯誤: ' + error.message);
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
  }, [filteredSchedule, markings, selectedDate]);

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
    setGenerationAttempts(0);
    shouldCancelGenerationRef.current = false; // 重置取消標記
    
    // 使用setTimeout實現非阻塞的生成
    setTimeout(() => {
      generateFullAssignmentsAsync();
    }, 100);
  };

  // 非阻塞的生成算法 - 全部重新生成
  const generateFullAssignmentsAsync = async () => {
    try {
      // 使用全局常量
      let attempts = 0;
      let isBalanced = false;
      let newMarkings = {};
      
      // 先檢查是否有足夠的資料來生成
      if (!overtimeData || Object.keys(overtimeData).length === 0) {
        throw new Error('沒有足夠的排班資料來生成加班人選');
      }
      
      // 不斷嘗試生成，直到達到平衡分配或達到最大嘗試次數
      while (!isBalanced && attempts < MAX_OVERTIME_GENERATION_ATTEMPTS && !shouldCancelGenerationRef.current) {
        attempts++;
        // 更新嘗試次數，確保UI更新
        setGenerationAttempts(attempts);
        
        // 更頻繁地檢查取消狀態並更新UI
        if (attempts % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
          
          // 再次檢查取消狀態，確保響應
          if (shouldCancelGenerationRef.current) {
            console.log('檢測到取消請求，停止生成');
            break;
          }
        }
        
        console.log(`嘗試生成加班人選 (第 ${attempts} 次)`);
        
        // 清空所有標記，全部重新生成
        newMarkings = {};
        
        // 對每一天進行處理 - 簡化的隨機分配方式
        Object.values(overtimeData)
          .sort((a, b) => a.day - b.day)
          .forEach(dayData => {
            const dateKey = dayData.date;
            // 過濾掉麻醉科Leader，只保留普通護理師
            const staffList = dayData.staffList.filter(staff => staff.identity !== '麻醉科Leader');
            
            // 檢查資料有效性
            if (!dateKey || !staffList || !Array.isArray(staffList) || staffList.length === 0) {
              console.warn(`日期 ${dateKey} 缺少有效的人員列表，跳過`);
              return;
            }
            
            const currentDate = parseISO(dateKey);
            
            // 跳過週日
            if (isSunday(currentDate)) {
              return;
            }
            
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
          });
        
        // 使用臨時的markings計算分數
        const tempMarkings = newMarkings;
        
        // 篩選出麻醉專科護理師（排除麻醉科Leader，因為他們不參與分數計算）
        const anesthesiaStaff = filteredSchedule.filter(nurse => 
          nurse.identity === '麻醉專科護理師' && 
          nurse.role !== 'head_nurse' && 
          nurse.position !== 'CC'
        );
        
        // 檢查是否有足夠的護理師來分配
        if (!anesthesiaStaff || anesthesiaStaff.length === 0) {
          throw new Error('沒有找到符合條件的麻醉專科護理師');
        }
        
        // 計算每個護理師的分數
        const nursesScores = anesthesiaStaff.map(nurse => {
          let totalScore = 0;
          // 用於記錄每月分數
          const monthlyScores = {};
          
          // 檢查nurse.shifts的有效性
          if (!nurse.shifts || !Array.isArray(nurse.shifts)) {
            console.warn(`護理師 ${nurse.name || nurse.id} 缺少shifts數據`);
            return {
              id: nurse.id,
              name: nurse.name || nurse.full_name || nurse.id.toString(),
              identity: nurse.identity,
              totalScore: 0,
              monthlyScores: {}
            };
          }
          
          // 計算每天的分數
          for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
            const dateKey = format(currentDate, 'yyyy-MM-dd');
            const month = currentDate.getMonth();
            
            // 確保該月的分數對象存在
            if (!monthlyScores[month]) {
              monthlyScores[month] = 0;
            }
            
            // 確保day-1不會超出shifts數組範圍
            if (day <= nurse.shifts.length) {
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
              monthlyScores[month] += dayScore;
            }
          }
          
          return {
            id: nurse.id,
            name: nurse.name || nurse.full_name || nurse.id.toString(),
            identity: nurse.identity,
            totalScore: parseFloat(totalScore.toFixed(2)),
            monthlyScores
          };
        });
        
        // 檢查是否有任何月份的分數超出範圍（正負3.5分）
        const hasMonthOutOfRange = nursesScores.some(nurse => 
          Object.values(nurse.monthlyScores).some(score => 
            score > 3.5 || score < -3.5
          )
        );
        
        // 檢查是否有年度總分超出範圍（正負2分）
        const hasYearOutOfRange = nursesScores.some(nurse => 
          nurse.totalScore > 2 || nurse.totalScore < -2
        );
        
        if (!hasMonthOutOfRange && !hasYearOutOfRange) {
          isBalanced = true;
          console.log('生成的加班人選分數已平衡', nursesScores);
        } else {
          if (hasMonthOutOfRange) {
            const outOfRangeMonths = nursesScores.flatMap(nurse => 
              Object.entries(nurse.monthlyScores)
                .filter(([_, score]) => score > 3.5 || score < -3.5)
                .map(([month, score]) => `${nurse.name}的${parseInt(month) + 1}月分數(${score.toFixed(2)})`)
            );
            console.log('有月份分數超出範圍(±3.5)，需要重新生成:', outOfRangeMonths);
          }
          
          if (hasYearOutOfRange) {
            const outOfRangeNurses = nursesScores
              .filter(nurse => nurse.totalScore > 2 || nurse.totalScore < -2)
              .map(nurse => `${nurse.name}(${nurse.totalScore.toFixed(2)})`);
            console.log('有護理師年度總分超出範圍(±2)，需要重新生成:', outOfRangeNurses);
          }
        }
      }
      
      // 檢查是否被取消
      if (shouldCancelGenerationRef.current) {
        console.log('生成已被用戶取消');
        setSuccessMessage('已成功取消隨機生成');
        setOpenSnackbar(true);
        setIsGeneratingRandom(false);
        shouldCancelGenerationRef.current = false;
        return;
      }
      
      if (!isBalanced) {
        setSuccessMessage(`已嘗試 ${MAX_OVERTIME_GENERATION_ATTEMPTS} 次全部重新生成加班人選，但無法達到完全平衡。目前結果為最接近平衡的方案。`);
      } else {
        setSuccessMessage(`已全部重新生成加班人選！在第 ${attempts} 次嘗試達到平衡分配。請記得保存變更`);
      }
      
      // 更新標記狀態
      setMarkings(newMarkings);
      setGenerationAttempts(attempts);
      setOpenSnackbar(true);
      
      // 生成後更新統計數據
      generateStatistics();
    } catch (error) {
      console.error('全部重新生成加班人選失敗:', error);
      setApiError(`全部重新生成加班人選時發生錯誤: ${error.message || '未知錯誤'}`);
      setOpenSnackbar(true);
    } finally {
      setIsGeneratingRandom(false);
      shouldCancelGenerationRef.current = false;
    }
  };

  // 生成尚未指定加班人員
  const generatePartialRandomAssignments = () => {
    setOpenConfirmDialog(false);
    setIsGeneratingRandom(true);
    setGenerationAttempts(0);
    shouldCancelGenerationRef.current = false; // 重置取消標記
    
    // 使用setTimeout實現非阻塞的生成
    setTimeout(() => {
      generatePartialAssignmentsAsync();
    }, 100);
  };

  // 非阻塞的生成算法 - 生成尚未指定
  const generatePartialAssignmentsAsync = async () => {
    try {
      // 使用全局常量
      let attempts = 0;
      let isBalanced = false;
      let newMarkings = {};
      
      // 先檢查是否有足夠的資料來生成
      if (!overtimeData || Object.keys(overtimeData).length === 0) {
        throw new Error('沒有足夠的排班資料來生成加班人選');
      }
      
      // 不斷嘗試生成，直到達到平衡分配或達到最大嘗試次數
      while (!isBalanced && attempts < MAX_OVERTIME_GENERATION_ATTEMPTS && !shouldCancelGenerationRef.current) {
        attempts++;
        // 更新嘗試次數，確保UI更新
        setGenerationAttempts(attempts);
        
        // 更頻繁地檢查取消狀態並更新UI
        if (attempts % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
          
          // 再次檢查取消狀態，確保響應
          if (shouldCancelGenerationRef.current) {
            console.log('檢測到取消請求，停止生成');
            break;
          }
        }
        
        console.log(`嘗試生成尚未指定加班人員 (第 ${attempts} 次)`);
        
        // 保留現有標記
        newMarkings = { ...markings };
        
        // 對每一天進行處理 - 簡化的隨機分配方式
        Object.values(overtimeData)
          .sort((a, b) => a.day - b.day)
          .forEach(dayData => {
            const dateKey = dayData.date;
            // 過濾掉麻醉科Leader，只保留普通護理師
            const staffList = dayData.staffList.filter(staff => staff.identity !== '麻醉科Leader');
            
            // 檢查資料有效性
            if (!dateKey || !staffList || !Array.isArray(staffList) || staffList.length === 0) {
              console.warn(`日期 ${dateKey} 缺少有效的人員列表，跳過`);
              return;
            }
            
            const currentDate = parseISO(dateKey);
            
            // 跳過週日
            if (isSunday(currentDate)) {
              return;
            }
            
            // 初始化該日期的標記對象（如果不存在）
            if (!newMarkings[dateKey]) {
              newMarkings[dateKey] = {};
            }
            
            // 找出該日期已經分配的標記
            const assignedMarks = new Set(Object.values(newMarkings[dateKey] || {}));
            const unassignedStaff = staffList.filter(staff => !newMarkings[dateKey][staff.id]);
            
            // 週六只分配一位A加班
            if (isSaturday(currentDate)) {
              // 檢查是否已有人被指定為A班加班
              const hasAssignedA = assignedMarks.has('A');
              
              // 如果尚未有人被指定為A班加班，且有未分配的人員
              if (!hasAssignedA && unassignedStaff.length > 0) {
                // 洗牌算法 - 隨機排序未分配的人員
                const shuffledStaff = [...unassignedStaff].sort(() => Math.random() - 0.5);
                const staff = shuffledStaff[0];
                newMarkings[dateKey][staff.id] = 'A';
              }
            } else {
              // 平日分配A-F六位加班人員
              const marksToAssign = ['A', 'B', 'C', 'D', 'E', 'F'].filter(mark => !assignedMarks.has(mark));
              
              if (marksToAssign.length > 0 && unassignedStaff.length > 0) {
                // 洗牌算法 - 隨機排序未分配的人員
                const shuffledStaff = [...unassignedStaff].sort(() => Math.random() - 0.5);
                
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
        
        // 篩選出麻醉專科護理師（排除麻醉科Leader，因為他們不參與分數計算）
        const anesthesiaStaff = filteredSchedule.filter(nurse => 
          nurse.identity === '麻醉專科護理師' && 
          nurse.role !== 'head_nurse' && 
          nurse.position !== 'CC'
        );
        
        // 檢查是否有足夠的護理師來分配
        if (!anesthesiaStaff || anesthesiaStaff.length === 0) {
          throw new Error('沒有找到符合條件的麻醉專科護理師');
        }
        
        // 計算每個護理師的分數
        const nursesScores = anesthesiaStaff.map(nurse => {
          let totalScore = 0;
          // 用於記錄每月分數
          const monthlyScores = {};
          
          // 檢查nurse.shifts的有效性
          if (!nurse.shifts || !Array.isArray(nurse.shifts)) {
            console.warn(`護理師 ${nurse.name || nurse.id} 缺少shifts數據`);
            return {
              id: nurse.id,
              name: nurse.name || nurse.full_name || nurse.id.toString(),
              identity: nurse.identity,
              totalScore: 0,
              monthlyScores: {}
            };
          }
          
          // 計算每天的分數
          for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
            const dateKey = format(currentDate, 'yyyy-MM-dd');
            const month = currentDate.getMonth();
            
            // 確保該月的分數對象存在
            if (!monthlyScores[month]) {
              monthlyScores[month] = 0;
            }
            
            // 確保day-1不會超出shifts數組範圍
            if (day <= nurse.shifts.length) {
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
              monthlyScores[month] += dayScore;
            }
          }
          
          return {
            id: nurse.id,
            name: nurse.name || nurse.full_name || nurse.id.toString(),
            identity: nurse.identity,
            totalScore: parseFloat(totalScore.toFixed(2)),
            monthlyScores
          };
        });
        
        // 檢查是否有任何月份的分數超出範圍（正負3.5分）
        const hasMonthOutOfRange = nursesScores.some(nurse => 
          Object.values(nurse.monthlyScores).some(score => 
            score > 3.5 || score < -3.5
          )
        );
        
        // 檢查是否有年度總分超出範圍（正負2分）
        const hasYearOutOfRange = nursesScores.some(nurse => 
          nurse.totalScore > 2 || nurse.totalScore < -2
        );
        
        if (!hasMonthOutOfRange && !hasYearOutOfRange) {
          isBalanced = true;
          console.log('生成的加班人選分數已平衡', nursesScores);
        } else {
          if (hasMonthOutOfRange) {
            const outOfRangeMonths = nursesScores.flatMap(nurse => 
              Object.entries(nurse.monthlyScores)
                .filter(([_, score]) => score > 3.5 || score < -3.5)
                .map(([month, score]) => `${nurse.name}的${parseInt(month) + 1}月分數(${score.toFixed(2)})`)
            );
            console.log('有月份分數超出範圍(±3.5)，需要重新生成:', outOfRangeMonths);
          }
          
          if (hasYearOutOfRange) {
            const outOfRangeNurses = nursesScores
              .filter(nurse => nurse.totalScore > 2 || nurse.totalScore < -2)
              .map(nurse => `${nurse.name}(${nurse.totalScore.toFixed(2)})`);
            console.log('有護理師年度總分超出範圍(±2)，需要重新生成:', outOfRangeNurses);
          }
        }
      }
      
      // 檢查是否被取消
      if (shouldCancelGenerationRef.current) {
        console.log('生成已被用戶取消');
        setSuccessMessage('已成功取消隨機生成');
        setOpenSnackbar(true);
        setIsGeneratingRandom(false);
        shouldCancelGenerationRef.current = false;
        return;
      }
      
      if (!isBalanced) {
        setSuccessMessage(`已嘗試 ${MAX_OVERTIME_GENERATION_ATTEMPTS} 次生成尚未指定加班人員，但無法達到完全平衡。目前結果為最接近平衡的方案。`);
      } else {
        setSuccessMessage(`已成功生成尚未指定加班人員！在第 ${attempts} 次嘗試達到平衡分配。請記得保存變更`);
      }
      
      // 更新標記狀態
      setMarkings(newMarkings);
      setGenerationAttempts(attempts);
      setOpenSnackbar(true);
      
      // 生成後更新統計數據
      generateStatistics();
    } catch (error) {
      console.error('生成尚未指定加班人員失敗:', error);
      setApiError(`生成尚未指定加班人員時發生錯誤: ${error.message || '未知錯誤'}`);
      setOpenSnackbar(true);
    } finally {
      setIsGeneratingRandom(false);
      shouldCancelGenerationRef.current = false;
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
      
      // 清空API數據緩存，強制下次重新獲取
      setApiData(null);
      
      // 如果是儲存確保不會立即重新加載
      setInvalidRecordsFixed(true);
      
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

  // 檢查記錄是否有效
  const isValidRecord = (staffId, date, mark) => {
    // 檢查護理師信息
    const nurse = filteredSchedule.find(n => n.id === staffId);
    if (!nurse) {
      console.error(`未找到護理師數據 (staffId: ${staffId})`);
      return false;
    }
    
    // 檢查是否為麻醉專科護理師或麻醉科Leader
    if (nurse.identity !== '麻醉專科護理師' && nurse.identity !== '麻醉科Leader') {
      console.warn(`護理師 ${nurse.name || nurse.id} 不是麻醉專科護理師或麻醉科Leader (identity: ${nurse.identity})`);
      return false;
    }
    
    // 檢查是否是主護或是CC職位
    if (nurse.role === 'head_nurse' || nurse.position === 'CC') {
      console.warn(`護理師 ${nurse.name || nurse.id} 是主護或CC職位，不參與加班`);
      return false;
    }
    
    // 解析日期
    const currentDate = parseISO(date);
    
    // 檢查是否是週日（不加班）
    if (isSunday(currentDate)) {
      console.warn(`${date} 是週日，不排加班`);
      return false;
    }
    
    // 檢查麻醉科Leader是否在週六加班（週六只有A班加班，不適合Leader）
    if (nurse.identity === '麻醉科Leader' && isSaturday(currentDate)) {
      console.warn(`麻醉科Leader ${nurse.name} 不能在週六加班`);
      return false;
    }
    
    // 檢查該護理師當天的班別（需確保當天是A班）
    const day = getDate(currentDate);
    if (day <= nurse.shifts?.length) {
      const shift = nurse.shifts[day - 1];
      if (shift !== 'A') {
        console.warn(`護理師 ${nurse.name || nurse.id} 在 ${date} 的班別不是A班 (是${shift}班)`);
        return false;
      }
      
      return true;
    }
    
    console.error(`護理師 ${nurse.name || nurse.id} 在 ${date} 的班別數據不存在`);
    return false;
  };

  // 處理選擇加班人員
  const handleStaffSelection = (staffId, date, mark, isRemoval = false) => {
    // 清除任何現有錯誤
    setApiError('');
    
    // 如果是移除操作，直接處理
    if (isRemoval) {
      setMarkings(prev => {
        const newMarkings = { ...prev };
        
        // 確保該日期的對象存在
        if (!newMarkings[date]) {
          return newMarkings;
        }
        
        // 移除該護理師的標記
        if (newMarkings[date][staffId]) {
          delete newMarkings[date][staffId];
          
          // 如果該日期下沒有標記了，刪除整個日期對象
          if (Object.keys(newMarkings[date]).length === 0) {
            delete newMarkings[date];
          }
        }
        
        return newMarkings;
      });
      
      setSuccessMessage(`已移除護理師ID${staffId}在${date}的加班標記`);
      setOpenSnackbar(true);
      
      return;
    }
    
    // 檢查此記錄是否有效（非移除操作時才檢查）
    if (!isValidRecord(staffId, date, mark)) {
      console.error('無效的加班記錄');
      setApiError(`無效的加班記錄：護理師ID${staffId}在${date}不能被指定為${mark}班加班。`);
      setOpenSnackbar(true);
      return;
    }
    
    // 更新標記
    setMarkings(prev => {
      const newMarkings = { ...prev };
      
      // 確保該日期的對象存在
      if (!newMarkings[date]) {
        newMarkings[date] = {};
      }
      
      // 處理標記的設置和清除
      if (mark) {
        // 檢查此日期是否已有人被分配相同的加班標記
        const isMarkTaken = Object.entries(newMarkings[date]).some(
          ([id, existingMark]) => existingMark === mark && id !== staffId.toString()
        );
        
        if (isMarkTaken) {
          // 如果標記已被佔用，不進行更新並設置錯誤
          setTimeout(() => {
            setApiError(`${date}已有人被分配為${mark}班加班。請先移除現有的標記，或選擇不同的加班類型。`);
            setOpenSnackbar(true);
          }, 0);
          
          return prev; // 返回原狀態，不更新
        }
        
        // 設置新標記
        newMarkings[date][staffId] = mark;
      } else {
        // 清除標記
        if (newMarkings[date][staffId]) {
          delete newMarkings[date][staffId];
          
          // 如果該日期下沒有標記了，刪除整個日期對象
          if (Object.keys(newMarkings[date]).length === 0) {
            delete newMarkings[date];
          }
        }
      }
      
      return newMarkings;
    });
    
    // 顯示成功消息
    setSuccessMessage(`已將護理師ID${staffId}在${date}的加班標記設為${mark}`);
    setOpenSnackbar(true);
    
    // 重新計算統計數據
    generateStatistics();
  };

  // 生成年度統計數據
  const generateYearlyStatistics = async () => {
    setIsLoadingYearlyStatistics(true);
    
    try {
      if (!filteredSchedule || !filteredSchedule.length) {
        setYearlyStatisticsData([]);
        return;
      }
      
      // 獲取當年1月1日至今的日期範圍
      const currentYear = new Date().getFullYear();
      const startDate = format(new Date(currentYear, 0, 1), 'yyyy-MM-dd'); // 1月1日
      const endDate = format(new Date(), 'yyyy-MM-dd'); // 今天
      
      // 獲取這段時間內的所有加班記錄
      const response = canEdit 
        ? await apiService.overtime.getAllRecords(startDate, endDate)
        : await apiService.overtime.getMyRecords(startDate, endDate);
      
      // 獲取整年的月排班數據
      const monthlySchedules = {};
      
      // 循環獲取每個月的班表數據（1-12月）
      for (let month = 0; month < 12; month++) {
        try {
          // 構建查詢日期（當年的每個月的1號）
          const queryDate = new Date(currentYear, month, 1);
          
          // 如果查詢日期在未來，則跳過（不獲取未來的排班數據）
          if (queryDate > new Date()) {
            continue;
          }
          
          // 使用API獲取該月排班數據
          const monthlyResponse = await apiService.schedule.getMonthlySchedule(queryDate);
          if (monthlyResponse && monthlyResponse.data) {
            monthlySchedules[month] = monthlyResponse.data;
          }
        } catch (error) {
          console.warn(`無法獲取${currentYear}年${month + 1}月的排班數據:`, error);
          // 繼續處理下一個月，不中斷整個流程
        }
      }
      
      // 將加班記錄按用戶ID和日期索引
      const overtimeByUserAndDate = {};
      
      response.data.forEach(record => {
        const userId = record.user_id;
        const dateKey = record.date;
        
        if (!overtimeByUserAndDate[userId]) {
          overtimeByUserAndDate[userId] = {};
        }
        
        overtimeByUserAndDate[userId][dateKey] = record.overtime_shift;
      });
      
      // 初始化用戶月度統計數據
      const userMonthlyStats = {};
      
      // 篩選出麻醉專科護理師（不包含麻醉科Leader，因為他們不參與分數計算）
      const anesthesiaStaff = filteredSchedule.filter(nurse => 
        nurse.identity === '麻醉專科護理師' && 
        nurse.role !== 'head_nurse' && 
        nurse.position !== 'CC'
      );
      
      // 篩選出麻醉科Leader（單獨處理，不計算分數）
      const leaderStaff = filteredSchedule.filter(nurse => 
        nurse.identity === '麻醉科Leader' && 
        nurse.role !== 'head_nurse' && 
        nurse.position !== 'CC'
      );
      
      // 初始化所有護理師的統計數據
      [...anesthesiaStaff, ...leaderStaff].forEach(nurse => {
        userMonthlyStats[nurse.id] = {
          monthlyStats: Array(12).fill().map(() => ({ score: 0, count: 0, whiteShiftDays: 0 })),
          identity: nurse.identity
        };
      });
      
      // 處理每個月的排班數據和加班記錄
      Object.entries(monthlySchedules).forEach(([monthIndex, scheduleData]) => {
        const month = parseInt(monthIndex);
        
        // 確保有排班數據
        if (!Array.isArray(scheduleData) || scheduleData.length === 0) return;
        
        // 遍歷每位護理師
        scheduleData.forEach(nurse => {
          const userId = nurse.id;
          const identity = nurse.identity;
          
          // 只處理麻醉專科護理師和麻醉科Leader
          if (
            (identity !== '麻醉專科護理師' && identity !== '麻醉科Leader') || 
            nurse.role === 'head_nurse' || 
            nurse.position === 'CC'
          ) {
            return;
          }
          
          // 確保該用戶有統計數據
          if (!userMonthlyStats[userId]) {
            userMonthlyStats[userId] = {
              monthlyStats: Array(12).fill().map(() => ({ score: 0, count: 0, whiteShiftDays: 0 })),
              identity: identity
            };
          }
          
          // 確保該護理師有班次數據
          if (!nurse.shifts || !Array.isArray(nurse.shifts)) return;
          
          // 獲取該月天數
          const daysInMonth = nurse.shifts.length;
          
          // 遍歷該月每一天
          for (let day = 0; day < daysInMonth; day++) {
            const shift = nurse.shifts[day];
            
            // 只處理白班（A班）
            if (shift !== 'A') continue;
            
            // 構建日期
            const date = new Date(currentYear, month, day + 1);
            
            // 跳過週日（不加班）
            if (isSunday(date)) continue;
            
            // 麻醉科Leader不在週六加班
            if (identity === '麻醉科Leader' && isSaturday(date)) continue;
            
            // 日期格式化為YYYY-MM-DD
            const dateKey = format(date, 'yyyy-MM-dd');
            
            // 獲取加班記錄
            const overtimeShift = overtimeByUserAndDate[userId]?.[dateKey];
            
            // 更新統計數據
            if (identity === '麻醉專科護理師') {
              // 累計白班天數
              userMonthlyStats[userId].monthlyStats[month].whiteShiftDays++;
              
              if (overtimeShift) {
                // 有加班記錄，加分
                userMonthlyStats[userId].monthlyStats[month].score += calculateOvertimeScore(overtimeShift);
                userMonthlyStats[userId].monthlyStats[month].count += 1;
              } else {
                // 沒有加班記錄，扣0.264分
                userMonthlyStats[userId].monthlyStats[month].score -= 0.264;
              }
            } else if (identity === '麻醉科Leader' && overtimeShift) {
              // Leader只記錄加班次數，不計分
              userMonthlyStats[userId].monthlyStats[month].count += 1;
            }
          }
        });
      });
      
      // 將計算完的月度分數保存到服務器（僅限护理長和管理員有權限）
      if (canEdit) {
        try {
          // 整理月度分數數據
          const monthlyScoresToUpdate = [];
          
          Object.entries(userMonthlyStats).forEach(([userId, userData]) => {
            // 對每個月的統計數據
            userData.monthlyStats.forEach((monthData, monthIndex) => {
              // 只保存有數據的月份
              if (monthData.whiteShiftDays > 0 || monthData.count > 0) {
                const totalScore = Math.round(monthData.score * 100); // 轉換為整數（乘以100）
                
                // 生成詳細信息JSON
                const details = JSON.stringify({
                  whiteShiftDays: monthData.whiteShiftDays,
                  overtimeCount: monthData.count,
                  rawScore: monthData.score
                });
                
                monthlyScoresToUpdate.push({
                  user_id: parseInt(userId),
                  year: currentYear,
                  month: monthIndex + 1, // 1-12月
                  total_score: totalScore,
                  details: details
                });
              }
            });
          });
          
          // 批量保存月度分數
          if (monthlyScoresToUpdate.length > 0) {
            console.log('保存月度加班分數:', monthlyScoresToUpdate);
            await apiService.overtime.bulkCreateOrUpdateMonthlyScores(monthlyScoresToUpdate);
            console.log('月度加班分數已保存');
          }
        } catch (error) {
          console.error('保存月度加班分數失敗:', error);
          // 繼續處理，不中斷整個流程
        }
      }
      
      // 轉換為最終的統計數據格式
      // 計算普通護理師的年度統計
      const normalStatistics = anesthesiaStaff.map(nurse => {
        const stats = userMonthlyStats[nurse.id] || {
          monthlyStats: Array(12).fill().map(() => ({ score: 0, count: 0, whiteShiftDays: 0 })),
          identity: nurse.identity
        };
        
        // 計算總分和總加班次數
        let totalScore = 0;
        let totalOvertimes = 0;
        
        stats.monthlyStats.forEach(month => {
          totalScore += month.score;
          totalOvertimes += month.count;
        });
        
        return {
          id: nurse.id,
          name: nurse.name || nurse.full_name || nurse.id.toString(),
          position: nurse.position || '一般護理師',
          identity: nurse.identity,
          totalScore: parseFloat(totalScore.toFixed(2)),
          totalOvertimes,
          monthlyStats: stats.monthlyStats.map(month => ({
            score: parseFloat(month.score.toFixed(2)),
            count: month.count,
            whiteShiftDays: month.whiteShiftDays
          }))
        };
      });
      
      // 計算Leader的年度統計（不計分）
      const leaderStatistics = leaderStaff.map(nurse => {
        const stats = userMonthlyStats[nurse.id] || {
          monthlyStats: Array(12).fill().map(() => ({ score: 0, count: 0, whiteShiftDays: 0 })),
          identity: nurse.identity
        };
        
        // 計算總加班次數（不計分）
        let totalOvertimes = 0;
        
        stats.monthlyStats.forEach(month => {
          totalOvertimes += month.count;
        });
        
        return {
          id: nurse.id,
          name: nurse.name || nurse.full_name || nurse.id.toString(),
          position: nurse.position || '一般護理師',
          identity: nurse.identity,
          totalScore: 0, // Leader固定為0分
          totalOvertimes,
          monthlyStats: stats.monthlyStats.map(month => ({
            score: 0, // Leader固定為0分
            count: month.count,
            whiteShiftDays: month.whiteShiftDays
          }))
        };
      });
      
      // 合併普通護理師和Leader的統計數據
      const statistics = [...normalStatistics, ...leaderStatistics];
      
      // 按總分從高到低排序（Leader會排在後面，因為是0分）
      statistics.sort((a, b) => b.totalScore - a.totalScore);
      
      setYearlyStatisticsData(statistics);
    } catch (error) {
      console.error('生成年度統計數據失敗:', error);
      setApiError('生成年度統計數據時發生錯誤: ' + error.message);
      setOpenSnackbar(true);
    } finally {
      setIsLoadingYearlyStatistics(false);
    }
  };

  // 從數據庫加載年度統計數據
  const loadYearlyStatisticsFromDB = async () => {
    setIsLoadingYearlyStatistics(true);
    
    try {
      const currentYear = new Date().getFullYear();
      
      // 獲取所有可用的月度加班分數
      const response = canEdit 
        ? await apiService.overtime.getAllMonthlyScores(currentYear)
        : await apiService.overtime.getMyMonthlyScores(currentYear);
      
      if (!response.data || response.data.length === 0) {
        // 如果數據庫中沒有數據，則返回false，表示需要重新計算
        console.log('數據庫中沒有找到月度加班分數數據，需要重新計算');
        return false;
      }
      
      console.log(`找到 ${response.data.length} 條月度加班分數數據`);
      
      // 按用戶ID分組數據
      const scoresByUserId = {};
      
      response.data.forEach(record => {
        if (!scoresByUserId[record.user_id]) {
          scoresByUserId[record.user_id] = {
            monthlyStats: Array(12).fill().map(() => ({ 
              score: 0, 
              count: 0, 
              whiteShiftDays: 0,
              hasData: false
            }))
          };
        }
        
        // 月份是1-12，數組索引是0-11
        const monthIndex = record.month - 1;
        if (monthIndex < 0 || monthIndex > 11) return;
        
        // 解析詳細信息
        let details = {};
        try {
          details = JSON.parse(record.details || '{}');
        } catch (e) {
          console.warn('無法解析詳細信息:', record.details);
        }
        
        // 更新月度統計
        scoresByUserId[record.user_id].monthlyStats[monthIndex] = {
          score: record.total_score / 100, // 轉回小數
          count: details.overtimeCount || 0,
          whiteShiftDays: details.whiteShiftDays || 0,
          hasData: true
        };
      });
      
      // 篩選出麻醉專科護理師（不包含麻醉科Leader）
      const anesthesiaStaff = filteredSchedule.filter(nurse => 
        nurse.identity === '麻醉專科護理師' && 
        nurse.role !== 'head_nurse' && 
        nurse.position !== 'CC'
      );
      
      // 篩選出麻醉科Leader
      const leaderStaff = filteredSchedule.filter(nurse => 
        nurse.identity === '麻醉科Leader' && 
        nurse.role !== 'head_nurse' && 
        nurse.position !== 'CC'
      );
      
      // 處理普通護理師的統計數據
      const normalStatistics = anesthesiaStaff.map(nurse => {
        const stats = scoresByUserId[nurse.id] || {
          monthlyStats: Array(12).fill().map(() => ({ 
            score: 0, 
            count: 0, 
            whiteShiftDays: 0,
            hasData: false
          }))
        };
        
        // 計算總分和總加班次數
        let totalScore = 0;
        let totalOvertimes = 0;
        
        stats.monthlyStats.forEach(month => {
          totalScore += month.score;
          totalOvertimes += month.count;
        });
        
        return {
          id: nurse.id,
          name: nurse.name || nurse.full_name || nurse.id.toString(),
          position: nurse.position || '一般護理師',
          identity: nurse.identity,
          totalScore: parseFloat(totalScore.toFixed(2)),
          totalOvertimes,
          monthlyStats: stats.monthlyStats.map(month => ({
            score: parseFloat(month.score.toFixed(2)),
            count: month.count,
            whiteShiftDays: month.whiteShiftDays
          }))
        };
      });
      
      // 處理Leader的統計數據
      const leaderStatistics = leaderStaff.map(nurse => {
        const stats = scoresByUserId[nurse.id] || {
          monthlyStats: Array(12).fill().map(() => ({ 
            score: 0, 
            count: 0, 
            whiteShiftDays: 0,
            hasData: false
          }))
        };
        
        // 計算總加班次數（Leader不計分）
        let totalOvertimes = 0;
        
        stats.monthlyStats.forEach(month => {
          totalOvertimes += month.count;
        });
        
        return {
          id: nurse.id,
          name: nurse.name || nurse.full_name || nurse.id.toString(),
          position: nurse.position || '一般護理師',
          identity: nurse.identity,
          totalScore: 0, // Leader固定為0分
          totalOvertimes,
          monthlyStats: stats.monthlyStats.map(month => ({
            score: 0, // Leader固定為0分
            count: month.count,
            whiteShiftDays: month.whiteShiftDays
          }))
        };
      });
      
      // 合併普通護理師和Leader的統計數據
      const statistics = [...normalStatistics, ...leaderStatistics];
      
      // 按總分從高到低排序
      statistics.sort((a, b) => b.totalScore - a.totalScore);
      
      // 更新年度統計數據
      setYearlyStatisticsData(statistics);
      
      return true; // 表示已從數據庫中獲取到數據
    } catch (error) {
      console.error('從數據庫加載年度統計數據失敗:', error);
      return false; // 失敗時返回false，表示需要重新計算
    } finally {
      setIsLoadingYearlyStatistics(false);
    }
  };

  // 計算並保存月度加班分數
  const calculateAndSaveMonthlyScores = async () => {
    if (!canEdit) return Promise.resolve();
    
    try {
      // 獲取當前年月
      const currentYear = selectedDate.getFullYear();
      const currentMonth = selectedDate.getMonth(); // 0-11
      
      // 只處理當前顯示的月份數據
      const monthlyScoresToUpdate = [];
      
      // 篩選出麻醉專科護理師（不包含麻醉科Leader，因為他們不參與分數計算）
      const anesthesiaStaff = filteredSchedule.filter(nurse => 
        nurse.identity === '麻醉專科護理師' && 
        nurse.role !== 'head_nurse' && 
        nurse.position !== 'CC'
      );
      
      // 篩選出麻醉科Leader（單獨處理，不計算分數）
      const leaderStaff = filteredSchedule.filter(nurse => 
        nurse.identity === '麻醉科Leader' && 
        nurse.role !== 'head_nurse' && 
        nurse.position !== 'CC'
      );
      
      // 為每位護理師計算該月的總分
      [...anesthesiaStaff, ...leaderStaff].forEach(nurse => {
        const userId = nurse.id;
        const identity = nurse.identity;
        
        // 只為麻醉專科護理師計算分數
        if (identity !== '麻醉專科護理師' && identity !== '麻醉科Leader') return;
        
        let monthScore = 0;
        let overtimeCount = 0;
        let whiteShiftDays = 0;
        
        // 遍歷該月每一天
        for (let day = 1; day <= daysInMonth; day++) {
          const currentDate = new Date(currentYear, currentMonth, day);
          
          // 跳過週日（不加班）
          if (isSunday(currentDate)) continue;
          
          // 麻醉科Leader不在週六加班
          if (identity === '麻醉科Leader' && isSaturday(currentDate)) continue;
          
          // 檢查該護理師當天的班別（需確保當天是A班）
          if (nurse.shifts && Array.isArray(nurse.shifts) && day <= nurse.shifts.length) {
            const shift = nurse.shifts[day - 1];
            
            if (shift === 'A') {
              // 白班天數+1
              whiteShiftDays++;
              
              // 日期格式化為YYYY-MM-DD
              const dateKey = format(currentDate, 'yyyy-MM-dd');
              
              // 檢查是否有加班記錄
              const overtimeShift = markings[dateKey]?.[userId];
              
              if (identity === '麻醉專科護理師') {
                if (overtimeShift) {
                  // 有加班記錄，加分
                  monthScore += calculateOvertimeScore(overtimeShift);
                  overtimeCount++;
                } else {
                  // 沒有加班記錄，扣0.264分
                  monthScore -= 0.264;
                }
              } else if (identity === '麻醉科Leader' && overtimeShift) {
                // Leader只記錄加班次數，不計分
                overtimeCount++;
              }
            }
          }
        }
        
        // 只保存有數據的月份
        if (whiteShiftDays > 0 || overtimeCount > 0) {
          // 轉換為整數（乘以100）
          const totalScore = Math.round(monthScore * 100);
          
          // 生成詳細信息JSON
          const details = JSON.stringify({
            whiteShiftDays,
            overtimeCount,
            rawScore: monthScore
          });
          
          monthlyScoresToUpdate.push({
            user_id: userId,
            year: currentYear,
            month: currentMonth + 1, // 1-12月
            total_score: totalScore,
            details
          });
        }
      });
      
      // 批量保存月度分數
      if (monthlyScoresToUpdate.length > 0) {
        console.log('保存月度加班分數:', monthlyScoresToUpdate);
        await apiService.overtime.bulkCreateOrUpdateMonthlyScores(monthlyScoresToUpdate);
        console.log('月度加班分數已保存');
      }
      
      return true;
    } catch (error) {
      console.error('計算並保存月度加班分數失敗:', error);
      return false;
    }
  };

  // 處理統計視圖切換
  const toggleStatisticsView = async () => {
    // 檢查是否有未保存的變更
    if (hasUnsavedChanges && canEdit) {
      // 自動儲存變更後切換視圖
      try {
        setIsSaving(true);
        await saveOvertimeRecords();
        setSuccessMessage('已自動儲存變更並切換統計視圖');
        setOpenSnackbar(true);
      } catch (error) {
        console.error('自動儲存變更失敗:', error);
        setApiError(`自動儲存變更失敗: ${error.message || '未知錯誤'}`);
        setOpenSnackbar(true);
      } finally {
        setIsSaving(false);
      }
    }
    
    // 執行切換視圖
    executeToggleView();
  };
  
  // 實際執行切換視圖的函數
  const executeToggleView = () => {
    // 如果要切換到年度視圖
    if (!showYearlyStats) {
      if (yearlyStatisticsData.length === 0) {
        // 先嘗試從數據庫加載
        setIsLoadingYearlyStatistics(true);
        loadYearlyStatisticsFromDB().then(dataLoaded => {
          if (!dataLoaded) {
            // 如果沒有從數據庫獲取到數據，則重新計算
            generateYearlyStatistics();
          }
        });
      }
    }
    
    // 切換視圖狀態
    setShowYearlyStats(prev => !prev);
  };
  
  // 確認對話框操作處理
  const handleSaveConfirmAction = async (shouldSave) => {
    setOpenSaveConfirmDialog(false);
    
    if (shouldSave) {
      // 先保存
      await saveOvertimeRecords();
    }
    
    // 然後執行待處理操作
    if (pendingAction === 'toggleView') {
      executeToggleView();
    }
    
    // 重置待處理操作
    setPendingAction(null);
  };

  // 在任何修改標記的地方添加設置未保存變更狀態
  useEffect(() => {
    // 跳過初始渲染
    if (Object.keys(originalMarkings).length === 0) return;
    
    // 檢查標記是否與原始標記不同
    const markingsJson = JSON.stringify(markings);
    const originalMarkingsJson = JSON.stringify(originalMarkings);
    
    setHasUnsavedChanges(markingsJson !== originalMarkingsJson);
  }, [markings, originalMarkings]);

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
            }}
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
                              const isLeader = staff.identity === '麻醉科Leader';
                              
                              return (
                                <Tooltip key={staff.id} title={canEdit ? `點擊標記排序${isLeader ? ' (Leader僅手動加班)' : ''}` : "只有護理長和管理員可以修改"}>
                                  <Chip 
                                    label={chipLabel}
                                    variant={mark ? "filled" : "outlined"}
                                    color={isLeader ? "secondary" : (mark ? "primary" : "default")}
                                    size="small"
                                    onClick={canEdit ? () => handleMarkStaff(dayData.date, staff.id) : undefined}
                                    sx={{ 
                                      m: 0.3, 
                                      cursor: canEdit ? 'pointer' : 'default',
                                      fontWeight: mark ? 'bold' : 'normal',
                                      border: isLeader ? '1px dashed purple' : 'none'
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
          
          {/* 統計標題區域 */}
          <Typography variant="h5" gutterBottom>
            {formattedDate}{showYearlyStats ? '年度' : '月'}加班統計
          </Typography>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            統計規則：A班加班 = 1.0分，B班加班 = 0.8分，C班加班 = 0.7分，D班加班 = 0.2分，E和F班加班 = 0分，白班未排加班 = -0.264分，夜班或休假 = 0分
          </Alert>
          
          {/* 切換按鈕 */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button 
              variant="outlined" 
              color="primary" 
              onClick={toggleStatisticsView}
              disabled={isLoadingStatistics || isLoadingYearlyStatistics}
              startIcon={(isLoadingStatistics || isLoadingYearlyStatistics) ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {isLoadingStatistics || isLoadingYearlyStatistics ? '載入中...' : 
               showYearlyStats ? '顯示本月分數' : '顯示今年加班分數'}
            </Button>
          </Box>
          
          {/* 載入狀態 */}
          {(isLoading || isLoadingStatistics || isLoadingYearlyStatistics) && (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
              <CircularProgress />
            </Box>
          )}
          
          {/* 月度加班統計表 */}
          {!isLoading && !isLoadingStatistics && !showYearlyStats && statisticsData.length > 0 && (
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
                          
                          // 顯示分數
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
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 24 }}>
                                    {/* 如果有加班，只顯示加班班別的藍色圓圈；否則顯示原班別 */}
                                    {dayData.overtimeShift ? (
                                      <Box 
                                        sx={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          width: 22,
                                          height: 22,
                                          borderRadius: '50%',
                                          bgcolor: 'primary.main',
                                          color: 'white',
                                          fontWeight: 'bold',
                                          fontSize: '0.7rem',
                                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                        }}
                                      >
                                        {dayData.overtimeShift.toUpperCase()}
                                      </Box>
                                    ) : (
                                      <Typography variant="caption">
                                        {dayData.shift}
                                      </Typography>
                                    )}
                                  </Box>
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
          
          {/* 年度加班統計表 */}
          {showYearlyStats && !isLoadingYearlyStatistics && yearlyStatisticsData.length > 0 && (
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table stickyHeader aria-label="年度加班統計表格">
                <TableHead>
                  <TableRow>
                    <TableCell>護理師</TableCell>
                    {Array.from({ length: 12 }, (_, i) => (
                      <TableCell key={i}>{i + 1}月</TableCell>
                    ))}
                    <TableCell>總分</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {yearlyStatisticsData.map((staff) => (
                    <TableRow 
                      key={staff.id}
                      sx={{ 
                        '&:nth-of-type(odd)': { bgcolor: 'rgba(0, 0, 0, 0.03)' }
                      }}
                    >
                      <TableCell component="th" scope="row">
                        <Tooltip title={staff.identity}>
                          <span>{staff.name}</span>
                        </Tooltip>
                      </TableCell>
                      {staff.monthlyStats.map((month, index) => (
                        <TableCell key={index}>
                          {month.score > 0 || month.count > 0 ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Chip 
                                label={month.score} 
                                color={staff.identity === '麻醉科Leader' ? "secondary" : (month.score >= 0 ? "success" : "error")}
                                size="small"
                              />
                              <Typography variant="body2">/{month.count}</Typography>
                            </Box>
                          ) : '-'}
                        </TableCell>
                      ))}
                      <TableCell>
                        <Chip 
                          label={staff.totalScore} 
                          color={staff.identity === '麻醉科Leader' ? "secondary" : (staff.totalScore >= 0 ? "success" : "error")}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          
          {!isLoading && !isLoadingStatistics && !isLoadingYearlyStatistics && 
           ((showYearlyStats && yearlyStatisticsData.length === 0) || (!showYearlyStats && statisticsData.length === 0)) && (
            <Alert severity="info" sx={{ mb: 2 }}>
              沒有可用的{showYearlyStats ? '年度' : '月度'}統計數據，請確保有相關的加班記錄
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
      
      {/* 隨機生成進度對話框 */}
      <Dialog open={isGeneratingRandom} onClose={() => shouldCancelGenerationRef.current = true}>
        <DialogTitle>正在生成加班人選</DialogTitle>
        <DialogContent>
          <Box sx={{ width: '100%', mb: 2 }}>
            <LinearProgress variant="indeterminate" />
          </Box>
          <Typography variant="body1" gutterBottom>
            正在嘗試第 {generationAttempts} 次生成加班人選...
          </Typography>
          <Typography variant="body2" color="textSecondary">
            系統正在嘗試找到一個平衡的加班分配方案，該方案需要滿足：每月加班分數不超過±3.5分，年度總分不超過±2分。
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            如果生成時間過長，可點擊取消按鈕停止生成。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => shouldCancelGenerationRef.current = true} color="primary">
            取消生成
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
      
      {/* 保存確認對話框 */}
      <Dialog
        open={openSaveConfirmDialog}
        onClose={() => setOpenSaveConfirmDialog(false)}
      >
        <DialogTitle>未保存的變更</DialogTitle>
        <DialogContent>
          <DialogContentText>
            您有未保存的加班記錄變更。切換到年度統計視圖前，是否要保存這些變更？
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleSaveConfirmAction(false)} color="error">
            不保存
          </Button>
          <Button onClick={() => handleSaveConfirmAction(true)} color="primary" autoFocus>
            保存變更
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OvertimeStaff; 