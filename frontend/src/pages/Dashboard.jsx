import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Paper,
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
  Badge
} from '@mui/material';
import {
  Event as EventIcon,
  Sync as SyncIcon,
  Announcement as AnnouncementIcon,
  ArrowForward as ArrowForwardIcon,
  Today as TodayIcon,
  Recommend as RecommendIcon
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import apiService from '../utils/api';
import { useScheduleStore } from '../store/scheduleStore';
import { format, startOfToday, getDate, getMonth, getYear, startOfWeek, endOfWeek, addDays, eachDayOfInterval, parseISO } from 'date-fns';
import { zhTW } from 'date-fns/locale';

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

// 定義班別顏色
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

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { 
    monthlySchedule, 
    isLoading: scheduleLoading, 
    error: scheduleError, 
    fetchMonthlySchedule,
    selectedDate, // 獲取存儲中的選定日期
    updateSelectedDate // 獲取更新日期的函數
  } = useScheduleStore();

  const [todayWork, setTodayWork] = useState({ shift: null, areaCode: null, details: null });
  const [weekPreview, setWeekPreview] = useState([]); // 新增 state 用於儲存當週班表預覽
  const [isLoading, setIsLoading] = useState(true); // 維持 isLoading，但在 processScheduleData 中設置
  const [error, setError] = useState(null);

  // 新增公告和換班相關的狀態
  const [announcements, setAnnouncements] = useState([]);
  const [shiftSwapRequests, setShiftSwapRequests] = useState([]);
  const [myShiftSwapRequests, setMyShiftSwapRequests] = useState([]);
  const [recommendedSwaps, setRecommendedSwaps] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [swapsLoading, setSwapsLoading] = useState(true);
  const [announcementsError, setAnnouncementsError] = useState(null);
  const [swapsError, setSwapsError] = useState(null);

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

  // 處理排班數據的函數
  const processScheduleData = () => {
    if (!user || !monthlySchedule || monthlySchedule.length === 0) {
      // 如果用戶信息或班表數據不存在，則不進行處理
      // 可能需要根據 scheduleLoading 狀態決定是否顯示加載中
      if (!scheduleLoading) {
        setIsLoading(false);
        // 可以選擇設置一個 '無數據' 的狀態
        setTodayWork({ shift: '', areaCode: null, details: getShiftInfo('') });
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

    // --- 新增處理當週班表預覽的邏輯 ---
    const weekStart = startOfWeek(today, { locale: zhTW, weekStartsOn: 1 }); // 週一開始
    const weekEnd = endOfWeek(today, { locale: zhTW, weekStartsOn: 1 });
    const weekDates = eachDayOfInterval({ start: weekStart, end: weekEnd });
    
    const previewData = weekDates.map(date => {
      const dayOfMonth = getDate(date);
      let shift = '';
      let areaCode = null;
      
      if (userSchedule && userSchedule.shifts && userSchedule.area_codes) {
        const shiftIndex = dayOfMonth - 1;
        // 檢查索引是否在範圍內
        if (shiftIndex >= 0 && shiftIndex < userSchedule.shifts.length) {
          shift = userSchedule.shifts[shiftIndex] || '';
          areaCode = userSchedule.area_codes[shiftIndex];
        }
      }
      
      return {
        date: date,
        shift: shift,
        areaCode: areaCode,
        details: getShiftInfo(shift)
      };
    });
    setWeekPreview(previewData);
    // --- 結束處理當週班表預覽的邏輯 ---
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
      
      // 修改這裡：將 getAll 改為 getRequests
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
        setShiftSwapRequests(allRequests);
      }
    } catch (err) {
      console.error("獲取換班請求失敗:", err);
      setSwapsError(err.response?.data?.message || err.message || '無法加載換班請求');
    } finally {
      setSwapsLoading(false);
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
    }
  }, [user]);

  // Effect 4: 獲取工作分配數據
  useEffect(() => {
    // 只有當月班表加載完成且不在加載狀態時獲取
    if (!scheduleLoading && monthlySchedule && monthlySchedule.length > 0) {
      fetchWorkAreaAssignments();
    }
  }, [monthlySchedule, scheduleLoading, user, selectedDate]);

  // 獲取工作分配數據
  const fetchWorkAreaAssignments = async () => {
    if (!user) return;
    
    try {
      // 獲取當前年月
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1; // 0-indexed，需 +1
      
      console.log(`正在獲取 ${year}年${month}月 的工作分配數據...`);
      
      // 使用API獲取排班詳細信息
      const response = await apiService.schedule.getScheduleDetails(year, month);
      
      if (response.data && response.data.success) {
        const details = response.data.data || [];
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
        
        // 更新store中的數據
        // 由於我們不想直接修改zustand store，將更新後的數據傳遞給處理函數
        processScheduleDataWithAreaCodes(updatedSchedule);
      } else {
        console.warn('獲取工作分配數據失敗:', response.data?.message || '未知錯誤');
      }
    } catch (err) {
      console.error('獲取工作分配數據時出錯:', err);
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
      
      // 處理當週班表預覽
      const weekStart = startOfWeek(today, { locale: zhTW, weekStartsOn: 1 }); // 週一開始
      const weekEnd = endOfWeek(today, { locale: zhTW, weekStartsOn: 1 });
      const weekDates = eachDayOfInterval({ start: weekStart, end: weekEnd });
      
      const previewData = weekDates.map(date => {
        const dayOfMonth = getDate(date);
        let shift = '';
        let areaCode = null;
        
        if (userSchedule.shifts && userSchedule.area_codes) {
          const shiftIndex = dayOfMonth - 1;
          // 檢查索引是否在範圍內
          if (shiftIndex >= 0 && shiftIndex < userSchedule.shifts.length) {
            shift = userSchedule.shifts[shiftIndex] || '';
            areaCode = userSchedule.area_codes[shiftIndex];
          }
        }
        
        return {
          date: date,
          shift: shift,
          areaCode: areaCode,
          details: getShiftInfo(shift)
        };
      });
      
      setWeekPreview(previewData);
    }
  };

  const formattedToday = format(today, 'yyyy年MM月dd日 EEEE', { locale: zhTW });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="page-container">
      <Typography variant="h4" gutterBottom>
        哈囉！{user?.full_name || user?.username}
      </Typography>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        今天是{format(today, 'yyyy年MM月dd日', { locale: zhTW })}
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {/* 今日班表卡片 */}
        <Grid item xs={12} md={4}>
          <Card>
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
        
        {/* 當週班表預覽卡片 */}
        <Grid item xs={12} md={8}> {/* 調整寬度 */} 
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <EventIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">本週班表預覽</Typography>
              </Box>
              
              {weekPreview.length > 0 ? (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'nowrap', width: '100%', overflowX: 'auto', pb: 1 }}> {/* 強制不換行並允許水平滾動 */} 
                  {weekPreview.map((dayInfo) => (
                    <Paper 
                      elevation={1} 
                      key={format(dayInfo.date, 'yyyy-MM-dd')} 
                      sx={{ 
                        p: 1, 
                        textAlign: 'center', 
                        flexGrow: 1, // 允許元素增長以填滿空間
                        flexBasis: 0, // 設置基礎寬度為0，讓flexGrow更均勻分配
                        minWidth: '100px', // 設置最小寬度，防止過於狹窄
                        display: 'flex', // 內部也使用 flex
                        flexDirection: 'column', // 垂直排列內容
                        justifyContent: 'space-between' // 分散內容
                      }}
                    >
                      <Box> {/* 將日期和班次包在一個 Box 中 */} 
                        <Typography variant="caption" display="block" gutterBottom sx={{ fontWeight: 'bold' }}>
                          {format(dayInfo.date, 'MM/dd E', { locale: zhTW })}
                        </Typography>
                        <Chip 
                          label={dayInfo.shift && !['O', 'V', ''].includes(dayInfo.shift) ? `${dayInfo.shift}班` : dayInfo.details?.name || '未排班'} 
                          size="small"
                          sx={{
                            backgroundColor: dayInfo.details?.color || '#f0f0f0',
                            color: dayInfo.details?.color === '#FFFFFF' ? 'black' : 'white',
                            border: dayInfo.details?.color === '#FFFFFF' ? '1px solid #ccc' : 'none',
                            fontWeight: 'bold',
                            mb: 0.5, // 所有班別都留點空間給 areaCode
                            width: '100%', // 讓 Chip 寬度一致
                            maxWidth: '80px' // 限制最大寬度
                          }}
                        />
                        {/* 工作分配顯示 */}
                        {dayInfo.areaCode ? (
                          <Chip 
                            label={dayInfo.areaCode}
                            size="small"
                            sx={{
                              mt: 0.5,
                              height: '20px',
                              minWidth: '20px',
                              fontSize: '10px',
                              backgroundColor: getAreaStyle(dayInfo.areaCode).bg,
                              color: getAreaStyle(dayInfo.areaCode).text,
                              border: `1px solid ${getAreaStyle(dayInfo.areaCode).border}`,
                              '& .MuiChip-label': { px: 0.5 }
                            }}
                          />
                        ) : (
                          <Typography variant="caption" display="block" sx={{ mt: 0.5, color: 'text.secondary', fontSize: '10px' }}>
                            -
                          </Typography>
                        )}
                      </Box>
                    </Paper>
                  ))}
                </Box>
              ) : (
                <Typography variant="body1" color="text.secondary">
                  無法載入本週班表
                </Typography>
              )}
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/weekly-schedule')}
              >
                查看週班表
              </Button>
            </CardActions>
          </Card>
        </Grid>
        
        {/* 最新公告卡片 */}
        <Grid item xs={12} md={4}>
          <Card>
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
                        onClick={() => navigate('/announcements')}
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
        
        {/* 換班請求卡片 */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
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
    </Box>
  );
}

export default Dashboard; 