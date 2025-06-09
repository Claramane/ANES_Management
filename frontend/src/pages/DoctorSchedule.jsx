import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Drawer,
  IconButton,
  Chip,
  TextField
} from '@mui/material';
import { 
  Schedule as ScheduleIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, startOfToday, addMonths, subMonths } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { doctorScheduleService, api } from '../utils/api'; // 修正導入語句，使用named import導入api實例
import { formatDoctorName, getDoctorMapping } from '../utils/doctorUtils';
import { useAuthStore } from '../store/authStore';

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
  '手術室': '#6b9d6b',          // 綠色系  
  '外圍(3F)': '#6b8fb8',      // 藍色系
  '外圍(高階)': '#8a729b',    // 紫色系
  '外圍(TAE)': '#b8866b',     // 棕色系
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
            backgroundColor = AREA_COLOR_MAPPING['手術室'];
          } else if (eventText.includes('/C')) {
            backgroundColor = AREA_COLOR_MAPPING['外圍(3F)'];
          } else if (eventText.includes('/D')) {
            backgroundColor = AREA_COLOR_MAPPING['外圍(高階)'];
          } else if (eventText.includes('/F')) {
            backgroundColor = AREA_COLOR_MAPPING['外圍(TAE)'];
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
                boxShadow: 'none',
                transition: 'all 0.2s ease',
                flexShrink: 0, // 防止顏色條被壓縮
                '&:hover': {
                  transform: isPastDate ? 'none' : 'scale(1.02)', // 過期日期不放大
                  boxShadow: 'none'
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
  // 狀態管理
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [meetingStartTime, setMeetingStartTime] = useState(null);
  const [meetingEndTime, setMeetingEndTime] = useState(null);
  
  // 確認狀態切換的狀態
  const [pendingStatusChange, setPendingStatusChange] = useState(null);

  // 彈出框相關的state
  const [selectedDayData, setSelectedDayData] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // 醫師資料映射
  const [doctorMapping, setDoctorMapping] = useState({});
  
  // 專門存儲今日班表資料，不受月曆切換影響
  const [todayScheduleData, setTodayScheduleData] = useState(null);
  
  // 防止重複請求的標記
  const [isLoadingToday, setIsLoadingToday] = useState(false);

  // 開會相關狀態
  const [showMeetingTimePicker, setShowMeetingTimePicker] = useState(false);
  const [doctorMeetingTimes, setDoctorMeetingTimes] = useState({}); // 存儲醫師開會時間
  const [meetingTimeStep, setMeetingTimeStep] = useState('start'); // 'start' 或 'end'

  // 上下班確認對話框狀態
  const [showStatusConfirmDialog, setShowStatusConfirmDialog] = useState(false);

  // 抽屜和新區域代碼狀態
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [newAreaCode, setNewAreaCode] = useState('');

  // 原始班表資料
  const [rawSchedules, setRawSchedules] = useState([]);
  const [error, setError] = useState(null);

  // 日曆資料狀態
  const [calendarData, setCalendarData] = useState([]);

  // 新增：ref用於控制結束時間下拉選單
  const endTimeSelectRef = useRef(null);

  // 新增：用戶信息（需要從context或props獲取，這裡先假設）
  const [currentUser] = useState({ role: 'admin' }); // 模擬用戶數據

  // 區域代碼選項
  const areaCodeOptions = [
    { value: '控台醫師', label: '控台醫師' },
    { value: '手術室', label: '手術室' },
    { value: '外圍(3F)', label: '外圍(3F)' },
    { value: '外圍(高階)', label: '外圍(高階)' },
    { value: '外圍(TAE)', label: '外圍(TAE)' },
  ];

  // 日期相關計算 - 移除未使用的變數
  // const currentYear = selectedDate.getFullYear();
  // const currentMonth = selectedDate.getMonth();

  // 初始化醫師資料映射
  useEffect(() => {
    const mapping = getDoctorMapping();
    setDoctorMapping(mapping);
  }, []);

  // 優化：載入今日班表資料的函數，避免重複請求
  const loadTodayData = useCallback(async () => {
    // 防止重複請求
    if (isLoadingToday) {
      return;
    }
    
    try {
      setIsLoadingToday(true);
      const today = new Date();
      const todayString = format(today, 'yyyyMMdd');
      
      // 檢查當前顯示的月份是否包含今天
      const currentMonthStart = format(startOfMonth(selectedDate), 'yyyyMMdd');
      const currentMonthEnd = format(endOfMonth(selectedDate), 'yyyyMMdd');
      
      // 如果當前顯示的月份包含今天，就不需要單獨請求了
      if (currentMonthStart <= todayString && todayString <= currentMonthEnd) {
        // 從現有的 rawSchedules 中找今天的資料
        const todaySchedule = rawSchedules.find(schedule => schedule.date === todayString);
        
        if (todaySchedule) {
          setTodayScheduleData(todaySchedule);
        } else {
          setTodayScheduleData(null);
        }
        return;
      }
      
      // 只有當顯示的月份不包含今天時，才單獨請求今天所在月份的資料
      const todayMonthStart = format(startOfMonth(today), 'yyyyMMdd');
      const todayMonthEnd = format(endOfMonth(today), 'yyyyMMdd');
      
      const response = await doctorScheduleService.getEventsInDateRange(todayMonthStart, todayMonthEnd);
      const responseData = response.data || {};
      
      if (responseData.schedules && Array.isArray(responseData.schedules)) {
        const todaySchedule = responseData.schedules.find(schedule => schedule.date === todayString);
        if (todaySchedule) {
          setTodayScheduleData(todaySchedule);
        } else {
          setTodayScheduleData(null);
        }
      } else {
        setTodayScheduleData(null);
      }
    } catch (err) {
      console.error('載入今日班表資料失敗:', err);
      setTodayScheduleData(null);
    } finally {
      setIsLoadingToday(false);
    }
  }, [selectedDate, rawSchedules, isLoadingToday]);

  // 載入指定月份的事件
  const loadEvents = useCallback(async (date) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 格式化日期為 YYYYMMDD
      const startDate = format(startOfMonth(date), 'yyyyMMdd');
      const endDate = format(endOfMonth(date), 'yyyyMMdd');
      const today = format(new Date(), 'yyyyMMdd');
      
      const response = await doctorScheduleService.getEventsInDateRange(startDate, endDate);
      const responseData = response.data || {};
      
      // 處理後端返回的數據格式
      const eventsData = [];
      if (responseData.schedules && Array.isArray(responseData.schedules)) {
        // 保存原始的班表資料
        setRawSchedules(responseData.schedules);
        
        // 檢查是否包含今天的資料，如果包含則更新今日班表資料
        const todayScheduleInThisMonth = responseData.schedules.find(schedule => schedule.date === today);
        
        if (todayScheduleInThisMonth) {
          setTodayScheduleData(todayScheduleInThisMonth);
        }
        
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
              // 轉換為統一格式
              const doctorInfo = {
                doctor: shift,
                active: shift.status !== 'off' // 只有請假狀態(off)才是不活躍的
              };
              eventsData.push({
                title: shift.summary,
                summary: shift.summary,
                start: { date: dayDate },
                time: shift.time,
                type: '白班',
                name: shift.name,
                area_code: shift.area_code, // 使用後端轉換好的區域代碼
                id: shift.id,
                ...doctorInfo
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
        
        // 找到這一天的所有事件，並過濾掉范守仁
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
          
          // 過濾掉范守仁的事件（月曆中不顯示）
          const isDateMatch = eventDate === dayString;
          const isNotFanShouwei = !event.name || event.name !== '范守仁';
          const isNotFanShouweiInSummary = !event.summary || !event.summary.includes('范守仁');
          
          return isDateMatch && isNotFanShouwei && isNotFanShouweiInSummary;
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

  // 優化自動更新 - 只更新當前顯示的月份，避免重複請求
  useEffect(() => {
    const interval = setInterval(async () => {
      // 只更新當前顯示的月份
      await loadEvents(selectedDate);
      
      // 如果當前顯示的月份不包含今天，才單獨更新今日資料
      const today = new Date();
      const todayString = format(today, 'yyyyMMdd');
      const currentMonthStart = format(startOfMonth(selectedDate), 'yyyyMMdd');
      const currentMonthEnd = format(endOfMonth(selectedDate), 'yyyyMMdd');
      
      if (!(currentMonthStart <= todayString && todayString <= currentMonthEnd)) {
        await loadTodayData();
      }
    }, 60000); // 1分鐘 = 60000毫秒

    return () => clearInterval(interval);
  }, [selectedDate, loadEvents, loadTodayData]);

  // 優化初始化載入 - 避免重複請求
  useEffect(() => {
    const initialize = async () => {
      // 先載入當前選擇的月份
      await loadEvents(selectedDate);
      
      // 檢查當前月份是否包含今天，如果不包含才單獨載入今日資料
      const today = new Date();
      const todayString = format(today, 'yyyyMMdd');
      const currentMonthStart = format(startOfMonth(selectedDate), 'yyyyMMdd');
      const currentMonthEnd = format(endOfMonth(selectedDate), 'yyyyMMdd');
      
      if (!(currentMonthStart <= todayString && todayString <= currentMonthEnd)) {
        await loadTodayData();
      }
    };
    
    initialize();
  }, []); // 只在組件掛載時執行一次

  // 新增：檢查醫師是否在上班時間
  const isDoctorWorkingTime = useCallback((timeRange) => {
    if (!timeRange) return true; // 如果沒有時間範圍，預設為上班時間
    
    try {
      const now = new Date();
      // 轉換為UTC+8時間
      const utc8Now = new Date(now.getTime() + (8 * 60 * 60 * 1000));
      const currentHour = utc8Now.getHours();
      const currentMinute = utc8Now.getMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;
      
      // 解析時間範圍，例如 "08:00-18:00"
      const timeMatch = timeRange.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
      if (!timeMatch) return true;
      
      const startHour = parseInt(timeMatch[1]);
      const startMinute = parseInt(timeMatch[2]);
      const endHour = parseInt(timeMatch[3]);
      const endMinute = parseInt(timeMatch[4]);
      
      const startTimeInMinutes = startHour * 60 + startMinute;
      const endTimeInMinutes = endHour * 60 + endMinute;
      
      return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
    } catch (error) {
      console.error('解析工作時間失敗:', error);
      return true;
    }
  }, []);

  // 新增：檢查醫師是否在開會時間
  const isDoctorInMeeting = useCallback((doctorId) => {
    // 安全檢查醫師ID
    if (!doctorId) {
      return false;
    }
    
    const meetingTime = doctorMeetingTimes[doctorId];
    if (!meetingTime) return false;
    
    try {
      const now = new Date();
      // 轉換為UTC+8時間
      const utc8Now = new Date(now.getTime() + (8 * 60 * 60 * 1000));
      const currentHour = utc8Now.getHours();
      const currentMinute = utc8Now.getMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;
      
      const startTimeInMinutes = meetingTime.startHour * 60 + meetingTime.startMinute;
      const endTimeInMinutes = meetingTime.endHour * 60 + meetingTime.endMinute;
      
      return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
    } catch (error) {
      console.error('檢查開會時間失敗:', error);
      return false;
    }
  }, [doctorMeetingTimes]);

  // 新增：獲取醫師開會時間顯示文字
  const getDoctorMeetingTimeText = useCallback((doctorId) => {
    // 安全檢查醫師ID
    if (!doctorId) {
      return '';
    }
    
    const meetingTime = doctorMeetingTimes[doctorId];
    if (!meetingTime) return '';
    
    const startTime = `${String(meetingTime.startHour).padStart(2, '0')}:${String(meetingTime.startMinute).padStart(2, '0')}`;
    const endTime = `${String(meetingTime.endHour).padStart(2, '0')}:${String(meetingTime.endMinute).padStart(2, '0')}`;
    
    return `（開會：${startTime}-${endTime}）`;
  }, [doctorMeetingTimes]);

  // 新增：生成時間選項（以半小時為單位）
  const generateTimeOptions = useCallback((startHour, startMinute, endHour, endMinute) => {
    const options = [];
    
    for (let hour = startHour; hour <= endHour; hour++) {
      const startMin = (hour === startHour) ? Math.ceil(startMinute / 30) * 30 : 0;
      const endMin = (hour === endHour) ? Math.floor(endMinute / 30) * 30 : 30;
      
      for (let minute = startMin; minute <= endMin; minute += 30) {
        if (hour === endHour && minute > endMinute) break;
        if (minute === 60) continue; // 跳過60分鐘，改為下一小時的0分鐘
        
        options.push({
          hour,
          minute: minute === 60 ? 0 : minute,
          displayHour: minute === 60 ? hour + 1 : hour,
          label: `${String(minute === 60 ? hour + 1 : hour).padStart(2, '0')}:${String(minute === 60 ? 0 : minute).padStart(2, '0')}`
        });
      }
    }
    
    return options;
  }, []);

  // 新增：解析醫師工作時間範圍
  const parseWorkingTime = useCallback((timeRange) => {
    if (!timeRange) return null;
    
    try {
      const timeMatch = timeRange.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
      if (!timeMatch) return null;
      
      return {
        startHour: parseInt(timeMatch[1]),
        startMinute: parseInt(timeMatch[2]),
        endHour: parseInt(timeMatch[3]),
        endMinute: parseInt(timeMatch[4])
      };
    } catch (error) {
      console.error('解析工作時間失敗:', error);
      return null;
    }
  }, []);

  // 新增：處理開會時間設定
  const handleSetMeetingTime = useCallback(async () => {
    if (!selectedDoctor || !meetingStartTime || !meetingEndTime) return;
    
    const startTime = new Date(meetingStartTime);
    const endTime = new Date(meetingEndTime);
    
    if (startTime >= endTime) {
      setError('結束時間必須晚於開始時間');
      return;
    }
    
    try {
      setIsUpdating(true);
      
      // 格式化開會時間為 HH:MM-HH:MM 格式
      const meetingTimeStr = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}-${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;
      
      console.log(`設定醫師 ${selectedDoctor.id} (${selectedDoctor.name}) 的開會時間為: ${meetingTimeStr}`);
      
      const response = await api.post(`/doctor-schedules/doctor/${selectedDoctor.id}/meeting-time`, {
        meeting_time: meetingTimeStr
      });

      const result = response.data;
      
      if (result.success) {
        console.log('開會時間設定成功');
        
        // 清除錯誤狀態
        setError(null);
        
        // 重置開會時間設定界面
        setShowMeetingTimePicker(false);
        setMeetingStartTime(null);
        setMeetingEndTime(null);
        setMeetingTimeStep('start');
        
        // 立刻重新載入今日資料和當前月份資料
        console.log('開始重新載入資料...');
        await Promise.all([
          loadTodayData(),
          loadEvents(selectedDate)
        ]);
        console.log('資料重新載入完成');
        
        // 更新本地的醫師開會時間記錄（顯示用）
        setDoctorMeetingTimes(prev => ({
          ...prev,
          [selectedDoctor.id]: {
            startHour: startTime.getHours(),
            startMinute: startTime.getMinutes(),
            endHour: endTime.getHours(),
            endMinute: endTime.getMinutes()
          }
        }));
        
      } else {
        // API調用成功但業務邏輯失敗
        const errorMsg = result.message || '設定開會時間失敗';
        console.error('業務邏輯失敗:', errorMsg);
        setError(errorMsg);
      }
    } catch (err) {
      console.error('設定開會時間失敗:', err);
      
      // 提取錯誤訊息
      let errorMessage = '設定開會時間失敗';
      if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  }, [selectedDoctor, meetingStartTime, meetingEndTime, loadTodayData, loadEvents, selectedDate]);

  // 新增：處理時間選擇
  const handleTimeSelect = useCallback((newValue) => {
    if (meetingTimeStep === 'start') {
      setMeetingStartTime(newValue);
      setMeetingTimeStep('end');
      // 自動設定結束時間為開始時間+1小時
      if (newValue) {
        const endTime = new Date(newValue.getTime() + 60 * 60 * 1000); // 加1小時
        setMeetingEndTime(endTime);
        
        // 延遲一下讓結束時間的下拉選單自動開啟
        setTimeout(() => {
          if (endTimeSelectRef.current) {
            const selectElement = endTimeSelectRef.current.querySelector('div[role="button"]');
            if (selectElement) {
              selectElement.click();
            }
          }
        }, 100);
      }
    } else {
      setMeetingEndTime(newValue);
    }
  }, [meetingTimeStep]);

  // 新增：重置開會時間設定
  const resetMeetingTimePicker = useCallback(() => {
    setShowMeetingTimePicker(false);
    setMeetingStartTime(null);
    setMeetingEndTime(null);
    setMeetingTimeStep('start');
  }, []);

  // 新增：處理醫師點擊事件
  const handleDoctorClick = useCallback((doctor) => {
    if (currentUser.role !== 'admin') return; // 只有管理員可以編輯
    
    // 值班醫師不可編輯
    if (doctor.isDuty) {
      console.log('值班醫師不可編輯');
      return;
    }
    
    // 檢查醫師資料是否有效
    if (!doctor || !doctor.id) {
      console.error('醫師資料無效，缺少ID:', doctor);
      setError('醫師資料無效，無法進行編輯');
      return;
    }
    
    console.log('選中醫師:', doctor);
    setSelectedDoctor(doctor);
    setNewAreaCode(doctor.area_code || '');
    setIsDrawerOpen(true);
  }, [currentUser.role]);

  // 新增：處理區域代碼變更（自動提交）
  const handleAreaCodeChange = useCallback(async (newAreaCode) => {
    if (!selectedDoctor || !newAreaCode) return;
    
    // 檢查醫師ID是否有效
    if (!selectedDoctor.id) {
      console.error('選中的醫師缺少ID:', selectedDoctor);
      setError('醫師資料無效，無法更新區域代碼');
      setIsDrawerOpen(false);
      setSelectedDoctor(null);
      return;
    }
    
    try {
      setIsUpdating(true);
      console.log(`更新醫師 ${selectedDoctor.id} (${selectedDoctor.name}) 的區域代碼為: ${newAreaCode}`);
      
      const response = await api.post(`/doctor-schedules/doctor/${selectedDoctor.id}/area-code`, {
        area_code: newAreaCode
      });
      
      const result = response.data;
      
      // 檢查回應格式 - 後端返回 {success: true, message: "區域代碼更新成功"}
      if (result.success) {
        console.log('區域代碼更新成功');
        
        // 清除錯誤狀態
        setError(null);
        
        // 關閉抽屜
        setIsDrawerOpen(false);
        setSelectedDoctor(null);
        
        // 立刻重新載入今日資料和當前月份資料
        console.log('開始重新載入資料...');
        await Promise.all([
          loadTodayData(),
          loadEvents(selectedDate)
        ]);
        console.log('資料重新載入完成');
        
      } else {
        // API調用成功但業務邏輯失敗
        const errorMsg = result.message || '更新區域代碼失敗';
        console.error('業務邏輯失敗:', errorMsg);
        setError(errorMsg);
        
        // 即使失敗也關閉抽屜
        setIsDrawerOpen(false);
        setSelectedDoctor(null);
      }
    } catch (err) {
      console.error('更新區域代碼失敗:', err);
      
      // 提取錯誤訊息
      let errorMessage = '更新區域代碼失敗';
      if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      // 錯誤時也關閉抽屜
      setIsDrawerOpen(false);
      setSelectedDoctor(null);
      
      // 即使發生錯誤也嘗試重新載入資料（因為可能實際上已經成功了）
      try {
        console.log('錯誤後嘗試重新載入資料...');
        await Promise.all([
          loadTodayData(),
          loadEvents(selectedDate)
        ]);
        console.log('錯誤後資料重新載入完成');
      } catch (reloadErr) {
        console.error('重新載入資料也失敗:', reloadErr);
      }
    } finally {
      setIsUpdating(false);
    }
  }, [selectedDoctor, loadTodayData, loadEvents, selectedDate]);

  // 新增：處理醫師上下班狀態切換
  const handleToggleActiveStatus = useCallback(async () => {
    if (!selectedDoctor) return;
    
    // 檢查醫師ID是否有效
    if (!selectedDoctor.id) {
      console.error('選中的醫師缺少ID:', selectedDoctor);
      setError('醫師資料無效，無法切換狀態');
      return;
    }
    
    // 判斷是上班還是下班
    const actionText = selectedDoctor.status === 'on_duty' ? '下班' : '上班';
    
    // 顯示確認對話框
    setPendingStatusChange({
      doctor: selectedDoctor,
      actionText: actionText,
      isLeave: false // 這不是請假操作
    });
    setShowStatusConfirmDialog(true);
  }, [selectedDoctor]);

  // 新增：處理醫師請假（包含取消請假）
  const handleDoctorLeave = useCallback(async () => {
    if (!selectedDoctor) return;
    
    // 檢查醫師ID是否有效
    if (!selectedDoctor.id) {
      console.error('選中的醫師缺少ID:', selectedDoctor);
      setError('醫師資料無效，無法設定請假');
      return;
    }
    
    // 判斷是請假還是取消請假 - 使用新的status字段
    const isCurrentlyOnLeave = selectedDoctor.status === 'off';
    const actionText = isCurrentlyOnLeave ? '取消請假' : '請假';
    
    // 顯示確認對話框
    setPendingStatusChange({
      doctor: selectedDoctor,
      actionText: actionText,
      isLeave: !isCurrentlyOnLeave // 如果目前在請假，那麼這次操作是取消請假
    });
    setShowStatusConfirmDialog(true);
  }, [selectedDoctor]);

  // 新增：確認上下班狀態切換
  const confirmStatusChange = useCallback(async () => {
    if (!pendingStatusChange) return;
    
    try {
      setIsUpdating(true);
      const { doctor, isLeave } = pendingStatusChange;
      
      // 使用備用API端點（解決部署同步問題）
      const action = isLeave ? 'toggle-leave' : 'toggle-active';
      
      // 首先嘗試原來的端點
      let response;
      let endpoint = `/doctor-schedules/doctor/${doctor.id}/set-status`;
      
      try {
        response = await api.post(endpoint, { action: action });
      } catch (error) {
        // 如果返回405或其他錯誤，嘗試備用端點
        if (error.response?.status === 405 || error.message.includes('405')) {
          console.log('原端點返回405，嘗試備用端點...');
          endpoint = `/doctor-schedules/update-doctor-status/${doctor.id}`;
          response = await api.post(endpoint, { action: action });
        } else {
          throw error;
        }
      }

      const result = response.data;
      
      if (result.success) {
        // 更新選中的醫師
        if (selectedDoctor && selectedDoctor.id === result.data.id) {
          setSelectedDoctor(prev => ({ ...prev, status: result.data.status }));
        }
        
        // 重新載入資料
        await Promise.all([
          loadTodayData(),
          loadEvents(selectedDate)
        ]);
        
        // 顯示成功訊息
        console.log('狀態切換成功:', result.message);
        
      } else {
        throw new Error(result.message || '狀態切換失敗');
      }
      
    } catch (error) {
      console.error('狀態切換失敗:', error);
      setError(`狀態切換失敗: ${error.message}`);
    } finally {
      setIsUpdating(false);
      setShowStatusConfirmDialog(false);
      setPendingStatusChange(null);
    }
  }, [pendingStatusChange, selectedDoctor, loadTodayData, loadEvents, selectedDate]);

  // 修改：計算今日班表資訊 - 自動檢查工作時間並更新active狀態
  const todayScheduleInfo = useMemo(() => {
    // 使用專門的 todayScheduleData 而不是 rawSchedules
    if (!todayScheduleData) {
      return {
        todayDutyDoctor: [{ name: '無資料', active: true, isDuty: true }],
        todayConsoleDoctor: [{ name: '無資料', active: true }],
        todayORDoctors: [{ name: '無資料', active: true }],
        todayPeripheral3F: [{ name: '無資料', active: true }],
        todayPeripheralAdvanced: [{ name: '無資料', active: true }],
        todayPeripheralTAE: [{ name: '無資料', active: true }],
        offDutyDoctors: [] // 新增已下班醫師列表
      };
    }
    
    // 提取值班醫師 - 值班醫師永遠active=true且不受時間限制
    const todayDutyDoctor = todayScheduleData.值班 ? [{ 
      name: todayScheduleData.值班, 
      active: true, 
      isDuty: true // 標記為值班醫師
    }] : [{ name: '無', active: true, isDuty: true }];
    
    // 從白班中根據area_code分類醫師，並分離已下班醫師
    let todayConsoleDoctor = [];
    let todayORDoctors = [];
    let todayPeripheral3F = [];
    let todayPeripheralAdvanced = [];
    let todayPeripheralTAE = [];
    let offDutyDoctors = []; // 新增：收集所有已下班的醫師
    
    if (todayScheduleData.白班 && Array.isArray(todayScheduleData.白班)) {
      todayScheduleData.白班.forEach((shift, index) => {
        const isInMeeting = isDoctorInMeeting(shift.id);
        
        // 使用資料庫中的active狀態，不再自動修改
        const doctorData = {
          ...shift,
          isInMeeting: isInMeeting // 添加開會狀態
        };
        
        // 檢查是否為已下班狀態
        const isOffDuty = shift.status === 'off_duty' || shift.status === 'off';
        
        if (isOffDuty) {
          // 如果是已下班，加入已下班醫師列表
          offDutyDoctors.push({
            ...doctorData,
            originalAreaCode: shift.area_code // 保留原始區域代碼用於顯示
          });
        } else {
          // 如果是正常上班，按原來的邏輯分類
          const areaCode = shift.area_code;
          
          // 根據後端轉換好的area_code分類
          if (areaCode === '控台醫師') {
            todayConsoleDoctor.push(doctorData);
          } else if (areaCode === '手術室') {
            todayORDoctors.push(doctorData);
          } else if (areaCode === '外圍(3F)') {
            todayPeripheral3F.push(doctorData);
          } else if (areaCode === '外圍(高階)') {
            todayPeripheralAdvanced.push(doctorData);
          } else if (areaCode === '外圍(TAE)') {
            todayPeripheralTAE.push(doctorData);
          }
        }
      });
    }
    
    // 如果沒有資料，填入預設值
    if (todayConsoleDoctor.length === 0) {
      todayConsoleDoctor = [{ name: '無', active: true }];
    }
    if (todayORDoctors.length === 0) {
      todayORDoctors = [{ name: '無', active: true }];
    }
    if (todayPeripheral3F.length === 0) {
      todayPeripheral3F = [{ name: '無', active: true }];
    }
    if (todayPeripheralAdvanced.length === 0) {
      todayPeripheralAdvanced = [{ name: '無', active: true }];
    }
    if (todayPeripheralTAE.length === 0) {
      todayPeripheralTAE = [{ name: '無', active: true }];
    }
    
    const result = {
      todayDutyDoctor,
      todayConsoleDoctor,
      todayORDoctors,
      todayPeripheral3F,
      todayPeripheralAdvanced,
      todayPeripheralTAE,
      offDutyDoctors // 新增已下班醫師列表
    };
    
    return result;
  }, [todayScheduleData, isDoctorInMeeting]); // 依賴改為 todayScheduleData 和相關檢查函數

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
        const matchDoctor = eventText.match(/^([^/值]+)/);
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

  // 新增：自動下班超時醫師 - 移除此功能，改為後端控制
  // useEffect(() => {
  //   // 移除自動更新醫師狀態的前端邏輯
  // }, []);

  // 新增：自動清除錯誤訊息
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 3000); // 3秒後自動清除錯誤訊息
      
      return () => clearTimeout(timer);
    }
  }, [error]);

  // 新增：獲取醫師狀態顯示文字
  const getDoctorStatusText = useCallback((doctor) => {
    if (!doctor) return '';
    
    // 只依賴後端返回的is_in_meeting狀態來判斷是否在開會中
    if (doctor.is_in_meeting) {
      return '（開會中）';
    }
    
    // 檢查是否為請假狀態
    if (doctor.status === 'off') {
      return '（請假）';
    }
    
    // 如果不是上班狀態，則為下班
    if (doctor.status === 'off_duty') {
      return '（已下班）';
    }
    
    return '';
  }, []);

  // 新增：獲取醫師開會時間顯示文字（從後端資料）
  const getDoctorMeetingTimeDisplay = useCallback((doctor) => {
    if (!doctor || !doctor.meeting_time) return '';
    
    // 顯示開會時間，格式如 "（開會：09:00-10:00）"
    return `（開會：${doctor.meeting_time}）`;
  }, []);

  // 新增：處理刪除開會時間
  const handleDeleteMeetingTime = useCallback(async () => {
    if (!selectedDoctor) return;
    
    // 檢查醫師ID是否有效
    if (!selectedDoctor.id) {
      console.error('選中的醫師缺少ID:', selectedDoctor);
      setError('醫師資料無效，無法刪除開會時間');
      return;
    }
    
    try {
      setIsUpdating(true);
      
      console.log(`刪除醫師 ${selectedDoctor.id} (${selectedDoctor.name}) 的開會時間`);
      
      const response = await fetch(`/api/doctor-schedules/doctor/${selectedDoctor.id}/meeting-time/remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('開會時間刪除成功');
        
        // 清除錯誤狀態
        setError(null);
        
        // 立刻重新載入今日資料和當前月份資料
        console.log('開始重新載入資料...');
        await Promise.all([
          loadTodayData(),
          loadEvents(selectedDate)
        ]);
        console.log('資料重新載入完成');
        
        // 更新選中醫師的開會時間資料
        setSelectedDoctor(prev => ({
          ...prev,
          meeting_time: null
        }));
        
        // 清除本地的醫師開會時間記錄
        setDoctorMeetingTimes(prev => {
          const newTimes = { ...prev };
          delete newTimes[selectedDoctor.id];
          return newTimes;
        });
        
        // 成功後自動關閉抽屜，避免焦點問題
        setIsDrawerOpen(false);
        setSelectedDoctor(null);
        
      } else {
        // API調用成功但業務邏輯失敗
        const errorMsg = result.message || '刪除開會時間失敗';
        console.error('業務邏輯失敗:', errorMsg);
        setError(errorMsg);
      }
    } catch (err) {
      console.error('刪除開會時間失敗:', err);
      
      // 提取錯誤訊息
      let errorMessage = '刪除開會時間失敗';
      if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  }, [selectedDoctor, loadTodayData, loadEvents, selectedDate]);

  return (
    <Box sx={{ 
      p: { xs: 0, sm: 2, md: 3 }, // 手機版本移除padding
      width: '100%',
      overflow: 'hidden' // 防止整體頁面溢出
    }}>
      {/* 今日班表資訊 - 多人分格顯示 */}
      <Box sx={{ px: { xs: 2, sm: 0 }, mb: 3 }}>
        <Grid container spacing={1}> {/* 改為spacing={1}縮小間隙 */}
          {/* 控台醫師 - 只在有醫師時顯示 */}
          {todayScheduleInfo.todayConsoleDoctor.some(doctor => doctor.name !== '無' && doctor.name !== '無資料') && 
            todayScheduleInfo.todayConsoleDoctor.map((doctor, index) => (
            <Grid 
              item 
              xs={12}
              key={`console-${index}`}
            >
              <Card sx={{ 
                boxShadow: 'none', 
                border: '1px solid #e0e0e0',
                backgroundColor: AREA_COLOR_MAPPING['控台醫師'],
                color: 'white',
                opacity: (doctor.status === 'off' || doctor.status === 'off_duty' || doctor.is_in_meeting) ? 0.5 : 1,
                cursor: currentUser.role === 'admin' && doctor.name !== '無' && doctor.name !== '無資料' ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                '&:hover': currentUser.role === 'admin' && doctor.name !== '無' && doctor.name !== '無資料' ? {
                  transform: 'scale(1.02)',
                  boxShadow: 'none'
                } : {}
              }}
              onClick={() => currentUser.role === 'admin' && doctor.name !== '無' && doctor.name !== '無資料' && handleDoctorClick(doctor)}
            >
                <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}>
                  <Box>
                    <Typography variant="body1" sx={{ fontSize: { xs: '14px', sm: '16px' }, fontWeight: 'medium' }}>
                    {formatDoctorName(doctor.name, doctorMapping)}
                    {getDoctorStatusText(doctor)}
                    {getDoctorMeetingTimeDisplay(doctor)}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: { xs: '11px', sm: '12px' }, opacity: 0.9 }}>
                      今日控台醫師
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
          
          {/* 手術室醫師 - 只在有醫師時顯示 */}
          {todayScheduleInfo.todayORDoctors.some(doctor => doctor.name !== '無' && doctor.name !== '無資料') && 
            todayScheduleInfo.todayORDoctors.map((doctor, index) => (
            <Grid 
              item 
              xs={12}
              key={`or-${index}`}
            >
              <Card sx={{ 
                boxShadow: 'none', 
                border: '1px solid #e0e0e0',
                backgroundColor: AREA_COLOR_MAPPING['手術室'],
                color: 'white',
                opacity: (doctor.status === 'off' || doctor.status === 'off_duty' || doctor.is_in_meeting) ? 0.5 : 1,
                cursor: currentUser.role === 'admin' && doctor.name !== '無' && doctor.name !== '無資料' ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                '&:hover': currentUser.role === 'admin' && doctor.name !== '無' && doctor.name !== '無資料' ? {
                  transform: 'scale(1.02)',
                  boxShadow: 'none'
                } : {}
              }}
              onClick={() => currentUser.role === 'admin' && doctor.name !== '無' && doctor.name !== '無資料' && handleDoctorClick(doctor)}
            >
                <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}>
                  <Box>
                    <Typography variant="body1" sx={{ fontSize: { xs: '14px', sm: '16px' }, fontWeight: 'medium' }}>
                    {formatDoctorName(doctor.name, doctorMapping)}
                    {getDoctorStatusText(doctor)}
                    {getDoctorMeetingTimeDisplay(doctor)}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: { xs: '11px', sm: '12px' }, opacity: 0.9 }}>
                      手術室
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
          
          {/* 外圍(3F)醫師 - 只在有醫師時顯示 */}
          {todayScheduleInfo.todayPeripheral3F.some(doctor => doctor.name !== '無' && doctor.name !== '無資料') && 
            todayScheduleInfo.todayPeripheral3F.map((doctor, index) => (
            <Grid 
              item 
              xs={12}
              key={`3f-${index}`}
            >
              <Card sx={{ 
                boxShadow: 'none', 
                border: '1px solid #e0e0e0',
                backgroundColor: AREA_COLOR_MAPPING['外圍(3F)'],
                color: 'white',
                opacity: (doctor.status === 'off' || doctor.status === 'off_duty' || doctor.is_in_meeting) ? 0.5 : 1,
                cursor: currentUser.role === 'admin' && doctor.name !== '無' && doctor.name !== '無資料' ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                '&:hover': currentUser.role === 'admin' && doctor.name !== '無' && doctor.name !== '無資料' ? {
                  transform: 'scale(1.02)',
                  boxShadow: 'none'
                } : {}
              }}
              onClick={() => currentUser.role === 'admin' && doctor.name !== '無' && doctor.name !== '無資料' && handleDoctorClick(doctor)}
            >
                <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}>
                  <Box>
                    <Typography variant="body1" sx={{ fontSize: { xs: '14px', sm: '16px' }, fontWeight: 'medium' }}>
                    {formatDoctorName(doctor.name, doctorMapping)}
                    {getDoctorStatusText(doctor)}
                    {getDoctorMeetingTimeDisplay(doctor)}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: { xs: '11px', sm: '12px' }, opacity: 0.9 }}>
                      外圍(3F)
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
          
          {/* 外圍(高階)醫師 - 只在有醫師時顯示 */}
          {todayScheduleInfo.todayPeripheralAdvanced.some(doctor => doctor.name !== '無' && doctor.name !== '無資料') && 
            todayScheduleInfo.todayPeripheralAdvanced.map((doctor, index) => (
            <Grid 
              item 
              xs={12}
              key={`advanced-${index}`}
            >
              <Card sx={{ 
                boxShadow: 'none', 
                border: '1px solid #e0e0e0',
                backgroundColor: AREA_COLOR_MAPPING['外圍(高階)'],
                color: 'white',
                opacity: (doctor.status === 'off' || doctor.status === 'off_duty' || doctor.is_in_meeting) ? 0.5 : 1,
                cursor: currentUser.role === 'admin' && doctor.name !== '無' && doctor.name !== '無資料' ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                '&:hover': currentUser.role === 'admin' && doctor.name !== '無' && doctor.name !== '無資料' ? {
                  transform: 'scale(1.02)',
                  boxShadow: 'none'
                } : {}
              }}
              onClick={() => currentUser.role === 'admin' && doctor.name !== '無' && doctor.name !== '無資料' && handleDoctorClick(doctor)}
            >
                <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}>
                  <Box>
                    <Typography variant="body1" sx={{ fontSize: { xs: '14px', sm: '16px' }, fontWeight: 'medium' }}>
                    {formatDoctorName(doctor.name, doctorMapping)}
                    {getDoctorStatusText(doctor)}
                    {getDoctorMeetingTimeDisplay(doctor)}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: { xs: '11px', sm: '12px' }, opacity: 0.9 }}>
                      外圍(高階)
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
          
          {/* 外圍(TAE)醫師 - 只在有醫師時顯示 */}
          {todayScheduleInfo.todayPeripheralTAE.some(doctor => doctor.name !== '無' && doctor.name !== '無資料') && 
            todayScheduleInfo.todayPeripheralTAE.map((doctor, index) => (
            <Grid 
              item 
              xs={12}
              key={`tae-${index}`}
            >
              <Card sx={{ 
                boxShadow: 'none', 
                border: '1px solid #e0e0e0',
                backgroundColor: AREA_COLOR_MAPPING['外圍(TAE)'],
                color: 'white',
                opacity: (doctor.status === 'off' || doctor.status === 'off_duty' || doctor.is_in_meeting) ? 0.5 : 1,
                cursor: currentUser.role === 'admin' && doctor.name !== '無' && doctor.name !== '無資料' ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                '&:hover': currentUser.role === 'admin' && doctor.name !== '無' && doctor.name !== '無資料' ? {
                  transform: 'scale(1.02)',
                  boxShadow: 'none'
                } : {}
              }}
              onClick={() => currentUser.role === 'admin' && doctor.name !== '無' && doctor.name !== '無資料' && handleDoctorClick(doctor)}
            >
              <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}>
                <Box>
                  <Typography variant="body1" sx={{ fontSize: { xs: '14px', sm: '16px' }, fontWeight: 'medium' }}>
                    {formatDoctorName(doctor.name, doctorMapping)}
                    {getDoctorStatusText(doctor)}
                    {getDoctorMeetingTimeDisplay(doctor)}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: { xs: '11px', sm: '12px' }, opacity: 0.9 }}>
                    外圍(TAE)
                  </Typography>
                </Box>
              </CardContent>
            </Card>
            </Grid>
          ))}
          
          {/* 值班醫師 - 只在有醫師時顯示 */}
          {todayScheduleInfo.todayDutyDoctor.some(doctor => doctor.name !== '無' && doctor.name !== '無資料') && 
            todayScheduleInfo.todayDutyDoctor.map((doctor, index) => (
            <Grid 
              item 
              xs={12}
              key={`duty-${index}`}
            >
              <Card sx={{ 
                boxShadow: 'none', 
                border: '1px solid #e0e0e0',
                backgroundColor: AREA_COLOR_MAPPING['值班'],
                color: 'white',
                opacity: 1, // 值班醫師永遠100%透明度
                cursor: 'default', // 值班醫師不可點擊
                transition: 'all 0.2s ease',
              }}
              // 值班醫師不響應點擊事件
            >
                <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}>
                  <Box>
                    <Typography variant="body1" sx={{ fontSize: { xs: '14px', sm: '16px' }, fontWeight: 'medium' }}>
                    {formatDoctorName(doctor.name, doctorMapping)}
                    {/* 值班醫師不顯示下班或開會狀態 */}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: { xs: '11px', sm: '12px' }, opacity: 0.9 }}>
                      今日值班醫師
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
          
          {/* 已下班醫師 - 統一灰色底，顯示在值班醫師下方 */}
          {todayScheduleInfo.offDutyDoctors && todayScheduleInfo.offDutyDoctors.length > 0 && 
            todayScheduleInfo.offDutyDoctors.map((doctor, index) => (
            <Grid 
              item 
              xs={12}
              key={`off-duty-${index}`}
            >
              <Card sx={{ 
                boxShadow: 'none', 
                border: '1px solid #e0e0e0',
                backgroundColor: '#9e9e9e', // 統一灰色背景
                color: 'white',
                opacity: 0.8, // 稍微降低透明度
                cursor: currentUser.role === 'admin' ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                '&:hover': currentUser.role === 'admin' ? {
                  transform: 'scale(1.02)',
                  boxShadow: 'none'
                } : {}
              }}
              onClick={() => currentUser.role === 'admin' && handleDoctorClick(doctor)}
            >
                <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}>
                  <Box>
                    <Typography variant="body1" sx={{ fontSize: { xs: '14px', sm: '16px' }, fontWeight: 'medium' }}>
                    {formatDoctorName(doctor.name, doctorMapping)}
                    {getDoctorStatusText(doctor)}
                    {getDoctorMeetingTimeDisplay(doctor)}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: { xs: '11px', sm: '12px' }, opacity: 0.9 }}>
                      已下班 - {doctor.originalAreaCode || '未分類'}
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
        <DialogTitle sx={{ pb: 1, pr: 6, position: 'relative' }}>
          <Typography variant="h6" component="div">
            {selectedDayData?.date && format(selectedDayData.date, 'yyyy年MM月dd日 (EEEE)', { locale: zhTW })}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            班表詳細資訊
          </Typography>
          <IconButton
            aria-label="關閉"
            onClick={handleCloseDialog}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ pt: 1 }}>
          {selectedDayData?.events && selectedDayData.events.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {selectedDayData.events
                .sort((a, b) => {
                  // 解析summary中斜線後面的英文字母進行排序
                  const getPositionCode = (event) => {
                    const eventText = event.summary || event.title || '';
                    
                    // 值班醫師排在最前面
                    if (eventText.includes('值班')) {
                      return 'Z-值班'; // 用Z開頭確保值班排在最前
                    }
                    
                    // 提取斜線後面的字母（如 "張醫師/A" 中的 "A"）
                    if (eventText.includes('/')) {
                      const parts = eventText.split('/');
                      if (parts.length > 1) {
                        const positionCode = parts[1].trim().charAt(0); // 只取第一個字符
                        return positionCode;
                      }
                    }
                    
                    // 沒有斜線的排到最後
                    return 'ZZ';
                  };
                  
                  const codeA = getPositionCode(a);
                  const codeB = getPositionCode(b);
                  
                  // 按字母順序排序（A、B、C、D、E、F）
                  return codeA.localeCompare(codeB);
                })
                .map((event, index) => {
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
                    backgroundColor = AREA_COLOR_MAPPING['手術室'];
                  } else if (eventText.includes('/C')) {
                    backgroundColor = AREA_COLOR_MAPPING['外圍(3F)'];
                  } else if (eventText.includes('/D')) {
                    backgroundColor = AREA_COLOR_MAPPING['外圍(高階)'];
                  } else if (eventText.includes('/F')) {
                    backgroundColor = AREA_COLOR_MAPPING['外圍(TAE)'];
                  }

                  return (
                    <Card 
                      key={index} 
                      sx={{ 
                        backgroundColor: backgroundColor,
                        color: textColor,
                        boxShadow: 'none'
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
      </Dialog>

      {/* 新增：醫師管理抽屜 */}
      <Drawer
        anchor="bottom"
        open={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedDoctor(null);
          // 清理會議時間選擇器狀態
          setShowMeetingTimePicker(false);
          resetMeetingTimePicker();
        }}
        disablePortal={false}
        disableEnforceFocus={false}
        disableAutoFocus={false}
        disableRestoreFocus={false}
        keepMounted={false}
        PaperProps={{
          sx: {
            maxWidth: '600px',
            margin: '0 auto',
            padding: 3,
          },
          // 確保抽屜內容可以正確接收焦點
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': 'drawer-title'
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" id="drawer-title" sx={{ textAlign: 'center', flex: 1 }}>
              麻醉醫師動態更新
            </Typography>
            <IconButton
              onClick={() => {
                setIsDrawerOpen(false);
                setSelectedDoctor(null);
                setShowMeetingTimePicker(false);
                resetMeetingTimePicker();
              }}
              size="small"
              sx={{ ml: 1 }}
              aria-label="關閉醫師管理面板"
            >
              <CloseIcon />
            </IconButton>
          </Box>
          
          {selectedDoctor && (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                醫師：{formatDoctorName(selectedDoctor.name, doctorMapping)}
              </Typography>
              
              <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                上班時間：{selectedDoctor.time}
              </Typography>
              
              {/* 顯示已設定的開會時間 */}
              {selectedDoctor.meeting_time && (
                <Box sx={{ mb: 2, p: 2, backgroundColor: 'rgba(25, 118, 210, 0.08)', borderRadius: 1, border: '1px solid rgba(25, 118, 210, 0.23)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                        已設定開會時間
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                        {selectedDoctor.meeting_time}
                      </Typography>
                    </Box>
                    <IconButton
                      onClick={handleDeleteMeetingTime}
                      disabled={isUpdating}
                      color="error"
                      size="small"
                      sx={{
                        '&:hover': {
                          backgroundColor: 'rgba(211, 47, 47, 0.08)'
                        }
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              )}
              
              {/* 區域代碼選擇 - 移除label，選擇後自動提交 */}
              <FormControl fullWidth sx={{ mb: 3 }}>
                <Select
                  value={newAreaCode}
                  onChange={(e) => {
                    setNewAreaCode(e.target.value);
                    handleAreaCodeChange(e.target.value);
                  }}
                  displayEmpty
                  disabled={isUpdating}
                >
                  <MenuItem value="" disabled>
                    選擇區域
                  </MenuItem>
                  {areaCodeOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {/* 開會時間選擇器 */}
              {showMeetingTimePicker && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    {meetingTimeStep === 'start' ? '設定開會開始時間' : '設定開會結束時間'}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* 自定義時間選擇下拉選單 */}
                    <FormControl 
                      fullWidth
                      ref={meetingTimeStep === 'end' ? endTimeSelectRef : null}
                    >
                      <Select
                        value={(() => {
                          const time = meetingTimeStep === 'start' ? meetingStartTime : meetingEndTime;
                          if (!time) return '';
                          return `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
                        })()}
                        onChange={(e) => {
                          const timeStr = e.target.value;
                          if (!timeStr) return;
                          
                          const [hours, minutes] = timeStr.split(':').map(Number);
                          const now = new Date();
                          const selectedTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
                          handleTimeSelect(selectedTime);
                        }}
                        displayEmpty
                        data-testid={meetingTimeStep === 'end' ? 'end-time-select' : 'start-time-select'}
                      >
                        <MenuItem value="" disabled>
                          {meetingTimeStep === 'start' ? '選擇開始時間' : '選擇結束時間'}
                        </MenuItem>
                        {(() => {
                          if (!selectedDoctor) return [];
                          
                          const workingTime = parseWorkingTime(selectedDoctor.time);
                          if (!workingTime) return [];
                          
                          const options = [];
                          const startHour = workingTime.startHour;
                          const startMinute = workingTime.startMinute;
                          const endHour = workingTime.endHour;
                          const endMinute = workingTime.endMinute;
                          
                          // 生成30分鐘間隔的時間選項
                          for (let hour = startHour; hour <= endHour; hour++) {
                            // 決定這個小時內的分鐘範圍
                            const minMinute = (hour === startHour) ? Math.ceil(startMinute / 30) * 30 : 0;
                            const maxMinute = (hour === endHour) ? endMinute : 60;
                            
                            for (let minute = minMinute; minute < maxMinute; minute += 30) {
                              const timeInMinutes = hour * 60 + minute;
                              const startTimeInMinutes = startHour * 60 + startMinute;
                              const endTimeInMinutes = endHour * 60 + endMinute;
                              
                              // 檢查是否在工作時間範圍內
                              if (timeInMinutes < startTimeInMinutes || timeInMinutes >= endTimeInMinutes) {
                                continue;
                              }
                              
                              // 如果是選擇結束時間，確保晚於開始時間
                              if (meetingTimeStep === 'end' && meetingStartTime) {
                                const meetingStartTimeInMinutes = meetingStartTime.getHours() * 60 + meetingStartTime.getMinutes();
                                if (timeInMinutes <= meetingStartTimeInMinutes) {
                                  continue;
                                }
                              }
                              
                              const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                              options.push(
                                <MenuItem key={timeStr} value={timeStr}>
                                  {timeStr}
                                </MenuItem>
                              );
                            }
                          }
                          
                          return options;
                        })()}
                      </Select>
                    </FormControl>
                    
                    {/* 顯示已選擇的時間 */}
                    {meetingStartTime && (
                      <Typography variant="body2" color="text.secondary">
                        開始時間：{meetingStartTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </Typography>
                    )}
                    {meetingEndTime && (
                      <Typography variant="body2" color="text.secondary">
                        結束時間：{meetingEndTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </Typography>
                    )}
                    
                    {/* 按鈕組 */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {meetingStartTime && meetingEndTime && (
                        <Button
                          variant="contained"
                          onClick={handleSetMeetingTime}
                          sx={{ 
                            flex: 1,
                            boxShadow: 'none',
                            '&:hover': {
                              boxShadow: 'none'
                            }
                          }}
                        >
                          確認
                        </Button>
                      )}
                      
                      <Button
                        variant="outlined"
                        onClick={resetMeetingTimePicker}
                        sx={{ 
                          flex: 1,
                          boxShadow: 'none',
                          '&:hover': {
                            boxShadow: 'none'
                          }
                        }}
                      >
                        取消
                      </Button>
                    </Box>
                  </Box>
                </Box>
              )}
              
              {/* 按鈕組 - 均分寬度 */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  color={selectedDoctor.status === 'on_duty' ? 'primary' : 'warning'}
                  onClick={handleToggleActiveStatus}
                  disabled={isUpdating}
                  sx={{ 
                    flex: 1,
                    boxShadow: 'none',
                    '&:hover': {
                      boxShadow: 'none'
                    }
                  }}
                >
                  {selectedDoctor.status === 'on_duty' ? '下班' : '上班'}
                </Button>
                
                <Button
                  variant={selectedDoctor.status === 'off' ? 'outlined' : 'contained'}
                  color="error"
                  onClick={handleDoctorLeave}
                  disabled={isUpdating}
                  sx={{ 
                    flex: 1,
                    boxShadow: 'none',
                    backgroundColor: selectedDoctor.status === 'off' ? 'transparent' : '#d32f2f',
                    borderColor: '#d32f2f',
                    color: selectedDoctor.status === 'off' ? '#d32f2f' : '#fff',
                    '&:hover': {
                      boxShadow: 'none',
                      backgroundColor: selectedDoctor.status === 'off' ? 'rgba(211, 47, 47, 0.04)' : '#c62828',
                      borderColor: '#d32f2f'
                    }
                  }}
                >
                  {selectedDoctor.status === 'off' ? '取消請假' : '請假'}
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<ScheduleIcon />}
                  onClick={() => {
                    if (showMeetingTimePicker) {
                      resetMeetingTimePicker();
                    } else {
                      setShowMeetingTimePicker(true);
                    }
                  }}
                  disabled={isUpdating}
                  sx={{ 
                    flex: 1,
                    boxShadow: 'none',
                    '&:hover': {
                      boxShadow: 'none'
                    }
                  }}
                >
                  {showMeetingTimePicker ? '取消' : '會議'}
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Drawer>

      {/* 新增：上下班確認對話框 */}
      <Dialog
        open={showStatusConfirmDialog}
        onClose={() => {
          setShowStatusConfirmDialog(false);
          setPendingStatusChange(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>確認{pendingStatusChange?.actionText}</DialogTitle>
        <DialogContent>
          <Typography>
            確定要將 {formatDoctorName(pendingStatusChange?.doctor?.name, doctorMapping)} 設為{pendingStatusChange?.actionText}狀態嗎？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setShowStatusConfirmDialog(false);
              setPendingStatusChange(null);
            }}
            color="inherit"
            sx={{
              boxShadow: 'none',
              '&:hover': {
                boxShadow: 'none'
              }
            }}
          >
            取消
          </Button>
          <Button 
            onClick={confirmStatusChange}
            variant="contained"
            disabled={isUpdating}
            sx={{
              boxShadow: 'none',
              '&:hover': {
                boxShadow: 'none'
              }
            }}
          >
            確認
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DoctorSchedule;