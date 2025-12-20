import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  Avatar,
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
import { SHIFT_COLORS } from '../constants/shiftSwapConstants';
import useWebSocket from '../hooks/useWebSocket';
import { doctorScheduleService } from '../utils/api';
import { formatDoctorName, getDoctorMapping } from '../utils/doctorUtils';
import NurseCalendar from '../components/common/NurseCalendar';

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

// 班別顏色已在 NurseCalendar 組件中定義，這裡移除重複定義

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

// 醫師班表區域代碼對應的顏色映射
const DOCTOR_AREA_COLOR_MAPPING = {
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



// 醫師班表日曆單元格渲染組件
const RenderDoctorCalendarCell = ({ day }) => {
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
        opacity: isPastDate ? 0.5 : 1,
        overflow: 'hidden',
        padding: '0.5px',
      }}
    >
      {/* 日期顯示在最上方 */}
      <Box sx={{ 
        textAlign: 'right',
        padding: { xs: '2px 4px', sm: '3px 6px' },
        fontWeight: 'bold',
        fontSize: { xs: '12px', sm: '16px' },
        width: '100%',
        opacity: isPastDate ? 0.6 : 1,
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
        gap: { xs: '0.5px', sm: '1px' },
        overflow: 'hidden',
        flex: 1,
        width: '100%',
        mt: { xs: 0.1, sm: 0.25 },
        maxHeight: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 16px)' },
      }}>
        {day.events && day.events.map((event, index) => {
          let eventText = event.summary || event.title || '';
          let backgroundColor = '#9e9e9e';
          let textColor = 'white';
          
          // 根據summary的內容決定顏色
          if (eventText.includes('值班')) {
            backgroundColor = DOCTOR_AREA_COLOR_MAPPING['值班'];
          } else if (eventText.includes('加班')) {
            backgroundColor = DOCTOR_AREA_COLOR_MAPPING['加班'];
          } else if (eventText.includes('代班')) {
            backgroundColor = DOCTOR_AREA_COLOR_MAPPING['代班'];
          } else if (eventText.includes('/A')) {
            backgroundColor = DOCTOR_AREA_COLOR_MAPPING['控台醫師'];
          } else if (eventText.includes('/B') || eventText.includes('/E')) {
            backgroundColor = DOCTOR_AREA_COLOR_MAPPING['手術室'];
          } else if (eventText.includes('/C')) {
            backgroundColor = DOCTOR_AREA_COLOR_MAPPING['外圍(3F)'];
          } else if (eventText.includes('/D') && !eventText.match(/\/D\s+\w/)) {
            backgroundColor = DOCTOR_AREA_COLOR_MAPPING['外圍(高階)'];
          } else if (eventText.includes('/F')) {
            backgroundColor = DOCTOR_AREA_COLOR_MAPPING['外圍(TAE)'];
          } else if (eventText.match(/\/D\s+\w/)) {
            backgroundColor = DOCTOR_AREA_COLOR_MAPPING['手術室'];
          }
          
          return (
            <Box 
              key={index}
              sx={{ 
                fontSize: { xs: '11px', sm: '13px' },
                padding: { xs: '1px 2px', sm: '2px 4px' },
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
                minHeight: { xs: '16px', sm: '20px' },
                maxWidth: '100%',
                backgroundColor: backgroundColor,
                color: textColor,
                fontWeight: 500,
                lineHeight: 1.1,
                boxShadow: 'none',
                transition: 'all 0.2s ease',
                flexShrink: 0,
                '&:hover': {
                  transform: isPastDate ? 'none' : 'scale(1.02)',
                  boxShadow: 'none'
                }
              }}
              title={eventText}
            >
              <span style={{ 
                overflow: 'hidden', 
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
                display: 'block',
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

// 🚀 直接使用 ShiftSwap 成功的日曆單元格組件


function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    selectedDate, // 獲取存儲中的選定日期
    updateSelectedDate // 獲取更新日期的函數
  } = useScheduleStore();

  // 啟用 WebSocket 連接
  const {
    isConnected: wsConnected,
    connectionError: wsError,
    onlineUsers: wsOnlineUsers,
    on: wsOn,
    off: wsOff
  } = useWebSocket();
  
  // 🗑️ 不再使用 store 的班表數據，改用 ShiftSwap 模式直接獲取
  // monthlySchedule, isLoading: scheduleLoading, fetchMonthlySchedule - 已移除

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

  // 醫師班表相關狀態
  const [doctorScheduleData, setDoctorScheduleData] = useState(null);
  const [doctorCalendarData, setDoctorCalendarData] = useState([]);
  const [doctorMapping, setDoctorMapping] = useState({});
  const [isDoctorScheduleLoading, setIsDoctorScheduleLoading] = useState(false);

  // 🗑️ 舊的狀態變數已被 ShiftSwap 模式替代
  // const [isAreaAssignmentLoading, setIsAreaAssignmentLoading] = useState(false); - 已移除

  // 新增加班數據狀態
  const [overtimeData, setOvertimeData] = useState(null);

  // 新增公告詳情狀態
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [isAnnouncementDetailOpen, setIsAnnouncementDetailOpen] = useState(false);

  const [showPasskeyDialog, setShowPasskeyDialog] = useState(false);

  // 在線用戶狀態（從 WebSocket 獲取，加上班表信息處理）
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [onlineUsersLoading, setOnlineUsersLoading] = useState(true);

  const today = useMemo(() => startOfToday(), []);
  const todayDate = useMemo(() => getDate(today), [today]); // 日 (1-31)
  const currentMonth = useMemo(() => getMonth(today), [today]); // 月 (0-11)
  const currentYear = useMemo(() => getYear(today), [today]); // 年

  // 判斷用戶是否正在上班的函數
  const isUserCurrentlyWorking = (userShift) => {
    if (!userShift || ['O', 'V', 'R', ''].includes(userShift)) {
      return false; // 休假班不算上班
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour + currentMinute / 60; // 轉為小數表示

    // 根據班別判斷工作時間
    switch (userShift) {
      case 'A': // 8-16
        return currentTime >= 8 && currentTime < 16;
      case 'B': // 8-17
        return currentTime >= 8 && currentTime < 17;
      case 'N': // 14-22
        return currentTime >= 14 && currentTime < 22;
      case 'D': // 22-08 (跨日班)
        return currentTime >= 22 || currentTime < 8;
      case 'E': // 8-12
        return currentTime >= 8 && currentTime < 12;
      case 'K': // 9-17
        return currentTime >= 9 && currentTime < 17;
      case 'C': // 10-18
        return currentTime >= 10 && currentTime < 18;
      case 'F': // 12-20
        return currentTime >= 12 && currentTime < 20;
      default:
        return false;
    }
  };

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

  // 🚀 使用 ShiftSwap 模式：一次性獲取所有數據
  useEffect(() => {
    if (!user) return;

    const needsUpdate = getMonth(selectedDate) !== currentMonth || getYear(selectedDate) !== currentYear;
    
    if (needsUpdate) {
      console.log('Dashboard: selectedDate 需要更新到當前月份');
      updateSelectedDate(today);
       return;
    }

    // 當用戶和日期都正確時，獲取完整的月度數據
    console.log('Dashboard: 開始獲取完整的月度數據 (ShiftSwap 模式)');
    fetchCompleteMonthData();
  }, [user, selectedDate, currentMonth, currentYear, updateSelectedDate, today]);

  // 🚀 完全複製 ShiftSwap 的數據獲取邏輯
  const fetchCompleteMonthData = async () => {
    if (!user) return;
    
    setIsLoading(true); 
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;
      
      console.log(`Dashboard: 獲取 ${year}年${month}月 的完整數據`);
      
      // 🚀 使用 ShiftSwap 相同的 API 調用方式
      // 1. 獲取月班表
      const monthlyResponse = await apiService.schedule.getMonthlySchedule(year, month);
      console.log('Dashboard 月班表API響應:', monthlyResponse.data);
      
      // 2. 獲取工作分配（使用緩存）
      const weeklyResponse = await cachedScheduleDetailsRequest(apiService, 'dashboard', year, month);
      console.log('Dashboard 工作分配API響應:', weeklyResponse.data);
      
      // 3. 獲取加班記錄
      const startDateStr = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
      const endDateStr = format(endOfMonth(selectedDate), 'yyyy-MM-dd');
      const overtimeResponse = await apiService.overtime.getMyRecords(startDateStr, endDateStr);
      console.log('Dashboard 加班記錄API響應:', overtimeResponse.data);
      
      // 格式化加班數據
      const formattedOvertimeData = {
        records: Array.isArray(overtimeResponse.data) ? overtimeResponse.data : []
      };
      
      // 🚀 使用 ShiftSwap 相同的數據處理方式
      generateShiftSwapCalendarData(
        selectedDate,
        monthlyResponse.data || {},
        weeklyResponse.data || {},
        formattedOvertimeData
      );
      
      // 處理今日工作信息
      processTodayWorkFromShiftSwapData(monthlyResponse.data, weeklyResponse.data, formattedOvertimeData);
      
    } catch (error) {
      console.error('Dashboard: 獲取月度數據時出錯:', error);
      setMonthlyCalendarData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 🚀 完全複製 ShiftSwap 的 generateCalendarData 函數
  const generateShiftSwapCalendarData = (date, scheduleData, assignmentData, overtimeData) => {
    try {
      console.log("===== Dashboard: 開始生成ShiftSwap月曆數據 =====");
      
      const startDate = startOfMonth(date);
      const endDate = endOfMonth(date);
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      
      // 初始化日曆數據結構
      const calendar = [];
      let week = [];
      
      // 填充月份開始前的空白單元格
      // 調整 getDay 結果：週一=0, 週二=1, ..., 週日=6
      const firstDay = (getDay(startDate) + 6) % 7;
      for (let i = 0; i < firstDay; i++) {
        week.push({ date: null });
      }
      
      // 安全獲取用戶ID
      const userId = user?.id || '';
      if (!userId) {
        console.warn("Dashboard: 用戶ID為空，無法獲取班表數據");
      }
      
      // 紀錄找到的班別數量，用於診斷
      let foundShiftsCount = 0;
      
      console.log("Dashboard 用戶ID:", userId);
      
      // 獲取年月
      const year = format(date, 'yyyy');
      const month = format(date, 'M'); // 不帶前導零的月份
      
      console.log(`Dashboard 嘗試獲取 ${year}年${month}月的班表數據`);
      console.log("Dashboard scheduleData類型:", typeof scheduleData);
      console.log("Dashboard scheduleData結構:", JSON.stringify(scheduleData).substring(0, 300) + "...");
      
      let userShifts = [];
      
      // 正確解析API返回的數據結構
      if (scheduleData && scheduleData.data && scheduleData.data[year] && scheduleData.data[year][month]) {
        console.log(`Dashboard 找到 ${year}年${month}月的班表數據，開始處理...`);
        
        const nurseSchedules = scheduleData.data[year][month].schedule || [];
        console.log(`Dashboard 班表中包含 ${nurseSchedules.length} 個護理師資料`);
        
        // 尋找當前用戶的班表
        const userSchedule = nurseSchedules.find(nurse => String(nurse.id) === String(userId));
        
        if (userSchedule) {
          console.log(`Dashboard 找到用戶 ${userId} (${userSchedule.name}) 的班表數據`);
          userShifts = userSchedule.shifts || [];
          console.log(`Dashboard 用戶班表天數: ${userShifts.length}`);
          console.log(`Dashboard 班表內容: ${userShifts.join(', ')}`);
    } else {
          console.warn(`Dashboard 在 ${nurseSchedules.length} 名護理師中未找到ID=${userId}的用戶班表`);
          console.log("Dashboard 所有護理師ID:", nurseSchedules.map(nurse => nurse.id).join(", "));
        }
      } else {
        console.warn("Dashboard 無法從數據中提取用戶班表");
      }
      
      // 如果沒有找到用戶班表，記錄警告但繼續使用空班表
      if (!userShifts || userShifts.length === 0) {
        console.warn("Dashboard 未找到用戶班表數據，將使用空班表");
        userShifts = Array(31).fill('O'); // 默認全部休假
      }
      
      // 處理月份中的每一天
      days.forEach((day, index) => {
        const dateString = format(day, 'yyyy-MM-dd');
        
        // 初始化為休假，如果找不到數據
        let shift = 'O';
        let mission = '';
        let overtime = '';
        let overtimeShift = '';
        let hasOvertime = false;
        
        try {
          // 從班表數據中獲取當天的班別
          if (userShifts && userShifts.length > 0) {
            // 日期索引，從0開始
            const dayOfMonth = parseInt(format(day, 'd')) - 1;
            
            if (dayOfMonth >= 0 && dayOfMonth < userShifts.length) {
              shift = userShifts[dayOfMonth] || 'O';
              foundShiftsCount++;
              console.log(`Dashboard ${dateString}: 班別=${shift}`);
            }
          }
          
          // 獲取工作分配
          const matchingRecord = assignmentData && Array.isArray(assignmentData.data) 
            ? assignmentData.data.find(record => 
                record.date === dateString && String(record.user_id) === String(userId)
              )
            : null;
            
          if (matchingRecord && matchingRecord.area_code) {
            mission = matchingRecord.area_code;
            console.log(`Dashboard ${dateString}: 找到工作分配: ${mission}`);
          }
          
          // 獲取加班記錄
          if (overtimeData && overtimeData.records) {
            const dayOvertime = overtimeData.records.find(record => 
              record.date === dateString
            );
            
            if (dayOvertime) {
              // 獲取加班班種
              overtimeShift = dayOvertime.overtime_shift || '';
              overtime = `加班${overtimeShift ? `(${overtimeShift})` : ''}`;
              hasOvertime = true;
              console.log(`Dashboard 找到 ${dateString} 的加班記錄: ${overtimeShift}`);
            }
          }
        } catch (err) {
          console.warn(`Dashboard 處理 ${dateString} 的班表數據時出錯:`, err.message);
        }
        
        // 添加日期項到當前週
        week.push({ 
          date: day, 
          shift, 
          mission, 
          overtime,
          overtimeShift,
          isOvertimeDay: hasOvertime
        });
        
        // 如果是一週的最後一天或是月份的最後一天
        // 調整判斷條件：週日對應6
        if ((getDay(day) + 6) % 7 === 6 || format(day, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')) {
          calendar.push([...week]);
          week = [];
        }
      });
      
      // 調試日曆數據
      console.log(`Dashboard 生成了 ${calendar.length} 週的日曆數據，找到 ${foundShiftsCount} 天的班別數據`);
      
      setMonthlyCalendarData(calendar);
      return calendar;
    } catch (err) {
      console.error('Dashboard: 生成月曆數據時出錯:', err);
      setMonthlyCalendarData([]);
      return [];
    }
  };

  // 處理今日工作信息（使用 ShiftSwap 數據格式）
  const processTodayWorkFromShiftSwapData = (scheduleData, assignmentData, overtimeData) => {
    try {
      if (!user) {
        setTodayWork({ shift: '', areaCode: null, details: getShiftInfo('') });
        return;
      }

      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const dayIndex = todayDate - 1;
      const userId = user.id;
      const todayDateString = format(today, 'yyyy-MM-dd');

      let shiftType = 'O';
      let areaCode = null;

      // 從班表數據獲取今日班別
      if (scheduleData && scheduleData.data && scheduleData.data[year] && scheduleData.data[year][month]) {
        const nurseSchedules = scheduleData.data[year][month].schedule || [];
        const userSchedule = nurseSchedules.find(nurse => String(nurse.id) === String(userId));
        
        if (userSchedule && userSchedule.shifts) {
          shiftType = userSchedule.shifts[dayIndex] || 'O';
          console.log(`Dashboard 今日班別: ${shiftType}`);
        }
      }

      // 從工作分配數據獲取今日工作區域
      if (assignmentData && Array.isArray(assignmentData.data)) {
        const todayAssignment = assignmentData.data.find(record => 
          record.date === todayDateString && String(record.user_id) === String(userId)
        );
        
        if (todayAssignment && todayAssignment.area_code) {
          areaCode = todayAssignment.area_code;
          console.log(`Dashboard 今日工作區域: ${areaCode}`);
        }
      }

      setTodayWork({ 
        shift: shiftType, 
        areaCode: areaCode,
        details: getShiftInfo(shiftType) 
      });
    } catch (error) {
      console.error('Dashboard: 處理今日工作信息時出錯:', error);
      setTodayWork({ shift: '', areaCode: null, details: getShiftInfo('') });
    }
  };

  // 生成月曆數據的函數（舊版本，保留以防需要）
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
      // 調整 getDay 結果：週一=0, 週二=1, ..., 週日=6
      const firstDay = (getDay(startDate) + 6) % 7;
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
        // 調整判斷條件：週日對應6
        if ((getDay(day) + 6) % 7 === 6 || format(day, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')) {
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

  // 🗑️ 舊的數據處理函數已被 ShiftSwap 模式替代
  // const processScheduleData = () => { ... } - 已移除

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

  // 處理從 WebSocket 接收的在線用戶數據（加上班表信息）
  const processOnlineUsersData = useCallback(async (wsUsers) => {
    if (!user || !wsUsers) {
      setOnlineUsersLoading(false);
      return;
    }

    try {
      setOnlineUsersLoading(true);

      // 獲取當月班表資料（用於批量獲取所有用戶班表）
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const dayIndex = getDate(today) - 1;

      let scheduleData = null;
      try {
        const scheduleResponse = await apiService.schedule.getMonthlySchedule(year, month);
        if (scheduleResponse.data && scheduleResponse.data.data &&
            scheduleResponse.data.data[year] && scheduleResponse.data.data[year][month]) {
          scheduleData = scheduleResponse.data.data[year][month].schedule || [];
        }
      } catch (error) {
        console.log('無法獲取月班表資料，將使用默認班表:', error);
      }

      // 處理所有在線用戶的班表信息
      const usersWithShifts = wsUsers.map((onlineUser) => {
        let userShift = 'O'; // 默認休假

        try {
          // 從班表數據中查找該用戶的今日班表
          if (scheduleData) {
            const userSchedule = scheduleData.find(nurse => String(nurse.id) === String(onlineUser.id));
            if (userSchedule && userSchedule.shifts && userSchedule.shifts[dayIndex]) {
              userShift = userSchedule.shifts[dayIndex];
            }
          }

          // 如果是當前登入用戶，且有月曆數據，優先使用月曆數據
          if (String(onlineUser.id) === String(user.id) && monthlyCalendarData.length > 0) {
            const todayData = monthlyCalendarData
              .flat()
              .find(day => day.date && format(day.date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'));

            if (todayData && todayData.shift) {
              userShift = todayData.shift;
            }
          }
        } catch (error) {
          console.log(`處理用戶 ${onlineUser.full_name} 的班表時出錯:`, error);
          // 使用默認值 'O'，確保用戶仍然顯示在線狀態
        }

        return {
          ...onlineUser,
          todayShift: userShift,
          isWorking: isUserCurrentlyWorking(userShift)
        };
      });

      setOnlineUsers(usersWithShifts);
    } catch (err) {
      console.error("處理在線用戶數據失敗:", err);
    } finally {
      setOnlineUsersLoading(false);
    }
  }, [user, today, monthlyCalendarData, isUserCurrentlyWorking]);

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

  // 獲取醫師班表數據的函數
  const fetchDoctorScheduleData = async () => {
    if (!user) return;
    
    try {
      setIsDoctorScheduleLoading(true);
      
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;
      
      // 獲取當月醫師班表
      const startDate = format(startOfMonth(selectedDate), 'yyyyMMdd');
      const endDate = format(endOfMonth(selectedDate), 'yyyyMMdd');
      
      const response = await doctorScheduleService.getEventsInDateRange(startDate, endDate);
      const responseData = response.data || {};
      
      // 處理今日班表資料
      const today = format(new Date(), 'yyyyMMdd');
      const todaySchedule = responseData.schedules?.find(schedule => schedule.date === today);
      setDoctorScheduleData(todaySchedule);
      
      // 處理月曆數據
      const eventsData = [];
      if (responseData.schedules && Array.isArray(responseData.schedules)) {
        responseData.schedules.forEach(daySchedule => {
          const dayDate = daySchedule.date;
          
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
          
          // 處理白班資訊
          if (daySchedule.白班 && Array.isArray(daySchedule.白班)) {
            daySchedule.白班.forEach(shift => {
              eventsData.push({
                title: shift.summary,
                summary: shift.summary,
                start: { date: dayDate },
                time: shift.time,
                type: '白班',
                name: shift.name,
                area_code: shift.area_code,
                id: shift.id
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
      }
      
      // 生成醫師月曆數據
      generateDoctorCalendarData(selectedDate, eventsData);
      
    } catch (err) {
      console.error('獲取醫師班表失敗:', err);
    } finally {
      setIsDoctorScheduleLoading(false);
    }
  };

  // 生成醫師月曆數據
  const generateDoctorCalendarData = (date, eventsData) => {
    try {
      const startDate = startOfMonth(date);
      const endDate = endOfMonth(date);
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      
      const calendar = [];
      let week = [];
      
      const firstDay = (getDay(startDate) + 6) % 7;
      for (let i = 0; i < firstDay; i++) {
        week.push({ date: null });
      }
      
      days.forEach(day => {
        const dayString = format(day, 'yyyy-MM-dd');
        
        const dayEvents = eventsData.filter(event => {
          let eventDate = null;
          
          if (event.start && event.start.date) {
            const dateStr = event.start.date;
            if (dateStr && dateStr.length === 8) {
              eventDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
            }
          }
          
          // 過濾掉范守仁的事件
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
        
        if ((getDay(day) + 6) % 7 === 6 || format(day, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')) {
          calendar.push([...week]);
          week = [];
        }
      });
      
      setDoctorCalendarData(calendar);
      
    } catch (err) {
      console.error('生成醫師月曆數據時出錯:', err);
      setDoctorCalendarData([]);
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

  // 初始化醫師資料映射
  useEffect(() => {
    const mapping = getDoctorMapping();
    setDoctorMapping(mapping);
  }, []);

  // 在使用者登入後獲取公告和換班請求
  useEffect(() => {
    if (user) {
      fetchLatestAnnouncements();
      fetchShiftSwapRequests();
      
      // 根據用戶角色決定載入哪種班表
      if (user.role === 'doctor' || user.role === 'admin') {
        fetchDoctorScheduleData();
      } else {
      fetchOvertimeData();
    }
    }
  }, [user, selectedDate]); // 加入selectedDate依賴，確保月份變更時重新獲取班表數據

  // WebSocket 在線用戶更新處理
  useEffect(() => {
    if (!user) return;

    // 當收到 WebSocket 在線用戶更新時，處理班表信息
    const handleOnlineUsersUpdate = (users) => {
      console.log('[Dashboard] 收到在線用戶更新:', users);
      processOnlineUsersData(users);
    };

    // 註冊 WebSocket 事件處理器
    wsOn('onlineUsersUpdate', handleOnlineUsersUpdate);

    // 初始處理一次（如果 WebSocket 已有數據）
    if (wsOnlineUsers && wsOnlineUsers.length > 0) {
      processOnlineUsersData(wsOnlineUsers);
    }

    return () => {
      // 清理事件處理器
      wsOff('onlineUsersUpdate');
    };
  }, [user, wsOn, wsOff, wsOnlineUsers, processOnlineUsersData]);

  // 🗑️ 舊的複雜 Effect 和函數已被 ShiftSwap 模式替代
  // Effect 4, fetchWorkAreaAssignments, processScheduleDataWithAreaCodes - 已移除

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

  // 新增：計算醫師今日班表資訊
  const doctorTodayScheduleInfo = useMemo(() => {
    if (!doctorScheduleData) {
      return {
        todayDutyDoctor: [{ name: '無', active: true, isDuty: true }],
        todayConsoleDoctor: [{ name: '無資料', active: true }],
        todayORDoctors: [{ name: '無資料', active: true }],
        todayPeripheral3F: [{ name: '無資料', active: true }],
        todayPeripheralAdvanced: [{ name: '無資料', active: true }],
        todayPeripheralTAE: [{ name: '無資料', active: true }],
        offDutyDoctors: []
      };
    }
    
    // 提取值班醫師
    const todayDutyDoctor = doctorScheduleData.值班 ? [{ 
      name: doctorScheduleData.值班, 
      active: true, 
      isDuty: true
    }] : [{ name: '無', active: true, isDuty: true }];
    
    // 從白班中根據area_code分類醫師
    let todayConsoleDoctor = [];
    let todayORDoctors = [];
    let todayPeripheral3F = [];
    let todayPeripheralAdvanced = [];
    let todayPeripheralTAE = [];
    let offDutyDoctors = [];
    
    if (doctorScheduleData.白班 && Array.isArray(doctorScheduleData.白班)) {
      doctorScheduleData.白班.forEach((shift, index) => {
        const doctorData = {
          ...shift,
        };
        
        const isOffDuty = shift.status === 'off_duty' || shift.status === 'off';
        
        if (isOffDuty) {
          offDutyDoctors.push({
            ...doctorData,
            originalAreaCode: shift.area_code
          });
        } else {
          const areaCode = shift.area_code;
          
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
    
    return {
      todayDutyDoctor,
      todayConsoleDoctor,
      todayORDoctors,
      todayPeripheral3F,
      todayPeripheralAdvanced,
      todayPeripheralTAE,
      offDutyDoctors
    };
  }, [doctorScheduleData]);

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
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* 今日班表卡片 - 根據用戶角色顯示不同內容 */}
            <Box>
              <Card sx={{ height: 'fit-content', boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                <CardContent>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 2,
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        borderRadius: 1
                      },
                      p: 1,
                      m: -1,
                      borderRadius: 1,
                      transition: 'background-color 0.2s ease'
                    }}
                    onClick={() => navigate((user?.role === 'doctor' || user?.role === 'admin') ? '/doctor-schedule' : '/weekly-schedule')}
                  >
                    <TodayIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">今日班表</Typography>
                  </Box>

                  {/* 醫師和系統管理員顯示醫師班表 */}
                  {(user?.role === 'doctor' || user?.role === 'admin') ? (
                    isDoctorScheduleLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 2 }}>
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        <Typography variant="body2">載入醫師班表中...</Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {/* 值班醫師 */}
                        {doctorTodayScheduleInfo.todayDutyDoctor.map((doctor, index) => 
                          doctor.name !== '無' && (
                            <Card
                              key={`duty-${index}`}
                              sx={{
                                boxShadow: 'none',
                                border: '1px solid #e0e0e0',
                                backgroundColor: DOCTOR_AREA_COLOR_MAPPING['值班'],
                                color: 'white',
                                borderRadius: 0,
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}>
                                <Typography variant="body1" sx={{ fontSize: { xs: '14px', sm: '16px' }, fontWeight: 'medium' }}>
                                  {formatDoctorName(doctor.name, doctorMapping)}
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: { xs: '11px', sm: '12px' }, opacity: 0.9 }}>
                                  今日值班醫師
                                </Typography>
                              </CardContent>
                            </Card>
                          )
                        )}
                        
                        {/* 控台醫師 */}
                        {doctorTodayScheduleInfo.todayConsoleDoctor.map((doctor, index) => 
                          doctor.name !== '無' && doctor.name !== '無資料' && (
                            <Card
                              key={`console-${index}`}
                              sx={{
                                boxShadow: 'none',
                                border: '1px solid #e0e0e0',
                                backgroundColor: DOCTOR_AREA_COLOR_MAPPING['控台醫師'],
                                color: 'white',
                                borderRadius: 0,
                                opacity: (doctor.status === 'off' || doctor.status === 'off_duty' || doctor.is_in_meeting) ? 0.5 : 1,
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}>
                                <Typography variant="body1" sx={{ fontSize: { xs: '14px', sm: '16px' }, fontWeight: 'medium' }}>
                                  {formatDoctorName(doctor.name, doctorMapping)}
                                  {doctor.status === 'off' && '（請假）'}
                                  {doctor.status === 'off_duty' && '（已下班）'}
                                  {doctor.is_in_meeting && '（開會中）'}
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: { xs: '11px', sm: '12px' }, opacity: 0.9 }}>
                                  今日控台醫師
                                </Typography>
                              </CardContent>
                            </Card>
                          )
                        )}
                        
                        {/* 手術室醫師 */}
                        {doctorTodayScheduleInfo.todayORDoctors.map((doctor, index) => 
                          doctor.name !== '無' && doctor.name !== '無資料' && (
                            <Card
                              key={`or-${index}`}
                              sx={{
                                boxShadow: 'none',
                                border: '1px solid #e0e0e0',
                                backgroundColor: DOCTOR_AREA_COLOR_MAPPING['手術室'],
                                color: 'white',
                                borderRadius: 0,
                                opacity: (doctor.status === 'off' || doctor.status === 'off_duty' || doctor.is_in_meeting) ? 0.5 : 1,
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}>
                                <Typography variant="body1" sx={{ fontSize: { xs: '14px', sm: '16px' }, fontWeight: 'medium' }}>
                                  {formatDoctorName(doctor.name, doctorMapping)}
                                  {doctor.status === 'off' && '（請假）'}
                                  {doctor.status === 'off_duty' && '（已下班）'}
                                  {doctor.is_in_meeting && '（開會中）'}
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: { xs: '11px', sm: '12px' }, opacity: 0.9 }}>
                                  手術室
                                </Typography>
                              </CardContent>
                            </Card>
                          )
                        )}
                        
                        {/* 外圍醫師 */}
                        {doctorTodayScheduleInfo.todayPeripheral3F.map((doctor, index) => 
                          doctor.name !== '無' && doctor.name !== '無資料' && (
                            <Card
                              key={`3f-${index}`}
                              sx={{
                                boxShadow: 'none',
                                border: '1px solid #e0e0e0',
                                backgroundColor: DOCTOR_AREA_COLOR_MAPPING['外圍(3F)'],
                                color: 'white',
                                borderRadius: 0,
                                opacity: (doctor.status === 'off' || doctor.status === 'off_duty' || doctor.is_in_meeting) ? 0.5 : 1,
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}>
                                <Typography variant="body1" sx={{ fontSize: { xs: '14px', sm: '16px' }, fontWeight: 'medium' }}>
                                  {formatDoctorName(doctor.name, doctorMapping)}
                                  {doctor.status === 'off' && '（請假）'}
                                  {doctor.status === 'off_duty' && '（已下班）'}
                                  {doctor.is_in_meeting && '（開會中）'}
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: { xs: '11px', sm: '12px' }, opacity: 0.9 }}>
                                  外圍(3F)
                                </Typography>
                              </CardContent>
                            </Card>
                          )
                        )}
                        
                        {doctorTodayScheduleInfo.todayPeripheralAdvanced.map((doctor, index) => 
                          doctor.name !== '無' && doctor.name !== '無資料' && (
                            <Card
                              key={`advanced-${index}`}
                              sx={{
                                boxShadow: 'none',
                                border: '1px solid #e0e0e0',
                                backgroundColor: DOCTOR_AREA_COLOR_MAPPING['外圍(高階)'],
                                color: 'white',
                                borderRadius: 0,
                                opacity: (doctor.status === 'off' || doctor.status === 'off_duty' || doctor.is_in_meeting) ? 0.5 : 1,
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}>
                                <Typography variant="body1" sx={{ fontSize: { xs: '14px', sm: '16px' }, fontWeight: 'medium' }}>
                                  {formatDoctorName(doctor.name, doctorMapping)}
                                  {doctor.status === 'off' && '（請假）'}
                                  {doctor.status === 'off_duty' && '（已下班）'}
                                  {doctor.is_in_meeting && '（開會中）'}
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: { xs: '11px', sm: '12px' }, opacity: 0.9 }}>
                                  外圍(高階)
                                </Typography>
                              </CardContent>
                            </Card>
                          )
                        )}
                        
                        {doctorTodayScheduleInfo.todayPeripheralTAE.map((doctor, index) => 
                          doctor.name !== '無' && doctor.name !== '無資料' && (
                            <Card
                              key={`tae-${index}`}
                              sx={{
                                boxShadow: 'none',
                                border: '1px solid #e0e0e0',
                                backgroundColor: DOCTOR_AREA_COLOR_MAPPING['外圍(TAE)'],
                                color: 'white',
                                borderRadius: 0,
                                opacity: (doctor.status === 'off' || doctor.status === 'off_duty' || doctor.is_in_meeting) ? 0.5 : 1,
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}>
                                <Typography variant="body1" sx={{ fontSize: { xs: '14px', sm: '16px' }, fontWeight: 'medium' }}>
                                  {formatDoctorName(doctor.name, doctorMapping)}
                                  {doctor.status === 'off' && '（請假）'}
                                  {doctor.status === 'off_duty' && '（已下班）'}
                                  {doctor.is_in_meeting && '（開會中）'}
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: { xs: '11px', sm: '12px' }, opacity: 0.9 }}>
                                  外圍(TAE)
                                </Typography>
                              </CardContent>
                            </Card>
                          )
                        )}
                        
                        {/* 下班醫師 */}
                        {doctorTodayScheduleInfo.offDutyDoctors.map((doctor, index) => (
                          <Card
                            key={`off-${index}`}
                            sx={{
                              boxShadow: 'none',
                              border: '1px solid #e0e0e0',
                              backgroundColor: '#9e9e9e',
                              color: 'white',
                              borderRadius: 0,
                              opacity: 0.35,
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}>
                              <Typography variant="body1" sx={{ fontSize: { xs: '14px', sm: '16px' }, fontWeight: 'medium' }}>
                                {formatDoctorName(doctor.name, doctorMapping)}
                                {doctor.status === 'off' && '（請假）'}
                                {doctor.status === 'off_duty' && '（已下班）'}
                                {doctor.is_in_meeting && '（開會中）'}
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: { xs: '11px', sm: '12px' }, opacity: 0.9 }}>
                                {doctor.originalAreaCode || '未分類'}
                              </Typography>
                            </CardContent>
                          </Card>
                        ))}
                        
                        {/* 如果沒有任何醫師，顯示預設訊息 */}
                        {!doctorScheduleData && (
                          <Typography variant="body2" color="text.secondary">
                            今日無醫師班表資料
                          </Typography>
                        )}
                      </Box>
                    )
                  ) : (
                    /* 護理師顯示護理師班表 */
                    todayWork.details ? (
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
                    )
                  )}
                </CardContent>
              </Card>
            </Box>


            
            {/* 本月班表卡片 - 根據用戶角色顯示不同內容 */}
            <Box sx={{ flex: 1, display: 'flex' }}>
              <Card sx={{ width: '100%', display: 'flex', flexDirection: 'column', boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 2,
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        borderRadius: 1
                      },
                      p: 1,
                      m: -1,
                      borderRadius: 1,
                      transition: 'background-color 0.2s ease'
                    }}
                    onClick={() => navigate((user?.role === 'doctor' || user?.role === 'admin') ? '/doctor-schedule' : '/weekly-schedule')}
                  >
                    <EventIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">本月班表</Typography>
                  </Box>

                  {/* 醫師和系統管理員顯示醫師月班表 */}
                  {(user?.role === 'doctor' || user?.role === 'admin') ? (
                    isDoctorScheduleLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                        <CircularProgress />
                        <Typography sx={{ ml: 2 }}>載入醫師班表中...</Typography>
                      </Box>
                    ) : doctorCalendarData.length > 0 ? (
                      <Box sx={{ width: '100%', overflowX: 'auto', flex: 1 }}>
                        <Box component="table" sx={{ 
                          width: '100%', 
                          height: '100%',
                          borderCollapse: 'collapse',
                          border: '1px solid #e0e0e0',
                          tableLayout: 'fixed'
                        }}>
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
                                    width: '14.285714%',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  {day}
                                </Box>
                              ))}
                            </Box>
                          </Box>
                          <Box component="tbody">
                            {doctorCalendarData.map((week, weekIndex) => (
                              <Box component="tr" key={weekIndex}>
                                {week.map((day, dayIndex) => {
                                  const isExpired = day.date && day.date < today;
                                  
                                  return (
                                    <Box 
                                      component="td" 
                                      key={dayIndex}
                                      sx={{
                                        position: 'relative',
                                        height: '90px',
                                        minHeight: '70px',
                                        padding: '4px',
                                        border: '1px solid #e0e0e0',
                                        overflow: 'hidden',
                                        cursor: 'default',
                                        '&:hover': {
                                          backgroundColor: '#f5f5f5',
                                        },
                                        ...(day.date && isToday(day.date) && { 
                                          backgroundColor: '#e8f5e9',
                                          border: '2px solid #4caf50'
                                        }),
                                        ...(isExpired && {
                                          backgroundColor: '#fafafa',
                                          opacity: 0.6,
                                          cursor: 'not-allowed'
                                        }),
                                        ...((!day.date) && { 
                                          backgroundColor: '#f9f9f9',
                                          opacity: 0.5
                                        })
                                      }}
                                    >
                                      {day.date && <RenderDoctorCalendarCell day={day} />}
                                    </Box>
                                  );
                                })}
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      </Box>
                    ) : (
                      <Typography variant="body1" color="text.secondary">
                        無法載入本月醫師班表
                      </Typography>
                    )
                  ) : (
                    /* 護理師顯示護理師月班表 */
                    monthlyCalendarData.length > 0 ? (
                      <Box sx={{ width: '100%', overflowX: 'auto', flex: 1 }}>
                        <NurseCalendar 
                          selectedDate={selectedDate}
                          calendarData={monthlyCalendarData}
                          isDateExpired={(day) => day.date && day.date < today}
                          showTable={true}
                          cellHeight={{ xs: '70px', sm: '90px' }}
                          clickable={false}
                        />
                      </Box>
                    ) : (
                      <Typography variant="body1" color="text.secondary">
                        無法載入本月班表
                      </Typography>
                    )
                  )}
                </CardContent>
              </Card>
            </Box>

            {/* 在線用戶卡片 - 手機版：本月班表下方 */}
            <Box sx={{ 
              display: { xs: 'block', md: 'none' }  // 只在手機版顯示
            }}>
              <Card sx={{ height: 'fit-content', boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Badge 
                      badgeContent={onlineUsers.length} 
                      color="success" 
                      sx={{ mr: 1 }}
                    >
                      <WorkIcon color="primary" />
                    </Badge>
                    <Typography variant="h6">目前在線</Typography>
                  </Box>
                  
                  {onlineUsersLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : wsError ? (
                    <Alert severity="error" sx={{ mb: 1 }}>
                      WebSocket 連接錯誤: {wsError}
                    </Alert>
                  ) : onlineUsers.length > 0 ? (
                    <List sx={{ p: 0, maxHeight: 200, overflowY: 'auto' }}>
                      {onlineUsers.map((onlineUser, index) => (
                        <React.Fragment key={onlineUser.id}>
                          <ListItem sx={{ px: 0, py: 0.5 }}>
                            <ListItemAvatar>
                              <Avatar 
                                sx={{ 
                                  width: 32, 
                                  height: 32, 
                                  fontSize: '0.8rem',
                                  backgroundColor: onlineUser.line_avatar_url ? 'transparent' : (onlineUser.isWorking ? '#f44336' : '#9e9e9e'), // 上班時間顯示紅色
                                  color: 'white'
                                }}
                                src={onlineUser.line_avatar_url || undefined}
                              >
                                {!onlineUser.line_avatar_url && (onlineUser.full_name?.charAt(0) || onlineUser.username?.charAt(0) || '?')}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                    {onlineUser.full_name || onlineUser.username}
                                  </Typography>
                                  {onlineUser.role !== 'doctor' && onlineUser.role !== 'admin' && (
                                    <Chip
                                      label={onlineUser.todayShift || 'O'}
                                      size="small"
                                      sx={{
                                        backgroundColor: SHIFT_COLORS[onlineUser.todayShift] || '#9e9e9e', // 手機版班表顏色 Chip
                                        color: onlineUser.todayShift === 'O' ? 'black' : 'white',
                                        height: '18px',
                                        minWidth: '18px',
                                        fontSize: '10px',
                                        '& .MuiChip-label': {
                                          padding: '0 4px',
                                          fontSize: '10px',
                                          fontWeight: 'bold'
                                        }
                                      }}
                                    />
                                  )}
                                  {/* 只對非admin和非麻醉科醫師顯示工作時間狀態 */}
                                  {onlineUser.role !== 'admin' && !onlineUser.identity?.includes('麻醉科醫師') && onlineUser.role !== 'doctor' && (
                                  <Chip 
                                    label={onlineUser.isWorking ? '上班中' : '非上班時間'} 
                                    size="small" 
                                    sx={{ 
                                      backgroundColor: onlineUser.isWorking ? '#f44336' : '#9e9e9e', // 上班時間顯示紅色
                                      color: 'white',
                                      height: '18px',
                                      fontSize: '10px',
                                      '& .MuiChip-label': {
                                        padding: '0 4px',
                                        fontSize: '10px',
                                        fontWeight: 'bold'
                                      }
                                    }}
                                  />
                                  )}
                                </Box>
                              }
                              secondary={
                                <Typography variant="caption" color="text.secondary">
                                  {onlineUser.identity || '未設定身份'} • 最後活動: {onlineUser.last_login_time ? format(parseISO(onlineUser.last_login_time), 'HH:mm') : '未知'}
                                </Typography>
                              }
                            />
                          </ListItem>
                          {index < onlineUsers.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      目前沒有其他用戶在線
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Box>
          </Box>
        </Grid>

        {/* 左側容器 - 小螢幕時後顯示 */}
        <Grid item xs={12} md={6} sx={{ order: { xs: 2, md: 1 } }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* 在線用戶卡片 - 桌面版：最上方 */}
            <Box sx={{ 
              display: { xs: 'none', md: 'block' }  // 只在桌面版顯示
            }}>
              <Card sx={{ 
                height: 'fit-content', 
                boxShadow: 'none', 
                border: '1px solid #e0e0e0'
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Badge 
                      badgeContent={onlineUsers.length} 
                      color="success" 
                      sx={{ mr: 1 }}
                    >
                      <WorkIcon color="primary" />
                    </Badge>
                    <Typography variant="h6">目前在線</Typography>
                  </Box>
                  
                  {onlineUsersLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : wsError ? (
                    <Alert severity="error" sx={{ mb: 1 }}>
                      WebSocket 連接錯誤: {wsError}
                    </Alert>
                  ) : onlineUsers.length > 0 ? (
                    <List sx={{ 
                      p: 0
                    }}>
                      {onlineUsers.map((onlineUser, index) => (
                        <React.Fragment key={onlineUser.id}>
                          <ListItem sx={{ px: 0, py: 0.5 }}>
                            <ListItemAvatar>
                              <Avatar 
                                sx={{ 
                                  width: 32, 
                                  height: 32, 
                                  fontSize: '0.8rem',
                                  backgroundColor: onlineUser.line_avatar_url ? 'transparent' : (onlineUser.isWorking ? '#f44336' : '#9e9e9e'), // 上班時間顯示紅色
                                  color: 'white'
                                }}
                                src={onlineUser.line_avatar_url || undefined}
                              >
                                {!onlineUser.line_avatar_url && (onlineUser.full_name?.charAt(0) || onlineUser.username?.charAt(0) || '?')}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                    {onlineUser.full_name || onlineUser.username}
                                  </Typography>
                                  {onlineUser.role !== 'doctor' && onlineUser.role !== 'admin' && (
                                    <Chip
                                      label={onlineUser.todayShift || 'O'}
                                      size="small"
                                      sx={{
                                        backgroundColor: SHIFT_COLORS[onlineUser.todayShift] || '#9e9e9e', // 桌面版班表顏色 Chip
                                        color: onlineUser.todayShift === 'O' ? 'black' : 'white',
                                        height: '18px',
                                        minWidth: '18px',
                                        fontSize: '10px',
                                        '& .MuiChip-label': {
                                          padding: '0 4px',
                                          fontSize: '10px',
                                          fontWeight: 'bold'
                                        }
                                      }}
                                    />
                                  )}
                                  {/* 只對非admin和非麻醉科醫師顯示工作時間狀態 */}
                                  {onlineUser.role !== 'admin' && !onlineUser.identity?.includes('麻醉科醫師') && onlineUser.role !== 'doctor' && (
                                  <Chip 
                                    label={onlineUser.isWorking ? '上班中' : '非上班時間'} 
                                    size="small" 
                                    sx={{ 
                                      backgroundColor: onlineUser.isWorking ? '#f44336' : '#9e9e9e', // 上班時間顯示紅色
                                      color: 'white',
                                      height: '18px',
                                      fontSize: '10px',
                                      '& .MuiChip-label': {
                                        padding: '0 4px',
                                        fontSize: '10px',
                                        fontWeight: 'bold'
                                      }
                                    }}
                                  />
                                  )}
                                </Box>
                              }
                              secondary={
                                <Typography variant="caption" color="text.secondary">
                                  {onlineUser.identity || '未設定身份'} • 最後活動: {onlineUser.last_login_time ? format(parseISO(onlineUser.last_login_time), 'HH:mm') : '未知'}
                                </Typography>
                              }
                            />
                          </ListItem>
                          {index < onlineUsers.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      目前沒有其他用戶在線
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Box>

            {/* 最新公告卡片 - 在線用戶下方 */}
            <Box>
              <Card sx={{ height: 'fit-content', boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                <CardContent>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 2,
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        borderRadius: 1
                      },
                      p: 1,
                      m: -1,
                      borderRadius: 1,
                      transition: 'background-color 0.2s ease'
                    }}
                    onClick={() => navigate('/announcements')}
                  >
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
              </Card>
            </Box>

            {/* 換班請求卡片 - 左下，填滿剩餘空間 - 只對護理師顯示 */}
            {!(user?.role === 'doctor' || user?.role === 'admin') && (
            <Box sx={{ flex: 1, display: 'flex' }}>
              <Card sx={{ width: '100%', display: 'flex', flexDirection: 'column', boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                <CardContent sx={{ flex: 1 }}>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 2,
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        borderRadius: 1
                      },
                      p: 1,
                      m: -1,
                      borderRadius: 1,
                      transition: 'background-color 0.2s ease'
                    }}
                    onClick={() => navigate('/shift-swap')}
                  >
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
              </Card>
            </Box>
            )}
          </Box>
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
