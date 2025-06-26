import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, Paper, List, ListItem, ListItemText, Chip, Alert, CircularProgress, 
  TextField, Button, Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle, 
  DialogContent, DialogActions, Grid, Tabs, Tab, Badge, IconButton, Drawer, Divider,
  Card, CardContent, CardActions, Tooltip, Snackbar, Avatar, ListItemAvatar,
  FormControlLabel, Checkbox, Collapse, InputAdornment, Pagination, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Add as AddIcon,
  Close as CloseIcon,
  CalendarMonth as CalendarIcon,
  FilterList as FilterListIcon,
  ArrowForward as ArrowForwardIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  Work as WorkIcon,
  ViewWeek as ViewWeekIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker, StaticDatePicker } from '@mui/x-date-pickers';
import { zhTW } from 'date-fns/locale';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isWithinInterval, getDay, isToday, isEqual, startOfDay, endOfDay, isSameDay, addDays, subDays, isBefore, isAfter, differenceInDays } from 'date-fns';
import { useAuthStore } from '../store/authStore';
import apiService from '../utils/api';
import { cachedScheduleDetailsRequest } from '../utils/scheduleCache';

// 不允許的班別組合及其最小間隔時間（小時）
const INVALID_SHIFT_COMBINATIONS = {
  // 只有這些特定組合才有限制
  'N-A': 11, // N班(14-22)後至少間隔11小時才能上A班(8-16)
  'N-B': 11, // N班(14-22)後至少間隔11小時才能上B班(8-17)
  'N-E': 11, // N班(14-22)後至少間隔11小時才能上E班(8-12)
  'D-A': 11, // D班(22-08)後至少間隔11小時才能上A班(8-16)
  'D-B': 11, // D班(22-08)後至少間隔11小時才能上B班(8-17)
  'D-E': 11, // D班(22-08)後至少間隔11小時才能上E班(8-12)
  'D-K': 11, // D班(22-08)後至少間隔11小時才能上K班(9-17)
  'D-C': 11, // D班(22-08)後至少間隔11小時才能上C班(10-18)
};

// 班別工作時段定義
const SHIFT_TIME_RANGES = {
  'A': '8-16',  // A班
  'B': '8-17',  // B班
  'N': '14-22', // N班
  'D': '22-08', // D班
  'E': '8-12',  // E班
  'K': '9-17',  // K班
  'C': '10-18', // C班
  'F': '12-20', // F班
  'O': '休假',   // O班
};

// 班別名稱對應
const SHIFT_NAMES = {
  'A': 'A班(8-16)',
  'B': 'B班(8-17)',
  'N': 'N班(14-22)',
  'D': 'D班(22-08)',
  'E': 'E班(8-12)',
  'K': 'K班(9-17)',
  'C': 'C班(10-18)',
  'F': 'F班(12-20)',
  'O': 'O班(休假)',
};

/**
 * 班別兼容性檢查說明
 * 
 * 為了保證護理師的休息時間充足，系統實現了班別兼容性檢查邏輯，主要包括：
 * 1. 在提交換班申請時，檢查申請人希望換到的班別是否會與前後班次形成不合規的組合
 * 2. 在接受換班申請時，同時檢查申請人和接受人在換班後的班表是否符合工時限制規定
 * 3. 不允許的班別組合定義在 INVALID_SHIFT_COMBINATIONS 中，包含班別組合和最小間隔時間
 * 
 * 各班別工作時段：
 * - A班: 8-16
 * - B班: 8-17
 * - N班: 14-22
 * - D班: 22-08
 * - E班: 8-12
 * - K班: 9-17
 * - C班: 10-18
 * - F班: 12-20
 * - O班: 休假
 * 
 * 工時限制規則：
 * - 僅限制以下幾種班別組合：
 *   - N班(14-22)後接A班(8-16)、B班(8-17)或E班(8-12)需間隔至少11小時
 *   - D班(22-08)後接A班(8-16)、B班(8-17)、E班(8-12)、K班(9-17)或C班(10-18)需間隔至少11小時
 * - 休假班(O班)規則：
 *   - 從休假班換成其他班別時，仍需檢查與前後班次的兼容性
 *   - 前一天是休假班時，不會對當天可以排哪種班別有限制
 *   - 後一天是休假班時，不會對當天可以排哪種班別有限制
 * 
 * 檢查邏輯：
 * - 對於每個班別變更，檢查變更後的班別與前一天和後一天班別是否構成不合規組合
 * - 系統會計算班別間的時間間隔，確保達到最小休息要求
 * - 如果檢測到不符合規定，系統會阻止換班操作並給出具體原因
 * - 使用臨時變更機制模擬換班後的班表狀態，確保檢查結果反映實際換班情況
 */

// 護理師身份類型
const NURSE_TYPES = {
  ANESTHESIA_SPECIALIST: 'anesthesia_specialist', // 麻醉專科護理師
  RECOVERY_NURSE: 'recovery_nurse', // 恢復室護理師
  ANESTHESIA_LEADER: 'anesthesia_leader', // 麻醉科Leader
  ANESTHESIA_SECRETARY: 'anesthesia_secretary', // 麻醉科書記
};

// 不同班表類型的班次設定
const SHIFT_TYPES_BY_FORMULA = {
  [NURSE_TYPES.ANESTHESIA_SPECIALIST]: ['D', 'A', 'N', 'O'],
  [NURSE_TYPES.RECOVERY_NURSE]: ['A', 'K', 'C', 'F', 'O'],
  [NURSE_TYPES.ANESTHESIA_LEADER]: ['A', 'E', 'O'],
  [NURSE_TYPES.ANESTHESIA_SECRETARY]: ['B', 'E', 'O'],
};

// 定義班別顏色
const SHIFT_COLORS = {
  'D': '#c5b5ac', // 白班 22-08
  'A': '#c6c05f', // 小夜班 8-16  
  'N': '#aa77c4', // 大夜班 14-22
  'K': '#8AA6C1', // 早班 9-17
  'C': '#a9d0ab', // 中班 10-18
  'F': '#d8bd89', // 晚班 12-20
  'E': '#cb9cc8', // 半班 8-12
  'B': '#e7b284', // 日班 8-17
  'O': '#e7e7e7', // 排休 OFF
  'V': '#e0755f', // 休假 OFF
  'R': '#a9c4ce'  // 靜養假 OFF
};

// 低飽和度班別顏色 (用於未選中狀態)
const DESATURATED_SHIFT_COLORS = {
  'D': '#a5d6a7', // 淡化的白班顏色
  'A': '#e7e6c3', // 淡化的A班顏色
  'N': '#90caf9', // 淡化的大夜顏色
  'K': '#c6d5e3', // 淡化的K班顏色
  'C': '#d4e9d5', // 淡化的C班顏色
  'F': '#f0e4d0', // 淡化的F班顏色
  'E': '#ffcc80', // 淡化的小夜顏色
  'B': '#f2d7c0', // 淡化的B班顏色
  'O': '#e0e0e0'  // 淡化的休假顏色
};

// 狀態顏色配置
const STATUS_COLORS = {
  'pending': { backgroundColor: '#ffecb3', color: '#bf360c' },
  'accepted': { backgroundColor: '#c8e6c9', color: '#1b5e20' },
  'rejected': { backgroundColor: '#ffcdd2', color: '#b71c1c' }, // 恢復紅色背景
  'cancelled': { backgroundColor: '#eeeeee', color: '#9e9e9e' }, // 淡灰色
  'expired': { backgroundColor: '#f3e5f5', color: '#9c27b0' } // 更淡的紫色
};

// 狀態顏色映射（統一的樣式配置）
const statusColors = {
  'pending': { backgroundColor: '#ff9800', color: 'black' }, // 橙色
  'accepted': { backgroundColor: '#4caf50', color: 'white' }, // 綠色
  'rejected': { backgroundColor: '#f44336', color: 'white' }, // 紅色
  'cancelled': { backgroundColor: '#9e9e9e', color: 'white' }, // 灰色
  'expired': { backgroundColor: '#ba68c8', color: 'white' }, // 紫色
  'default': { backgroundColor: '#bdbdbd', color: 'black' }  // 灰色
};

// 獲取狀態風格
const getStatusStyle = (status) => {
  return statusColors[status] || statusColors.default;
};

// 獲取狀態顯示名稱
const getStatusDisplayName = (status) => {
  const statusNames = {
    'pending': '待處理',
    'accepted': '已完成',
    'rejected': '已駁回',
    'expired': '已過期',
    'cancelled': '已取消'
  };
  return statusNames[status] || status;
};

// 添加日曆樣式
const calendarStyles = `
  .calendar-container {
    width: 100%;
    margin-top: 20px;
  }
  
  .calendar-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  
  .calendar-table th {
    padding: 8px;
    text-align: center;
    background-color: #f5f5f5;
    border: 1px solid #ddd;
    width: 14.285714%;
    font-weight: bold;
  }
  
  .calendar-table td {
    border: 1px solid #ddd;
    padding: 0;
    vertical-align: top;
    height: 90px;
    width: 14.285714%;
    position: relative;
    transition: all 0.2s ease;
  }
  
  @media (max-width: 600px) {
    .calendar-table td {
      height: 70px;
    }
    .calendar-table th {
      padding: 6px 4px;
      font-size: 14px;
    }
  }
  
  .empty-cell {
    background-color: #f9f9f9;
  }
  
  .expired-cell {
    background-color: #fafafa;
    opacity: 0.6;
  }
  
  .expired-cell:hover {
    background-color: #fafafa !important;
    cursor: not-allowed !important;
  }
  
  .cell-content {
    padding: 5px;
    height: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  
  .day-number {
    font-weight: bold;
    margin-bottom: 5px;
  }
  
  .shift {
    display: inline-block;
    padding: 2px 5px;
    border-radius: 3px;
    font-size: 12px;
    font-weight: bold;
    color: white;
    background-color: #757575;
    margin-bottom: 5px;
  }
  
  /* 麻醉專科護理師班別 */
  .shift:is([data-shift="D"]) {
    background-color: #4caf50;
  }
  
  .shift:is([data-shift="A"]) {
    background-color: #c6c05f;
  }
  
  .shift:is([data-shift="N"]) {
    background-color: #2196f3;
  }
  
  /* 恢復室護理師班別 */
  .shift:is([data-shift="K"]) {
    background-color: #8AA6C1;
  }
  
  .shift:is([data-shift="C"]) {
    background-color: #a9d0ab;
  }
  
  .shift:is([data-shift="F"]) {
    background-color: #d8bd89;
  }
  
  /* 麻醉科Leader和書記班別 */
  .shift:is([data-shift="E"]) {
    background-color: #ff9800;
  }
  
  .shift:is([data-shift="B"]) {
    background-color: #e7b284;
  }
  
  /* 休假 */
  .shift:is([data-shift="O"]) {
    background-color: #9e9e9e;
    color: black;
  }
  
  .mission {
    font-size: 12px;
    color: #fff;
    margin-top: 5px;
    width: fit-content;
  }
  
  .overtime {
    background-color: #ffebee;
    border-radius: 3px;
    padding: 3px 6px;
    color: #d32f2f;
    font-weight: bold;
    display: flex;
    align-items: center;
    font-size: 11px;
    margin-top: 5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    width: fit-content;
  }
  
  .today {
    background-color: #e3f2fd;
  }
  
  .selected {
    background-color: #e8f5e9;
    transform: scale(1.05);
    box-shadow: none;
    z-index: 10;
  }
  
  td:hover:not(.expired-cell) {
    background-color: #f0f0f0;
    cursor: pointer;
  }
`;

// 添加日曆單元格的CSS
const calendarCellStyle = {
  position: 'relative',
  height: '100%',
  minHeight: '70px',
  padding: '4px',
  border: '1px solid #e0e0e0',
  overflow: 'hidden',
  '&:hover': {
    backgroundColor: '#f5f5f5',
  },
  '&.selected': {
    backgroundColor: '#e3f2fd',
    border: '2px solid #2196f3',
  },
  '&.disabled': {
    backgroundColor: '#f5f5f5',
    color: '#9e9e9e',
    cursor: 'not-allowed',
  }
};

// 渲染日曆單元格內容的組件
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
        
        {/* 加班信息 */}
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

// 更新CalendarDialog組件
const CalendarDialog = ({ open, onClose, onSelect, selectedDate, setSelectedDate, calendarData }) => {
  const handleSelectDate = () => {
    onSelect(selectedDate);
    onClose();
  };

  const handleDateClick = (day) => {
    // 檢查日期是否過期
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (day < today) {
      console.log('不能選擇過期的日期');
      return;
    }
    
    setSelectedDate(day);
  };
  
  // 獲取今天的日期
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="dialog-title"
      maxWidth="md"
      fullWidth
    >
      <DialogTitle id="dialog-title" sx={{ pb: 1 }}>
        請選擇日期:
        <IconButton
          aria-label="close"
          onClick={onClose}
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
      <DialogContent>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
          <StaticDatePicker
            displayStaticWrapperAs="desktop"
            openTo="day"
            value={selectedDate}
            onChange={(newValue) => {
              // 檢查是否過期
              if (newValue < today) {
                console.log('不能選擇過期的日期');
                return;
              }
              setSelectedDate(newValue);
            }}
            renderInput={(params) => <TextField {...params} />}
            renderDay={(day, _value, DayComponentProps) => {
              const isDateDisabled = !isWithinInterval(day, {
                start: startOfMonth(selectedDate),
                end: endOfMonth(selectedDate)
              });
              
              // 檢查日期是否過期
              const isExpired = day < today;
              
              const dayData = calendarData.find(d => isSameDay(parseISO(d.date), day)) || { date: day };
              
              return (
                <Box
                  sx={{
                    ...calendarCellStyle,
                    ...(DayComponentProps.selected && { backgroundColor: '#e3f2fd', border: '2px solid #2196f3' }),
                    ...(isDateDisabled && { opacity: 0.5, pointerEvents: 'none' }),
                    ...(isExpired && { 
                      opacity: 0.5, 
                      pointerEvents: 'none',
                      cursor: 'not-allowed',
                      backgroundColor: '#f5f5f5'
                    })
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isExpired) {
                      handleDateClick(day);
                    }
                  }}
                >
                  <RenderCalendarCell day={dayData} />
                </Box>
              );
            }}
            // 設置週一為一週的第一天
            firstDayOfWeek={1}
            shouldDisableDate={(date) => {
              // 禁用過期的日期
              return date < today;
            }}
            sx={{
              width: '100%',
              '& .MuiPickersDay-root': {
                width: '40px', 
                height: '40px'
              },
              '& .MuiDayCalendar-weekContainer': {
                margin: '4px 0'
              },
              '& .MuiPickersCalendarHeader-root': {
                paddingLeft: '10px',
                paddingRight: '10px',
                marginTop: '8px'
              }
            }}
          />
        </LocalizationProvider>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSelectDate} color="primary">申請換班</Button>
      </DialogActions>
    </Dialog>
  );
};

// 檢查換班後的班表是否符合工時限制規則
const checkShiftCompatibility = (userSchedules, date, newShift, userId, tempChanges = {}) => {
  if (!userSchedules || !date || !newShift || !userId) {
    return { valid: false, message: '無法檢查班表兼容性，資料不完整' };
  }

  // 移除這個條件，因為O班換成其他班別時也需要檢查兼容性
  // if (newShift === 'O') {
  //   return { valid: true, message: '' };
  // }

  const targetDate = new Date(date);
  const prevDay = subDays(targetDate, 1);
  const nextDay = addDays(targetDate, 1);
  
  const prevDateStr = format(prevDay, 'yyyy-MM-dd');
  const targetDateStr = format(targetDate, 'yyyy-MM-dd');
  const nextDateStr = format(nextDay, 'yyyy-MM-dd');
  
  // 考慮臨時變更中的班別（例如還未實際換班但需要預先計算的情況）
  const getTempOrActualShift = (dateStr, uid) => {
    // 檢查是否有臨時變更中的班別
    if (tempChanges[dateStr] && tempChanges[dateStr][uid]) {
      return tempChanges[dateStr][uid];
    }
    
    // 否則返回實際班表中的班別
    if (userSchedules[dateStr] && userSchedules[dateStr][uid]) {
      return userSchedules[dateStr][uid];
    }
    
    return null;
  };
  
  // 獲取前一天和後一天的班別，並考慮臨時變更
  let prevShift = getTempOrActualShift(prevDateStr, userId);
  let nextShift = getTempOrActualShift(nextDateStr, userId);
  
  // 獲取當前(待換班)日期的原班別
  let currentShift = getTempOrActualShift(targetDateStr, userId);
  
  console.log(`檢查班表兼容性:`, {
    用戶ID: userId,
    目標日期: targetDateStr,
    原班別: currentShift,
    新班別: newShift,
    前一天班別: prevShift,
    後一天班別: nextShift,
    已考慮臨時變更: Object.keys(tempChanges).length > 0
  });
  
  // 如果前一天是休假班"O"，則不需要檢查前一天的限制
  // 但需要檢查其他情況：即使當前是O班要換成其他班別，也要檢查與前一天的兼容性
  if (prevShift && prevShift !== 'O') {
    const prevCombination = `${prevShift}-${newShift}`;
    if (INVALID_SHIFT_COMBINATIONS[prevCombination] !== undefined) {
      const requiredHours = INVALID_SHIFT_COMBINATIONS[prevCombination];
      if (requiredHours === 0) {
        return { 
          valid: false, 
          message: `${SHIFT_NAMES[prevShift]}後不允許接${SHIFT_NAMES[newShift]}，這會違反工時限制規定` 
        };
      } else {
        return { 
          valid: false, 
          message: `${SHIFT_NAMES[prevShift]}後至少需要間隔${requiredHours}小時才能安排${SHIFT_NAMES[newShift]}` 
        };
      }
    }
  }
  
  // 如果後一天是休假班"O"，則不需要檢查後一天的限制
  // 但需要檢查其他情況：即使當前是O班要換成其他班別，也要檢查與後一天的兼容性
  if (nextShift && nextShift !== 'O') {
    const nextCombination = `${newShift}-${nextShift}`;
    if (INVALID_SHIFT_COMBINATIONS[nextCombination] !== undefined) {
      const requiredHours = INVALID_SHIFT_COMBINATIONS[nextCombination];
      if (requiredHours === 0) {
        return { 
          valid: false, 
          message: `${SHIFT_NAMES[newShift]}後不允許接${SHIFT_NAMES[nextShift]}，這會違反工時限制規定` 
        };
      } else {
        return { 
          valid: false, 
          message: `${SHIFT_NAMES[newShift]}後至少需要間隔${requiredHours}小時才能安排${SHIFT_NAMES[nextShift]}` 
        };
      }
    }
  }
  
  // 通過所有檢查，班表兼容
  return { valid: true, message: '' };
};

// 整理班表數據為便於檢查的格式
const prepareShiftSchedule = (monthlySchedules, year, month, userId) => {
  if (!monthlySchedules || !year || !month || !userId) {
    console.error('無法準備班表數據，參數不完整');
    return {};
  }
  
  // 嘗試構造月份鍵名
  const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
  
  // 檢查是否有相應月份的數據
  if (!monthlySchedules[monthStr]) {
    console.warn(`沒有找到 ${monthStr} 的班表數據`);
    return {};
  }
  
  const scheduleData = monthlySchedules[monthStr];
  const userSchedules = {};
  
  try {
    // 嘗試從不同的數據結構中提取班表數據
    if (scheduleData && scheduleData.data && scheduleData.data[year] && scheduleData.data[year][month]) {
      const nurseSchedules = scheduleData.data[year][month].schedule || [];
      const userSchedule = nurseSchedules.find(nurse => String(nurse.id) === String(userId));
      
      if (userSchedule && Array.isArray(userSchedule.shifts)) {
        // 將班表數據轉換為以日期為鍵的對象
        const daysInMonth = new Date(year, month, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
          const shiftIndex = day - 1;
          if (shiftIndex < userSchedule.shifts.length) {
            const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            userSchedules[dateStr] = {};
            userSchedules[dateStr][userId] = userSchedule.shifts[shiftIndex] || 'O';
          }
        }
      } else {
        console.warn(`未找到用戶 ${userId} 的班表數據或格式不符合預期`);
      }
    } else {
      console.warn('班表數據結構不符合預期');
    }
  } catch (err) {
    console.error('處理班表數據時出錯:', err);
  }
  
  return userSchedules;
};

const ShiftSwap = () => {
  const { user } = useAuthStore();
  
  // 狀態管理
  const [swapRequests, setSwapRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [monthlySchedules, setMonthlySchedules] = useState({});
  const [weeklyAssignments, setWeeklyAssignments] = useState({});
  const [overtimeRecords, setOvertimeRecords] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // 換班申請交互狀態
  const [selectedDay, setSelectedDay] = useState(null); // 選中的日期
  const [swapOperationType, setSwapOperationType] = useState(null); // 換班操作類型: 'shift', 'mission', 'overtime'
  const [targetShift, setTargetShift] = useState(null); // 目標班別
  
  const [openSwapDialog, setOpenSwapDialog] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [openDetailDrawer, setOpenDetailDrawer] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', type: 'success' });
  
  // 換班申請表單數據
  const [swapFormData, setSwapFormData] = useState({
    selectedMonth: null,
    fromDate: null,
    toDate: null,
    targetNurseId: "",
    swapType: "shift", // "shift", "mission", "overtime"
    notes: "",
    toMission: ""  // 添加目標工作區域字段
  });

  const [calendarData, setCalendarData] = useState([]);
  const [selectedFromDateDetails, setSelectedFromDateDetails] = useState(null);
  const [selectedToDateDetails, setSelectedToDateDetails] = useState(null);

  // 過濾相關狀態
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [shiftStartDate, setShiftStartDate] = useState(null); // 要換班的日期範圍開始
  const [shiftEndDate, setShiftEndDate] = useState(null); // 要換班的日期範圍結束
  const [requestorFilter, setRequestorFilter] = useState('');
  const [selectedShifts, setSelectedShifts] = useState([]); // 選擇的班別
  const [onlySameIdentity, setOnlySameIdentity] = useState(false); // 初始預設顯示所有申請
  const [availableRequestors, setAvailableRequestors] = useState([]);
  
  const [isRequestFormOpen, setIsRequestFormOpen] = useState(false);
  
  // 添加分類標籤狀態
  const [currentTab, setCurrentTab] = useState(0); // 0: 全部, 1: 換班別, 2: 換工作區域, 3: 換加班
  
  // 添加顯示/隱藏已完成和已取消請求的狀態
  // const [showCompleted, setShowCompleted] = useState(false); // 默認不顯示已完成請求
  // const [showCancelled, setShowCancelled] = useState(false); // 默認不顯示已取消請求
  // // 新增顯示/隱藏已過期請求的狀態
  // const [showExpired, setShowExpired] = useState(false); // 默認不顯示已過期請求
  
  // 添加回狀態和標籤定義
  const statuses = ['accepted', 'rejected', 'cancelled', 'expired']; // 移除 'pending'
  const statusLabels = {
    'pending': '待處理',
    'accepted': '已完成',
    'rejected': '已駁回',
    'cancelled': '已取消',
    'expired': '已過期'
  };
  
  // 添加隱藏狀態的標籤文本
  const hideStatusLabels = {
    'accepted': '隱藏已完成',
    'rejected': '隱藏已駁回',
    'cancelled': '隱藏已取消',
    'expired': '隱藏已過期'
  };
  
  // 修改狀態變量，改為記錄被隱藏的狀態
  const [hiddenStatuses, setHiddenStatuses] = useState([]); // 初始不隱藏任何狀態
  
  // 添加處理狀態隱藏/顯示的函數
  const handleStatusVisibilityChange = (status) => {
    setHiddenStatuses(prev => {
      if (prev.includes(status)) {
        return prev.filter(s => s !== status);
      } else {
        return [...prev, status];
      }
    });
  };
  
  // 所有可能的班別
  const allShifts = ['D', 'A', 'N', 'K', 'C', 'F', 'E', 'B', 'O'];
  
  // 獲取當前用戶身份類型
  const userNurseType = useMemo(() => {
    // 默認返回麻醉專科護理師類型，避免未定義
    if (!user) return NURSE_TYPES.ANESTHESIA_SPECIALIST;
    
    // 安全地獲取用戶身份
    const identity = user.identity || '';
    
    // 根據用戶身份判斷護理師類型
    if (identity === 'anesthesia_specialist' || identity === '麻醉專科護理師') {
      return NURSE_TYPES.ANESTHESIA_SPECIALIST;
    } else if (identity === 'recovery_nurse' || identity === '恢復室護理師') {
      return NURSE_TYPES.RECOVERY_NURSE;
    } else if (identity === 'anesthesia_leader' || identity === '麻醉科Leader') {
      return NURSE_TYPES.ANESTHESIA_LEADER;
    } else if (identity === 'anesthesia_secretary' || identity === '麻醉科書記') {
      return NURSE_TYPES.ANESTHESIA_SECRETARY;
    } else {
      // 默認為麻醉專科護理師
      return NURSE_TYPES.ANESTHESIA_SPECIALIST;
    }
  }, [user]);
  
  // 獲取當前用戶可用的班別選項
  const userAvailableShifts = useMemo(() => {
    // 根據用戶身份類型獲取可用班別
    return SHIFT_TYPES_BY_FORMULA[userNurseType] || ['D', 'A', 'N', 'O'];
  }, [userNurseType]);

  // 檢查是否有請求換班的權限
  const canRequestSwap = useMemo(() => {
    if (!user) return false;
    
    // 獲取用戶身份，如果沒有則設為空字符串
    const identity = user.identity || '';
    
    // 任何護理師都可以創建換班
    return identity === '麻醉專科護理師' || 
           identity === 'anesthesia_specialist' ||
           identity === '恢復室護理師' || 
           identity === 'recovery_nurse';
  }, [user]);
  
  // 定義檢查請求是否過期的函數 - 必須在 updateFilteredRequests 前定義
  const isRequestExpired = (request) => {
    if (!request || !request.from_date) return false;
    
    const requestDate = new Date(request.from_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 設置今天的時間為00:00:00
    
    return requestDate < today;
  };
  
  // 獲取請求的顯示狀態 (包含過期判斷)
  const getRequestDisplayStatus = (request) => {
    if (request.status !== 'pending') {
      return request.status; // 如果不是待處理，返回原始狀態
    }
    
    // 如果是待處理，檢查是否過期
    if (isRequestExpired(request)) {
      return 'expired'; // 已過期
    }
    
    return 'pending'; // 未過期的待處理
  };
  
  // 頁面加載時獲取初始數據
  useEffect(() => {
    fetchInitialData();
    
    // 初始加載當前月份的班表數據和加班資料
    const currentDate = new Date();
    fetchMonthData(currentDate);
    
    // 清理函數
    return () => {
      // 取消所有進行中的請求
      // (如果有需要的話)
    };
  }, []);

  // 初始化數據獲取
  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      
      // 獲取換班請求列表
      const swapResponse = await apiService.shiftSwap.getRequests();
      
      // 獲取可用的月份(已有班表的月份)
      const monthsResponse = await apiService.shiftSwap.getAvailableMonths();
      
      const requests = swapResponse.data || [];
      console.log(`初始化：獲取到 ${requests.length} 條換班請求`);
      
      setSwapRequests(requests);
      
      // 提取所有請求者的資訊為過濾做準備
      if (requests.length > 0) {
        const requestors = requests
          .filter(req => req.requestor)
          .map(req => ({
            id: req.requestor.id,
            name: req.requestor.full_name || `${req.requestor.first_name || ''} ${req.requestor.last_name || ''}`.trim(),
            identity: req.requestor.identity
          }));
        
        // 去除重複值
        const uniqueRequestors = requestors.reduce((acc, current) => {
          const x = acc.find(item => item.id === current.id);
          if (!x) {
            return acc.concat([current]);
          } else {
            return acc;
          }
        }, []);
        
        setAvailableRequestors(uniqueRequestors);
      }
      
      // 應用過濾規則
      updateFilteredRequests(requests);
      
      setAvailableMonths(monthsResponse.data || []);
      
      setError(null);
    } catch (err) {
      console.error("獲取初始數據失敗:", err);
      setError(err.response?.data?.message || err.message || '無法加載數據');
    } finally {
      setIsLoading(false);
    }
  };

  // 處理標籤切換
  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  // 更新過濾後的請求列表
  const updateFilteredRequests = useCallback((requests) => {
    // 先過濾請求
    const filtered = requests.filter(req => {
      // 0. 根據當前標籤過濾
      const matchesTab = currentTab === 0 || 
        (currentTab === 1 && req.swap_type === 'shift') ||
        (currentTab === 2 && req.swap_type === 'mission') ||
        (currentTab === 3 && req.swap_type === 'overtime');
      
      // 1. 關鍵字搜尋
      const lowerSearchTerm = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        (req.notes?.toLowerCase() || '').includes(lowerSearchTerm) ||
        (req.requestor?.full_name?.toLowerCase() || '').includes(lowerSearchTerm) ||
        (req.target_nurse?.full_name?.toLowerCase() || '').includes(lowerSearchTerm) ||
        // 增加對班別的搜尋支援
        (req.from_shift?.toLowerCase() || '').includes(lowerSearchTerm) ||
        (req.to_shift?.toLowerCase() || '').includes(lowerSearchTerm) ||
        // 增加對工作區域的搜尋支援
        (req.from_mission?.toLowerCase() || '').includes(lowerSearchTerm) ||
        (req.to_mission?.toLowerCase() || '').includes(lowerSearchTerm);
      
      // 檢查請求是否過期
      const displayStatus = getRequestDisplayStatus(req);
      
      // 2. 狀態篩選 - 使用 hiddenStatuses 進行過濾
      // 如果狀態在 hiddenStatuses 中，則隱藏該請求
      const isVisible = !hiddenStatuses.includes(displayStatus);
      
      // 2.1 根據顯示/隱藏設定過濾
      // let matchesVisibility = true;
      
      // 處理不同狀態的顯示邏輯
      // if (displayStatus === 'expired' && !showExpired) {
      //   matchesVisibility = false;
      // } else if (req.status === 'accepted' && !showCompleted) {
      //   matchesVisibility = false;
      // } else if (req.status === 'cancelled' && !showCancelled) {
      //   matchesVisibility = false;
      // }
      
      // 3. 申請日期範圍篩選 - 已移除
      // const matchesDate = 
      //   (!startDate || new Date(req.created_at || req.from_date) >= startOfDay(startDate)) &&
      //   (!endDate || new Date(req.created_at || req.from_date) <= endOfDay(endDate));
      
      // 4. 要換班的日期範圍篩選
      const matchesShiftDate = 
        (!shiftStartDate || new Date(req.from_date) >= startOfDay(shiftStartDate)) &&
        (!shiftEndDate || new Date(req.from_date) <= endOfDay(shiftEndDate));
      
      // 5. 班別篩選
      const matchesShift = selectedShifts.length === 0 || selectedShifts.includes(req.from_shift);
      
      // 6. 請求者篩選
      const matchesRequestor = !requestorFilter || req.requestor?.id === requestorFilter;
      
      // 7. 僅顯示相同身份類型
      const matchesIdentity = !onlySameIdentity || 
        (user && req.requestor && req.requestor.identity === user.identity);
      
      return matchesTab && matchesSearch && isVisible && matchesShiftDate && 
             matchesShift && matchesRequestor && matchesIdentity;
    });
    
    // 按 from_date 日期降冪排序（較新的日期在前）
    const sortedRequests = [...filtered].sort((a, b) => {
      // 如果沒有日期，放到最後
      if (!a.from_date) return 1;
      if (!b.from_date) return -1;
      
      const dateA = new Date(a.from_date);
      const dateB = new Date(b.from_date);
      
      // 按日期降冪排列（較新的日期在前）
      return dateB - dateA;
    });
    
    setFilteredRequests(sortedRequests);
    // 重置頁碼
    setPage(1);
  }, [searchTerm, hiddenStatuses, shiftStartDate, shiftEndDate, 
      selectedShifts, requestorFilter, onlySameIdentity, user, currentTab]);

  // 當過濾條件變更時更新結果
  useEffect(() => {
    if (swapRequests.length > 0) {
      updateFilteredRequests(swapRequests);
    }
  }, [searchTerm, hiddenStatuses, shiftStartDate, shiftEndDate, 
      selectedShifts, requestorFilter, onlySameIdentity, updateFilteredRequests, swapRequests, currentTab]);

  // 獲取指定月份的班表及相關數據
  const fetchMonthData = async (date) => {
    try {
      // 設置 loading 狀態，但無需清空原有數據
      setIsLoading(true);
      setError(null);
      
      const monthStr = format(date, 'yyyy-MM');
      const year = format(date, 'yyyy');
      const month = format(date, 'M'); // 不帶前導零的月份
      
      console.log(`===== 開始獲取 ${year}年${month}月 的班表數據和加班資料... =====`);
      console.log('當前用戶信息:', {
        userId: user?.id,
        username: user?.username,
        userIdentity: user?.identity,
        nurseType: userNurseType
      });
      
      // 首先檢查緩存中是否已有數據
      if (monthlySchedules[monthStr] && Object.keys(monthlySchedules[monthStr]).length > 0) {
        console.log('使用緩存的月班表數據');
        
        // 使用緩存數據生成日曆
        generateCalendarData(
          date, 
          monthlySchedules[monthStr], 
          weeklyAssignments[monthStr] || {}, 
          overtimeRecords[monthStr] || { records: [] }
        );
        
        setIsLoading(false);
        return;
      }
      
      // 獲取月班表
      console.log(`調用月班表API: year=${year}, month=${month}`);
      const monthlyResponse = await apiService.schedule.getMonthlySchedule(year, month);
      console.log('月班表API響應狀態:', monthlyResponse.status);
      if (monthlyResponse.data) {
        console.log('API響應結構:', JSON.stringify(Object.keys(monthlyResponse.data)).substring(0, 300));
        if (monthlyResponse.data.data) {
          console.log('找到data字段，包含以下結構:', Object.keys(monthlyResponse.data.data));
        }
      }
      
      // 獲取用戶ID
      const userId = user?.id;
      if (!userId) {
        console.error('無法獲取用戶ID');
        setError('無法獲取用戶信息');
        setIsLoading(false);
        return;
      }
      
      // 處理API響應數據 - 保持原始結構，不做額外處理
      const responseData = monthlyResponse.data || {};
      
      // 更新月度班表緩存
      setMonthlySchedules(prev => ({
        ...prev,
        [monthStr]: responseData
      }));
      
      // 設定加班API請求的日期範圍
      const startDateStr = format(startOfMonth(date), 'yyyy-MM-dd');
      const endDateStr = format(endOfMonth(date), 'yyyy-MM-dd');
      
      // 使用 Promise.allSettled 並行請求其他數據
      let weeklyResponse = { data: {} };
      let overtimeResponse = { data: { records: [] } };
      
      try {
        // 使用 Promise.allSettled 並行請求其他數據
        const [weeklyResult, overtimeResult, nursesResult] = await Promise.allSettled([
          // 獲取工作分配（使用緩存）
          cachedScheduleDetailsRequest(apiService, 'shift-swap', year, month),
          
          // 獲取加班記錄 - 使用正確的 API 方法
          apiService.overtime.getMyRecords(startDateStr, endDateStr),
          
          // 獲取護理師列表
          apiService.users.getUsers()
        ]);
        
        console.log("所有 API 請求完成：", {
          工作分配: weeklyResult.status,
          加班記錄: overtimeResult.status,
          護理師列表: nursesResult.status
        });
        
        // 提取結果
        if (weeklyResult.status === 'fulfilled') {
          weeklyResponse = weeklyResult.value;
          
          if (weeklyResponse.fromCache) {
            console.log('ShiftSwap: 使用緩存的工作分配數據');
          }
          
          // 記錄工作分配 API 響應
          console.log('工作分配API返回數據:', {
            數據類型: typeof weeklyResponse.data,
            是否為對象: typeof weeklyResponse.data === 'object',
            數據長度: weeklyResponse.data ? Object.keys(weeklyResponse.data).length : 0,
            示例數據: weeklyResponse.data ? Object.keys(weeklyResponse.data).slice(0, 3) : null
          });
          
          // 保持原始數據結構
          setWeeklyAssignments(prev => ({
            ...prev,
            [monthStr]: weeklyResponse.data
          }));
        } else {
          console.warn('獲取工作分配失敗:', weeklyResult.reason);
          weeklyResponse = { data: {} };
        }
        
        // 處理加班記錄結果
        if (overtimeResult.status === 'fulfilled') {
          overtimeResponse = overtimeResult.value;
          console.log('加班記錄API返回數據:', {
            數據類型: typeof overtimeResponse.data,
            是否為數組: Array.isArray(overtimeResponse.data),
            數據長度: overtimeResponse.data ? 
              (Array.isArray(overtimeResponse.data) ? overtimeResponse.data.length : Object.keys(overtimeResponse.data).length) 
              : 0,
            示例數據: overtimeResponse.data && Array.isArray(overtimeResponse.data) && overtimeResponse.data.length > 0 ? 
              overtimeResponse.data[0] : null
          });
          
          // 調整加班數據格式以適配calendar生成函數
          // overtimeData.records 結構是 generateCalendarData 函數所期望的
          const formattedOvertimeData = {
            records: Array.isArray(overtimeResponse.data) ? overtimeResponse.data : []
          };
          
          setOvertimeRecords(prev => ({
            ...prev,
            [monthStr]: formattedOvertimeData
          }));
          
          // 更新overtimeResponse以傳遞給generateCalendarData
          overtimeResponse.data = formattedOvertimeData;
        } else {
          console.warn('獲取加班記錄失敗:', overtimeResult.reason);
          // 設置空的加班記錄
          const emptyOvertimeData = { records: [] };
          setOvertimeRecords(prev => ({
            ...prev,
            [monthStr]: emptyOvertimeData
          }));
          overtimeResponse = { data: emptyOvertimeData };
        }
        
        // 處理護理師列表結果
        if (nursesResult.status === 'fulfilled' && nursesResult.value.data) {
          const nursesList = nursesResult.value.data;
          console.log(`從API獲取了 ${nursesList.length} 名護理師`);
          
          // 格式化護理師列表
          const formattedNurses = nursesList.map(nurse => ({
            id: nurse.id,
            name: nurse.full_name || `${nurse.first_name || ''} ${nurse.last_name || ''}`.trim(),
            full_name: nurse.full_name || `${nurse.first_name || ''} ${nurse.last_name || ''}`.trim(),
            identity: nurse.identity || ''
          }));
          
          setNurses(formattedNurses);
        }
      } catch (err) {
        console.warn('獲取輔助數據時出錯 (非致命):', err.message);
      }
      
      // 使用數據生成日曆視圖
      generateCalendarData(
        date,
        responseData,  // 將完整的API響應傳給generateCalendarData
        weeklyResponse.data,
        overtimeResponse.data
      );
      
    } catch (err) {
      console.error('獲取月數據失敗:', err);
      setError(err.response?.data?.message || err.message || '無法加載班表數據');
      
      // 創建空日曆而不是使用測試數據
      console.log('獲取月班表失敗，創建空日曆...');
      createEmptyCalendarData(date);
    } finally {
      setIsLoading(false);
    }
  };

  // 根據班表生成日曆數據
  const generateCalendarData = (date, scheduleData, assignmentData, overtimeData) => {
    try {
      console.log("===== 開始生成ShiftSwap月曆數據 =====");
      
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
      
      // 紀錄找到的班別數量，用於診斷
      let foundShiftsCount = 0;
      
      console.log("用戶ID:", userId);
      
      // 獲取年月
      const year = format(date, 'yyyy');
      const month = format(date, 'M'); // 不帶前導零的月份
      
      console.log(`嘗試獲取 ${year}年${month}月的班表數據`);
      console.log("scheduleData類型:", typeof scheduleData);
      console.log("scheduleData結構:", JSON.stringify(scheduleData).substring(0, 300) + "...");
      
      let userShifts = [];
      
      // 正確解析API返回的數據結構
      if (scheduleData && scheduleData.data && scheduleData.data[year] && scheduleData.data[year][month]) {
        console.log(`找到 ${year}年${month}月的班表數據，開始處理...`);
        
        const nurseSchedules = scheduleData.data[year][month].schedule || [];
        console.log(`班表中包含 ${nurseSchedules.length} 個護理師資料`);
        
        // 尋找當前用戶的班表
        const userSchedule = nurseSchedules.find(nurse => String(nurse.id) === String(userId));
        
        if (userSchedule) {
          console.log(`找到用戶 ${userId} (${userSchedule.name}) 的班表數據`);
          userShifts = userSchedule.shifts || [];
          console.log(`用戶班表天數: ${userShifts.length}`);
          console.log(`班表內容: ${userShifts.join(', ')}`);
        } else {
          console.warn(`在 ${nurseSchedules.length} 名護理師中未找到ID=${userId}的用戶班表`);
          console.log("所有護理師ID:", nurseSchedules.map(nurse => nurse.id).join(", "));
        }
      } else if (scheduleData && scheduleData.originalData && scheduleData.originalData.data) {
        // 向後兼容舊的數據結構
        const data = scheduleData.originalData.data;
        console.log("使用舊的數據結構");
        
        if (data[year] && data[year][month] && data[year][month].schedule) {
          console.log(`從舊數據結構找到 ${year}年${month}月的班表`);
          
          // 尋找當前用戶的班表
          const userSchedule = data[year][month].schedule.find(nurse => String(nurse.id) === String(userId));
          
          if (userSchedule) {
            console.log(`從舊結構找到用戶班表`);
            userShifts = userSchedule.shifts || [];
          }
        }
      } else if (scheduleData && scheduleData.userShifts) {
        // 如果直接傳入了用戶班表，使用它
        userShifts = scheduleData.userShifts;
        console.log(`使用直接傳入的用戶班表，長度: ${userShifts.length}`);
      } else {
        console.warn("無法從數據中提取用戶班表，嘗試從可能的其他位置查找");
        
        // 額外嘗試其他可能的數據結構
        if (scheduleData && typeof scheduleData === 'object') {
          console.log("檢查其他可能的數據路徑...");
          // 遍歷所有可能的嵌套結構
          const logKeys = (obj, prefix = '') => {
            if (obj && typeof obj === 'object') {
              Object.keys(obj).forEach(key => {
                console.log(`${prefix}${key}`);
                if (obj[key] && typeof obj[key] === 'object') {
                  logKeys(obj[key], `${prefix}${key}.`);
                }
              });
            }
          };
          logKeys(scheduleData);
        }
      }
      
      // 如果沒有找到用戶班表，記錄警告但繼續使用空班表
      if (!userShifts || userShifts.length === 0) {
        console.warn("未找到用戶班表數據，將使用空班表");
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
              console.log(`${dateString}: 班別=${shift}`);
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
            console.log(`${dateString}: 找到工作分配:`, {
              區域代碼: mission,
              原始數據: matchingRecord
            });
          }
          
          // 獲取加班記錄
          if (overtimeData && overtimeData.records) {
            console.log(`檢查 ${dateString} 的加班記錄`, {
              加班數據: overtimeData.records,
              數據類型: typeof overtimeData.records,
              數據長度: overtimeData.records.length
            });

            // 簡化加班記錄查找邏輯，因為使用 /overtime/me 端點時所有記錄都是當前用戶的
            const dayOvertime = overtimeData.records.find(record => 
              record.date === dateString
            );
            
            if (dayOvertime) {
              // 獲取加班班種
              overtimeShift = dayOvertime.overtime_shift || '';
              overtime = `加班${overtimeShift ? `(${overtimeShift})` : ''}`;
              hasOvertime = true;
              console.log(`找到 ${dateString} 的加班記錄:`, {
                加班班種: overtimeShift,
                原始數據: dayOvertime
              });
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
      console.log(`生成了 ${calendar.length} 週的日曆數據，找到 ${foundShiftsCount} 天的班別數據`);
      
      // 顯示每週的班別統計
      calendar.forEach((weekData, weekIndex) => {
        const shifts = weekData
          .filter(cell => cell.date)
          .map(cell => cell.shift)
          .join('');
        console.log(`第${weekIndex+1}週班別: ${shifts}`);
      });
      
      // 如果沒有找到任何班別數據，輸出警告但繼續使用生成的空日曆
      if (foundShiftsCount === 0) {
        console.warn("未找到任何班別數據，將使用空班表（全部休假）");
      }
      
      // 更新日曆數據
      setCalendarData(calendar);
    } catch (err) {
      console.error('生成日曆數據失敗:', err);
      // 生成空日曆而不是使用測試數據
      console.warn("由於錯誤，生成空班表");
      createEmptyCalendarData(date);
    }
  };

  // 生成空的日曆數據（全部為休假）
  const createEmptyCalendarData = (date) => {
    try {
      console.log("生成空日曆數據...");
      
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
      
      // 處理月份中的每一天
      days.forEach((day) => {
        // 所有天都設為休假
        week.push({
          date: day,
          shift: 'O',
          mission: '',
          overtime: ''
        });
        
        // 如果是星期六或月份的最後一天，添加到日曆並重新開始新的一週
        if (getDay(day) === 6 || format(day, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')) {
          calendar.push([...week]);
          week = [];
        }
      });
      
      // 設置日曆數據
      setCalendarData(calendar);
      console.log('空日曆數據生成成功');
    } catch (err) {
      console.error('生成空日曆數據失敗:', err);
      setError(`無法生成日曆視圖: ${err.message}`);
    }
  };

  // 生成測試用的日曆數據
  const createTestCalendarData = (date) => {
    try {
      console.log("生成測試用日曆數據...");
      
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
      
      // 測試用的班別循環 - 確保包含用戶護理師類型的可能班別
      const nurseShiftTypes = SHIFT_TYPES_BY_FORMULA[userNurseType] || ['D', 'A', 'N', 'O'];
      console.log(`根據用戶類型 ${userNurseType} 使用班別類型:`, nurseShiftTypes);
      
      // 處理月份中的每一天
      days.forEach((day, index) => {
        // 生成不同的班別
        const shift = nurseShiftTypes[index % nurseShiftTypes.length];
        
        // 根據星期幾生成不同的任務
        const dayOfWeek = getDay(day);
        let mission = '';
        let overtime = '';
        
        // 每週一三五添加工作區域任務
        if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
          mission = `區域${String.fromCharCode(65 + (index % 5))}`; // A, B, C, D, E
        }
        
        // 每週二四添加加班
        if (dayOfWeek === 2 || dayOfWeek === 4) {
          overtime = '2小時';
        }
        
        // 添加日期單元格
        week.push({
          date: day,
          shift,
          mission,
          overtime
        });
        
        // 如果是星期六或月份的最後一天，添加到日曆並重新開始新的一週
        if (dayOfWeek === 6 || format(day, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')) {
          calendar.push([...week]);
          week = [];
        }
      });
      
      // 顯示生成的測試數據統計信息
      console.log(`生成了 ${calendar.length} 週的測試日曆數據`);
      
      // 設置日曆數據
      setCalendarData(calendar);
      
      // 同時更新護理師列表，生成測試用護理師數據
      const testNurses = Array.from({ length: 10 }, (_, i) => ({
        id: `test-${i + 1}`,
        name: `測試護理師 ${i + 1}`,
        full_name: `測試護理師 ${i + 1}`,
        identity: i % 2 === 0 ? '麻醉專科護理師' : '恢復室護理師'
      }));
      
      // 更新護理師列表
      setNurses(testNurses);
      
      console.log('測試用日曆數據生成成功');
    } catch (err) {
      console.error('生成測試日曆數據失敗:', err);
      setError(`無法生成測試日曆視圖: ${err.message}`);
    }
  };

  // 處理從哪天換班的選擇
  const handleFromDateSelect = (day) => {
    setSwapFormData(prev => ({ ...prev, fromDate: day.date }));
    setSelectedFromDateDetails(day);
  };

  // 處理換到哪天的選擇
  const handleToDateSelect = (day) => {
    setSwapFormData(prev => ({ ...prev, toDate: day.date }));
    setSelectedToDateDetails(day);
  };

  // 處理換班類型選擇
  const handleSwapTypeChange = (event) => {
    setSwapFormData(prev => ({ ...prev, swapType: event.target.value }));
  };

  // 處理指定對象選擇
  const handleTargetNurseChange = (event) => {
    setSwapFormData(prev => ({ ...prev, targetNurseId: event.target.value }));
  };

  // 處理備註變更
  const handleNotesChange = (event) => {
    setSwapFormData(prev => ({ ...prev, notes: event.target.value }));
  };

  // 檢查換班是否可行
  const validateSwapRequest = () => {
    if (!swapFormData.fromDate || !swapFormData.toDate) {
      return { valid: false, message: '請選擇要換班的日期和目標日期' };
    }
    
    // 如果有指定對象，檢查對方的班別是否可以換
    if (swapFormData.targetNurseId) {
      // 這裡需要根據實際數據結構檢查目標護理師在目標日期的班別
      // 目前僅作為示例，實際邏輯需要調整
      return { valid: true, message: '換班條件符合' };
    }
    
    return { valid: true, message: '換班條件符合' };
  };

  // 提交換班申請
  const submitSwapRequest = async () => {
    try {
      // 基本驗證
      if (!selectedDay || !selectedDay.date) {
        setNotification({
          open: true,
          message: '請選擇要換班的日期',
          type: 'error'
        });
        return;
      }
      
      if (!swapOperationType) {
        setNotification({
          open: true,
          message: '請選擇換班類型',
          type: 'error'
        });
        return;
      }
      
      // 針對班別交換，必須選擇目標班別
      if (swapOperationType === 'shift' && !targetShift) {
        setNotification({
          open: true,
          message: '請選擇想要換成的班別',
          type: 'error'
        });
        return;
      }
      
      // 檢查班別兼容性（僅對班別交換進行檢查）
      if (swapOperationType === 'shift' && targetShift) {
        const currentDate = format(selectedDay.date, 'yyyy-MM-dd');
        const dateObj = new Date(currentDate);
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1;
        
        // 獲取並整理班表數據
        const userSchedules = prepareShiftSchedule(monthlySchedules, year, month, user.id);
        
        // 創建臨時變更，模擬換班後的狀態
        // 將目標日期的班別從當前班別改為目標班別
        const tempChanges = {
          [currentDate]: {
            [user.id]: targetShift
          }
        };
        
        console.log('班表檢查臨時變更:', {
          當前日期: currentDate,
          用戶ID: user.id,
          當前班別: selectedDay.shift || 'O',
          目標班別: targetShift,
          臨時變更: tempChanges
        });
        
        // 檢查目標班別是否與當前班表兼容
        const compatibilityCheck = checkShiftCompatibility(
          userSchedules, 
          currentDate, 
          targetShift, 
          user.id,
          tempChanges
        );
        
        if (!compatibilityCheck.valid) {
          setNotification({
            open: true,
            message: `無法申請換班：${compatibilityCheck.message}`,
            type: 'error'
          });
          return;
        }
      }
      
      // 設置加載狀態
      setIsLoading(true);
      
      // 獲取日期和班別信息
      const currentDate = format(selectedDay.date, 'yyyy-MM-dd');
      const currentShift = selectedDay.shift || 'O';
      const missionContent = selectedDay.mission || '';
      const overtimeContent = selectedDay.overtime || '';
      const overtimeShift = selectedDay.overtimeShift || '';
      
      console.log(`準備提交換班申請：
        日期：${currentDate}
        換班類型：${swapOperationType}
        原班別：${currentShift}
        目標班別：${targetShift || '無'}
        原工作分配：${missionContent}
        原加班內容：${overtimeContent}
        原加班班別：${overtimeShift}
        目標護理師：${swapFormData.targetNurseId || '未指定'}
        備註：${swapFormData.notes || '無'}
      `);
      
      // 準備請求數據
      const requestData = {
        swap_type: swapOperationType,
        from_date: currentDate, // 要換班的日期（例如5/25）
        to_date: currentDate,   // 換班請求的有效期限，設為同一天因為過了這天就沒意義了
        from_shift: currentShift,
        to_shift: targetShift || currentShift, // 確保始終有to_shift字段值，默認用當前班別
        target_nurse_id: swapFormData.targetNurseId || null,
        notes: swapFormData.notes || ''
      };
      
      // 根據換班類型添加額外字段
      if (swapOperationType === 'shift') {
        // 班別交換已經在上面設置了to_shift
        // 確保to_shift有值
        if (!targetShift) {
          // 錯誤處理 - 班別交換必須有目標班別
          setNotification({
            open: true,
            message: '請選擇想要換成的班別',
            type: 'error'
          });
          setIsLoading(false);
          return;
        }
        requestData.to_shift = targetShift;
      } else if (swapOperationType === 'mission') {
        // 工作內容交換
        requestData.from_mission = missionContent;
        requestData.to_mission = swapFormData.toMission || '未指定';
        // 確保to_shift與from_shift一致
        requestData.to_shift = currentShift;
        
        // 移除自動生成備註的邏輯
        // 不再添加默認備註，由用戶自行輸入
        
        console.log('工作內容交換請求資料:', {
          from_mission: requestData.from_mission,
          to_mission: requestData.to_mission,
          notes: requestData.notes
        });
      } else if (swapOperationType === 'overtime') {
        // 處理不想加班的請求
        // 對於加班換班，我們需要記錄當前的加班班種（如果有）
        console.log('加班信息詳情:', {
          selectedDay, 
          overtime: selectedDay.overtime,
          overtimeShift: selectedDay.overtimeShift,
          加班日期: currentDate,
          加班班種: overtimeShift
        });
        requestData.from_overtime = overtimeShift || '加班';
        requestData.to_overtime = '未指定';  // 由接受者來指定
        // 確保to_shift與from_shift一致
        requestData.to_shift = currentShift;
      }
      
      console.log('最終換班請求數據:', requestData);
      
      // 發送API請求
      console.log('發送換班請求:', requestData);
      try {
        const response = await apiService.shiftSwap.create(requestData);
        
        // 請求成功
        if (response.status >= 200 && response.status < 300) {
          // 關閉對話框
          handleCloseSwapDialog();
          
          // 成功通知
          setNotification({
            open: true,
            message: '換班申請已成功提交',
            type: 'success'
          });
          
          // 重新獲取換班請求列表
          fetchShiftSwapRequests();
        } else {
          // 請求成功但業務邏輯失敗
          console.error('換班申請業務邏輯失敗:', response.data);
          setNotification({
            open: true,
            message: typeof response.data?.message === 'string' ? response.data.message : 
                    typeof response.data?.detail === 'string' ? response.data.detail : 
                    '申請提交失敗',
            type: 'error'
          });
        }
      } catch (apiError) {
        // 處理API請求錯誤
        console.error('提交換班申請失敗:', apiError);
        console.error('錯誤詳情:', {
          錯誤訊息: apiError.message,
          響應數據: apiError.response?.data,
          狀態碼: apiError.response?.status,
          狀態文本: apiError.response?.statusText
        });
        
        // 獲取詳細錯誤信息
        let errorMsg = '申請提交失敗，請稍後重試';
        
        try {
          if (apiError.response?.data) {
            if (typeof apiError.response.data === 'string') {
              errorMsg = apiError.response.data;
            } else if (apiError.response.data.detail) {
              errorMsg = typeof apiError.response.data.detail === 'string' 
                ? apiError.response.data.detail 
                : JSON.stringify(apiError.response.data.detail);
            } else if (apiError.response.data.message) {
              errorMsg = apiError.response.data.message;
            } else if (Array.isArray(apiError.response.data)) {
              // 處理可能的數組錯誤信息
              errorMsg = apiError.response.data.map(e => e.msg || JSON.stringify(e)).join('; ');
            } else {
              // 嘗試解析錯誤對象的所有字段
              const errorDetails = Object.entries(apiError.response.data)
                .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
                .join('; ');
              errorMsg = errorDetails || JSON.stringify(apiError.response.data);
            }
          } else if (apiError.message) {
            errorMsg = apiError.message;
          } else if (typeof apiError === 'object') {
            // 處理純物件錯誤
            errorMsg = JSON.stringify(apiError);
          }
        } catch (parseError) {
          console.error('解析錯誤詳情失敗:', parseError);
          errorMsg = '解析錯誤詳情失敗，請稍後重試';
        }
        
        // 記錄最終顯示給用戶的錯誤信息
        console.warn('最終錯誤信息:', errorMsg);
        
        setNotification({
          open: true,
          message: errorMsg,
          type: 'error'
        });
      }
    } catch (err) {
      // 處理其他非API錯誤
      console.error('換班申請處理過程中發生錯誤:', err);
      setNotification({
        open: true,
        message: err.message || '處理換班申請時發生未知錯誤',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 添加專用於更新換班請求列表的函數
  const fetchShiftSwapRequests = async () => {
    try {
      setIsLoading(true);
      console.log("開始獲取換班請求數據");
      
      const swapResponse = await apiService.shiftSwap.getRequests();
      const requests = swapResponse.data || [];
      
      console.log(`獲取到 ${requests.length} 條換班請求`);
      setSwapRequests(requests);
      setFilteredRequests(requests);
      setError(null);
    } catch (err) {
      console.error("獲取換班請求失敗:", err);
      setError(err.response?.data?.message || err.message || '無法加載換班申請數據');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 處理打開換班表單對話框
  const handleOpenSwapDialog = () => {
    setOpenSwapDialog(true);
    setSelectedDay(null);
    setSwapOperationType(null);
    setTargetShift(null);
    setSwapFormData({
      selectedMonth: selectedDate,
      fromDate: null,
      toDate: null,
      targetNurseId: "",
      swapType: "shift",
      notes: "",
      toMission: ""  // 添加目標工作區域字段
    });
    
    // 獲取當前月份的班表數據
    fetchMonthData(selectedDate);
  };

  // 處理選擇換班操作類型
  const handleSwapOperationTypeSelect = (type) => {
    setSwapOperationType(type);
    
    // 根據操作類型設置預設目標班別
    if (type === 'shift') {
      // 如果是班別換班，則清空目標班別讓用戶選擇
      setTargetShift(null);
      // 清空工作區域
      setSwapFormData(prev => ({ ...prev, toMission: "" }));
    } else if (type === 'mission') {
      // 如果是工作分配換班，則目標班別與當前班別相同
      setTargetShift(selectedDay?.shift || 'O');
      // 清空工作區域，讓用戶重新選擇
      setSwapFormData(prev => ({ ...prev, toMission: "" }));
    } else if (type === 'overtime') {
      // 如果是加班換班，則目標班別與當前班別相同
      setTargetShift(selectedDay?.shift || 'O');
      // 清空工作區域
      setSwapFormData(prev => ({ ...prev, toMission: "" }));
    }
  };

  // 處理選擇目標班別
  const handleTargetShiftSelect = (shift) => {
    setTargetShift(shift);
  };

  // 處理關閉換班對話框
  const handleCloseSwapDialog = () => {
    setOpenSwapDialog(false);
    setSwapOperationType(null);
    setTargetShift(null);
    setSelectedDay(null);
    // 重置表單數據
    setSwapFormData({
      selectedMonth: new Date(),
      fromDate: null,
      toDate: null,
      targetNurseId: "",
      swapType: "shift",
      notes: "",
      toMission: ""  // 重置工作區域
    });
  };

  // 處理通知關閉
  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  // 檢查用戶是否有資格接受換班申請
  const checkSwapEligibility = (request) => {
    if (!request || !user) return { eligible: false, reason: '無法檢查資格' };
    
    // 檢查基本條件
    if (request.requestor_id === user.id) {
      return { eligible: false, reason: '不能接受自己的換班申請' };
    }
    
    if (request.status !== 'pending') {
      return { eligible: false, reason: '此申請已被處理' };
    }
    
    if (request.target_nurse_id && request.target_nurse_id !== user.id) {
      return { eligible: false, reason: '此申請已指定其他護理師接受' };
    }
    
    // 安全獲取用戶角色
    const userRole = user.role || '';
    // admin不能接受換班申請
    if (userRole === 'admin') {
      return { eligible: false, reason: '系統管理員不能接受換班申請' };
    }
    
    // 檢查班別相關條件
    const userIdentity = user.identity || '';
    const requestIdentity = request.requestor?.identity || '';
    
    // 如果是不同類型的護理師（麻醉專科與恢復室）
    if ((userIdentity.includes('恢復室') && requestIdentity.includes('麻醉')) || 
        (userIdentity.includes('麻醉') && requestIdentity.includes('恢復室'))) {
      return { eligible: false, reason: '不同類型的護理師無法互換班別' };
    }
    
    // 如果通過所有檢查
    return { eligible: true, reason: '' };
  };

  // 修改檢查是否可以刪除/取消換班請求的函數
  const canDeleteRequest = (request) => {
    if (!request || !user) return false;
    
    // 如果請求已過期，則不能刪除
    if (isRequestExpired(request) && request.status === 'pending') {
      return false;
    }
    
    // 以下人員可以操作換班請求:
    // 1. 換班申請人可以取消自己的請求
    // 2. 管理員可以駁回所有請求
    // 3. 護理長可以駁回所有請求
    
    const isAdmin = user.role === 'admin';
    const isLeader = user.identity === 'anesthesia_leader' || user.identity === '麻醉科Leader';
    const isHeadNurse = user.role === 'head_nurse';
    const isRequester = request.requestor_id === user.id;
    
    // 檢查權限
    if (isAdmin || isLeader || isHeadNurse) {
      return true; // 管理員、領導和護理長可以操作任何請求
    } else if (isRequester && request.status === 'pending') {
      return true; // 申請人可以取消待處理的請求
    }
    
    return false;
  };

  // 根據請求狀態和用戶角色獲取刪除按鈕文本
  const getDeleteButtonText = (request) => {
    if (!request || !user) return '刪除';
    
    const isAdmin = user.role === 'admin';
    const isLeader = user.identity === 'anesthesia_leader' || user.identity === '麻醉科Leader';
    const isHeadNurse = user.role === 'head_nurse';
    const isRequester = request.requestor_id === user.id;
    
    // 已接受的請求，管理員/護理長/領導可以駁回
    if (request.status === 'accepted' && (isAdmin || isLeader || isHeadNurse)) {
      return '駁回並恢復班表';
    }
    
    // 待處理的請求
    if (request.status === 'pending') {
      if (isRequester) {
        return '取消申請';
      } else if (isAdmin || isLeader || isHeadNurse) {
        return '駁回申請';
      }
    }
    
    return '刪除';
  };

  // 渲染換班表單
  const renderSwapForm = () => {
    if (!openSwapDialog) return null;
    
    // 將週標頭改為從週一開始
    const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
    
    // 獲取今天的日期，用於比較
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 設置今天的時間為00:00:00
    
    return (
      <Dialog
        open={openSwapDialog}
        onClose={handleCloseSwapDialog}
        fullWidth
        maxWidth="md"
        fullScreen={{ xs: true, md: false }}
        sx={{
          '& .MuiDialog-paper': {
            width: { xs: '100%', md: 'auto' },
            height: { xs: '100%', md: 'auto' },
            maxHeight: { xs: '100%', md: '90vh' },
            margin: { xs: 0, md: 2 },
          }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">申請換班</Typography>
            <IconButton onClick={handleCloseSwapDialog}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent dividers sx={{ p: 1 }}>
          <Box sx={{ mb: 2 }}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
              <DatePicker
                views={['year', 'month']}
                label="選擇月份"
                value={swapFormData.selectedMonth}
                onChange={handleMonthChange}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    sx: { '& .MuiInputBase-root': { height: 40 } }
                  }
                }}
              />
            </LocalizationProvider>
          </Box>
          
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : calendarData.length > 0 ? (
            <Box sx={{ mt: 3 }}>
              <style>{calendarStyles}</style>
              <div className="calendar-container">
                <table className="calendar-table">
                  <thead>
                    <tr>
                      {weekDays.map(day => (
                        <th key={day}>{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calendarData.map((week, weekIndex) => (
                      <tr key={weekIndex}>
                        {week.map((day, dayIndex) => {
                          // 檢查日期是否過期
                          const isExpired = day.date && day.date < today;
                          
                          return (
                            <td 
                              key={dayIndex}
                              className={`
                                ${!day.date ? 'empty-cell' : ''}
                                ${day.date && isToday(day.date) ? 'today' : ''}
                                ${selectedDay && day.date && selectedDay.date instanceof Date && 
                                  day.date instanceof Date && isEqual(day.date, selectedDay.date) ? 'selected' : ''}
                                ${isExpired ? 'expired-cell' : ''} 
                              `}
                              onClick={() => day.date && !isExpired && handleDateSelect(day)}
                              style={{
                                cursor: isExpired ? 'not-allowed' : 'pointer',
                                opacity: isExpired ? 0.5 : 1
                              }}
                            >
                              {day.date && <RenderCalendarCell day={day} />}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Box>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              請選擇月份以載入班表數據
            </Alert>
          )}
          
          {/* 已選擇日期的操作面板 */}
          {renderOperationPanel()}
        </DialogContent>
        
        <DialogActions sx={{ p: 1 }}>
          <Button onClick={handleCloseSwapDialog}>
            取消
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={submitSwapRequest}
            disabled={!selectedDay || !swapOperationType || (swapOperationType === 'shift' && !targetShift) || isLoading}
          >
            {isLoading ? <CircularProgress size={24} /> : '申請換班'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  // 渲染換班詳情抽屜
  // 獲取班別顏色樣式 (共用函數)
  const getShiftStyle = (shift, size = '35px') => {
    return {
      backgroundColor: SHIFT_COLORS[shift] || '#757575',
      color: shift === 'O' ? 'black' : 'white',
      width: size,
      height: size,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: '50%',
      fontSize: size === '35px' ? '16px' : '12px',
      fontWeight: 'bold'
    };
  };
  
  // 獲取加班標籤樣式 (共用函數)
  const getOvertimeStyle = (content, size = 'normal') => {
    const isSmall = size === 'small';
    return {
      backgroundColor: content === '未指定' || content === '無' ? '#E0E0E0' : '#FF8A65',
      color: content === '未指定' || content === '無' ? '#666' : 'white',
      minWidth: isSmall ? '30px' : '40px',
      height: isSmall ? '20px' : '28px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: '6px',
      fontSize: isSmall ? '10px' : '13px',
      fontWeight: 'bold',
      padding: isSmall ? '0 4px' : '0 8px'
    };
  };

  // 渲染換班內容的視覺化標示 (用於列表中)
  const renderSwapVisual = (request, isInline = true) => {
    const containerStyle = isInline ? 
      { display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 } : 
      { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 };
    
    const shiftSize = isInline ? '20px' : '35px';
    const overtimeSize = isInline ? 'small' : 'normal';

    return (
      <Box sx={containerStyle}>
        {/* 原內容 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {request.swap_type === 'overtime' ? (
            <Box sx={{ ...getOvertimeStyle(request.from_overtime || '無', overtimeSize) }}>
              {request.from_overtime ? (request.from_overtime + '加') : '無'}
            </Box>
          ) : request.swap_type === 'mission' ? (
            <Chip 
              label={request.from_mission || '未指定'}
              size={isInline ? 'small' : 'medium'}
              sx={{ 
                backgroundColor: '#4dabf5',
                color: 'white',
                height: isInline ? '18px' : '24px',
                fontSize: isInline ? '10px' : '12px',
                fontWeight: 'bold'
              }}
            />
          ) : (
            <Box sx={{ ...getShiftStyle(request.from_shift, shiftSize) }}>
              {request.from_shift || 'O'}
            </Box>
          )}
        </Box>
        
        {/* 箭頭 */}
        <ArrowForwardIcon sx={{ 
          color: '#666', 
          fontSize: isInline ? 16 : 20,
          mx: isInline ? 0.3 : 1
        }} />
        
        {/* 目標內容 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {request.swap_type === 'overtime' ? (
            <Box sx={{ ...getOvertimeStyle(request.to_overtime || '無', overtimeSize) }}>
              {request.to_overtime === '未指定' ? '不加班' : request.to_overtime || '無'}
            </Box>
          ) : request.swap_type === 'mission' ? (
            <Chip 
              label={request.to_mission || '未指定'}
              size={isInline ? 'small' : 'medium'}
              sx={{ 
                backgroundColor: '#81c784',
                color: 'white',
                height: isInline ? '18px' : '24px',
                fontSize: isInline ? '10px' : '12px',
                fontWeight: 'bold'
              }}
            />
          ) : (
            <Box sx={{ ...getShiftStyle(request.to_shift, shiftSize) }}>
              {request.to_shift || 'O'}
            </Box>
          )}
        </Box>
      </Box>
    );
  };

  const renderDetailDrawer = () => {
    if (!selectedRequest) return null;
    
    const isRequester = selectedRequest.requestor_id === user?.id;
    const isTargeted = selectedRequest.target_nurse_id === user?.id;
    const eligibilityCheck = checkSwapEligibility(selectedRequest);
    const displayStatus = getRequestDisplayStatus(selectedRequest);
    const canAccept = !isRequester && (selectedRequest.target_nurse_id === null || isTargeted) && 
                     selectedRequest.status === 'pending' && !isRequestExpired(selectedRequest) && eligibilityCheck.eligible;
    
    return (
      <Drawer
        anchor="right"
        open={openDetailDrawer}
        onClose={handleCloseDetail}
      >
        <Box sx={{ width: 400, p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">換班詳情</Typography>
            <IconButton onClick={handleCloseDetail}>
              <CloseIcon />
            </IconButton>
          </Box>
          
          <Divider sx={{ mb: 2 }} />
          
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography 
                variant="body1" 
                sx={{ 
                  fontWeight: 'bold',
                  // 已取消、已過期或已駁回的請求標題淡化
                  color: displayStatus === 'cancelled' || displayStatus === 'expired' || displayStatus === 'rejected' ? '#9e9e9e' : 'inherit'
                }}
              >
                {selectedRequest.requestor?.full_name || '未知用戶'} 的換班申請
              </Typography>
              <Chip 
                label={displayStatus === 'pending' ? '待處理' : 
                      displayStatus === 'accepted' ? '已完成' : 
                      displayStatus === 'rejected' ? '已駁回' : 
                      displayStatus === 'expired' ? '已過期' : '已取消'} 
                sx={{ 
                  ...STATUS_COLORS[displayStatus] 
                }} 
              />
            </Box>
            
            {selectedRequest.target_nurse_id && (
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold', color: '#f57c00' }}>
                指定對象: {selectedRequest.target_nurse?.full_name || '特定用戶'}
              </Typography>
            )}
            
            <Typography variant="body2" sx={{ mb: 2 }}>
              換班類型: {
                selectedRequest.swap_type === 'shift' ? '換班別' :
                selectedRequest.swap_type === 'mission' ? '換工作分配' : '換加班'
              }
            </Typography>
            
            <Paper sx={{ p: 2, bgcolor: '#f5f5f5', mb: 3, boxShadow: 'none', border: '1px solid #e0e0e0' }}>
              {/* 日期顯示在上方中央 */}
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  {selectedRequest.from_date}
                </Typography>
              </Box>
              
              {/* 班別轉換顯示 */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                {/* 標籤行 */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', px: 2 }}>
                  <Typography variant="caption" sx={{ textAlign: 'center' }}>
                    {selectedRequest.swap_type === 'overtime' ? '原加班' : 
                     selectedRequest.swap_type === 'mission' ? '原工作區域' : '原班別'}
                  </Typography>
                  <Typography variant="caption" sx={{ textAlign: 'center' }}>
                    {selectedRequest.swap_type === 'overtime' ? '目標狀態' : 
                     selectedRequest.swap_type === 'mission' ? '目標工作區域' : '目標班別'}
                  </Typography>
                </Box>
                
                {/* 視覺化換班內容 */}
                {renderSwapVisual(selectedRequest, false)}
                
                {/* 工作區域信息 - 只在非工作區域換班類型時顯示 */}
                {selectedRequest.swap_type !== 'mission' && (selectedRequest.from_mission || selectedRequest.to_mission) && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1 }}>
                    {selectedRequest.from_mission && (
                      <Typography variant="caption" sx={{ textAlign: 'center' }}>
                        {selectedRequest.from_mission}
                      </Typography>
                    )}
                    {selectedRequest.from_mission && selectedRequest.to_mission && (
                      <ArrowForwardIcon sx={{ color: '#666', fontSize: 16 }} />
                    )}
                    {selectedRequest.to_mission && (
                      <Typography variant="caption" sx={{ textAlign: 'center' }}>
                        {selectedRequest.to_mission}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
              
              {/* 加班信息 - 只在非加班換班類型時顯示 */}
              {selectedRequest.swap_type !== 'overtime' && selectedRequest.swap_type !== 'mission' && (selectedRequest.from_overtime || selectedRequest.to_overtime) && (
                <Box sx={{ textAlign: 'center', mt: 1, display: 'flex', justifyContent: 'center', gap: 2 }}>
                  <Box sx={{ ...getOvertimeStyle(selectedRequest.from_overtime || '無'), height: '24px' }}>
                    {selectedRequest.from_overtime ? (selectedRequest.from_overtime + '加') : '無加班'}
                  </Box>
                  <ArrowForwardIcon sx={{ color: '#666', fontSize: 18 }} />
                  <Box sx={{ ...getOvertimeStyle(selectedRequest.to_overtime || '無'), height: '24px' }}>
                    {selectedRequest.to_overtime ? (selectedRequest.to_overtime + '加') : '無加班'}
                  </Box>
                </Box>
              )}
            </Paper>
            
            {/* 備註 */}
            {selectedRequest.notes && (
              <Paper sx={{ p: 2, mt: 2, backgroundColor: '#f5f5f5', boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>備註:</Typography>
                <Typography variant="body2">{selectedRequest.notes}</Typography>
              </Paper>
            )}
            
            {/* 狀態信息 */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" color="text.secondary">
                申請時間: {new Date(selectedRequest.created_at).toLocaleString()}
              </Typography>
              
              {selectedRequest.acceptor_id && (
                <Typography variant="body2" color="text.secondary">
                  接受者: {selectedRequest.acceptor?.full_name || '未知用戶'}
                </Typography>
              )}
            </Box>
            
            {/* 操作按鈕 */}
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 2 }}>
              {/* 接受按鈕 - 只對有資格的用戶顯示，且不能接受已過期的請求 */}
              {!isRequester && selectedRequest.status === 'pending' && !isRequestExpired(selectedRequest) && (
                <Tooltip 
                  title={!eligibilityCheck.eligible ? eligibilityCheck.reason : ''}
                  placement="top"
                  arrow
                >
                  <span>
                    <Button 
                      variant="contained" 
                      color="primary"
                      onClick={() => handleAcceptSwap(selectedRequest.id)}
                      disabled={!eligibilityCheck.eligible || isLoading}
                    >
                      {isLoading ? <CircularProgress size={24} /> : '接受換班'}
                    </Button>
                  </span>
                </Tooltip>
              )}
              
              {/* 過期的請求顯示淡紫色的已過期按鈕 */}
              {isRequestExpired(selectedRequest) && selectedRequest.status === 'pending' && (
                <Button 
                  variant="outlined" 
                  disabled={true}
                  sx={{ color: '#ba68c8', borderColor: '#ba68c8' }} // 更淡的紫色
                >
                  已過期
                </Button>
              )}
              
              {/* 刪除/駁回按鈕 - 只對申請人、護理長和admin顯示，且不顯示在已過期的請求上 */}
              {canDeleteRequest(selectedRequest) && (
                <Button 
                  variant="outlined" 
                  color="error"
                  onClick={() => handleDeleteSwap(selectedRequest.id)}
                  disabled={isLoading}
                  startIcon={<DeleteIcon />}
                >
                  {isLoading ? <CircularProgress size={24} /> : getDeleteButtonText(selectedRequest)}
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      </Drawer>
    );
  };

  // 處理日期選擇
  const handleDateSelect = (day) => {
    // 檢查日期是否過期（早於今天）
    if (day.date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // 設置今天的時間為00:00:00
      
      if (day.date < today) {
        // 如果日期過期，不做任何操作
        console.log('不能選擇過期的日期');
        return;
      }
    }
    
    setSelectedDay(day);
    // 重置操作類型和目標班別
    setSwapOperationType(null);
    setTargetShift(null);
    // 更新表單中的日期
    setSwapFormData(prev => ({
      ...prev,
      fromDate: day.date,
      toDate: day.date
    }));
    console.log("選擇日期:", {
      日期: day.date,
      班別: day.shift,
      工作區域: day.mission,
      加班: day.overtime
    });
  };

  // 渲染日期選中後的操作面板
  const renderOperationPanel = () => {
    if (!selectedDay) return null;
    
    // 根據用戶身份類型獲取可用的班別選項
    // 直接使用之前定義的 userAvailableShifts
    const availableShifts = userAvailableShifts;
    
    // 安全獲取當前選中日期的班別
    const currentShift = selectedDay.shift || 'O';
    
    // 確保selectedDay.date是一個有效的日期對象
    const selectedDateStr = selectedDay.date instanceof Date ? format(selectedDay.date, 'yyyy-MM-dd') : '未選擇日期';
    
    return (
      <Paper sx={{ p: 2, mt: 2, mb: 3, boxShadow: 'none', border: '1px solid #e0e0e0' }}>
        <Typography variant="subtitle1" gutterBottom>
          已選擇日期: {selectedDateStr} - 班別: {currentShift}
          {selectedDay.overtime && ' (有加班)'}
        </Typography>
        
        {/* 選擇操作類型 */}
        {!swapOperationType ? (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              請選擇換班類型:
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <Button 
                variant="outlined" 
                color="primary" 
                onClick={() => handleSwapOperationTypeSelect('shift')}
                disabled={!currentShift}
              >
                換班別
              </Button>
              <Button 
                variant="outlined" 
                color="primary" 
                onClick={() => handleSwapOperationTypeSelect('mission')}
                disabled={!selectedDay || !selectedDay.mission}
              >
                換工作分配
              </Button>
              <Button 
                variant="outlined" 
                color="primary" 
                onClick={() => handleSwapOperationTypeSelect('overtime')}
                disabled={!selectedDay.overtime}
              >
                不想加班
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2">
                已選擇: {
                  swapOperationType === 'shift' ? '換班別' : 
                  swapOperationType === 'mission' ? '換工作分配' : 
                  '不想加班'
                }
              </Typography>
              <Button 
                size="small" 
                onClick={() => setSwapOperationType(null)}
                startIcon={<CloseIcon />}
              >
                重新選擇
              </Button>
            </Box>
            
            {/* 顯示不同操作類型的對應選項 */}
            {swapOperationType === 'shift' && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  想換成的班別:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                  {availableShifts.filter(shift => shift !== currentShift).map(shift => (
                    <Chip 
                      key={shift}
                      label={shift}
                      clickable
                      onClick={() => handleTargetShiftSelect(shift)}
                      color={targetShift === shift ? 'primary' : 'default'}
                      sx={{ 
                        backgroundColor: targetShift === shift ? (SHIFT_COLORS[shift] || '#9e9e9e') : (DESATURATED_SHIFT_COLORS[shift] || '#e0e0e0'),
                        color: (targetShift === shift || shift !== 'O') ? 'white' : 'black',
                        fontWeight: targetShift === shift ? 'bold' : 'normal',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          backgroundColor: SHIFT_COLORS[shift] || '#9e9e9e',
                          opacity: 0.9
                        }
                      }}
                    />
                  ))}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  註：不顯示當前的班別 "{currentShift}"，僅顯示{user?.identity?.includes('恢復室') ? '恢復室護理師' : '麻醉專科護理師'}可用的班別
                </Typography>
              </Box>
            )}
            
            {swapOperationType === 'mission' && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  需要與其他相同班別的護理師交換工作分配
                </Typography>
                
                <Box sx={{ mt: 2, mb: 2 }}>
                  <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold', mb: 1 }}>
                    目前工作區域: {selectedDay.mission || '未分配'}
                  </Typography>
                  
                  <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                    <InputLabel>想換到的工作區域</InputLabel>
                    <Select
                      value={swapFormData.toMission || ""}
                      label="想換到的工作區域"
                      onChange={(e) => setSwapFormData(prev => ({ ...prev, toMission: e.target.value }))}
                    >
                      <MenuItem value=""><em>不指定 (由接受者決定)</em></MenuItem>
                      <MenuItem value="OR1">OR1 - 手術室1</MenuItem>
                      <MenuItem value="OR2">OR2 - 手術室2</MenuItem>
                      <MenuItem value="OR3">OR3 - 手術室3</MenuItem>
                      <MenuItem value="OR5">OR5 - 手術室5</MenuItem>
                      <MenuItem value="OR6">OR6 - 手術室6</MenuItem>
                      <MenuItem value="OR7">OR7 - 手術室7</MenuItem>
                      <MenuItem value="OR8">OR8 - 手術室8</MenuItem>
                      <MenuItem value="OR9">OR9 - 手術室9</MenuItem>
                      <MenuItem value="OR11">OR11 - 手術室11</MenuItem>
                      <MenuItem value="OR13">OR13 - 手術室13</MenuItem>
                      <MenuItem value="DR">DR - 恢復室</MenuItem>
                      <MenuItem value="3F1">3F1 - 三樓1</MenuItem>
                      <MenuItem value="3F2">3F2 - 三樓2</MenuItem>
                      <MenuItem value="3F_Recovery">3F_Recovery - 三樓恢復室</MenuItem>
                      <MenuItem value="CC">CC - 疼痛控制中心</MenuItem>
                      <MenuItem value="F1">F1 - 會診室1</MenuItem>
                      <MenuItem value="F2">F2 - 會診室2</MenuItem>
                      <MenuItem value="P">P - 備用</MenuItem>
                      <MenuItem value="PAR1">PAR1 - 麻醉準備區1</MenuItem>
                      <MenuItem value="PAR2">PAR2 - 麻醉準備區2</MenuItem>
                      <MenuItem value="C">C - 備料區</MenuItem>
                      <MenuItem value="HC1">HC1 - 一般照護1</MenuItem>
                      <MenuItem value="HC2">HC2 - 一般照護2</MenuItem>
                      <MenuItem value="HC3">HC3 - 一般照護3</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                
                <Typography variant="body2" color="text.secondary">
                  只有相同班別的護理師可以互換工作分配。請確保當天為白班。
                </Typography>
              </Box>
            )}
            
            {swapOperationType === 'overtime' && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  尋找願意替你加班的護理師
                </Typography>
                <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 'bold', mt: 1 }}>
                  原加班班別: {selectedDay.overtimeShift ? `${selectedDay.overtimeShift}加` : '加班'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  此操作將取消你的加班，由接受者來執行
                </Typography>
              </Box>
            )}
            
            {/* 指定對象選擇 */}
            <Box sx={{ mt: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>指定換班對象 (選填)</InputLabel>
                <Select
                  value={swapFormData.targetNurseId || ""}
                  label="指定換班對象 (選填)"
                  onChange={handleTargetNurseChange}
                >
                  <MenuItem value=""><em>不指定</em></MenuItem>
                  {Array.isArray(nurses) && nurses.length > 0 ? (
                    nurses.map((nurse) => (
                      <MenuItem key={nurse.id || Math.random().toString()} value={nurse.id || ""}>
                        {nurse.full_name || nurse.name || `${nurse.first_name || ''} ${nurse.last_name || ''}` || '未知用戶'}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled><em>無可用護理師</em></MenuItem>
                  )}
                </Select>
              </FormControl>
            </Box>
            
            {/* 備註 */}
            <Box sx={{ mt: 2 }}>
              <TextField
                label="備註 (選填)"
                multiline
                rows={2}
                fullWidth
                size="small"
                value={swapFormData.notes || ""}
                onChange={handleNotesChange}
                placeholder="請輸入換班原因或其他說明..."
              />
            </Box>
          </Box>
        )}
      </Paper>
    );
  };

  // 處理接受換班
  const handleAcceptSwap = async (requestId) => {
    if (!selectedRequest || !user || !requestId) return;
    
    try {
      setIsLoading(true);
      
      console.log(`準備接受換班請求 ID: ${requestId}`);
      
      // 安全地獲取所需的資料，避免 undefined
      const { 
        swap_type = '', 
        from_date = '', 
        to_date = '',
        from_shift = '', 
        to_shift = '', 
        from_mission = '', 
        to_mission = '', 
        from_overtime = '', 
        to_overtime = '', 
        requestor_id = ''
      } = selectedRequest || {};
      
      // 確保日期有效
      if (!from_date) {
        throw new Error('無效的日期資料');
      }
      
      // 獲取日期相關信息
      const dateObj = new Date(from_date);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const monthNum = dateObj.getMonth() + 1;
      
      // 對班別交換類型進行兼容性檢查
      if (swap_type === 'shift') {
        console.log('執行班別交換兼容性檢查');
        
        // 獲取當前班表數據
        const requestorSchedules = prepareShiftSchedule(monthlySchedules, year, monthNum, requestor_id);
        const acceptorSchedules = prepareShiftSchedule(monthlySchedules, year, monthNum, user.id);
        
        // 創建臨時變更，模擬換班後的狀態
        // 對於申請者：將目標日期的班別從 from_shift 改為 to_shift
        const requestorTempChanges = {
          [from_date]: {
            [requestor_id]: to_shift
          }
        };
        
        // 對於接受者：將目標日期的班別從當前班別改為 from_shift
        // 首先嘗試獲取接受者當前的班別
        let acceptorCurrentShift = 'O'; // 默認為休假
        if (acceptorSchedules[from_date] && acceptorSchedules[from_date][user.id]) {
          acceptorCurrentShift = acceptorSchedules[from_date][user.id];
        }
        
        const acceptorTempChanges = {
          [from_date]: {
            [user.id]: from_shift
          }
        };
        
        console.log('班表檢查臨時變更:', {
          申請者臨時變更: requestorTempChanges,
          接受者臨時變更: acceptorTempChanges,
          申請者目標班別: to_shift,
          接受者目標班別: from_shift,
          接受者當前班別: acceptorCurrentShift
        });
        
        // 檢查申請者在換班後的班表是否合規
        const requestorCheck = checkShiftCompatibility(
          requestorSchedules, 
          from_date, 
          to_shift, 
          requestor_id,
          requestorTempChanges
        );
        
        if (!requestorCheck.valid) {
          setNotification({
            open: true,
            message: `無法接受換班：申請者 - ${requestorCheck.message}`,
            type: 'error'
          });
          setIsLoading(false);
          return;
        }
        
        // 檢查接受者在換班後的班表是否合規
        const acceptorCheck = checkShiftCompatibility(
          acceptorSchedules, 
          from_date, 
          from_shift, 
          user.id,
          acceptorTempChanges
        );
        
        if (!acceptorCheck.valid) {
          setNotification({
            open: true,
            message: `無法接受換班：您 - ${acceptorCheck.message}`,
            type: 'error'
          });
          setIsLoading(false);
          return;
        }
      }
      
      console.log(`準備更新班表記錄: 類型=${swap_type}, 日期=${from_date}, 申請人ID=${requestor_id}, 接受者ID=${user.id}`);
      
      // 更新狀態文本，顯示當前正在處理的步驟
      setNotification({
        open: true,
        message: '正在處理換班申請...',
        type: 'info'
      });
      
      // 標記是否所有更新都成功
      let updateSuccess = true;
      
      try {
        // 根據換班類型調用不同的API更新班表
        if (swap_type === 'shift') {
          // 更新班別交換
          try {
            // 申請人的班別變更為目標班別
            await apiService.schedule.updateShift({
              user_id: requestor_id,
              date: from_date,
              shift_type: to_shift,
              year: year,
              month: month
            });
            
            // 接受者的班別變更為申請人原班別
            await apiService.schedule.updateShift({
              user_id: user.id,
              date: from_date,
              shift_type: from_shift,
              year: year,
              month: month
            });
            
            console.log('班別交換成功更新！');
          } catch (err) {
            console.error('更新班別失敗:', err);
            updateSuccess = false;
            throw new Error('更新班別失敗: ' + (err.message || '未知錯誤'));
          }
        } else if (swap_type === 'mission') {
          // 更新工作區域交換
          try {
            // 首先查詢acceptor當前的工作區域，無論to_mission是什麼值
            let acceptorMission = "";
            
            // 獲取月度數據以查找acceptor的現有工作區域
            const monthStr = `${year}-${month}`;
            const weeklyData = weeklyAssignments[monthStr];
            
            if (weeklyData && weeklyData.data) {
              // 從工作分配數據中查找acceptor在指定日期的工作區域
              const acceptorRecord = weeklyData.data.find(record => 
                record.date === from_date && 
                String(record.user_id) === String(user.id)
              );
              
              if (acceptorRecord && acceptorRecord.area_code) {
                acceptorMission = acceptorRecord.area_code;
                console.log(`找到接受者的工作區域: ${acceptorMission}`);
              } else {
                console.warn('未找到接受者當前工作區域，將使用默認值');
                // 如果找不到acceptor的工作區域，使用一個合理的默認值
                acceptorMission = from_mission || '';
              }
            } else {
              console.warn('未找到工作分配數據，將使用默認值');
              acceptorMission = from_mission || '';
            }
            
            // 無論to_mission是什麼值，都進行實際的交換操作
            // requestor獲得acceptor的工作區域，acceptor獲得requestor的工作區域
            const updates = [
              {
                user_id: requestor_id,
                date: from_date,
                area_code: acceptorMission, // requestor獲得acceptor的工作區域
                year: year,
                month: month
              },
              {
                user_id: user.id,
                date: from_date,
                area_code: from_mission || '', // acceptor獲得requestor的工作區域
                year: year,
                month: month
              }
            ];
            
            console.log('正在更新工作分配:', {
              申請人ID: requestor_id,
              申請人新工作區域: acceptorMission,
              接受者ID: user.id,
              接受者新工作區域: from_mission || '',
              日期: from_date
            });
            
            await apiService.schedule.bulkUpdateAreaCodes(updates);
            console.log('工作分配交換成功更新！');
          } catch (err) {
            console.error('更新工作分配失敗:', err);
            updateSuccess = false;
            throw new Error('更新工作分配失敗: ' + (err.message || '未知錯誤'));
          }
        } else if (swap_type === 'overtime') {
          // 更新加班記錄
          try {
            const overtimeRecords = [];
            
            // 處理加班記錄 - 一般是將申請人的加班轉給接受者
            if (from_overtime) {
              // 把原本申請人的加班記錄轉移給接受者
              const record = {
                date: from_date,
                overtime_shift: from_overtime,
                user_ids: [user.id]  // 接受者的ID
              };
              
              overtimeRecords.push(record);
              
              // 明確移除申請者的加班記錄（創建一條空的記錄，確保申請者當天沒有加班）
              const clearRecord = {
                date: from_date,
                overtime_shift: "",  // 空字串表示無加班
                user_ids: [requestor_id]  // 申請者的ID
              };
              
              overtimeRecords.push(clearRecord);
            }
            
            if (overtimeRecords.length > 0) {
              console.log('正在更新加班記錄:', {
                記錄數量: overtimeRecords.length,
                記錄內容: overtimeRecords
              });
              
              // 使用專為換班流程設計的API端點，並確保數據格式正確
              await apiService.overtime.updateOvertimeMonth({ records: overtimeRecords });
              console.log('加班記錄交換成功更新！');
            }
          } catch (err) {
            console.error('更新加班記錄失敗:', err);
            updateSuccess = false;
            throw new Error('更新加班記錄失敗: ' + (err.message || '未知錯誤'));
          }
        }
        
        // 只有當所有更新操作都成功時，才調用API接受換班請求
        if (updateSuccess) {
          console.log('所有更新成功，現在接受換班請求');
          
          // 發送接受換班請求
          const response = await apiService.shiftSwap.accept(requestId);
          
          if (response.data) {
            // 更新完所有班表後顯示成功消息
            setNotification({
              open: true,
              message: '換班申請已成功接受並更新班表',
              type: 'success'
            });
            
            // 關閉詳情抽屜
            handleCloseDetail();
            
            // 更新換班請求列表
            fetchShiftSwapRequests();
          } else {
            throw new Error('接受換班請求失敗，伺服器未返回有效數據');
          }
        } else {
          throw new Error('更新班表失敗，無法接受換班請求');
        }
      } catch (updateErr) {
        console.error("更新班表或接受請求失敗:", updateErr);
        setNotification({
          open: true,
          message: updateErr.message || '處理換班請求時發生錯誤，換班未被接受',
          type: 'error'
        });
      }
    } catch (err) {
      console.error("接受換班整體處理失敗:", err);
      setNotification({
        open: true,
        message: err.response?.data?.message || err.message || '接受換班申請失敗',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 處理刪除/拒絕換班
  const handleDeleteSwap = async (requestId) => {
    if (!selectedRequest || !requestId) return;
    
    try {
      setIsLoading(true);
      
      // 根據不同的狀態執行不同的操作
      if (selectedRequest.status === 'accepted') {
        console.log('執行駁回已接受的換班申請並恢復原始班表');
        
        // 1. 駁回此請求
        const response = await apiService.shiftSwap.reject(requestId);
        
        if (response.data) {
          // 2. 取得原始班表數據
          const { swap_type, from_date, to_date, from_shift, to_shift, from_mission, to_mission, from_overtime, to_overtime, requestor_id, acceptor_id } = selectedRequest;
          
          // 日期相關信息
          const dateObj = new Date(from_date);
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          
          // 狀態通知
          setNotification({
            open: true,
            message: '正在駁回換班申請並恢復原始班表...',
            type: 'info'
          });
          
          try {
            // 3. 根據換班類型恢復原始班表
            if (swap_type === 'shift') {
              // 恢復班別
              await apiService.schedule.updateShift({
                user_id: requestor_id,
                date: from_date,
                shift_type: from_shift, // 恢復為原始班別
                year: year,
                month: month
              });
              
              await apiService.schedule.updateShift({
                user_id: acceptor_id,
                date: from_date,
                shift_type: to_shift, // 恢復為原始班別
                year: year,
                month: month
              });
            } else if (swap_type === 'mission') {
              // 恢復工作區域
              let requestorOriginalMission = from_mission || '';
              let acceptorOriginalMission = '';
              
              // 如果原先的to_mission是"未指定"，我們需要找出交換前acceptor的實際工作區域
              if (to_mission === '未指定') {
                console.log('檢測到未指定的原始工作區域，嘗試獲取實際交換前的工作區域');
                
                // 這裡我們無法準確獲取交換前的工作區域，但可以從這個exchange的API響應或日誌中嘗試獲取
                // 由於我們無法確定，所以會使用一個保守的方法，保留acceptor當前的工作區域
                const monthStr = `${year}-${month}`;
                const weeklyData = weeklyAssignments[monthStr];
                
                if (weeklyData && weeklyData.data) {
                  const acceptorRecord = weeklyData.data.find(record => 
                    record.date === from_date && 
                    String(record.user_id) === String(acceptor_id)
                  );
                  
                  if (acceptorRecord && acceptorRecord.area_code) {
                    acceptorOriginalMission = acceptorRecord.area_code;
                    console.log(`假設接受者的原始工作區域為: ${acceptorOriginalMission}`);
                  } else {
                    console.warn('未找到接受者當前工作區域，將使用默認值');
                  }
                }
              } else {
                // 如果to_mission不是"未指定"，應使用from_mission和to_mission作為原始值
                // 注意這裡的邏輯變化: to_mission應該是acceptor的原始區域
                acceptorOriginalMission = to_mission || '';
              }
              
              console.log('恢復工作區域交換:', {
                申請人ID: requestor_id,
                申請人恢復為: requestorOriginalMission,
                接受者ID: acceptor_id,
                接受者恢復為: acceptorOriginalMission,
                日期: from_date
              });
              
              const updates = [
                {
                  user_id: requestor_id,
                  date: from_date,
                  area_code: requestorOriginalMission,
                  year: year,
                  month: month
                },
                {
                  user_id: acceptor_id,
                  date: from_date,
                  area_code: acceptorOriginalMission,
                  year: year,
                  month: month
                }
              ];
              
              await apiService.schedule.bulkUpdateAreaCodes(updates);
            } else if (swap_type === 'overtime') {
              // 恢復加班記錄
              const overtimeRecords = [];
              
              if (from_overtime) {
                overtimeRecords.push({
                  date: from_date,
                  overtime_shift: from_overtime,
                  user_ids: [requestor_id]
                });
              }
              
              if (to_overtime) {
                overtimeRecords.push({
                  date: from_date,
                  overtime_shift: to_overtime,
                  user_ids: [acceptor_id]
                });
              }
              
              if (overtimeRecords.length > 0) {
                await apiService.overtime.updateOvertimeMonth({ records: overtimeRecords });
              }
            }
            
            setNotification({
              open: true,
              message: '已成功駁回換班申請並恢復原始班表',
              type: 'success'
            });
          } catch (err) {
            console.error('恢復班表失敗:', err);
            setNotification({
              open: true,
              message: '駁回申請成功，但恢復班表時發生錯誤',
              type: 'warning'
            });
          }
        }
      } else {
        // 如果是待處理的請求，執行取消操作
        console.log('執行取消操作');
        
        // 發送取消換班請求
        const response = await apiService.shiftSwap.cancel(requestId);
        
        if (response.data) {
          setNotification({
            open: true,
            message: '已成功取消換班申請',
            type: 'success'
          });
        }
      }
      
      // 關閉詳情抽屜
      handleCloseDetail();
      // 更新換班請求列表
      fetchShiftSwapRequests();
      
    } catch (err) {
      console.error("操作失敗:", err);
      setNotification({
        open: true,
        message: err.response?.data?.message || err.message || '操作失敗',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 處理打開過濾器對話框
  const handleOpenFilterDialog = () => {
    setIsFilterDialogOpen(true);
  };

  // 處理關閉過濾器對話框
  const handleCloseFilterDialog = () => {
    setIsFilterDialogOpen(false);
  };

  // 清除所有過濾器
  const handleClearFilters = () => {
    setSelectedStatus([]);
    setHiddenStatuses([]);
    setShiftStartDate(null);
    setShiftEndDate(null);
    setSelectedShifts([]);
    setRequestorFilter('');
    setOnlySameIdentity(false);
  };

  // 處理起始日期變更
  const handleStartDateChange = (newValue) => {
    setStartDate(newValue);
  };

  // 處理結束日期變更
  const handleEndDateChange = (newValue) => {
    setEndDate(newValue ? endOfDay(newValue) : null);
  };

  // 處理要換班的日期範圍開始變更
  const handleShiftStartDateChange = (newValue) => {
    setShiftStartDate(newValue);
  };

  // 處理要換班的日期範圍結束變更
  const handleShiftEndDateChange = (newValue) => {
    setShiftEndDate(newValue ? endOfDay(newValue) : null);
  };

  // 處理班別選擇變更
  const handleShiftChange = (shift) => {
    setSelectedShifts(prev => {
      if (prev.includes(shift)) {
        return prev.filter(s => s !== shift);
      } else {
        return [...prev, shift];
      }
    });
  };

  // 計算活動過濾器數量
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedStatus.length > 0) count++;
    if (hiddenStatuses.length > 0) count++;
    if (startDate || endDate) count++;
    if (shiftStartDate || shiftEndDate) count++;
    if (selectedShifts.length > 0) count++;
    if (requestorFilter) count++;
    if (onlySameIdentity) count++;
    return count;
  }, [selectedStatus, hiddenStatuses, startDate, endDate, shiftStartDate, shiftEndDate, 
      selectedShifts, requestorFilter, onlySameIdentity]);

  // 處理頁碼變更
  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  // 進行分頁處理
  const paginatedRequests = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredRequests.slice(startIndex, startIndex + pageSize);
  }, [filteredRequests, page, pageSize]);

  // 計算總頁數
  const totalPages = useMemo(() => {
    return Math.ceil(filteredRequests.length / pageSize);
  }, [filteredRequests, pageSize]);

  // 處理搜尋關鍵字變更
  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  // 處理請求者變更
  const handleRequestorChange = (event) => {
    setRequestorFilter(event.target.value);
  };

  // 處理狀態變更
  const handleStatusChange = (status) => {
    setSelectedStatus(prev => {
      if (prev.includes(status)) {
        return prev.filter(s => s !== status);
      } else {
        return [...prev, status];
      }
    });
  };

  // 處理相同身份過濾切換
  const handleSameIdentityChange = (event) => {
    setOnlySameIdentity(event.target.checked);
  };

  // 新增獨立的數據刷新函數，避免複雜的強制更新邏輯
  const refreshShiftSwapData = async () => {
    try {
      console.log("開始獲取最新換班請求數據");
      
      // 獲取換班請求列表
      const swapResponse = await apiService.shiftSwap.getRequests();
      const requests = swapResponse.data || [];
      
      console.log(`獲取到 ${requests.length} 條換班請求`);
      
      // 只有當API返回數據不為空時才更新列表
      if(requests.length > 0) {
        setSwapRequests(requests);
        setFilteredRequests(requests); // 不再過濾，直接顯示所有請求
      } else {
        console.warn("API返回空數據，保持當前列表不變");
      }
      
      setError(null);
    } catch (err) {
      console.error("獲取最新數據失敗:", err);
      setError(err.response?.data?.message || err.message || '無法加載數據');
    }
  };

  // 處理月份選擇變更
  const handleMonthChange = (newMonth) => {
    setSwapFormData(prev => ({ ...prev, selectedMonth: newMonth }));
    if (newMonth) {
      fetchMonthData(newMonth);
    }
  };

  // 處理打開詳情抽屜
  const handleOpenDetail = (request) => {
    setSelectedRequest(request);
    setOpenDetailDrawer(true);
  };

  // 處理關閉詳情抽屜
  const handleCloseDetail = () => {
    // 先關閉抽屜
    setOpenDetailDrawer(false);
    // 清空選中的請求
    setSelectedRequest(null);
  };

  // 處理從日曆選擇日期
  const handleSelectDate = (date) => {
    console.log('從日曆選擇日期:', date);
    setSelectedDate(date);
    setCalendarOpen(false);
    // 更新換班表單日期
    setSwapFormData(prev => ({
      ...prev,
      fromDate: date
    }));
    
    // 在日曆數據中查找該日期的數據
    if (calendarData && calendarData.length > 0) {
      // 先將日期轉換為字符串格式，方便比較
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // 遍歷日曆數據尋找匹配的日期
      let foundDay = null;
      
      for (const week of calendarData) {
        for (const day of week) {
          if (day.date && format(day.date, 'yyyy-MM-dd') === dateStr) {
            foundDay = day;
            break;
          }
        }
        if (foundDay) break;
      }
      
      if (foundDay) {
        setSelectedDay(foundDay);
        console.log('找到選中日期數據:', foundDay);
      } else {
        console.log('未找到選中日期的數據');
      }
    }
  };

  // 處理點擊打開日曆
  const handleOpenCalendar = () => {
    setCalendarOpen(true);
    // 獲取當前月份的班表數據
    fetchMonthData(selectedDate);
  };

  // 自訂Tab樣式
  const StyledTab = styled(Tab)(({ theme }) => ({
    fontWeight: 'bold',
    minHeight: '30px',
    fontSize: '1rem',
    flex: 1, // 讓每個Tab平分寬度
    [theme.breakpoints.up('md')]: {
      fontSize: '0.9rem',
    },
  }));

  // 班次顏色映射
  const shiftColors = {
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

  // 低飽和度班別顏色 (用於未選中狀態)
  const desaturatedShiftColors = {
    'D': '#a5d6a7', // 淡化的白班顏色
    'A': '#e7e6c3', // 淡化的A班顏色
    'N': '#90caf9', // 淡化的大夜顏色
    'K': '#c6d5e3', // 淡化的K班顏色
    'C': '#d4e9d5', // 淡化的C班顏色
    'F': '#f0e4d0', // 淡化的F班顏色
    'E': '#ffcc80', // 淡化的小夜顏色
    'B': '#f2d7c0', // 淡化的B班顏色
    'O': '#e0e0e0'  // 淡化的休假顏色
  };

  return (
    <Box sx={{ p: { xs: 0.25, sm: 2, md: 3 } }}>
      {/* 手機版不顯示標題 */}
      <Typography variant="h4" gutterBottom sx={{ display: { xs: 'none', md: 'block' }, mb: 3 }}>
        換班申請管理
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {/* 標籤導航 */}
      <Paper sx={{ mb: 3, boxShadow: 'none', border: '1px solid #e0e0e0' }}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
          sx={{
            '& .MuiTabs-root': {
              display: 'flex',
            },
            '& .MuiTab-root': {
              flex: 1,
              fontWeight: 'bold',
              minHeight: '30px',
              fontSize: '1rem',
              '&.MuiTab-root': {
                [theme => theme.breakpoints.up('md')]: {
                  fontSize: '0.9rem',
                },
              },
            },
          }}
        >
          <StyledTab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                全部
                <Badge 
                  badgeContent={swapRequests.length} 
                  color="primary"
                  sx={{ ml: 1 }}
                />
              </Box>
            } 
          />
          <StyledTab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                換班別
                <Badge 
                  badgeContent={swapRequests.filter(req => req.swap_type === 'shift').length} 
                  color="primary"
                  sx={{ ml: 1 }}
                />
              </Box>
            } 
          />
          <StyledTab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                換區域
                <Badge 
                  badgeContent={swapRequests.filter(req => req.swap_type === 'mission').length} 
                  color="primary"
                  sx={{ ml: 1 }}
                />
              </Box>
            } 
          />
          <StyledTab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                換加班
                <Badge 
                  badgeContent={swapRequests.filter(req => req.swap_type === 'overtime').length} 
                  color="primary"
                  sx={{ ml: 1 }}
                />
              </Box>
            } 
          />
        </Tabs>
      </Paper>
      
      {/* 保留日曆對話框組件用於申請換班 */}
      <CalendarDialog
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        onSelect={handleSelectDate}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        calendarData={calendarData.flat().filter(day => day.date)}
      />
      
      {/* 篩選工具列 */}
      <Paper sx={{ p: 1.5, mb: 3, display: 'flex', gap: 1.5, alignItems: 'center', boxShadow: 'none', border: '1px solid #e0e0e0' }}>
        <TextField
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={handleSearchChange}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          sx={{ 
            flexGrow: 1, 
            minWidth: '120px',
            '& .MuiInputBase-root': { height: 40 }
          }}
          placeholder="輸入護理師姓名、備註..."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'action.active' }} />
              </InputAdornment>
            )
          }}
        />
        <Button
          variant="outlined"
          startIcon={<FilterListIcon />}
          onClick={handleOpenFilterDialog}
          size="medium"
          sx={{
            height: 40,
            // 手機版只顯示圖標並設為正方形
            minWidth: { xs: 40, sm: 'auto' },
            width: { xs: 40, sm: 'auto' },
            '& .MuiButton-startIcon': { 
              mr: { xs: 0, sm: 1 },
              ml: { xs: 0, sm: 0 }
            }
          }}
        >
          <Badge badgeContent={activeFilterCount} color="primary">
            <Box sx={{ display: { xs: 'none', sm: 'inline' } }}>
              篩選
            </Box>
          </Badge>
        </Button>
        {canRequestSwap && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleOpenSwapDialog}
            size="medium"
            sx={{
              height: 40,
              // 手機版只顯示圖標並設為正方形
              minWidth: { xs: 40, sm: 'auto' },
              width: { xs: 40, sm: 'auto' },
              '& .MuiButton-startIcon': { 
                mr: { xs: 0, sm: 1 },
                ml: { xs: 0, sm: 0 }
              }
            }}
          >
            <Box sx={{ display: { xs: 'none', sm: 'inline' } }}>
              申請換班
            </Box>
          </Button>
        )}
      </Paper>
      
      {isLoading ? (
        // 正在加載中
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', my: 5 }}>
          <CircularProgress size={40} />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
            正在更新資料...
          </Typography>
        </Box>
      ) : (
        <>
          {filteredRequests.length > 0 ? (
            // 有數據顯示列表
            <>
              <List component={Paper} sx={{ boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                {paginatedRequests.map((request, index) => {
                  const displayStatus = getRequestDisplayStatus(request);
                  const isFaded = displayStatus === 'cancelled' || displayStatus === 'expired' || displayStatus === 'accepted' || displayStatus === 'rejected';

                  return (
                    <React.Fragment key={request.id || index}>
                      <ListItem button onClick={() => handleOpenDetail(request)}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography 
                                variant="subtitle1"
                                component="span"
                                sx={{
                                  fontWeight: 'bold',
                                  // 已取消、已過期、已駁回的請求標題淡化
                                  color: isFaded ? '#bdbdbd' : 'inherit'
                                }}
                              >
                                {request.requestor?.full_name || '未知用戶'} {
                                  request.swap_type === 'overtime' ? '申請換掉加班' : 
                                  request.swap_type === 'mission' ? '申請換工作區域' : 
                                  '申請換班'
                                }
                              </Typography>
                              <Chip 
                                label={getStatusDisplayName(displayStatus)}
                                size="small"
                                sx={{
                                  ...getStatusStyle(displayStatus),
                                  fontWeight: 'bold',
                                  fontSize: '12px'
                                }}
                              />
                            </Box>
                          }
                          secondary={
                            <Box sx={{ mt: 1 }}>
                              <Typography 
                                variant="body2" 
                                color="text.secondary"
                                sx={{ 
                                  // 已取消、已過期、已駁回的請求內容淡化
                                  color: isFaded ? '#bdbdbd' : 'text.secondary'
                                }}
                              >
                                申請日期: {format(parseISO(request.created_at), 'MM/dd')}
                                {request.from_date && ` • 從: ${format(parseISO(request.from_date), 'MM/dd')}`}
                                {request.to_date && ` • 到: ${format(parseISO(request.to_date), 'MM/dd')}`}
                                {request.notes && ` • ${request.notes}`}
                              </Typography>
                              
                              {/* 添加視覺化換班內容 */}
                              <Box sx={{ 
                                mt: 1, 
                                opacity: isFaded ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1
                              }}>
                                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 'fit-content' }}>
                                  換班內容:
                                </Typography>
                                {renderSwapVisual(request, true)}
                              </Box>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < paginatedRequests.length - 1 && <Divider />}
                    </React.Fragment>
                  );
                })}
              </List>
              
              {/* 分頁控件 */}
              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Pagination 
                    count={totalPages} 
                    page={page} 
                    onChange={handlePageChange} 
                    color="primary"
                    siblingCount={1}
                    boundaryCount={1}
                  />
                </Box>
              )}
            </>
          ) : (
            <Paper sx={{ p: 3, textAlign: 'center', boxShadow: 'none', border: '1px solid #e0e0e0' }}>
              <Typography color="text.secondary">暫無符合條件的換班請求</Typography>
            </Paper>
          )}
        </>
      )}
      
      {/* 過濾器對話框 */}
      <Dialog open={isFilterDialogOpen} onClose={handleCloseFilterDialog} maxWidth="md" fullWidth>
        <DialogTitle>篩選換班請求</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            {/* 狀態篩選 - 修改為隱藏/顯示操作 */}
            <Box>
              <Typography component="legend" variant="subtitle2" sx={{ mb: 0.5 }}>狀態顯示設定：</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {statuses.map(status => (
                  <Chip
                    key={status}
                    label={hideStatusLabels[status] || `隱藏${statusLabels[status]}`}
                    onClick={() => handleStatusVisibilityChange(status)}
                    color={hiddenStatuses.includes(status) ? "primary" : "default"}
                    variant={hiddenStatuses.includes(status) ? "filled" : "outlined"}
                    sx={{ 
                      margin: 0.5,
                      ...(hiddenStatuses.includes(status) ? { backgroundColor: '#e0e0e0', color: '#757575' } : STATUS_COLORS[status])
                    }}
                  />
                ))}
              </Box>
            </Box>
            
            {/* 移除顯示設定部分，因為已經整合到狀態篩選中 */}
            
            {/* 要換班的日期範圍篩選 */}
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
              <Typography component="legend" variant="subtitle2" sx={{ mb: 0.5 }}>依要換班的日期篩選：</Typography>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <DatePicker
                  label="起始日期"
                  value={shiftStartDate}
                  onChange={handleShiftStartDateChange}
                  maxDate={shiftEndDate || undefined}
                  renderInput={(params) => <TextField {...params} size="small" fullWidth />}
                />
                <DatePicker
                  label="結束日期"
                  value={shiftEndDate}
                  onChange={handleShiftEndDateChange}
                  minDate={shiftStartDate || undefined}
                  renderInput={(params) => <TextField {...params} size="small" fullWidth />}
                />
              </Box>
            </LocalizationProvider>
            
            {/* 班別篩選 */}
            <Box>
              <Typography component="legend" variant="subtitle2" sx={{ mb: 0.5 }}>依要換掉的班別篩選：</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {userAvailableShifts.map(shift => (
                  <Chip
                    key={shift}
                    label={shift}
                    onClick={() => handleShiftChange(shift)}
                    color={selectedShifts.includes(shift) ? "primary" : "default"}
                    sx={{ 
                      margin: 0.5,
                      ...(selectedShifts.includes(shift) ? {} : { 
                        backgroundColor: SHIFT_COLORS[shift] || '#9e9e9e',
                        color: shift === 'O' ? 'black' : 'white',
                      })
                    }}
                  />
                ))}
              </Box>
            </Box>
            
            {/* 請求者篩選 */}
            <FormControl size="small" fullWidth>
              <InputLabel>申請者篩選</InputLabel>
              <Select
                value={requestorFilter}
                label="申請者篩選"
                onChange={handleRequestorChange}
              >
                <MenuItem value=""><em>全部申請者</em></MenuItem>
                {availableRequestors.map((requestor) => (
                  <MenuItem key={requestor.id} value={requestor.id}>
                    {requestor.name} {requestor.identity ? `(${requestor.identity})` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {/* 身份篩選 */}
            <FormControlLabel
              control={
                <Checkbox 
                  checked={onlySameIdentity}
                  onChange={handleSameIdentityChange}
                />
              }
              label="顯示麻護和恢復室的完整申請"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClearFilters}>清除篩選</Button>
          <Button onClick={handleCloseFilterDialog} variant="contained">關閉</Button>
        </DialogActions>
      </Dialog>
      
      {renderSwapForm()}
      {renderDetailDrawer()}
      
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.type} 
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ShiftSwap; 