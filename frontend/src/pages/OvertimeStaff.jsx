import React, { useState, useEffect, useMemo, useRef, useCallback, memo, useReducer } from 'react';
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
  LinearProgress,
  TextField,
  IconButton
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { zhTW } from 'date-fns/locale';
import { useScheduleStore } from '../store/scheduleStore';
import { useUserStore } from '../store/userStore';
import { useAuthStore } from '../store/authStore';
import { format, getDaysInMonth, getDay, isValid, parseISO, getDate } from 'date-fns';
import apiService from '../utils/api';

// 導入新的加班分配組件和工具
import { 
  OvertimeAllocationButton,
  AllocationConfirmDialog,
  AllocationProgressDialog,
  scoreUtils,
  NO_OVERTIME_PENALTY
} from '../components/OvertimeAllocation';
import { useOvertimeAllocation } from '../hooks/useOvertimeAllocation';

// 日誌記錄功能
const logger = {
  info: (message, ...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[INFO] ${message}`, ...args);
    }
  },
  warn: (message, ...args) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
  success: (message, ...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SUCCESS] ${message}`, ...args);
    }
  },
  debug: (message, ...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }
};

// 確保日期有效性的工具函數
const ensureValidDate = (date) => {
  if (date && date instanceof Date && !isNaN(date.getTime())) {
    return date;
  }
  logger.warn('發現無效日期，使用當前日期替代:', date);
  return new Date();
};

// MARK_SEQUENCE 已從組件導入

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

// 獲取星期幾名稱
const getDayName = (day) => {
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
  return dayNames[day] || '?';
};

// 使用統一的分數計算工具
const calculateOvertimeScore = scoreUtils.calculateOvertimeScore;


// 新增統一的 API 請求緩存機制
const useApiCache = () => {
  const [cache, setCache] = useState({});
  const [loading, setLoading] = useState({});

  const fetchWithCache = async (key, fetchFn) => {
    // 如果已經在請求中，等待完成
    if (loading[key]) {
      logger.info(`請求 ${key} 正在進行中，等待完成...`);
      return cache[key];
    }
    
    // 如果已經有緩存，直接返回
    if (cache[key]) {
      logger.info(`使用緩存數據: ${key}`);
      return cache[key];
    }
    
    // 開始新請求
    logger.info(`開始新的請求: ${key}`);
    setLoading(prev => ({ ...prev, [key]: true }));
    
    try {
      const result = await fetchFn();
      setCache(prev => ({ ...prev, [key]: result }));
      return result;
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const clearCache = (key) => {
    if (key) {
      setCache(prev => {
        const newCache = { ...prev };
        delete newCache[key];
        return newCache;
      });
    } else {
      setCache({});
    }
  };

  return { fetchWithCache, clearCache, cache };
};

// 將OvertimeRow抽出來作為獨立組件，使用memo優化渲染
const OvertimeRow = ({ 
  dayData, 
  canEdit, 
  markings, 
  onMarkStaff, 
  isCompliant,
  showUnmarkedStaff = true // 新增參數，預設顯示所有人員
}) => {
  // 預先計算常用樣式
  const chipStyle = useMemo(() => ({ 
    m: 0.3, 
    cursor: canEdit ? 'pointer' : 'default' 
  }), [canEdit]);
  
  // 建立處理加班標記的回調函數
  const handleMarkStaffCallback = useCallback((staffId) => {
    return () => onMarkStaff(dayData.date, staffId);
  }, [dayData.date, onMarkStaff]);
  
  // 根據showUnmarkedStaff狀態過濾人員列表
  const filteredStaffList = useMemo(() => {
    if (showUnmarkedStaff) {
      // 顯示所有人員
      return dayData.staffList;
    } else {
      // 只顯示有加班標記的人員
      const markedStaff = dayData.staffList.filter(staff => {
        const mark = markings[dayData.date]?.[staff.id];
        return mark && mark.trim() !== '';
      });
      
      // 按照加班標記A-F順序排序
      return markedStaff.sort((a, b) => {
        const markA = markings[dayData.date]?.[a.id] || '';
        const markB = markings[dayData.date]?.[b.id] || '';
        
        // 定義排序順序：A=1, B=2, C=3, D=4, E=5, F=6
        const orderMap = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6 };
        
        return (orderMap[markA] || 999) - (orderMap[markB] || 999);
      });
    }
  }, [dayData.staffList, showUnmarkedStaff, markings, dayData.date]);
  
  return (
    <TableRow 
      sx={{ 
        '&:nth-of-type(odd)': { bgcolor: 'rgba(0, 0, 0, 0.03)' },
        ...(dayData.weekday === '六' ? { bgcolor: 'rgba(255, 220, 220, 0.1)' } : {})
      }}
    >
      <TableCell
        sx={{
          width: { xs: 'auto', md: '150px' },
          minWidth: { xs: '80px', md: '150px' }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {dayData.day}({dayData.weekday})
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
      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
        {showUnmarkedStaff ? dayData.staffList.length : filteredStaffList.length}人
        {!showUnmarkedStaff && dayData.staffList.length > filteredStaffList.length && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            (共{dayData.staffList.length}人)
          </Typography>
        )}
      </TableCell>
      <TableCell>
        {filteredStaffList.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {filteredStaffList.map((staff) => {
              const mark = markings[dayData.date]?.[staff.id] || '';
              const chipLabel = mark ? `${staff.name}${mark}` : staff.name;
              const isLeader = staff.identity === '麻醉科Leader';
              const isCc = staff.isCc || staff.areaCode === 'CC';
              
              return (
                <Tooltip key={staff.id} title={canEdit ? `點擊標記排序${isLeader ? ' (Leader僅手動加班)' : ''}` : "只有護理長和系統管理員可以修改"}>
                  <Chip 
                    label={chipLabel}
                    variant={mark ? "filled" : "outlined"}
                    color={isLeader ? "secondary" : (mark ? "primary" : "default")}
                    size="small"
                    onClick={canEdit ? handleMarkStaffCallback(staff.id) : undefined}
                    sx={{ 
                      ...chipStyle,
                      fontWeight: mark ? 'bold' : 'normal',
                      border: isLeader ? '1px dashed purple' : (isCc ? '1px dashed' : 'none'),
                      borderColor: isCc ? 'text.disabled' : undefined,
                      color: isCc ? 'text.disabled' : undefined,
                      borderRadius: isCc ? 0 : undefined
                    }}
                  />
                </Tooltip>
              );
            })}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {showUnmarkedStaff ? '無加班人員' : '無已安排加班人員'}
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
};
// 移除 memo 優化以確保用戶點擊後立即渲染，優先考慮用戶體驗

// 獨立的統計行組件
const StatRow = memo(({ staff, daysInMonth, selectedDate }) => {
  return (
    <TableRow 
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
                          boxShadow: 'none'
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
  );
});

// 新增：狀態管理的 reducer 和初始狀態
const initialUIState = {
  isSaving: false,
  isLoadingOvertimeRecords: false,
  isLoadingStatistics: false,
  isGeneratingRandom: false,
  isResetting: false,
  isScheduleLoading: false,
  scheduleLoaded: false,
  hasSchedule: false,
  invalidRecordsFixed: true,
  hasUnsavedChanges: false,
};

const initialDialogState = {
  openSnackbar: false,
  openConfirmDialog: false,
  openResetConfirmDialog: false,
};

const initialMessageState = {
  apiError: null,
  successMessage: '',
};

const initialDataState = {
  markings: {},
  originalMarkings: {},
  statisticsData: [],
  tempDate: null,
};

const initialConfigState = {
  showUnmarkedStaff: false,
};

// UI狀態 reducer
const uiStateReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, [action.loadingType]: action.value };
    case 'SET_SCHEDULE_STATE':
      return { 
        ...state, 
        scheduleLoaded: action.loaded,
        hasSchedule: action.hasSchedule,
        isScheduleLoading: action.loading || false
      };
    case 'SET_MULTIPLE':
      return { ...state, ...action.updates };
    case 'RESET':
      return initialUIState;
    default:
      return state;
  }
};

// 對話框狀態 reducer
const dialogStateReducer = (state, action) => {
  switch (action.type) {
    case 'OPEN_DIALOG':
      return { ...state, [action.dialogType]: true };
    case 'CLOSE_DIALOG':
      return { ...state, [action.dialogType]: false };
    case 'CLOSE_ALL':
      return initialDialogState;
    default:
      return state;
  }
};

// 訊息狀態 reducer
const messageStateReducer = (state, action) => {
  switch (action.type) {
    case 'SET_ERROR':
      return { ...state, apiError: action.error, successMessage: '' };
    case 'SET_SUCCESS':
      return { ...state, successMessage: action.message, apiError: null };
    case 'CLEAR_MESSAGES':
      return initialMessageState;
    default:
      return state;
  }
};

// 數據狀態 reducer
const dataStateReducer = (state, action) => {
  switch (action.type) {
    case 'SET_MARKINGS':
      return { ...state, markings: action.markings };
    case 'SET_ORIGINAL_MARKINGS':
      return { ...state, originalMarkings: action.markings };
    case 'SET_STATISTICS':
      return { ...state, statisticsData: action.data };
    case 'SET_TEMP_DATE':
      return { ...state, tempDate: action.date };
    case 'RESET_MARKINGS':
      return { ...state, markings: {}, originalMarkings: {} };
    case 'UPDATE_MARKINGS_AND_ORIGINAL':
      return { 
        ...state, 
        markings: action.markings,
        originalMarkings: JSON.parse(JSON.stringify(action.markings))
      };
    default:
      return state;
  }
};

// 配置狀態 reducer
const configStateReducer = (state, action) => {
  switch (action.type) {
    case 'TOGGLE_UNMARKED_STAFF':
      return { ...state, showUnmarkedStaff: !state.showUnmarkedStaff };
    case 'SET_SHOW_UNMARKED_STAFF':
      return { ...state, showUnmarkedStaff: action.value };
    default:
      return state;
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
  
  // 使用新的 API 緩存機制
  const { fetchWithCache, clearCache } = useApiCache();
  
  // 🚀 優化後的狀態管理 - 使用 useReducer 分組管理狀態
  const [uiState, dispatchUI] = useReducer(uiStateReducer, initialUIState);
  const [dialogState, dispatchDialog] = useReducer(dialogStateReducer, initialDialogState);
  const [messageState, dispatchMessage] = useReducer(messageStateReducer, initialMessageState);
  const [dataState, dispatchData] = useReducer(dataStateReducer, initialDataState);
  const [configState, dispatchConfig] = useReducer(configStateReducer, initialConfigState);
  const hasInitializedShowUnmarkedRef = useRef(false);

  // 🚀 從狀態中解構常用的值，提高可讀性
  const {
    isSaving,
    isLoadingOvertimeRecords,
    isLoadingStatistics,
    isGeneratingRandom,
    isResetting,
    isScheduleLoading,
    scheduleLoaded,
    hasSchedule,
    invalidRecordsFixed,
    hasUnsavedChanges
  } = uiState;

  const {
    openSnackbar,
    openConfirmDialog,
    openResetConfirmDialog
  } = dialogState;

  const { apiError, successMessage } = messageState;

  const {
    markings,
    originalMarkings,
    statisticsData,
    tempDate
  } = dataState;

  const {
    showUnmarkedStaff
  } = configState;

  // 🚀 所有狀態現在都通過 useReducer 管理，舊的 useState 已被移除
  useEffect(() => {
    if (!user || hasInitializedShowUnmarkedRef.current) {
      return;
    }

    const shouldShowAll = user.role === 'head_nurse' || user.role === 'admin';
    if (shouldShowAll) {
      dispatchConfig({ type: 'SET_SHOW_UNMARKED_STAFF', value: true });
    }

    hasInitializedShowUnmarkedRef.current = true;
  }, [user]);

  // 🚀 創建狀態更新輔助函數，簡化調用
  const updateUI = useCallback((updates) => {
    dispatchUI({ type: 'SET_MULTIPLE', updates });
  }, []);

  const updateMessage = useCallback((type, content) => {
    if (type === 'error') {
      dispatchMessage({ type: 'SET_ERROR', error: content });
    } else if (type === 'success') {
      dispatchMessage({ type: 'SET_SUCCESS', message: content });
    } else {
      dispatchMessage({ type: 'CLEAR_MESSAGES' });
    }
  }, []);

  const updateDialog = useCallback((dialogType, isOpen) => {
    if (isOpen) {
      dispatchDialog({ type: 'OPEN_DIALOG', dialogType });
    } else {
      dispatchDialog({ type: 'CLOSE_DIALOG', dialogType });
    }
  }, []);

  const updateData = useCallback((type, data) => {
    switch (type) {
      case 'markings':
        dispatchData({ type: 'SET_MARKINGS', markings: data });
        break;
      case 'statistics':
        dispatchData({ type: 'SET_STATISTICS', data });
        break;
      case 'tempDate':
        dispatchData({ type: 'SET_TEMP_DATE', date: data });
        break;
      case 'resetMarkings':
        dispatchData({ type: 'RESET_MARKINGS' });
        break;
      default:
        break;
    }
  }, []);

  const updateConfig = useCallback((type, value) => {
    switch (type) {
      case 'toggleUnmarkedStaff':
        dispatchConfig({ type: 'TOGGLE_UNMARKED_STAFF' });
        break;
      default:
        break;
    }
  }, []);

  // 🚀 簡化的錯誤處理函數
  const showError = useCallback((message) => {
    updateMessage('error', message);
    updateDialog('openSnackbar', true);
  }, [updateMessage, updateDialog]);

  const showSuccess = useCallback((message) => {
    updateMessage('success', message);
    updateDialog('openSnackbar', true);
  }, [updateMessage, updateDialog]);

  // 🚀 新增：使用加班分配Hook
  const allocationHook = useOvertimeAllocation(logger);
  const [includeZeroScoreShifts, setIncludeZeroScoreShifts] = useState(true);

  // 權限檢查 - 只有護理長和admin可以編輯
  const canEdit = useMemo(() => {
    return user && (user.role === 'head_nurse' || user.role === 'admin');
  }, [user]);
  
  // 確保選擇的日期是有效的
  const selectedDate = useMemo(() => {
    try {
      return ensureValidDate(storeSelectedDate);
    } catch (error) {
      logger.error('處理日期時出錯:', error);
      return new Date();
    }
  }, [storeSelectedDate]);

  // 獲取當前選擇月份的天數
  const daysInMonth = useMemo(() => {
    try {
      return getDaysInMonth(selectedDate);
    } catch (error) {
      logger.error('獲取月份天數失敗:', error);
      return 30; // 默認返回30天
    }
  }, [selectedDate]);

  // 獲取當前月份格式化字符串
  const formattedDate = useMemo(() => {
    try {
      if (!isValid(selectedDate)) return '無效日期';
      return format(selectedDate, 'yyyy年MM月');
    } catch (error) {
      logger.error('格式化日期失敗:', error);
      return '無效日期';
    }
  }, [selectedDate]);

  // 使用 useMemo 計算 filteredSchedule
  const filteredSchedule = useMemo(() => {
    if (!hasSchedule || !storeMonthlySchedule || !Array.isArray(storeMonthlySchedule) || storeMonthlySchedule.length === 0) {
      return [];
    }
    // 過濾出有班次數據的護理師
    return storeMonthlySchedule.filter(nurse =>
      nurse && nurse.shifts && Array.isArray(nurse.shifts) && nurse.shifts.length > 0
    );
  }, [storeMonthlySchedule, hasSchedule]);

  // 使用 useMemo 計算 overtimeData
  const overtimeData = useMemo(() => {
    if (!hasSchedule || !storeMonthlySchedule || !Array.isArray(storeMonthlySchedule) || storeMonthlySchedule.length === 0) {
      return {};
    }
    
    const nursesWithShifts = storeMonthlySchedule.filter(nurse =>
      nurse && nurse.shifts && Array.isArray(nurse.shifts) && nurse.shifts.length > 0
    );
    
    const overtimeByDate = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
      if (isSunday(currentDate)) continue;
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      const weekday = getDay(currentDate);
      overtimeByDate[dateKey] = { date: dateKey, day: day, weekday: getDayName(weekday), staffList: [] };
    }
    
    nursesWithShifts.forEach(nurse => {
      const isAnesthesiaNurse = nurse.identity === '麻醉專科護理師' || nurse.identity === '麻醉科Leader';
      const isNotHeadNurse = nurse.role !== 'head_nurse';
      const isNotCC = nurse.position !== 'CC';
      if (!isNotHeadNurse || !isNotCC || !isAnesthesiaNurse) return;
      
      const isLeader = nurse.identity === '麻醉科Leader';
      if (!nurse.shifts || !Array.isArray(nurse.shifts)) return;
      
      nurse.shifts.forEach((shift, index) => {
        if (shift === 'A') {
          const areaCode = nurse.area_codes?.[index] || null;
          const day = index + 1;
          if (day <= daysInMonth) {
            const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
            if (isSunday(currentDate)) return;
            if (isLeader && isSaturday(currentDate)) return;
            const dateKey = format(currentDate, 'yyyy-MM-dd');
            if (overtimeByDate[dateKey]) {
              overtimeByDate[dateKey].staffList.push({ 
                id: nurse.id, 
                name: nurse.name || nurse.full_name || '未知姓名', 
                position: nurse.position || '一般護理師', 
                identity: nurse.identity || '未知身份',
                areaCode,
                isCc: areaCode === 'CC'
              });
            }
          }
        }
      });
    });
    
    return overtimeByDate;
  }, [storeMonthlySchedule, selectedDate, daysInMonth, hasSchedule]);

  // 臨時日期狀態已移至 dataState 中管理

  // 處理日期變更
  const handleDateChange = (newDate) => {
    if (newDate && newDate instanceof Date && !isNaN(newDate.getTime())) {
      // 只更新臨時日期，不觸發API調用
      dispatchData({ type: 'SET_TEMP_DATE', date: newDate });
    } else {
      logger.error('嘗試設置無效的日期:', newDate);
      dispatchData({ type: 'SET_TEMP_DATE', date: new Date() });
    }
  };
  
  // 處理日期確認
  const handleDateAccept = () => {
    if (tempDate && tempDate instanceof Date && !isNaN(tempDate.getTime())) {
      updateSelectedDate(tempDate);
      // 清除之前的標記
      dispatchData({ type: 'RESET_MARKINGS' });
    }
  };

  // 處理點擊標記 - 已經使用useCallback優化，但進一步添加了註釋提示
  const handleMarkStaff = useCallback(
    (dateKey, staffId) => {
      try {
        const date = parseISO(dateKey);
        
        // 檢查護理師信息
        const nurse = filteredSchedule.find(n => n.id === staffId);
        if (!nurse) {
          logger.error(`未找到護理師數據 (staffId: ${staffId})`);
          dispatchMessage({ type: 'SET_ERROR', error: '未找到護理師數據' });
          dispatchDialog({ type: 'OPEN_DIALOG', dialogType: 'openSnackbar' });
          return;
        }
        
        // 檢查是否為麻醉科Leader的情況
        const isLeader = nurse.identity === '麻醉科Leader';
        
        // 處理週六的特殊邏輯，只允許有一個A班加班人員，並且麻醉科Leader不能排週六加班
        if (isSaturday(date)) {
          // 如果是Leader，不允許在週六加班
          if (isLeader) {
            dispatchMessage({ type: 'SET_ERROR', error: '麻醉科Leader不能在週六加班' });
            dispatchDialog({ type: 'OPEN_DIALOG', dialogType: 'openSnackbar' });
            return;
          }
          
          // 處理週六的標記邏輯
          const newMarkings = { ...markings };
          
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
            dispatchMessage({ type: 'SET_ERROR', error: '週六只能有一位加班人員A' });
            dispatchDialog({ type: 'OPEN_DIALOG', dialogType: 'openSnackbar' });
            return;
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
          
          dispatchData({ type: 'SET_MARKINGS', markings: newMarkings });
          
          return;
        }
        
        // 簡單的循環邏輯：A→B→C→D→E→F→取消，跳過已占用班別
        const newMarkings = { ...markings };
        if (!newMarkings[dateKey]) {
          newMarkings[dateKey] = {};
        }
        
        // 當前人員的班別
        const currentShift = newMarkings[dateKey][staffId] || '';
        
        // 找出已被其他人占用的班別
        const usedShifts = [];
        Object.entries(newMarkings[dateKey]).forEach(([id, shift]) => {
          if (id !== staffId && shift) {
            usedShifts.push(shift);
          }
        });
        
        // 所有可能的班別
        const allShifts = ['A', 'B', 'C', 'D', 'E', 'F'];
        
        // 找出可用的班別（未被占用的）
        const availableShifts = allShifts.filter(shift => !usedShifts.includes(shift));
        
        let nextShift = '';
        
        if (!currentShift) {
          // 沒有班別 → 分配第一個可用班別
          nextShift = availableShifts[0] || '';
        } else {
          // 有班別 → 在全部班別序列中找下一個可用班別
          const currentIndexInAll = allShifts.indexOf(currentShift);
          
          // 從當前班別的下一個開始尋找可用班別
          let found = false;
          for (let i = currentIndexInAll + 1; i < allShifts.length; i++) {
            if (availableShifts.includes(allShifts[i])) {
              nextShift = allShifts[i];
              found = true;
              break;
            }
          }
          
          // 如果沒找到，表示已經循環完畢，取消班別
          if (!found) {
            nextShift = '';
          }
        }
        
        // 更新班別
        if (nextShift) {
          newMarkings[dateKey][staffId] = nextShift;
        } else {
          delete newMarkings[dateKey][staffId];
          if (Object.keys(newMarkings[dateKey]).length === 0) {
            delete newMarkings[dateKey];
          }
        }
        
        logger.info(`班別切換: ${staffId} 從 ${currentShift || '無'} → ${nextShift || '取消'}`);
        dispatchData({ type: 'SET_MARKINGS', markings: newMarkings });
      } catch (error) {
        logger.error('處理標記時出錯:', error);
        dispatchMessage({ type: 'SET_ERROR', error: '處理標記時發生錯誤' });
        dispatchDialog({ type: 'OPEN_DIALOG', dialogType: 'openSnackbar' });
      }
    },
    [filteredSchedule, markings, dispatchData, dispatchMessage, dispatchDialog]
  );

  // 保存加班記錄 - 優化版本
  const saveOvertimeRecords = async () => {
    if (!canEdit) {
      dispatchMessage({ type: 'SET_ERROR', error: '只有護理長和系統管理員可以保存加班記錄' });
      dispatchDialog({ type: 'OPEN_DIALOG', dialogType: 'openSnackbar' });
      return;
    }
    
    dispatchUI({ type: 'SET_LOADING', loadingType: 'isSaving', value: true });
    dispatchMessage({ type: 'CLEAR_MESSAGES' });
    
    try {
      // 組織數據，收集所有更新
      const updateRecords = [];
      const updateLog = [];  // 添加日誌陣列，以便除錯
      
      if (Object.keys(markings).length === 0) {
        logger.info('加班表已被重設，準備清空所有記錄');
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
      logger.info('整月批量更新請求:', { 記錄數量: updateLog.length });
      
      // 執行批量更新
      if (updateRecords.length > 0) {
        const result = await apiService.overtime.bulkUpdate(updateRecords);
        logger.success('整月批量更新成功:', { 更新記錄數: result.data || updateRecords.length });
        
        // 在保存加班記錄成功後，計算並保存月度加班分數
        const scoresSaved = await calculateAndSaveMonthlyScores();
        
        dispatchMessage({ 
          type: 'SET_SUCCESS', 
          message: `加班記錄保存成功！共更新 ${result.data || updateRecords.length} 條記錄${scoresSaved ? '，且月度加班分數已更新' : ''}` 
        });
        dispatchDialog({ type: 'OPEN_DIALOG', dialogType: 'openSnackbar' });
        
        // 清空相關緩存
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const startDate = format(new Date(year, month, 1), 'yyyy-MM-dd');
        const endDate = format(new Date(year, month + 1, 0), 'yyyy-MM-dd');
        
        // 更新緩存鍵，使用統一的格式
        clearCache(`overtimeRecords_${startDate}_${endDate}`);
        
        // --- 直接重新獲取數據並處理 ---
        try {
          logger.info('重新獲取數據以更新畫面');
          
          // 所有用戶都使用getAllRecords API
          const freshResponse = await apiService.overtime.getAllRecords(startDate, endDate);
            
          logger.info('獲取新數據成功，準備更新UI');
          processApiData(freshResponse.data); // 直接使用返回的數據更新狀態
        } catch (fetchError) {
          logger.error('保存後重新獲取數據失敗:', fetchError);
          dispatchMessage({ type: 'SET_ERROR', error: '保存成功，但刷新數據時出錯' });
          dispatchDialog({ type: 'OPEN_DIALOG', dialogType: 'openSnackbar' });
        }
        // --- 重新獲取結束 ---
      } else {
        dispatchMessage({ type: 'SET_SUCCESS', message: '無變更需要保存' });
        dispatchDialog({ type: 'OPEN_DIALOG', dialogType: 'openSnackbar' });
      }
    } catch (error) {
      logger.error('保存加班記錄失敗:', error);
      
      // 提取更有用的錯誤信息
      let errorMsg = '保存加班記錄失敗';
      
      if (error.response) {
        const responseData = error.response.data;
        logger.error('錯誤響應數據:', responseData);
        
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
      
      dispatchMessage({ type: 'SET_ERROR', error: errorMsg });
      dispatchDialog({ type: 'OPEN_DIALOG', dialogType: 'openSnackbar' });
    } finally {
      dispatchUI({ type: 'SET_LOADING', loadingType: 'isSaving', value: false });
    }
  };

  // 優化加載月排班表
  const loadMonthlySchedule = async () => {
    // 防止重複加載
    if (isScheduleLoading) {
        logger.info('月排班表已在加載中，跳過請求');
        return;
    }
    
    logger.info('開始加載月排班表');
    dispatchUI({ type: 'SET_LOADING', loadingType: 'isScheduleLoading', value: true });

    try {
      // 使用緩存鍵，包含年月信息
      const cacheKey = `monthlySchedule_${format(selectedDate, 'yyyy-MM')}`;
      await fetchWithCache(cacheKey, async () => {
        await fetchMonthlySchedule();
        return storeMonthlySchedule;
      });
      
      const hasData = storeMonthlySchedule && 
          Array.isArray(storeMonthlySchedule) && 
          storeMonthlySchedule.length > 0;
      
      dispatchUI({ 
        type: 'SET_SCHEDULE_STATE', 
        loaded: true, 
        hasSchedule: hasData 
      });
      
      if (hasData) {
        logger.success('月排班表加載成功');
      } else {
        logger.warn('月排班表加載後無數據');
      }
    } catch (error) {
      logger.error('獲取月排班表失敗:', error);
      dispatchUI({ 
        type: 'SET_SCHEDULE_STATE', 
        loaded: true, 
        hasSchedule: false 
      });
    } finally {
      logger.info('月排班表加載完成');
      dispatchUI({ type: 'SET_LOADING', loadingType: 'isScheduleLoading', value: false });
    }
  };

  // 從後端加載加班記錄 - 優化版本
  const loadOvertimeRecords = async () => {
    if (!selectedDate || !isValid(selectedDate) || !hasSchedule) return Promise.resolve();
    
    dispatchUI({ type: 'SET_LOADING', loadingType: 'isLoadingOvertimeRecords', value: true });
    dispatchMessage({ type: 'CLEAR_MESSAGES' });
    
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      
      // 獲取該月第一天和最後一天
      const startDate = format(new Date(year, month, 1), 'yyyy-MM-dd');
      const endDate = format(new Date(year, month + 1, 0), 'yyyy-MM-dd');
      
      // 創建緩存鍵，僅使用日期信息，不再區分用戶角色
      const cacheKey = `overtimeRecords_${startDate}_${endDate}`;
      
      // 使用簡化的緩存機制獲取數據
      const response = await fetchWithCache(cacheKey, async () => {
        // 使用API服務獲取加班記錄 - 使用簡潔的URL格式
        logger.info('正在獲取加班記錄', { 開始日期: startDate, 結束日期: endDate });
        
        // 添加詳細API請求日誌
        logger.debug('API請求細節', {
          請求類型: 'getAllRecords',
          參數: { startDate, endDate }
        });
        
        try {
          // 所有用戶都使用getAllRecords API
          const result = await apiService.overtime.getAllRecords(startDate, endDate);
          
          logger.debug('API響應狀態', { 
            狀態碼: result.status,
            響應大小: JSON.stringify(result.data).length
          });
          
          return result;
        } catch (error) {
          logger.error('API請求失敗', {
            錯誤: error.message,
            狀態碼: error.response?.status,
            錯誤詳情: error.response?.data
          });
          throw error;
        }
      });
      
      // 處理API數據
      if (response && response.data) {
        logger.success('成功獲取加班記錄', { 記錄數量: response.data.length });
        processApiData(response.data);
      } else {
        logger.warn('API返回的數據結構異常或為空');
      }
      
      return Promise.resolve(markings);
    } catch (error) {
      logger.error('獲取加班記錄失敗:', error);
      // 確保錯誤信息是字符串
      const errorMessage = typeof error === 'object' ? 
        (error.response?.data?.detail || JSON.stringify(error)) : 
        String(error);
      dispatchMessage({ type: 'SET_ERROR', error: errorMessage });
      dispatchDialog({ type: 'OPEN_DIALOG', dialogType: 'openSnackbar' });
      return Promise.reject(error);
    } finally {
      dispatchUI({ type: 'SET_LOADING', loadingType: 'isLoadingOvertimeRecords', value: false });
    }
  };
  
  // 更新 processApiData 函數，將標記、統計、原始標記一次性更新，避免連鎖觸發
  const processApiData = (data) => {
    const startTime = performance.now();
    
    // 將後端數據轉換為前端需要的格式
    const newMarkings = {};
    
    // 使用 Map 加速檢索
    data.forEach(record => {
      const dateKey = typeof record.date === 'string' 
        ? record.date
        : format(parseISO(record.date), 'yyyy-MM-dd');
      
      if (!newMarkings[dateKey]) {
        newMarkings[dateKey] = {};
      }
      
      newMarkings[dateKey][record.user_id] = record.overtime_shift;
    });

    // 批量更新狀態，避免連鎖反應
    dispatchData({ type: 'UPDATE_MARKINGS_AND_ORIGINAL', markings: newMarkings });
    dispatchUI({ type: 'SET_MULTIPLE', updates: { 
      hasUnsavedChanges: false, 
      invalidRecordsFixed: false 
    }});
    
    // 只有在至少有一條記錄時才生成統計 - 避免不必要的計算
    if (data.length > 0 && storeMonthlySchedule && storeMonthlySchedule.length > 0) {
      generateStatistics();
    }
    
    const endTime = performance.now();
    logger.info(`數據處理耗時: ${(endTime - startTime).toFixed(2)}ms`);
  };

  // 初始化加載數據 - 優化依賴項
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // 優先獲取用戶資料，減少後續請求
        await fetchUsers();
      } catch (error) {
        logger.error('載入用戶資料失敗:', error);
      }
    };
    
    loadInitialData();
  }, []);
  
  // 優化月份變化時的數據加載邏輯
  useEffect(() => {
    const loadData = async () => {
      dispatchUI({ 
        type: 'SET_SCHEDULE_STATE', 
        loaded: false, 
        hasSchedule: false 
      });
      // 清除相關緩存
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const startDate = format(new Date(year, month, 1), 'yyyy-MM-dd');
      const endDate = format(new Date(year, month + 1, 0), 'yyyy-MM-dd');
      
      // 更新緩存鍵格式
      clearCache(`overtimeRecords_${startDate}_${endDate}`);
      clearCache(`monthlySchedule_${format(selectedDate, 'yyyy-MM')}`);
      
      await loadMonthlySchedule();
    };
    
    loadData();
  }, [selectedDate]); // 只在日期變化時重新加載

  // 優化：班表載入後加載加班記錄 - 減少不必要的依賴
  useEffect(() => {
    if (scheduleLoaded && hasSchedule) {
      const loadData = async () => {
        logger.info('班表載入完成，開始加載加班記錄');
        try {
          await loadOvertimeRecords();
        } catch (error) {
          logger.error('加載加班記錄失敗:', error);
        }
      };
      
      loadData();
    }
  }, [scheduleLoaded, hasSchedule]); // 只依賴這兩個狀態，避免多餘的加載

  // 優化：當標記變更時重新生成統計 - 減少不必要的依賴
  useEffect(() => {
    if (storeMonthlySchedule && storeMonthlySchedule.length > 0) {
      logger.info('更新統計數據（標記變更觸發）');
      generateStatistics();
    }
  }, [markings, selectedDate]); // 只依賴 markings 和 selectedDate，移除 storeMonthlySchedule
  
  // --- 新增：核心月度統計計算函數 ---
  const calculateNurseMonthlyStats = (nurse, currentMarkings, daysInMonth, selectedDate) => {
    const userStats = {
      id: nurse.id,
      name: nurse.name || nurse.full_name || nurse.id.toString(),
      position: nurse.position || '一般護理師',
      identity: nurse.identity,
      dailyScores: [],
      totalScore: 0,
      overtimeCount: 0, // 新增：用於 calculateAndSaveMonthlyScores
      whiteShiftDays: 0 // 新增：用於 calculateAndSaveMonthlyScores
    };
    const isLeader = nurse.identity === '麻醉科Leader';

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      
      // 檢查是否為週日，週日不參與加班計算
      const isCurrentDateSunday = isSunday(currentDate);
      
      let shift = '';
      if (nurse.shifts && Array.isArray(nurse.shifts) && day <= nurse.shifts.length) {
        shift = nurse.shifts[day - 1];
      }

      let dayScore = 0;
      const overtimeShift = currentMarkings[dateKey]?.[nurse.id];

      if (shift === 'A' && !isCurrentDateSunday) { // 週日的A班不計入統計
          userStats.whiteShiftDays++;
          if (!isLeader) {
              if (overtimeShift) {
                  dayScore = calculateOvertimeScore(overtimeShift);
                  userStats.overtimeCount++;
              } else {
                  dayScore = NO_OVERTIME_PENALTY;
              }
          } else if (overtimeShift) {
             userStats.overtimeCount++;
          }
      }

      userStats.dailyScores.push({
        date: dateKey,
        day,
        score: isLeader ? 0 : dayScore,
        shift,
        overtimeShift: overtimeShift || '',
        isSunday: isCurrentDateSunday // 添加週日標記，方便UI層使用
      });

      if (!isLeader) {
         userStats.totalScore += dayScore;
      }
    }

    if (!isLeader) {
      userStats.totalScore = parseFloat(userStats.totalScore.toFixed(2));
    }

    return userStats;
  };
  // --- 結束核心計算函數 ---

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
          logger.warn(`移除無效加班記錄: ${dateKey} 護理師ID: ${staffId} (該日未排白班)`);
        }
      });
      
      // 如果該日期沒有任何標記，則移除該日期
      if (Object.keys(newMarkings[dateKey]).length === 0) {
        delete newMarkings[dateKey];
      }
    });
    
    // 如果有無效記錄被移除，更新標記狀態並通知用戶
    if (hasInvalidRecords) {
      dispatchData({ type: 'SET_MARKINGS', markings: newMarkings });
      dispatchMessage({ type: 'SET_SUCCESS', message: '已自動移除排班表不一致的加班記錄' });
      dispatchDialog({ type: 'OPEN_DIALOG', dialogType: 'openSnackbar' });
      
      // 如果有權限編輯，建議用戶保存更新後的記錄
      if (canEdit) {
        setTimeout(() => {
          dispatchMessage({ type: 'SET_ERROR', error: '發現與班表不一致的加班記錄已被調整，請記得保存變更' });
          dispatchDialog({ type: 'OPEN_DIALOG', dialogType: 'openSnackbar' });
        }, 3000);
      }
    }
    
    // 標記已完成清理
    dispatchUI({ type: 'SET_LOADING', loadingType: 'invalidRecordsFixed', value: true });
  }, [markings, storeMonthlySchedule, hasSchedule, isLoadingOvertimeRecords, invalidRecordsFixed]);

  // 檢查加班分配方案是否平衡（僅月度分數）
  const checkIfAssignmentBalanced = (tempMarkings) => {
    // 篩選出麻醉專科護理師（排除麻醉科Leader，因為他們不參與分數計算）
    const anesthesiaStaff = filteredSchedule.filter(nurse => 
      nurse.identity === '麻醉專科護理師' && 
      nurse.role !== 'head_nurse' && 
      nurse.position !== 'CC'
    );
    
    if (!anesthesiaStaff || anesthesiaStaff.length === 0) {
      logger.warn('沒有找到符合條件的麻醉專科護理師');
      return false;
    }
    
    // --- 使用核心函數計算每個護理師在 tempMarkings 下的分數 ---
    const nursesScores = anesthesiaStaff.map(nurse => {
        const stats = calculateNurseMonthlyStats(nurse, tempMarkings, daysInMonth, selectedDate);
        return {
            id: nurse.id,
            name: nurse.name || nurse.full_name || nurse.id.toString(),
            totalScore: stats.totalScore // 只關心總分
        };
    });
    // --- 結束計算 ---

    // REMOVED: 舊的內部計算邏輯
    /*
    const nursesScores = anesthesiaStaff.map(nurse => {
      // ... 舊計算邏輯 ...
    });
    */

    // 所有檢查都通過
    return true;
  };

  // 生成統計數據 - 只考慮當月數據
  const generateStatistics = () => {
    const startTime = performance.now();
    dispatchUI({ type: 'SET_LOADING', loadingType: 'isLoadingStatistics', value: true });
    
    try {
      // 直接使用 storeMonthlySchedule 作為數據源
      if (!storeMonthlySchedule || !Array.isArray(storeMonthlySchedule) || storeMonthlySchedule.length === 0) {
        dispatchData({ type: 'SET_STATISTICS', data: [] });
        return;
      }

      // 篩選出麻醉專科護理師
      const anesthesiaStaff = storeMonthlySchedule.filter(nurse =>
        nurse && nurse.identity === '麻醉專科護理師' &&
        nurse.role !== 'head_nurse' &&
        nurse.position !== 'CC'
      );

      // 篩選出麻醉科Leader
      const leaderStaff = storeMonthlySchedule.filter(nurse =>
        nurse && nurse.identity === '麻醉科Leader' &&
        nurse.role !== 'head_nurse' &&
        nurse.position !== 'CC'
      );

      // 使用統一的計算函數
      const normalStatistics = anesthesiaStaff.map(nurse =>
        calculateNurseMonthlyStats(nurse, markings, daysInMonth, selectedDate)
      );
      const leaderStatistics = leaderStaff.map(nurse =>
        calculateNurseMonthlyStats(nurse, markings, daysInMonth, selectedDate)
      );

      const statistics = [...normalStatistics, ...leaderStatistics];
      statistics.sort((a, b) => b.totalScore - a.totalScore);

      dispatchData({ type: 'SET_STATISTICS', data: statistics });
      
      const endTime = performance.now();
      logger.info(`統計數據生成耗時: ${(endTime - startTime).toFixed(2)}ms`);
    } catch (error) {
      logger.error('生成統計數據失敗:', error);
      dispatchMessage({ type: 'SET_ERROR', error: '生成統計數據時發生錯誤: ' + error.message });
      dispatchDialog({ type: 'OPEN_DIALOG', dialogType: 'openSnackbar' });
    } finally {
      dispatchUI({ type: 'SET_LOADING', loadingType: 'isLoadingStatistics', value: false });
    }
  };

  // 當排班數據或加班記錄變化時，重新生成統計 - 進一步優化
  useEffect(() => {
    // 只有在以下情況才生成統計:
    // 1. 有排班數據
    // 2. 加班記錄已載入
    // 3. 不是在加載中狀態
    if (storeMonthlySchedule && 
        storeMonthlySchedule.length > 0 && 
        Object.keys(markings).length > 0 && 
        !isLoading && 
        !isLoadingOvertimeRecords) {
      
      // 當加班標記或日期變更時重新生成
      logger.info('更新統計數據（標記或日期變更觸發）');
      generateStatistics();
    }
  }, [markings, selectedDate, isLoading, isLoadingOvertimeRecords]);

  // 格式化錯誤信息為字符串
  const formatErrorMessage = (error) => {
    if (!error) return null;
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    return JSON.stringify(error);
  };

  // 檢查日期是否符合加班規則
  const checkDateCompliance = (dateKey, staffMarks, includeZeroScoreShiftsFlag = true) => {
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
      
      // 平日需要分配的班別（是否含E/F）
      const marksSet = new Set(Object.values(staffMarks));
      const requiredShifts = includeZeroScoreShiftsFlag 
        ? ['A', 'B', 'C', 'D', 'E', 'F'] 
        : ['A', 'B', 'C', 'D'];
      const hasAllMarks = requiredShifts.every(mark => marksSet.has(mark));
      const hasValidCount = includeZeroScoreShiftsFlag 
        ? marksSet.size === requiredShifts.length 
        : marksSet.size >= requiredShifts.length;
        
      return hasAllMarks && hasValidCount;
    } catch (error) {
      logger.error('檢查日期合規性失敗:', error);
      return false;
    }
  };

  // 🚀 新的自動分配函數 - 使用Hook
  const handleSmartAllocation = useCallback(() => {
    if (!canEdit) {
      showError('只有護理長和系統管理員可以生成加班記錄');
      return;
    }
    
    allocationHook.showAllocationDialog();
  }, [canEdit, allocationHook, showError]);

  // 🚀 處理完整分配
  const handleFullAllocation = useCallback(async () => {
    allocationHook.hideAllocationDialog();
    updateUI({ isGeneratingRandom: true });

    try {
      const result = await allocationHook.performFullAllocation(overtimeData, { 
        includeZeroScoreShifts 
      });
      
      if (result.success) {
        updateData('markings', result.markings);
        showSuccess(result.message);
      } else {
        showError(result.message);
      }
    } catch (error) {
      logger.error('分配過程出錯:', error);
      showError('分配過程中發生未知錯誤');
    } finally {
      updateUI({ isGeneratingRandom: false });
    }
  }, [allocationHook, overtimeData, includeZeroScoreShifts, updateUI, updateData, showSuccess, showError]);

  // 🚀 處理部分分配
  const handlePartialAllocation = useCallback(async () => {
    allocationHook.hideAllocationDialog();
    updateUI({ isGeneratingRandom: true });

    try {
      const result = await allocationHook.performPartialAllocation(overtimeData, markings, { 
        includeZeroScoreShifts 
      });
      
      if (result.success) {
        updateData('markings', result.markings);
        showSuccess(result.message);
      } else {
        showError(result.message);
      }
    } catch (error) {
      logger.error('分配過程出錯:', error);
      showError('分配過程中發生未知錯誤');
    } finally {
      updateUI({ isGeneratingRandom: false });
    }
  }, [allocationHook, overtimeData, markings, includeZeroScoreShifts, updateUI, updateData, showSuccess, showError]);

  // 重設加班表
  const resetOvertimeSchedule = () => {
    if (!canEdit) {
      showError('只有護理長和系統管理員可以重設加班記錄');
      return;
    }
    
    updateDialog('openResetConfirmDialog', true);
  };
  
  // 確認重設加班表
  const confirmResetOvertimeSchedule = async () => {
    updateDialog('openResetConfirmDialog', false);
    updateUI({ isResetting: true });
    
    try {
      // 清空前端的標記狀態
      updateData('resetMarkings');
      
      // 清空相關緩存
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const startDate = format(new Date(year, month, 1), 'yyyy-MM-dd');
      const endDate = format(new Date(year, month + 1, 0), 'yyyy-MM-dd');
      
      // 更新緩存鍵格式
      clearCache(`overtimeRecords_${startDate}_${endDate}`);
      
      showSuccess('加班表已在前端重設，請記得按保存加班記錄按鈕以更新資料庫');
    } catch (error) {
      console.error('重設加班表失敗:', error);
      
      // 提取更有用的錯誤信息
      let errorMsg = '重設加班表失敗';
      if (error.message) {
        errorMsg = error.message;
      }
      
      showError(errorMsg);
    } finally {
      updateUI({ isResetting: false });
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
    updateMessage('clear');
    
    // 如果是移除操作，直接處理
    if (isRemoval) {
      const newMarkings = { ...markings };
      
      // 確保該日期的對象存在
      if (!newMarkings[date]) {
        return;
      }
      
      // 移除該護理師的標記
      if (newMarkings[date][staffId]) {
        delete newMarkings[date][staffId];
        
        // 如果該日期下沒有標記了，刪除整個日期對象
        if (Object.keys(newMarkings[date]).length === 0) {
          delete newMarkings[date];
        }
      }
      
      updateData('markings', newMarkings);
      showSuccess(`已移除護理師ID${staffId}在${date}的加班標記`);
      
      return;
    }
    
    // 檢查此記錄是否有效（非移除操作時才檢查）
    if (!isValidRecord(staffId, date, mark)) {
      console.error('無效的加班記錄');
      showError(`無效的加班記錄：護理師ID${staffId}在${date}不能被指定為${mark}班加班。`);
      return;
    }
    
    // 更新標記
    const newMarkings = { ...markings };
    
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
          showError(`${date}已有人被分配為${mark}班加班。請先移除現有的標記，或選擇不同的加班類型。`);
        }, 0);
        
        return; // 不更新狀態
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
    
    updateData('markings', newMarkings);
    
    // 顯示成功消息
    showSuccess(`已將護理師ID${staffId}在${date}的加班標記設為${mark}`);
    
    // 重新計算統計數據
    generateStatistics();
  };

  // 計算並保存月度加班分數
  const calculateAndSaveMonthlyScores = async () => {
    if (!canEdit) return Promise.resolve(false);
    
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
        
        // --- 調用核心函數獲取統計數據 ---
        const stats = calculateNurseMonthlyStats(nurse, markings, daysInMonth, selectedDate);
        // --- 結束調用 ---

        const totalScore = Math.round(stats.totalScore * 100); // 從 stats 獲取總分並轉換為整數

        // 生成詳細信息JSON (從 stats 獲取)
        const details = JSON.stringify({
          whiteShiftDays: stats.whiteShiftDays,
          overtimeCount: stats.overtimeCount,
          rawScore: stats.totalScore // 可以保留原始分數作參考
        });

        monthlyScoresToUpdate.push({
          user_id: userId,
          year: currentYear,
          month: currentMonth + 1, // 1-12月
          total_score: totalScore,
          details
        });
      });
      
      // 批量保存月度分數
      if (monthlyScoresToUpdate.length > 0) {
        logger.info('保存月度加班分數', { 記錄數量: monthlyScoresToUpdate.length });
        await apiService.overtime.bulkCreateOrUpdateMonthlyScores(monthlyScoresToUpdate);
        logger.success('月度加班分數已保存');
      }
      
      return true;
    } catch (error) {
      logger.error('計算並保存月度加班分數失敗:', error);
      return false;
    }
  };

  // 在任何修改標記的地方添加設置未保存變更狀態
  useEffect(() => {
    // 跳過初始渲染
    if (Object.keys(originalMarkings).length === 0) return;
    
    // 檢查標記是否與原始標記不同
    const markingsJson = JSON.stringify(markings);
    const originalMarkingsJson = JSON.stringify(originalMarkings);
    
    updateUI({ hasUnsavedChanges: markingsJson !== originalMarkingsJson });
  }, [markings, originalMarkings]);

  // 渲染性能監控 - 組件掛載時記錄開始時間
  const mountTimeRef = useRef(performance.now());
  const renderTimeRef = useRef(null);
  
  // 在首次渲染後記錄完成時間
  useEffect(() => {
    renderTimeRef.current = performance.now();
    const renderTime = renderTimeRef.current - mountTimeRef.current;
    console.log(`[效能] OvertimeStaff 初始渲染耗時: ${renderTime.toFixed(2)}ms`);
    
    // 返回清理函數，組件卸載時執行
    return () => {
      const totalLifetime = performance.now() - mountTimeRef.current;
      console.log(`[效能] OvertimeStaff 組件總生命週期: ${totalLifetime.toFixed(2)}ms`);
    };
  }, []);

  // 使用 useMemo 計算每天的加班合規性，避免重複計算
  const complianceMap = useMemo(() => {
    const map = {};
    Object.keys(markings).forEach(dateKey => {
      map[dateKey] = checkDateCompliance(dateKey, markings[dateKey], includeZeroScoreShifts);
    });
    return map;
  }, [markings, includeZeroScoreShifts]);

  // 預先定義通用樣式
  const tableCellSx = useMemo(() => ({ padding: '10px 16px' }), []);
  const tableHeaderSx = useMemo(() => ({ 
    fontWeight: 'bold', 
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    ...tableCellSx
  }), [tableCellSx]);

  return (
    <Box sx={{ padding: 2 }}>
      <Typography variant="h4" gutterBottom sx={{ display: { xs: 'none', md: 'block' } }}>
        {formattedDate}加班人員管理
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
          
          {!canEdit && hasSchedule && (
            <Tooltip title="您可以查看加班記錄，但只有護理長和系統管理員可以修改" placement="top">
              <IconButton size="small" color="info">
                <InfoIcon />
              </IconButton>
            </Tooltip>
          )}
          
          {/* 顯示未加班人員按鈕 - 對所有使用者開放 */}
          {hasSchedule && (
            <Button 
              variant="outlined" 
              color="info"
              onClick={() => updateConfig('toggleUnmarkedStaff')}
              sx={{ ml: 1 }}
            >
              {showUnmarkedStaff ? '隱藏未加班人員' : '顯示未加班人員'}
            </Button>
          )}
        </Box>
        
        {canEdit && hasSchedule && (
          <>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <OvertimeAllocationButton 
                onClick={handleSmartAllocation}
                disabled={Object.keys(overtimeData).length === 0}
                isAllocating={allocationHook.isAllocating}
              />
              
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
            </Box>
            
          </>
        )}
      </Box>
      
      {canEdit && hasSchedule && (
        <Alert severity="info" sx={{ mb: 2 }}>
          點擊護理師姓名可標記排序 (A → B → C → D → E → F → 取消)，平日通常需要六位加班人員(A-F)，若自動分配選擇不安排E/F班，平日只分配A-D；週六需要一位A班，週日不需要加班人員。
          「自動分配」使用統一分數導向算法，所有班別都按分數最低優先原則分配，確保最大化零分接近度。
          預設只顯示已安排加班的人員，可使用「顯示未加班人員」按鈕切換顯示模式。
        </Alert>
      )}
      
      {!canEdit && hasSchedule && (
        <Alert severity="info" sx={{ mb: 2 }}>
          預設只顯示已安排加班的人員，可使用「顯示未加班人員」按鈕切換顯示模式。
        </Alert>
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
        <TableContainer component={Paper} sx={{ mt: 2, boxShadow: 'none' }}>
          <Table stickyHeader aria-label="加班人員列表">
            <TableHead>
              <TableRow>
                <TableCell 
                  sx={{
                    ...tableHeaderSx,
                    width: { xs: 'auto', md: '150px' },
                    minWidth: { xs: '80px', md: '150px' }
                  }}
                >
                  日期
                </TableCell>
                <TableCell 
                  sx={{
                    ...tableHeaderSx,
                    width: '80px',
                    display: { xs: 'none', md: 'table-cell' }
                  }}
                >
                  人數
                </TableCell>
                <TableCell sx={tableHeaderSx}>加班人員</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.values(overtimeData)
                .sort((a, b) => a.day - b.day) // 確保按日期排序
                .map((dayData) => (
                  <OvertimeRow
                    key={dayData.date}
                    dayData={dayData}
                    canEdit={canEdit}
                    markings={markings}
                    onMarkStaff={handleMarkStaff}
                    isCompliant={complianceMap[dayData.date]}
                    showUnmarkedStaff={showUnmarkedStaff}
                  />
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {/* 加班統計表格 - 使用優化的StatRow組件 */}
      {hasSchedule && (
        <>
          <Divider sx={{ my: 4 }} />
          
          {/* 統計標題區域 */}
          <Typography variant="h5" gutterBottom>
            {formattedDate}月加班統計
          </Typography>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            統計規則：A班加班 = 2.0分，B班加班 = 1.0分，C班加班 = 0.8分，D班加班 = 0.3分，E和F班加班 = 0分，白班未排加班 = -0.365分，夜班或休假 = 0分。
          </Alert>
          
          {/* 月度加班統計表 */}
          {!isLoading && !isLoadingStatistics && statisticsData.length > 0 && (
            <TableContainer component={Paper} sx={{ mt: 2, boxShadow: 'none' }}>
              <Table stickyHeader aria-label="加班統計表格">
                <TableHead>
                  <TableRow>
                    <TableCell sx={tableHeaderSx}>護理師</TableCell>
                    <TableCell sx={tableHeaderSx}>總分</TableCell>
                    {[...Array(daysInMonth)].map((_, index) => {
                      const day = index + 1;
                      const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
                      
                      // 跳過週日
                      if (isSunday(currentDate)) {
                        return null;
                      }
                      
                      const weekday = getDayName(getDay(currentDate));
                      return (
                        <TableCell key={day} align="center" sx={tableHeaderSx}>
                          {day}<br/>({weekday})
                        </TableCell>
                      );
                    }).filter(Boolean)} {/* 過濾掉null值 */}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {statisticsData.map((staff) => (
                    <StatRow
                      key={staff.id}
                      staff={staff}
                      daysInMonth={daysInMonth}
                      selectedDate={selectedDate}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          
          {!isLoading && !isLoadingStatistics && 
           (statisticsData.length === 0) && (
            <Alert severity="info" sx={{ mb: 2 }}>
              沒有可用的月度統計數據，請確保有相關的加班記錄
            </Alert>
          )}
        </>
      )}
      
      {/* 自動分配確認對話框 */}
      <AllocationConfirmDialog
        open={allocationHook.showConfirmDialog}
        onClose={allocationHook.hideAllocationDialog}
        onFullAllocation={handleFullAllocation}
        onPartialAllocation={handlePartialAllocation}
        includeZeroScoreShifts={includeZeroScoreShifts}
        onToggleIncludeZeroScoreShifts={setIncludeZeroScoreShifts}
      />
      
      {/* 自動分配進度對話框 */}
      <AllocationProgressDialog
        open={allocationHook.isAllocating}
        onCancel={allocationHook.cancelAllocation}
      />
      
      {/* 確認重設對話框 */}
      <Dialog
        open={openResetConfirmDialog}
        onClose={() => updateDialog('openResetConfirmDialog', false)}
      >
        <DialogTitle>確認重設加班表</DialogTitle>
        <DialogContent>
          <DialogContentText>
            這將清空{formattedDate}的所有加班記錄。此操作無法撤銷，確定要繼續嗎？
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => updateDialog('openResetConfirmDialog', false)} color="primary">
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
        onClose={() => updateDialog('openSnackbar', false)}
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
