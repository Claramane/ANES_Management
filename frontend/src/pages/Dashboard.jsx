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
  CircularProgress
} from '@mui/material';
import {
  Event as EventIcon,
  Sync as SyncIcon,
  Announcement as AnnouncementIcon,
  ArrowForward as ArrowForwardIcon,
  Today as TodayIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import apiService from '../utils/api';
import { useScheduleStore } from '../store/scheduleStore';
import { format, startOfToday, getDate, getMonth, getYear, startOfWeek, endOfWeek, addDays, eachDayOfInterval } from 'date-fns';
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
                  <Typography variant="body1">區域: {todayWork.areaCode || '未分配區域'}</Typography>
                  <Typography variant="body1">時間: {todayWork.details?.time || '-'}</Typography>
                </Box>
              ) : (
                <Typography variant="body1" color="text.secondary">
                  今日無班表安排
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
                            mb: dayInfo.shift === 'A' ? 0.5 : 0, // A班時留點空間給 areaCode
                            width: '100%', // 讓 Chip 寬度一致
                            maxWidth: '80px' // 限制最大寬度
                          }}
                        />
                        {dayInfo.shift === 'A' && (
                          <Typography variant="caption" display="block" sx={{ mt: 0.5, color: 'text.secondary', wordBreak: 'break-all' }}>
                            {dayInfo.areaCode || '-'} {/* 顯示區域或橫線 */}
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
              
              {/* 公告部分 */}
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
                <Typography variant="h6">待處理換班請求</Typography>
              </Box>
              
              {/* 換班請求部分 */}
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