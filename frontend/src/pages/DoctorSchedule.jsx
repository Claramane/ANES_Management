import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Grid,
  Chip,
  Paper,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Event as EventIcon,
  CalendarMonth as CalendarMonthIcon,
  Refresh as RefreshIcon,
  LocalHospital as LocalHospitalIcon,
  MedicalServices as MedicalServicesIcon,
  PersonPin as PersonPinIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, startOfToday, addMonths, subMonths } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { doctorScheduleService } from '../utils/api';

// 日曆單元格樣式 - 參考Dashboard設計
const calendarCellStyle = {
  position: 'relative',
  height: '100%',
  minHeight: '90px',
  padding: '4px',
  border: '1px solid #e0e0e0',
  overflow: 'hidden',
  cursor: 'default',
  '&:hover': {
    backgroundColor: '#f5f5f5',
  },
  '&.today': {
    backgroundColor: '#e8f5e9',
    border: '2px solid #4caf50'
  }
};

// 區域代碼對應的顏色映射
const AREA_COLOR_MAPPING = {
  '控台醫師': '#c5706b',      // 紅色系
  '刀房': '#6b9d6b',          // 綠色系  
  '外圍(3F)': '#6b8fb8',      // 藍色系
  '外圍(高階)': '#8a729b',    // 紫色系
  '值班': '#d4935a',          // 橘色系
  '加班': '#c5804a',          // 深橘色系
  '代班': '#7a5d80',          // 深紫色系
  '未分類': '#9e9e9e'         // 灰色系
};

// 渲染日曆單元格內容的組件
const RenderDoctorCalendarCell = ({ day, onClick }) => {
  if (!day.date) return null;
  
  // 判斷是否為過期日期
  const isPastDate = day.date < startOfToday();
  
  return (
    <div 
      style={{ 
        display: 'flex', 
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        opacity: isPastDate ? 0.5 : 1, // 整個單元格淡化
        overflow: 'hidden', // 防止內容溢出
        padding: '0.5px', // 極小內部padding
        cursor: 'pointer', // 添加指針樣式
      }}
      onClick={() => onClick && onClick(day)} // 添加點擊事件
    >
      {/* 日期顯示在最上方 */}
      <Box sx={{ 
        textAlign: 'right',
        padding: { xs: '2px 4px', sm: '3px 6px' }, // 增加padding讓日期數字與邊界保持距離
        fontWeight: 'bold',
        fontSize: { xs: '12px', sm: '16px' }, // 增大手機版日期字體
        width: '100%',
        opacity: isPastDate ? 0.6 : 1, // 日期數字淡化
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {format(day.date, 'd')}
      </Box>
      
      {/* 事件顯示 */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: { xs: '0.5px', sm: '1px' }, // 手機版本極小間距
        overflow: 'hidden',
        flex: 1,
        width: '100%',
        mt: { xs: 0.1, sm: 0.25 }, // 手機版本極小margin
        maxHeight: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 16px)' }, // 調整手機版最大高度
      }}>
        {day.events && day.events.map((event, index) => {
          // 直接使用原始的summary作為顯示文字，保持月班表的原始格式
          let eventText = event.summary || event.title || '';
          let backgroundColor = '#9e9e9e'; // 預設灰色
          let textColor = 'white';
          
          // 根據summary的內容決定顏色 - 保持原有的邏輯
          if (eventText.includes('值班')) {
            backgroundColor = AREA_COLOR_MAPPING['值班'];
          } else if (eventText.includes('加班')) {
            backgroundColor = AREA_COLOR_MAPPING['加班'];
          } else if (eventText.includes('代班')) {
            backgroundColor = AREA_COLOR_MAPPING['代班'];
          } else if (eventText.includes('/A')) {
            backgroundColor = AREA_COLOR_MAPPING['控台醫師'];
          } else if (eventText.includes('/B') || eventText.includes('/E')) {
            backgroundColor = AREA_COLOR_MAPPING['刀房'];
          } else if (eventText.includes('/C')) {
            backgroundColor = AREA_COLOR_MAPPING['外圍(3F)'];
          } else if (eventText.includes('/D')) {
            backgroundColor = AREA_COLOR_MAPPING['外圍(高階)'];
          }
          
          return (
            <Box 
              key={index}
              sx={{ 
                fontSize: { xs: '11px', sm: '13px' }, // 增大手機版事件字體
                padding: { xs: '1px 2px', sm: '2px 4px' }, // 增加電腦版padding
                borderRadius: '3px',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                boxSizing: 'border-box',
                marginTop: '1px',
                opacity: isPastDate ? 0.4 : 1,
                minHeight: { xs: '16px', sm: '20px' }, // 增加手機版高度
                maxWidth: '100%',
                backgroundColor: backgroundColor,
                color: textColor,
                fontWeight: 500,
                lineHeight: 1.1, // 更緊密的行高
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                transition: 'all 0.2s ease',
                flexShrink: 0, // 防止顏色條被壓縮
                '&:hover': {
                  transform: isPastDate ? 'none' : 'scale(1.02)', // 過期日期不放大
                  boxShadow: isPastDate ? '0 1px 2px rgba(0,0,0,0.1)' : '0 2px 3px rgba(0,0,0,0.15)'
                }
              }}
              title={eventText} // 顯示完整文字作為tooltip
            >
              <span style={{ 
                overflow: 'hidden', 
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
                display: 'block', // 確保能正確處理溢出
              }}>
                {eventText}
              </span>
            </Box>
          );
        })}
      </Box>
    </div>
  );
};

const DoctorSchedule = () => {
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [calendarData, setCalendarData] = useState([]);
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [rawSchedules, setRawSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 新增：彈出框相關的state
  const [selectedDayData, setSelectedDayData] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 載入醫師成員列表
  const loadMembers = useCallback(async () => {
    try {
      const response = await doctorScheduleService.getMembers();
      setMembers(response.data || []);
      console.log('醫師成員列表:', response.data);
    } catch (err) {
      console.error('載入醫師成員失敗:', err);
      setError('無法載入醫師成員列表');
    }
  }, []);

  // 載入指定月份的事件
  const loadEvents = useCallback(async (date) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 格式化日期為 YYYYMMDD
      const startDate = format(startOfMonth(date), 'yyyyMMdd');
      const endDate = format(endOfMonth(date), 'yyyyMMdd');
      
      console.log(`載入醫師班表: ${startDate} 到 ${endDate}`);
      
      const response = await doctorScheduleService.getEventsInDateRange(startDate, endDate);
      const responseData = response.data || {};
      
      console.log('醫師班表原始數據:', responseData);
      
      // 處理後端返回的數據格式
      const eventsData = [];
      if (responseData.schedules && Array.isArray(responseData.schedules)) {
        // 保存原始的班表資料
        setRawSchedules(responseData.schedules);
        
        responseData.schedules.forEach(daySchedule => {
          const dayDate = daySchedule.date; // YYYYMMDD 格式
          
          // 處理值班資訊
          if (daySchedule.值班) {
            eventsData.push({
              title: `${daySchedule.值班}值班`,
              summary: `${daySchedule.值班}值班`,
              start: { date: dayDate },
              type: '值班',
              doctor_name: daySchedule.值班,
              area_code: '值班'
            });
          }
          
          // 處理白班資訊 - 使用後端轉換好的area_code
          if (daySchedule.白班 && Array.isArray(daySchedule.白班)) {
            daySchedule.白班.forEach(shift => {
              eventsData.push({
                title: shift.summary,
                summary: shift.summary,
                start: { date: dayDate },
                time: shift.time,
                type: '白班',
                name: shift.name,
                area_code: shift.area_code, // 使用後端轉換好的區域代碼
                id: shift.id,
                active: shift.active
              });
            });
          }
          
          // 處理排班注記
          if (daySchedule.排班注記 && Array.isArray(daySchedule.排班注記)) {
            daySchedule.排班注記.forEach(note => {
              eventsData.push({
                title: note.summary,
                summary: note.summary,
                start: { date: dayDate },
                time: note.time,
                type: '排班注記'
              });
            });
          }
        });
      } else {
        // 沒有班表資料時設置空陣列
        setRawSchedules([]);
      }
      
      console.log('處理後的醫師班表事件:', eventsData);
      setEvents(eventsData);
      
      // 生成日曆數據
      generateCalendarData(date, eventsData);
      
    } catch (err) {
      console.error('載入醫師班表失敗:', err);
      setError('無法載入醫師班表資料');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 生成日曆數據
  const generateCalendarData = useCallback((date, eventsData) => {
    try {
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
      
      // 為每一天創建數據結構，並匹配事件
      days.forEach(day => {
        const dayString = format(day, 'yyyy-MM-dd');
        
        // 找到這一天的所有事件
        const dayEvents = eventsData.filter(event => {
          // 處理不同的日期格式
          let eventDate = null;
          
          if (event.start && event.start.date) {
            // 新格式：YYYYMMDD -> 轉換為 yyyy-MM-dd 進行比較
            const dateStr = event.start.date;
            if (dateStr && dateStr.length === 8) {
              eventDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
            }
          } else if (event.date) {
            eventDate = event.date;
          } else if (event.start_date) {
            eventDate = event.start_date;
          }
          
          return eventDate === dayString;
        });
        
        week.push({
          date: day,
          events: dayEvents,
          eventsCount: dayEvents.length
        });
        
        // 每週結束時將週資料加入日曆
        if (getDay(day) === 6 || format(day, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')) {
          calendar.push([...week]);
          week = [];
        }
      });
      
      console.log(`生成了 ${calendar.length} 週的醫師班表日曆數據`);
      setCalendarData(calendar);
      
    } catch (err) {
      console.error('生成日曆數據時出錯:', err);
      setCalendarData([]);
    }
  }, []);

  // 處理日期變更
  const handleDateChange = useCallback((newDate) => {
    if (newDate) {
      setSelectedDate(newDate);
      loadEvents(newDate);
    }
  }, [loadEvents]);

  // 處理前一個月
  const handlePreviousMonth = useCallback(() => {
    const prevMonth = subMonths(selectedDate, 1);
    setSelectedDate(prevMonth);
    loadEvents(prevMonth);
  }, [selectedDate, loadEvents]);

  // 處理下一個月
  const handleNextMonth = useCallback(() => {
    const nextMonth = addMonths(selectedDate, 1);
    setSelectedDate(nextMonth);
    loadEvents(nextMonth);
  }, [selectedDate, loadEvents]);

  // 設置自動更新 - 每1分鐘
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('自動更新醫師班表...');
      loadEvents(selectedDate);
    }, 60000); // 1分鐘 = 60000毫秒

    return () => clearInterval(interval);
  }, [selectedDate, loadEvents]);

  // 初始化載入
  useEffect(() => {
    const initialize = async () => {
      await loadMembers();
      await loadEvents(selectedDate);
    };
    
    initialize();
  }, [loadMembers, loadEvents, selectedDate]);

  // 計算今日班表資訊 - 多人分格顯示
  const todayScheduleInfo = useMemo(() => {
    const today = format(new Date(), 'yyyyMMdd');
    
    // 從原始 schedules 資料中找到今日的班表
    const todaySchedule = rawSchedules.find(schedule => schedule.date === today);
    
    if (!todaySchedule) {
      return {
        todayDutyDoctor: ['無資料'],
        todayConsoleDoctor: ['無資料'],
        todayORDoctors: ['無資料'],
        todayPeripheral3F: ['無資料'],
        todayPeripheralAdvanced: ['無資料']
      };
    }
    
    // 提取值班醫師
    const todayDutyDoctor = todaySchedule.值班 ? [todaySchedule.值班] : ['無'];
    
    // 從白班中根據area_code分類醫師
    let todayConsoleDoctor = [];
    let todayORDoctors = [];
    let todayPeripheral3F = [];
    let todayPeripheralAdvanced = [];
    
    if (todaySchedule.白班 && Array.isArray(todaySchedule.白班)) {
      todaySchedule.白班.forEach(shift => {
        if (!shift.active) return; // 只顯示啟用的醫師
        
        const areaCode = shift.area_code;
        const doctorName = shift.name;
        
        // 根據後端轉換好的area_code分類
        if (areaCode === '控台醫師') {
          todayConsoleDoctor.push(doctorName);
        } else if (areaCode === '刀房') {
          todayORDoctors.push(doctorName);
        } else if (areaCode === '外圍(3F)') {
          todayPeripheral3F.push(doctorName);
        } else if (areaCode === '外圍(高階)') {
          todayPeripheralAdvanced.push(doctorName);
        }
      });
    }
    
    // 如果沒有資料，填入預設值
    if (todayConsoleDoctor.length === 0) todayConsoleDoctor = ['無'];
    if (todayORDoctors.length === 0) todayORDoctors = ['無'];
    if (todayPeripheral3F.length === 0) todayPeripheral3F = ['無'];
    if (todayPeripheralAdvanced.length === 0) todayPeripheralAdvanced = ['無'];
    
    return {
      todayDutyDoctor,
      todayConsoleDoctor,
      todayORDoctors,
      todayPeripheral3F,
      todayPeripheralAdvanced
    };
  }, [rawSchedules]);

  // 計算統計資料
  const statistics = useMemo(() => {
    const totalEvents = events.length;
    const doctorCounts = {};
    const doctorSet = new Set();
    
    events.forEach(event => {
      let doctorName = null;
      
      if (event.name) {
        doctorName = event.name;
      } else if (event.doctor_name) {
        doctorName = event.doctor_name;
      } else if (event.title || event.summary) {
        const eventText = event.title || event.summary || '';
        const matchDoctor = eventText.match(/^([^\/值]+)/);
        if (matchDoctor) {
          doctorName = matchDoctor[1].trim();
        }
      }
      
      if (doctorName) {
        doctorSet.add(doctorName);
        doctorCounts[doctorName] = (doctorCounts[doctorName] || 0) + 1;
      }
    });
    
    return {
      totalEvents,
      activeDoctors: doctorSet.size,
      doctorCounts
    };
  }, [events]);

  // 新增：處理日期點擊事件
  const handleDayClick = useCallback((dayData) => {
    if (dayData && dayData.date) {
      setSelectedDayData(dayData);
      setIsDialogOpen(true);
    }
  }, []);

  // 新增：關閉彈出框
  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
    setSelectedDayData(null);
  }, []);

  return (
    <Box sx={{ 
      p: { xs: 0, sm: 2, md: 3 }, // 手機版本移除padding
      width: '100%',
      overflow: 'hidden' // 防止整體頁面溢出
    }}>
      {/* 今日班表資訊 - 多人分格顯示 */}
      <Box sx={{ px: { xs: 2, sm: 0 }, mb: 3 }}>
        <Grid container spacing={1}> {/* 改為spacing={1}縮小間隙 */}
          {/* 值班醫師 */}
          {todayScheduleInfo.todayDutyDoctor.map((doctor, index) => (
            <Grid 
              item 
              xs={12 / Math.max(todayScheduleInfo.todayDutyDoctor.length, 1)} 
              sm={2.4}
              key={`duty-${index}`}
            >
              <Card sx={{ boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                <CardContent>
                  <Box>
                    <Typography variant="h6">{doctor}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      今日值班醫師
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
          
          {/* 控台醫師 */}
          {todayScheduleInfo.todayConsoleDoctor.map((doctor, index) => (
            <Grid 
              item 
              xs={12 / Math.max(todayScheduleInfo.todayConsoleDoctor.length, 1)} 
              sm={2.4}
              key={`console-${index}`}
            >
              <Card sx={{ boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                <CardContent>
                  <Box>
                    <Typography variant="h6">{doctor}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      今日控台醫師
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
          
          {/* 刀房醫師 */}
          {todayScheduleInfo.todayORDoctors.map((doctor, index) => (
            <Grid 
              item 
              xs={12 / Math.max(todayScheduleInfo.todayORDoctors.length, 1)} 
              sm={2.4}
              key={`or-${index}`}
            >
              <Card sx={{ boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                <CardContent>
                  <Box>
                    <Typography variant="h6">{doctor}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      刀房
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
          
          {/* 外圍(3F)醫師 */}
          {todayScheduleInfo.todayPeripheral3F.map((doctor, index) => (
            <Grid 
              item 
              xs={12 / Math.max(todayScheduleInfo.todayPeripheral3F.length, 1)} 
              sm={2.4}
              key={`3f-${index}`}
            >
              <Card sx={{ boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                <CardContent>
                  <Box>
                    <Typography variant="h6">{doctor}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      外圍(3F)
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
          
          {/* 外圍(高階)醫師 */}
          {todayScheduleInfo.todayPeripheralAdvanced.map((doctor, index) => (
            <Grid 
              item 
              xs={12 / Math.max(todayScheduleInfo.todayPeripheralAdvanced.length, 1)} 
              sm={2.4}
              key={`advanced-${index}`}
            >
              <Card sx={{ boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                <CardContent>
                  <Box>
                    <Typography variant="h6">{doctor}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      外圍(高階)
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* 錯誤顯示 */}
      {error && (
        <Box sx={{ px: { xs: 2, sm: 0 }, mb: 2 }}>
          <Alert severity="error">
            {error}
          </Alert>
        </Box>
      )}

      {/* 主要內容 - 參考Dashboard設計 */}
      <Box sx={{ px: { xs: 0, sm: 0 } }}> {/* 移除所有padding讓月曆使用全寬 */}
        <Card sx={{ 
          borderRadius: { xs: 0, sm: 1 }, // 手機版本無圓角
          boxShadow: 'none' // 移除陰影
        }}>
          <CardContent sx={{ 
            p: { xs: 1, sm: 2, md: 3 }, // 手機版本減少內部padding
            '&:last-child': { pb: { xs: 1, sm: 2, md: 3 } }
          }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              mb: 3,
              px: { xs: 1, sm: 0 } // 手機版本標題區域加一點padding
            }}>
              <IconButton 
                onClick={handlePreviousMonth}
                sx={{ mr: 2 }}
                size="large"
              >
                <ChevronLeftIcon />
              </IconButton>
              
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
                <DatePicker
                  views={['year', 'month']}
                  openTo="month"
                  value={selectedDate}
                  onChange={handleDateChange}
                  format="yyyy年MM月"
                  sx={{ 
                    mx: 2,
                    '& .MuiInputBase-root': {
                      height: '40px'
                    },
                    '& .MuiInputBase-input': {
                      textAlign: 'center',
                      fontSize: '1rem',
                      fontWeight: 'normal'
                    }
                  }}
                />
              </LocalizationProvider>
              
              <IconButton 
                onClick={handleNextMonth}
                sx={{ ml: 2 }}
                size="large"
              >
                <ChevronRightIcon />
              </IconButton>
            </Box>
            
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>載入醫師班表中...</Typography>
              </Box>
            ) : calendarData.length > 0 ? (
              <Box sx={{ 
                width: '100%', 
              }}>
                {/* 日曆表格 - 參考Dashboard設計 */}
                <Box component="table" sx={{ 
                  width: '100%', 
                  height: '100%',
                  borderCollapse: 'collapse',
                  border: '1px solid #e0e0e0',
                  tableLayout: 'fixed' // 固定表格佈局
                }}>
                  {/* 表頭 */}
                  <Box component="thead">
                    <Box component="tr">
                      {['一', '二', '三', '四', '五', '六', '日'].map(day => (
                        <Box 
                          component="th" 
                          key={day}
                          sx={{
                            padding: { xs: '6px 1px', sm: '8px 2px' }, // 手機版本更緊湊
                            textAlign: 'center',
                            backgroundColor: '#f5f5f5',
                            border: '1px solid #e0e0e0',
                            fontSize: { xs: '14px', sm: '16px' }, // 增大手機版字體
                            fontWeight: 'bold',
                            width: '14.28%', // 固定寬度百分比
                          }}
                        >
                          {day}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                  
                  {/* 表格主體 */}
                  <Box component="tbody">
                    {calendarData.map((week, weekIndex) => (
                      <Box component="tr" key={weekIndex}>
                        {week.map((dayData, dayIndex) => (
                          <Box 
                            component="td" 
                            key={dayIndex}
                            sx={{
                              ...calendarCellStyle,
                              height: { xs: '80px', sm: '90px' }, // 手機版本稍微降低高度
                              width: '14.28%', // 固定寬度百分比
                              verticalAlign: 'top',
                              padding: { xs: '1px', sm: '2px 1px' }, // 手機版本極小padding
                              cursor: 'pointer', // 添加指針樣式
                              '&:hover': {
                                backgroundColor: dayData.date ? '#f5f5f5' : undefined,
                              },
                              ...(dayData.date && isToday(dayData.date) && { 
                                backgroundColor: '#e8f5e9',
                                border: '2px solid #4caf50'
                              }),
                              ...((!dayData.date) && { 
                                backgroundColor: '#f9f9f9',
                                opacity: 0.5
                              })
                            }}
                            onClick={() => handleDayClick(dayData)} // 添加點擊事件
                          >
                            {dayData.date && <RenderDoctorCalendarCell day={dayData} onClick={handleDayClick} />}
                          </Box>
                        ))}
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', p: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  暫無醫師班表資料
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* 醫師列表 */}
      {members.length > 0 && (
        <Box sx={{ px: { xs: 2, sm: 0 }, mt: 3 }}>
          <Card sx={{ 
            borderRadius: { xs: 0, sm: 1 }, // 手機版本無圓角
            boxShadow: 'none' // 移除陰影
          }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                醫師成員列表
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {members.map((member) => (
                  <Chip
                    key={member.id}
                    label={`${member.name} (${member.employee_id || 'N/A'})`}
                    variant="outlined"
                    color={statistics.doctorCounts[member.name] ? 'primary' : 'default'}
                    size="small"
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* 新增：日期詳細資訊彈出框 */}
      <Dialog
        open={isDialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: '80vh'
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" component="div">
            {selectedDayData?.date && format(selectedDayData.date, 'yyyy年MM月dd日 (EEEE)', { locale: zhTW })}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            班表詳細資訊
          </Typography>
        </DialogTitle>
        
        <DialogContent sx={{ pt: 1 }}>
          {selectedDayData?.events && selectedDayData.events.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {selectedDayData.events.map((event, index) => {
                // 決定背景顏色
                let backgroundColor = '#9e9e9e'; // 預設灰色
                let textColor = 'white';
                const eventText = event.summary || event.title || '';
                
                if (eventText.includes('值班')) {
                  backgroundColor = AREA_COLOR_MAPPING['值班'];
                } else if (eventText.includes('加班')) {
                  backgroundColor = AREA_COLOR_MAPPING['加班'];
                } else if (eventText.includes('代班')) {
                  backgroundColor = AREA_COLOR_MAPPING['代班'];
                } else if (eventText.includes('/A')) {
                  backgroundColor = AREA_COLOR_MAPPING['控台醫師'];
                } else if (eventText.includes('/B') || eventText.includes('/E')) {
                  backgroundColor = AREA_COLOR_MAPPING['刀房'];
                } else if (eventText.includes('/C')) {
                  backgroundColor = AREA_COLOR_MAPPING['外圍(3F)'];
                } else if (eventText.includes('/D')) {
                  backgroundColor = AREA_COLOR_MAPPING['外圍(高階)'];
                }

                return (
                  <Card 
                    key={index} 
                    sx={{ 
                      backgroundColor: backgroundColor,
                      color: textColor,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {eventText}
                      </Typography>
                      {event.time && (
                        <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.9 }}>
                          時間：{event.time}
                        </Typography>
                      )}
                      {event.area_code && (
                        <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.9 }}>
                          區域：{event.area_code}
                        </Typography>
                      )}
                      {event.name && (
                        <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.9 }}>
                          醫師：{event.name}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography variant="body1" color="text.secondary">
                此日期無班表安排
              </Typography>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog} variant="contained" size="small">
            關閉
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DoctorSchedule;