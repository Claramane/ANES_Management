import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert,
  CircularProgress,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Drawer,
  IconButton
} from '@mui/material';
import {
  Event as EventIcon,
  Sync as SyncIcon,
  Announcement as AnnouncementIcon,
  ArrowForward as ArrowForwardIcon,
  Today as TodayIcon,
  Recommend as RecommendIcon,
  Work as WorkIcon,
  ViewWeek as ViewWeekIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import apiService from '../utils/api';
import { useScheduleStore } from '../store/scheduleStore';
import { format, startOfToday, getDate, getMonth, getYear, eachDayOfInterval, parseISO, startOfMonth, endOfMonth, getDay, isToday } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { cachedScheduleDetailsRequest } from '../utils/scheduleCache';

// 班次顏色和名稱的映射，可以根據需要擴展
const shiftDetails = {
  'D': { name: '白班', color: '#a08887', time: '22-08' },
  'A': { name: '小夜班', color: '#d9d06e', time: '8-16' },
  'N': { name: '大夜班', color: '#8387da', time: '14-22' },
  'K': { name: '早班', color: '#8AA6C1', time: '9-17' },
  'C': { name: '中班', color: '#67dcbd', time: '10-18' },
  'F': { name: '晚班', color: '#FFA07A', time: '12-20' },
  'E': { name: '半班', color: '#FFB6C1', time: '8-12' },
  'B': { name: '日班', color: '#FFDAB9', time: '8-17' },
  'O': { name: '休假', color: '#FFFFFF', time: 'OFF' },
  'V': { name: '休假', color: '#FFFFFF', time: 'OFF' },
  '': { name: '未排班', color: '#f0f0f0', time: '-' } // 空白或其他未定義情況
};

const getShiftInfo = (shiftType) => {
  return shiftDetails[shiftType] || shiftDetails['']; // 提供默認值
};

// 工作區域顏色定義
const areaColors = {
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

const getAreaStyle = (areaCode) => {
  // 檢查是否有對應的顏色定義
  const areaStyle = areaColors[areaCode];
  if (areaStyle) {
    return areaStyle.active; // 使用active樣式
  }
  // 找不到對應的顏色，返回默認樣式
  return { bg: '#f0f0f0', text: '#757575', border: '#bdbdbd' };
};

// 定義班別顏色（月曆用）
const SHIFT_COLORS = {
  'D': '#4caf50', // 白班
  'A': '#c6c05f', // A班
  'N': '#2196f3', // 大夜
  'K': '#8AA6C1', // K班
  'C': '#a9d0ab', // C班
  'F': '#d8bd89', // F班
  'E': '#ff9800', // 小夜
  'B': '#e7b284', // B班
  'O': '#9e9e9e'  // 休假
};

// 狀態顏色配置
const STATUS_COLORS = {
  'pending': { backgroundColor: '#ffecb3', color: '#bf360c' },
  'accepted': { backgroundColor: '#c8e6c9', color: '#1b5e20' },
  'rejected': { backgroundColor: '#ffcdd2', color: '#b71c1c' },
  'cancelled': { backgroundColor: '#eeeeee', color: '#9e9e9e' },
  'expired': { backgroundColor: '#f3e5f5', color: '#9c27b0' }
};

const categoryColors = {
  '長官佈達': { backgroundColor: '#ef5350', color: 'white' }, 
  '政令宣導': { backgroundColor: '#42a5f5', color: 'white' }, 
  '系統公告': { backgroundColor: '#ff9800', color: 'black' }, 
  '交班':     { backgroundColor: '#66bb6a', color: 'white' }, 
  '閒聊':     { backgroundColor: '#ab47bc', color: 'white' }, 
  'default':  { backgroundColor: '#bdbdbd', color: 'black' }  
};

const getCategoryStyle = (category) => {
  return categoryColors[category] || categoryColors.default;
};

// 添加日曆單元格的CSS
const calendarCellStyle = {
  position: 'relative',
  height: '100%',
  minHeight: '70px',
  padding: '4px',
  border: '1px solid #e0e0e0',
  overflow: 'hidden',
  cursor: 'default',
  '&:hover': {
    backgroundColor: '#f5f5f5',
  },
  '&.selected': {
    backgroundColor: '#e3f2fd',
    border: '2px solid #2196f3',
  },
  '&.today': {
    backgroundColor: '#e8f5e9',
  }
};

// 渲染日曆單元格內容的組件 - 已優化版本
const RenderCalendarCell = ({ day }) => {
  if (!day.date) return null;
  
  const commonTagStyle = {
    fontSize: '10px',
    padding: '2px 4px',
    borderRadius: '0 4px 4px 4px',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    marginTop: '2px'
  };
  
  return (
    <div className="cell-content" style={{ 
      display: 'flex', 
      flexDirection: 'column',
      height: '100%',
      width: '100%'
    }}>
      {/* 日期顯示在最上方 */}
      <Box sx={{ 
        textAlign: 'right',
        padding: '2px 4px',
        fontWeight: 'bold',
        fontSize: '12px',
        width: '100%'
      }}>
        {format(day.date, 'd')}
      </Box>
      
      {/* 班別顯示在第二行 */}
      {day.shift && (
        <Box sx={{ 
          backgroundColor: SHIFT_COLORS[day.shift] || '#9e9e9e',
          color: day.shift === 'O' ? 'black' : 'white',
          fontWeight: 'bold',
          fontSize: '11px',
          padding: '2px 4px',
          borderRadius: '4px',
          width: '100%',
          textAlign: 'left',
          marginTop: '2px'
        }}>
          {day.shift}
        </Box>
      )}
      
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '2px',
        overflow: 'hidden',
        flex: 1,
        width: '100%',
        mt: 0.5
      }}>
        {/* 工作區域 */}
        {day.mission && (
          <Box sx={{ 
            ...commonTagStyle,
            backgroundColor: '#4dabf5',
            color: 'white',
          }}>
            <ViewWeekIcon sx={{ fontSize: '10px', mr: 0.3 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{day.mission}</span>
          </Box>
        )}
        
        {/* 加班信息 - 已優化，移除"加班"文字和班別外框 */}
        {day.overtime && (
          <Box sx={{ 
            ...commonTagStyle,
            backgroundColor: '#ff8a65',
            color: 'white',
          }}>
            <WorkIcon sx={{ fontSize: '10px', mr: 0.3 }} />
            {day.overtimeShift && (
              <span style={{
                color: 'white',
                fontSize: '9px',
                fontWeight: 'bold',
              }}>
                {day.overtimeShift}
              </span>
            )}
          </Box>
        )}
      </Box>
    </div>
  );
};

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { 
    monthlySchedule, 
    isLoading: scheduleLoading, 
    fetchMonthlySchedule,
    selectedDate, // 獲取存儲中的選定日期
    updateSelectedDate // 獲取更新日期的函數
  } = useScheduleStore();

  const [todayWork, setTodayWork] = useState({ shift: null, areaCode: null, details: null });
  const [monthlyCalendarData, setMonthlyCalendarData] = useState([]); // 新增月曆數據狀態
  const [isLoading, setIsLoading] = useState(true); // 維持 isLoading，但在 processScheduleData 中設置
  const [error, setError] = useState(null); // 添加error state

  // 新增公告和換班相關的狀態
  const [announcements, setAnnouncements] = useState([]);
  const [myShiftSwapRequests, setMyShiftSwapRequests] = useState([]);
  const [recommendedSwaps, setRecommendedSwaps] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [swapsLoading, setSwapsLoading] = useState(true);
  const [announcementsError, setAnnouncementsError] = useState(null);
  const [swapsError, setSwapsError] = useState(null);

  // 新增防重複請求的狀態
  const [isAreaAssignmentLoading, setIsAreaAssignmentLoading] = useState(false);

  // 新增加班數據狀態
  const [overtimeData, setOvertimeData] = useState(null);

  // 新增公告詳情狀態
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [isAnnouncementDetailOpen, setIsAnnouncementDetailOpen] = useState(false);

  const [showPasskeyDialog, setShowPasskeyDialog] = useState(false);

  const today = useMemo(() => startOfToday(), []);
  const todayDate = useMemo(() => getDate(today), [today]); // 日 (1-31)
  const currentMonth = useMemo(() => getMonth(today), [today]); // 月 (0-11)
  const currentYear = useMemo(() => getYear(today), [today]); // 年

  // Effect 1: 檢查並可能更新 selectedDate (只在需要時運行)
  useEffect(() => {
    // 確保只在 user 加載後執行
    if (!user) return;

    const needsUpdate = getMonth(selectedDate) !== currentMonth || getYear(selectedDate) !== currentYear;
    
    if (needsUpdate) {
      console.log('Dashboard Effect 1: selectedDate 需要更新');
      updateSelectedDate(today); // 只更新日期，不 fetch
    }
  // 依賴項應只包含觸發檢查/更新的條件
  }, [user, selectedDate, currentMonth, currentYear, updateSelectedDate, today]); 

  // Effect 2: 獲取數據 (當 selectedDate 準備好時運行)
  useEffect(() => {
    // 確保 user 加載且 selectedDate 是當前月份
    if (!user || getMonth(selectedDate) !== currentMonth || getYear(selectedDate) !== currentYear) {
       // 如果日期還沒對，或者 user 不存在，則不 fetch
       // 可以在這裡設置 isLoading 為 true 如果需要的話
       setIsLoading(true); // 當日期不對時，也視為加載中
       return;
    }

    console.log('Dashboard Effect 2: selectedDate 正確，觸發 fetchMonthlySchedule');
    // 觸發 fetch 前確保 isLoading 為 true
    // fetchMonthlySchedule 內部應該會處理自己的 loading 狀態 (scheduleLoading)
    // 但我們仍然可以先設置 setIsLoading(true) 以覆蓋可能的舊狀態
    setIsLoading(true); 
    fetchMonthlySchedule(); // 根據正確的日期獲取數據

  // 依賴項只包含觸發 fetch 的條件
  // 注意：移除了 fetchMonthlySchedule，假設 store 處理其引用穩定性
  // 如果 fetchMonthlySchedule 本身會變，可能需要加回來，但要注意無限循環
  }, [user, selectedDate, currentMonth, currentYear, fetchMonthlySchedule]); // 重新加入 fetchMonthlySchedule，假設 zustand 保證其穩定

  // Effect 3: 處理加載的數據 (當 schedule 數據變化時運行)
  useEffect(() => {
    // 這個 effect 用於處理 fetch 回來的數據
    if (!scheduleLoading) {
       // 只有當 scheduleLoading 結束時才處理數據並設置 isLoading 為 false
       processScheduleData(); 
    } else {
      // 如果 scheduleLoading 開始了，確保本地 isLoading 也是 true
      setIsLoading(true);
    }
  }, [monthlySchedule, scheduleLoading, user, todayDate]); // 依賴 scheduleLoading 很重要

  // Effect 3.5: 當加班數據更新時重新生成月曆數據
  useEffect(() => {
    // 只有當班表數據和用戶都存在，且不在加載狀態時才重新生成月曆
    if (!scheduleLoading && monthlySchedule && monthlySchedule.length > 0 && user && overtimeData) {
      console.log('加班數據更新，重新生成月曆數據');
      const calendarData = generateCalendarData(selectedDate, monthlySchedule, null, overtimeData);
      setMonthlyCalendarData(calendarData);
    }
  }, [overtimeData, monthlySchedule, user, selectedDate, scheduleLoading]);

  // 生成月曆數據的函數
  const generateCalendarData = (date, scheduleData, assignmentData, overtimeData) => {
    try {
      console.log("===== 開始生成Dashboard月曆數據 =====");
      
      const startDate = startOfMonth(date);
      const endDate = endOfMonth(date);
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      
      // 初始化日曆數據結構
      const calendar = [];
      let week = [];
      
      // 填充月份開始前的空白單元格
      const firstDay = getDay(startDate);
      for (let i = 0; i < firstDay; i++) {
        week.push({ date: null });
      }
      
      // 安全獲取用戶ID
      const userId = user?.id || '';
      if (!userId) {
        console.warn("用戶ID為空，無法獲取班表數據");
      }
      
      console.log("用戶ID:", userId);
      
      let userShifts = [];
      let userAreaCodes = [];
      
      // 從monthlySchedule獲取用戶班表數據
      if (scheduleData && scheduleData.length > 0) {
        const userSchedule = scheduleData.find(nurse => nurse.id === userId);
        
        if (userSchedule) {
          console.log(`找到用戶 ${userId} (${userSchedule.full_name}) 的班表數據`);
          userShifts = userSchedule.shifts || [];
          userAreaCodes = userSchedule.area_codes || [];
          console.log(`用戶班表天數: ${userShifts.length}`);
        } else {
          console.warn(`在 ${scheduleData.length} 名護理師中未找到ID=${userId}的用戶班表`);
        }
      }
      
      // 如果沒有找到用戶班表，記錄警告但繼續使用空班表
      if (!userShifts || userShifts.length === 0) {
        console.warn("未找到用戶班表數據，將使用空班表");
        userShifts = Array(31).fill('O'); // 默認全部休假
        userAreaCodes = Array(31).fill(null);
      }
      
      // 處理月份中的每一天
      days.forEach((day, index) => {
        const dateString = format(day, 'yyyy-MM-dd');
        
        // 初始化為休假，如果找不到數據
        let shift = 'O';
        let mission = '';
        let overtime = '';
        let overtimeShift = '';
        
        try {
          // 從班表數據中獲取當天的班別
          if (userShifts && userShifts.length > 0) {
            // 日期索引，從0開始
            const dayOfMonth = parseInt(format(day, 'd')) - 1;
            
            if (dayOfMonth >= 0 && dayOfMonth < userShifts.length) {
              shift = userShifts[dayOfMonth] || 'O';
              console.log(`${dateString}: 班別=${shift}`);
            }
          }
          
          // 獲取工作分配
          if (userAreaCodes && userAreaCodes.length > 0) {
            const dayOfMonth = parseInt(format(day, 'd')) - 1;
            if (dayOfMonth >= 0 && dayOfMonth < userAreaCodes.length) {
              mission = userAreaCodes[dayOfMonth] || '';
            }
          }
          
          // 獲取加班記錄
          if (overtimeData && overtimeData.records) {
            const dayOvertime = overtimeData.records.find(record => 
              record.date === dateString
            );
            
            if (dayOvertime) {
              overtimeShift = dayOvertime.overtime_shift || '';
              overtime = `加班${overtimeShift ? `(${overtimeShift})` : ''}`;
              console.log(`找到 ${dateString} 的加班記錄: ${overtimeShift}`);
            }
          }
        } catch (err) {
          console.warn(`處理 ${dateString} 的班表數據時出錯:`, err.message);
        }
        
        // 添加日期項到當前週
        week.push({ 
          date: day, 
          shift, 
          mission, 
          overtime,
          overtimeShift
        });
        
        // 如果是一週的最後一天或是月份的最後一天
        if (getDay(day) === 6 || format(day, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')) {
          calendar.push([...week]);
          week = [];
        }
      });
      
      console.log(`生成了 ${calendar.length} 週的月曆數據`);
      return calendar;
    } catch (err) {
      console.error('生成月曆數據時出錯:', err);
      return [];
    }
  };

  // 處理排班數據的函數
  const processScheduleData = () => {
    if (!user || !monthlySchedule || monthlySchedule.length === 0) {
      // 如果用戶信息或班表數據不存在，則不進行處理
      // 可能需要根據 scheduleLoading 狀態決定是否顯示加載中
      if (!scheduleLoading) {
        setIsLoading(false);
        // 可以選擇設置一個 '無數據' 的狀態
        setTodayWork({ shift: '', areaCode: null, details: getShiftInfo('') });
        // 無班表數據時設置空的月曆數據
        setMonthlyCalendarData([]);
      }
      return;
    }

    const userSchedule = monthlySchedule.find(nurse => nurse.id === user.id);

    if (userSchedule && userSchedule.shifts && userSchedule.area_codes) {
      const shiftIndex = todayDate - 1; // 陣列索引從0開始
      const shiftType = userSchedule.shifts[shiftIndex];
      const areaCode = userSchedule.area_codes[shiftIndex];
      
      setTodayWork({ 
        shift: shiftType, 
        areaCode: areaCode,
        details: getShiftInfo(shiftType) 
      });
    } else {
      // 如果找不到用戶或數據不完整
      setTodayWork({ shift: '', areaCode: null, details: getShiftInfo('') });
    }
    setIsLoading(false);

    // 立即生成月曆數據，不等待加班數據
    // 如果加班數據還沒準備好，月曆會在加班數據更新時重新生成
    const calendarData = generateCalendarData(selectedDate, monthlySchedule, null, overtimeData);
    setMonthlyCalendarData(calendarData);
  };

  // 獲取最新公告的函數
  const fetchLatestAnnouncements = async () => {
    try {
      setAnnouncementsLoading(true);
      const response = await apiService.announcement.getAll();
      // 對公告按時間降序排序，只取最新的3則
      const sortedData = response.data
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 3);
      setAnnouncements(sortedData);
    } catch (err) {
      console.error("獲取公告失敗:", err);
      setAnnouncementsError(err.response?.data?.message || err.message || '無法加載公告');
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  // 獲取換班請求的函數
  const fetchShiftSwapRequests = async () => {
    if (!user) return;
    
    try {
      setSwapsLoading(true);
      
      const response = await apiService.shiftSwap.getRequests();
      
      if (response.data) {
        // 處理換班請求數據
        const allRequests = response.data || [];
        
        // 篩選出符合當前用戶資格的換班請求（推薦）
        const recommended = allRequests.filter(swap => 
          // 不是自己發起的 且 符合自己資格的請求
          swap.requestor_id !== user.id && 
          isSwapMatchingUserCriteria(swap, user) &&
          swap.status === 'pending'
        );
        
        // 篩選出自己發起的換班請求
        const myRequests = allRequests.filter(swap => 
          swap.requestor_id === user.id
        );
        
        setRecommendedSwaps(recommended);
        setMyShiftSwapRequests(myRequests);
      }
    } catch (err) {
      console.error("獲取換班請求失敗:", err);
      setSwapsError(err.response?.data?.message || err.message || '無法加載換班請求');
    } finally {
      setSwapsLoading(false);
    }
  };

  // 獲取加班數據的函數
  const fetchOvertimeData = async () => {
    if (!user) return;
    
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;
      
      // 計算月份的開始和結束日期
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      
      console.log(`開始獲取加班數據: ${startDate} 到 ${endDate}`);
      
      const response = await apiService.overtime.getMyRecords(startDate, endDate);
      
      console.log('加班API回應:', response);
      
      if (response.data) {
        // 將API回應的數據包裝成generateCalendarData期望的格式
        const formattedOvertimeData = {
          records: Array.isArray(response.data) ? response.data : []
        };
        
        setOvertimeData(formattedOvertimeData);
        console.log('成功設置加班數據:', formattedOvertimeData);
        console.log('加班記錄數量:', formattedOvertimeData.records.length);
      } else {
        console.log('API回應中沒有data欄位');
        setOvertimeData({ records: [] });
      }
    } catch (err) {
      console.error("獲取加班數據失敗:", err);
      console.error("錯誤詳情:", err.response?.data || err.message);
      // 設置空的加班數據
      setOvertimeData({ records: [] });
    }
  };

  // 判斷換班請求是否符合用戶條件的輔助函數
  const isSwapMatchingUserCriteria = (swap, user) => {
    // 檢查是否過期
    if (swap.from_date) {
      const requestDate = new Date(swap.from_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (requestDate < today) {
        return false; // 過期的請求不推薦
      }
    }
    
    // 檢查是否指定了特定的護理師，如果有，必須是當前用戶
    if (swap.target_nurse_id && swap.target_nurse_id !== user.id) {
      return false;
    }
    
    // 檢查用戶身份是否符合要求
    // 如果申請人是麻醉護理師，則只推薦給麻醉護理師
    // 如果申請人是恢復室護理師，則只推薦給恢復室護理師
    const userIdentity = user.identity || '';
    const requestorIdentity = swap.requestor?.identity || '';
    
    if ((userIdentity.includes('麻醉') && !requestorIdentity.includes('麻醉')) ||
        (userIdentity.includes('恢復') && !requestorIdentity.includes('恢復'))) {
      return false;
    }
    
    return true;
  };

  // 在使用者登入後獲取公告和換班請求
  useEffect(() => {
    if (user) {
      fetchLatestAnnouncements();
      fetchShiftSwapRequests();
      fetchOvertimeData();
    }
  }, [user, selectedDate]); // 加入selectedDate依賴，確保月份變更時重新獲取加班數據

  // Effect 4: 獲取工作分配數據（首次載入強制刷新，後續使用快取）
  useEffect(() => {
    // 只有當月班表加載完成且不在加載狀態時獲取，並且沒有正在進行的請求
    if (!scheduleLoading && monthlySchedule && monthlySchedule.length > 0 && !isAreaAssignmentLoading) {
      // 首次載入或月份變更時強制刷新，確保獲取最新的工作分配資料
      const isFirstLoad = !monthlyCalendarData || monthlyCalendarData.length === 0;
      fetchWorkAreaAssignments(isFirstLoad);
    }
  }, [monthlySchedule, scheduleLoading, user, selectedDate, isAreaAssignmentLoading]);

  // 獲取工作分配數據（優化版本，使用緩存）
  const fetchWorkAreaAssignments = async (forceRefresh = false) => {
    if (!user || isAreaAssignmentLoading) return;
    
    try {
      setIsAreaAssignmentLoading(true);
      
      // 獲取當前年月
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1; // 0-indexed，需 +1
      
      console.log(`正在獲取 ${year}年${month}月 的工作分配數據... ${forceRefresh ? '(強制刷新)' : ''}`);
      
      // 使用帶緩存的API請求，但允許強制刷新
      const result = await cachedScheduleDetailsRequest(apiService, 'dashboard', year, month, forceRefresh);
      
      if (result.fromCache) {
        console.log('使用緩存數據');
      } else {
        console.log('從API獲取最新數據');
      }
      
      if (result.data && result.data.success) {
        const details = result.data.data || [];
        console.log(`成功獲取工作分配數據，共 ${details.length} 條記錄`);
        
        // 建立日期到工作分配的映射
        const areaAssignments = {};
        
        // 篩選當前用戶的排班記錄並建立映射
        details.forEach(item => {
          if (String(item.user_id) === String(user.id)) {
            const dateObj = new Date(item.date);
            const day = dateObj.getDate();
            
            // 保存工作分配信息
            areaAssignments[day] = item.area_code;
          }
        });
        
        console.log(`找到用戶 ${user.id} 的 ${Object.keys(areaAssignments).length} 個工作分配`);
        
        // 更新monthlySchedule中的area_codes
        const updatedSchedule = monthlySchedule.map(nurse => {
          if (String(nurse.id) === String(user.id)) {
            // 創建更新後的area_codes數組
            const updatedAreaCodes = [...(nurse.area_codes || Array(31).fill(null))];
            
            // 更新area_codes
            Object.entries(areaAssignments).forEach(([day, areaCode]) => {
              const index = parseInt(day) - 1; // 轉為0-based索引
              if (index >= 0 && index < updatedAreaCodes.length) {
                updatedAreaCodes[index] = areaCode;
              }
            });
            
            // 返回更新後的護理師數據
            return {
              ...nurse,
              area_codes: updatedAreaCodes
            };
          }
          return nurse;
        });
        
        // 使用更新後的數據處理班表
        processScheduleDataWithAreaCodes(updatedSchedule);
      } else {
        console.warn('獲取工作分配數據失敗:', result.data?.message || '未知錯誤');
      }
    } catch (err) {
      console.error('獲取工作分配數據時出錯:', err);
    } finally {
      setIsAreaAssignmentLoading(false);
    }
  };

  // 使用更新後的數據處理班表
  const processScheduleDataWithAreaCodes = (updatedSchedule) => {
    if (!user || !updatedSchedule || updatedSchedule.length === 0) {
      return;
    }
    
    const userSchedule = updatedSchedule.find(nurse => nurse.id === user.id);
    
    if (userSchedule && userSchedule.shifts && userSchedule.area_codes) {
      const shiftIndex = todayDate - 1; // 陣列索引從0開始
      const shiftType = userSchedule.shifts[shiftIndex];
      const areaCode = userSchedule.area_codes[shiftIndex];
      
      setTodayWork({ 
        shift: shiftType, 
        areaCode: areaCode,
        details: getShiftInfo(shiftType) 
      });
      
      // 生成月曆數據
      const calendarData = generateCalendarData(selectedDate, updatedSchedule, null, overtimeData);
      setMonthlyCalendarData(calendarData);
    }
  };

  // 檢查是否需要顯示 Passkey 提示框
  useEffect(() => {
    if (user) {
      const loginMethod = localStorage.getItem('loginMethod');
      if (loginMethod === 'password') {
        setShowPasskeyDialog(true);
      }
    }
  }, [user]);

  // 處理 Passkey 提示框的關閉
  const handlePasskeyDialogClose = (createNow = false) => {
    setShowPasskeyDialog(false);
    localStorage.removeItem('loginMethod');
    if (createNow) {
      navigate('/settings');
    }
  };

  const formattedToday = format(today, 'yyyy年MM月dd日 EEEE', { locale: zhTW });

  // 處理公告詳情相關函數
  const handleOpenAnnouncementDetail = (announcement) => {
    setSelectedAnnouncement(announcement);
    setIsAnnouncementDetailOpen(true);
  };

  const handleCloseAnnouncementDetail = () => {
    setIsAnnouncementDetailOpen(false);
    setSelectedAnnouncement(null);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 0.25, sm: 2, md: 3 } }}>
      <Typography variant="h4" gutterBottom>
        哈囉！{user?.full_name || user?.username}
      </Typography>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        今天是{formattedToday}
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {/* 右側容器 - 小螢幕時先顯示 */}
        <Grid item xs={12} md={6} sx={{ order: { xs: 1, md: 2 } }}>
          <Grid container spacing={3} sx={{ height: '100%' }}>
            {/* 今日班表卡片 - 右上 */}
            <Grid item xs={12} sx={{ height: 'auto' }}>
              <Card sx={{ height: 'fit-content', boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TodayIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">今日班表</Typography>
                  </Box>
                  
                  {todayWork.details ? (
                    <Box sx={{ mt: 2 }}>
                      <Chip 
                        label={todayWork.shift && !['O', 'V', ''].includes(todayWork.shift) ? `${todayWork.shift}班` : todayWork.details?.name || '未排班'} 
                        color="primary" 
                        className={`shift-${todayWork.shift}`} 
                        sx={{ fontWeight: 'bold', mb: 1 }}
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body1" sx={{ mr: 1 }}>
                          <strong>工作分配:</strong>
                        </Typography>
                        {todayWork.areaCode ? (
                          <Chip 
                            label={todayWork.areaCode}
                            size="small"
                            sx={{
                              height: '24px',
                              fontSize: '0.875rem',
                              backgroundColor: getAreaStyle(todayWork.areaCode).bg,
                              color: getAreaStyle(todayWork.areaCode).text,
                              border: `1px solid ${getAreaStyle(todayWork.areaCode).border}`,
                              '& .MuiChip-label': { px: 1 }
                            }}
                          />
                        ) : (
                          <Typography variant="body1" color="text.secondary">
                            未分配區域
                          </Typography>
                        )}
                      </Box>
                      <Typography variant="body1">
                        <strong>時間:</strong> {todayWork.details?.time || '-'}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="body1" color="text.secondary">
                      今日無班表安排
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            
            {/* 本月班表卡片 - 右下，填滿剩餘空間 */}
            <Grid item xs={12} sx={{ flex: 1, display: 'flex' }}>
              <Card sx={{ width: '100%', display: 'flex', flexDirection: 'column', boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <EventIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">本月班表</Typography>
                  </Box>
                  
                  {monthlyCalendarData.length > 0 ? (
                    <Box sx={{ width: '100%', overflowX: 'auto', flex: 1 }}>
                      {/* 日曆表格 */}
                      <Box component="table" sx={{ 
                        width: '100%', 
                        height: '100%',
                        borderCollapse: 'collapse',
                        border: '1px solid #e0e0e0'
                      }}>
                        {/* 表頭 */}
                        <Box component="thead">
                          <Box component="tr">
                            {['一', '二', '三', '四', '五', '六', '日'].map(day => (
                              <Box 
                                component="th" 
                                key={day}
                                sx={{
                                  padding: '8px',
                                  textAlign: 'center',
                                  backgroundColor: '#f5f5f5',
                                  border: '1px solid #e0e0e0',
                                  fontSize: '14px',
                                  fontWeight: 'bold',
                                  width: '14.28%'
                                }}
                              >
                                {day}
                              </Box>
                            ))}
                          </Box>
                        </Box>
                        
                        {/* 表格主體 */}
                        <Box component="tbody">
                          {monthlyCalendarData.map((week, weekIndex) => (
                            <Box component="tr" key={weekIndex}>
                              {week.map((dayData, dayIndex) => (
                                <Box 
                                  component="td" 
                                  key={dayIndex}
                                  sx={{
                                    ...calendarCellStyle,
                                    height: '90px',
                                    ...(dayData.date && isToday(dayData.date) && { 
                                      backgroundColor: '#e8f5e9',
                                      border: '2px solid #4caf50'
                                    }),
                                    ...((!dayData.date) && { 
                                      backgroundColor: '#f9f9f9',
                                      opacity: 0.5
                                    })
                                  }}
                                >
                                  {dayData.date && <RenderCalendarCell day={dayData} />}
                                </Box>
                              ))}
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    </Box>
                  ) : (
                    <Typography variant="body1" color="text.secondary">
                      無法載入本月班表
                    </Typography>
                  )}
                </CardContent>
                <CardActions>
                  <Button 
                    size="small" 
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => navigate('/weekly-schedule')}
                  >
                    查看詳細班表
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* 左側容器 - 小螢幕時後顯示 */}
        <Grid item xs={12} md={6} sx={{ order: { xs: 2, md: 1 } }}>
          <Grid container spacing={3} sx={{ height: '100%' }}>
            {/* 最新公告卡片 - 左上 */}
            <Grid item xs={12} sx={{ height: 'auto' }}>
              <Card sx={{ height: 'fit-content', boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AnnouncementIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">最新公告</Typography>
                  </Box>
                  
                  {announcementsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : announcementsError ? (
                    <Alert severity="error" sx={{ mb: 1 }}>
                      {announcementsError}
                    </Alert>
                  ) : announcements.length > 0 ? (
                    <List sx={{ p: 0 }}>
                      {announcements.map((ann, index) => (
                        <React.Fragment key={ann.id}>
                          <ListItem 
                            button 
                            onClick={() => handleOpenAnnouncementDetail(ann)}
                            sx={{ px: 0, py: 1 }}
                          >
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                                  <Typography variant="body2" component="span" sx={{ fontWeight: 'bold', mr: 1, maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {ann.title}
                                  </Typography>
                                  <Chip 
                                    label={ann.category} 
                                    size="small" 
                                    sx={{ 
                                      ...getCategoryStyle(ann.category),
                                      height: '20px',
                                      '& .MuiChip-label': { px: 0.5, fontSize: '0.7rem' }
                                    }} 
                                  />
                                </Box>
                              }
                              secondary={format(parseISO(ann.created_at), 'MM/dd', { locale: zhTW })}
                              secondaryTypographyProps={{ variant: 'caption' }}
                            />
                          </ListItem>
                          {index < announcements.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      沒有最新公告
                    </Typography>
                  )}
                </CardContent>
                <CardActions>
                  <Button 
                    size="small" 
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => navigate('/announcements')}
                  >
                    查看所有公告
                  </Button>
                </CardActions>
              </Card>
            </Grid>

            {/* 換班請求卡片 - 左下，填滿剩餘空間 */}
            <Grid item xs={12} sx={{ flex: 1, display: 'flex' }}>
              <Card sx={{ width: '100%', display: 'flex', flexDirection: 'column', boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SyncIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">
                      待處理換班請求
                      {recommendedSwaps.length > 0 && (
                        <Badge badgeContent={recommendedSwaps.length} color="error" sx={{ ml: 1 }}>
                          <RecommendIcon color="action" fontSize="small" />
                        </Badge>
                      )}
                    </Typography>
                  </Box>
                  
                  {swapsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : swapsError ? (
                    <Alert severity="error" sx={{ mb: 1 }}>
                      {swapsError}
                    </Alert>
                  ) : (recommendedSwaps.length > 0 || myShiftSwapRequests.length > 0) ? (
                    <List sx={{ p: 0 }}>
                      {/* 顯示推薦的換班請求 */}
                      {recommendedSwaps.slice(0, 2).map((swap, index) => (
                        <React.Fragment key={`rec-${swap.id}`}>
                          <ListItem 
                            button 
                            onClick={() => navigate('/shift-swap')}
                            sx={{ px: 0, py: 1 }}
                          >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              <RecommendIcon color="error" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Typography variant="body2" component="span" sx={{ fontWeight: 'bold' }}>
                                  {swap.requestor?.full_name || '某人'} 請求換班 ({swap.from_date ? format(new Date(swap.from_date), 'MM/dd', { locale: zhTW }) : 'N/A'})
                                </Typography>
                              }
                              secondary={
                                <Box component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                  {swap.swap_type === 'overtime' ? (
                                    // 加班換班顯示
                                    <>
                                      {swap.from_overtime && (
                                        <Chip 
                                          label={swap.from_overtime + '加'}
                                          size="small" 
                                          sx={{ 
                                            backgroundColor: '#FF8A65',
                                            color: 'white',
                                            height: '20px',
                                            minWidth: '28px',
                                            borderRadius: '4px',
                                            '& .MuiChip-label': {
                                              padding: '0 4px',
                                              fontSize: '11px',
                                              fontWeight: 'bold'
                                            }
                                          }}
                                        />
                                      )}
                                      {swap.to_overtime && (
                                        <>
                                          <ArrowForwardIcon sx={{ fontSize: 16, color: '#666' }} />
                                          <Chip 
                                            label={swap.to_overtime === '未指定' ? '不加班' : swap.to_overtime}
                                            size="small" 
                                            sx={{ 
                                              backgroundColor: swap.to_overtime === '未指定' ? '#E0E0E0' : '#FFB74D',
                                              color: '#333',
                                              height: '20px',
                                              minWidth: '28px',
                                              borderRadius: '4px',
                                              '& .MuiChip-label': {
                                                padding: '0 4px',
                                                fontSize: '11px',
                                                fontWeight: 'bold'
                                              }
                                            }}
                                          />
                                        </>
                                      )}
                                    </>
                                  ) : swap.swap_type === 'mission' ? (
                                    // 工作區域交換顯示
                                    <>
                                      <Chip 
                                        label={swap.from_mission || '未指定'} 
                                        size="small" 
                                        sx={{ 
                                          backgroundColor: '#4dabf5',
                                          color: 'white',
                                          height: '20px',
                                          minWidth: '28px',
                                          borderRadius: '4px',
                                          '& .MuiChip-label': {
                                            padding: '0 4px',
                                            fontSize: '11px',
                                            fontWeight: 'bold'
                                          }
                                        }}
                                      />
                                      <ArrowForwardIcon sx={{ fontSize: 16, color: '#666' }} />
                                      <Chip 
                                        label={swap.to_mission || '未指定'} 
                                        size="small" 
                                        sx={{ 
                                          backgroundColor: '#81c784',
                                          color: 'white',
                                          height: '20px',
                                          minWidth: '28px',
                                          borderRadius: '4px',
                                          '& .MuiChip-label': {
                                            padding: '0 4px',
                                            fontSize: '11px',
                                            fontWeight: 'bold'
                                          }
                                        }}
                                      />
                                    </>
                                  ) : (
                                    // 一般換班顯示
                                    <>
                                      <Chip 
                                        label={swap.from_shift || 'O'} 
                                        size="small" 
                                        sx={{ 
                                          backgroundColor: SHIFT_COLORS[swap.from_shift] || '#9e9e9e',
                                          color: swap.from_shift === 'O' ? 'black' : 'white',
                                          height: '20px',
                                          minWidth: '20px',
                                          '& .MuiChip-label': {
                                            padding: '0 4px',
                                            fontSize: '11px',
                                            fontWeight: 'bold'
                                          }
                                        }}
                                      />
                                      <ArrowForwardIcon sx={{ fontSize: 16, color: '#666' }} />
                                      <Chip 
                                        label={swap.to_shift || 'O'} 
                                        size="small" 
                                        sx={{ 
                                          backgroundColor: SHIFT_COLORS[swap.to_shift] || '#9e9e9e',
                                          color: swap.to_shift === 'O' ? 'black' : 'white',
                                          height: '20px',
                                          minWidth: '20px',
                                          '& .MuiChip-label': {
                                            padding: '0 4px',
                                            fontSize: '11px',
                                            fontWeight: 'bold'
                                          }
                                        }}
                                      />
                                    </>
                                  )}
                                  
                                  {/* 顯示狀態 */}
                                  <Chip 
                                    label={'待處理'} 
                                    size="small" 
                                    sx={{ 
                                      ...STATUS_COLORS['pending'],
                                      height: '20px',
                                      minWidth: '28px',
                                      fontSize: '11px',
                                      '& .MuiChip-label': { padding: '0 4px' }
                                    }} 
                                  />
                                </Box>
                              }
                              secondaryTypographyProps={{ component: "div" }}
                            />
                          </ListItem>
                          {index < recommendedSwaps.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                      
                      {recommendedSwaps.length > 0 && myShiftSwapRequests.length > 0 && <Divider sx={{ my: 1 }} />}
                      
                      {/* 顯示自己的換班請求 */}
                      {myShiftSwapRequests.slice(0, 2).map((swap, index) => (
                        <React.Fragment key={`my-${swap.id}`}>
                          <ListItem 
                            button 
                            onClick={() => navigate('/shift-swap')}
                            sx={{ px: 0, py: 1 }}
                          >
                            <ListItemText
                              primary={
                                <Typography variant="body2" component="span" sx={{ fontWeight: 'bold' }}>
                                  您的換班請求 ({swap.from_date ? format(new Date(swap.from_date), 'MM/dd', { locale: zhTW }) : 'N/A'})
                                </Typography>
                              }
                              secondary={
                                <Box component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                  {swap.swap_type === 'overtime' ? (
                                    // 加班換班顯示
                                    <>
                                      {swap.from_overtime && (
                                        <Chip 
                                          label={swap.from_overtime + '加'}
                                          size="small" 
                                          sx={{ 
                                            backgroundColor: '#FF8A65',
                                            color: 'white',
                                            height: '20px',
                                            minWidth: '28px',
                                            borderRadius: '4px',
                                            '& .MuiChip-label': {
                                              padding: '0 4px',
                                              fontSize: '11px',
                                              fontWeight: 'bold'
                                            }
                                          }}
                                        />
                                      )}
                                      {swap.to_overtime && (
                                        <>
                                          <ArrowForwardIcon sx={{ fontSize: 16, color: '#666' }} />
                                          <Chip 
                                            label={swap.to_overtime === '未指定' ? '不加班' : swap.to_overtime}
                                            size="small" 
                                            sx={{ 
                                              backgroundColor: swap.to_overtime === '未指定' ? '#E0E0E0' : '#FFB74D',
                                              color: '#333',
                                              height: '20px',
                                              minWidth: '28px',
                                              borderRadius: '4px',
                                              '& .MuiChip-label': {
                                                padding: '0 4px',
                                                fontSize: '11px',
                                                fontWeight: 'bold'
                                              }
                                            }}
                                          />
                                        </>
                                      )}
                                    </>
                                  ) : swap.swap_type === 'mission' ? (
                                    // 工作區域交換顯示
                                    <>
                                      <Chip 
                                        label={swap.from_mission || '未指定'} 
                                        size="small" 
                                        sx={{ 
                                          backgroundColor: '#4dabf5',
                                          color: 'white',
                                          height: '20px',
                                          minWidth: '28px',
                                          borderRadius: '4px',
                                          '& .MuiChip-label': {
                                            padding: '0 4px',
                                            fontSize: '11px',
                                            fontWeight: 'bold'
                                          }
                                        }}
                                      />
                                      <ArrowForwardIcon sx={{ fontSize: 16, color: '#666' }} />
                                      <Chip 
                                        label={swap.to_mission || '未指定'} 
                                        size="small" 
                                        sx={{ 
                                          backgroundColor: '#81c784',
                                          color: 'white',
                                          height: '20px',
                                          minWidth: '28px',
                                          borderRadius: '4px',
                                          '& .MuiChip-label': {
                                            padding: '0 4px',
                                            fontSize: '11px',
                                            fontWeight: 'bold'
                                          }
                                        }}
                                      />
                                    </>
                                  ) : (
                                    // 一般換班顯示
                                    <>
                                      <Chip 
                                        label={swap.from_shift || 'O'} 
                                        size="small" 
                                        sx={{ 
                                          backgroundColor: SHIFT_COLORS[swap.from_shift] || '#9e9e9e',
                                          color: swap.from_shift === 'O' ? 'black' : 'white',
                                          height: '20px',
                                          minWidth: '20px',
                                          '& .MuiChip-label': {
                                            padding: '0 4px',
                                            fontSize: '11px',
                                            fontWeight: 'bold'
                                          }
                                        }}
                                      />
                                      <ArrowForwardIcon sx={{ fontSize: 16, color: '#666' }} />
                                      <Chip 
                                        label={swap.to_shift || 'O'} 
                                        size="small" 
                                        sx={{ 
                                          backgroundColor: SHIFT_COLORS[swap.to_shift] || '#9e9e9e',
                                          color: swap.to_shift === 'O' ? 'black' : 'white',
                                          height: '20px',
                                          minWidth: '20px',
                                          '& .MuiChip-label': {
                                            padding: '0 4px',
                                            fontSize: '11px',
                                            fontWeight: 'bold'
                                          }
                                        }}
                                      />
                                    </>
                                  )}
                                  
                                  {/* 顯示狀態 */}
                                  <Chip 
                                    label={swap.status === 'pending' ? '待處理' : 
                                           swap.status === 'accepted' ? '已完成' : 
                                           swap.status === 'rejected' ? '已駁回' : 
                                           swap.status === 'cancelled' ? '已取消' : '處理中'} 
                                    size="small" 
                                    sx={{ 
                                      ...STATUS_COLORS[swap.status || 'pending'],
                                      height: '20px',
                                      minWidth: '28px',
                                      fontSize: '11px',
                                      '& .MuiChip-label': { padding: '0 4px' }
                                    }} 
                                  />
                                </Box>
                              }
                              secondaryTypographyProps={{ component: "div" }}
                            />
                          </ListItem>
                          {index < myShiftSwapRequests.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      沒有待處理的換班請求
                    </Typography>
                  )}
                </CardContent>
                <CardActions>
                  <Button 
                    size="small" 
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => navigate('/shift-swap')}
                  >
                    查看換班申請
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      {/* 公告詳情 Drawer */}
      <Drawer anchor="right" open={isAnnouncementDetailOpen} onClose={handleCloseAnnouncementDetail}>
        <Box sx={{ width: 400, p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">公告詳情</Typography>
            <IconButton onClick={handleCloseAnnouncementDetail}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 2 }}/>
          {selectedAnnouncement && (
            <Box>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                {selectedAnnouncement.title}
              </Typography>
              <Chip 
                label={selectedAnnouncement.category} 
                size="small" 
                sx={{ 
                  mb: 1,
                  ...getCategoryStyle(selectedAnnouncement.category)
                }} 
              />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                發布者: {selectedAnnouncement.author?.full_name || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                發布日期: {format(parseISO(selectedAnnouncement.created_at), 'yyyy-MM-dd HH:mm', { locale: zhTW })}
              </Typography>
              {selectedAnnouncement.expires_at && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  有效日期: {format(parseISO(selectedAnnouncement.expires_at), 'yyyy-MM-dd', { locale: zhTW })}
                </Typography>
              )}
              <Divider sx={{ my: 2 }}/>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {selectedAnnouncement.content}
              </Typography>
            </Box>
          )}
        </Box>
      </Drawer>

      {/* Passkey 設置提示對話框 */}
      <Dialog
        open={showPasskeyDialog}
        onClose={() => handlePasskeyDialogClose(false)}
        aria-labelledby="passkey-dialog-title"
        aria-describedby="passkey-dialog-description"
      >
        <DialogTitle id="passkey-dialog-title">
          設置 Passkey 快速登入
        </DialogTitle>
        <DialogContent>
          <Typography id="passkey-dialog-description">
            您現在使用的是密碼登入。為了提升安全性和便利性，我們建議您設置 Passkey 進行快速登入。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handlePasskeyDialogClose(false)}>
            稍後設置
          </Button>
          <Button onClick={() => handlePasskeyDialogClose(true)} variant="contained">
            立即設置
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Dashboard; 