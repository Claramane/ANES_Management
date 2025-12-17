import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, Paper, List, ListItem, ListItemText, Chip, Alert, CircularProgress, 
  TextField, Button, Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle, 
  DialogContent, DialogActions, Grid, Tabs, Tab, Badge, IconButton, Drawer, Divider,
  Card, CardContent, CardActions, Tooltip, Snackbar, Avatar, ListItemAvatar,
  FormControlLabel, Checkbox, Collapse, InputAdornment, Pagination, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, Fab
} from '@mui/material';
import {
  Add as AddIcon, Close as CloseIcon, CalendarMonth as CalendarIcon,
  FilterList as FilterListIcon, ArrowForward as ArrowForwardIcon,
  Delete as DeleteIcon, Business as BusinessIcon, Work as WorkIcon,
  ViewWeek as ViewWeekIcon, Search as SearchIcon, Sync as SyncIcon
} from '@mui/icons-material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker, StaticDatePicker } from '@mui/x-date-pickers';
import { zhTW } from 'date-fns/locale';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isWithinInterval, 
  getDay, isToday, isEqual, startOfDay, endOfDay, isSameDay, addDays, subDays, 
  isBefore, isAfter, differenceInDays 
} from 'date-fns';

// 導入新模組
import { useShiftSwap } from '../hooks/useShiftSwap';
import CalendarCell from '../components/ShiftSwap/CalendarCell';
import RequestDetailDrawer from '../components/ShiftSwap/RequestDetailDrawer';
import FilterDialog from '../components/ShiftSwap/FilterDialog';
import { useAuthStore } from '../store/authStore';
import apiService from '../utils/api';
import { cachedScheduleDetailsRequest } from '../utils/scheduleCache';
import { 
  WORK_AREAS, 
  SHIFT_COLORS, 
  WEEK_DAYS,
  PAGE_SIZE,
  ALL_SHIFTS,
  SHIFT_NAMES 
} from '../constants/shiftSwapConstants';
import { 
  checkShiftCompatibility, 
  prepareShiftSchedule,
  canRequestSwap,
  getRequestDisplayStatus,
  isRequestExpired,
  checkSwapEligibility,
  canDeleteRequest,
  getDeleteButtonText
} from '../utils/shiftSwapUtils';

/**
 * 優化後的換班申請管理組件
 * 使用模組化架構，將功能拆分成多個可重用的組件和hooks
 */
const ShiftSwap = () => {
  const { user } = useAuthStore();
  
  // 基本狀態
  const [swapRequests, setSwapRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState({ open: false, message: '', type: 'info' });
  
  // 對話框狀態
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  
  // 日曆相關狀態
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarData, setCalendarData] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [monthlySchedules, setMonthlySchedules] = useState({});
  
  // 換班表單狀態
  const [swapForm, setSwapForm] = useState({
    swap_type: 'shift',
    from_date: null,
    to_date: null,
    target_nurse_id: '',
    notes: '',
    from_shift: '',
    to_shift: '',
    from_mission: '',
    to_mission: '',
    work_area: ''
  });
  
  // 使用自定義hook管理換班過濾邏輯
  const shiftSwapManager = useShiftSwap(swapRequests, user);
  
  // 計算可用的申請者列表
  const availableRequestors = useMemo(() => {
    const requestorMap = new Map();
    swapRequests.forEach(req => {
      if (req.requestor && req.requestor.id) {
        requestorMap.set(req.requestor.id, {
          id: req.requestor.id,
          name: req.requestor.full_name,
          identity: req.requestor.identity
        });
      }
    });
    return Array.from(requestorMap.values());
  }, [swapRequests]);
  
  // 計算用戶可用的班別
  const userAvailableShifts = useMemo(() => {
    if (!user || !user.identity) return ALL_SHIFTS;
    
    // 根據護理師身份返回相應的班別
    if (user.identity.includes('麻醉專科') || user.identity === 'anesthesia_specialist') {
      return ['D', 'A', 'N', 'C', 'O'];
    } else if (user.identity.includes('恢復室') || user.identity === 'recovery_nurse') {
      return ['A', 'K', 'C', 'F', 'O'];
    } else if (user.identity.includes('Leader') || user.identity === 'anesthesia_leader') {
      return ['A', 'E', 'O'];
    } else if (user.identity.includes('書記') || user.identity === 'anesthesia_secretary') {
      return ['B', 'E', 'O'];
    }
    
    return ALL_SHIFTS;
  }, [user]);
  
  // 初始化數據
  useEffect(() => {
    if (user) {
      fetchInitialData();
    }
  }, [user]);
  
  // 獲取初始數據
  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchShiftSwapRequests(),
        fetchMonthData(currentMonth)
      ]);
    } catch (error) {
      console.error('初始化數據失敗:', error);
      setNotification({
        open: true,
        message: '載入數據失敗，請重新整理頁面',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);
  
  // 獲取換班請求
  const fetchShiftSwapRequests = useCallback(async () => {
    try {
      const response = await apiService.get('/api/shift-swap/');
      if (response.data && Array.isArray(response.data)) {
        setSwapRequests(response.data);
      }
    } catch (error) {
      console.error('獲取換班請求失敗:', error);
      throw error;
    }
  }, []);
  
  // 獲取月份數據
  const fetchMonthData = useCallback(async (date) => {
    try {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
      
      if (monthlySchedules[monthKey]) {
        generateCalendarData(date, monthlySchedules[monthKey]);
        return;
      }
      
      const response = await cachedScheduleDetailsRequest(year, month);
      if (response.data) {
        const newSchedules = { ...monthlySchedules, [monthKey]: response.data };
        setMonthlySchedules(newSchedules);
        generateCalendarData(date, response.data);
      }
    } catch (error) {
      console.error('獲取月份數據失敗:', error);
      setCalendarData(createEmptyCalendarData(date));
    }
  }, [monthlySchedules]);
  
  // 生成日曆數據
  const generateCalendarData = useCallback((date, scheduleData) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const days = eachDayOfInterval({ start, end });
    
    const calendar = {};
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      calendar[dateStr] = {
        date: day,
        shift: null,
        mission: null,
        overtime: false,
        overtimeShift: null
      };
      
      // 從班表數據中提取信息
      if (scheduleData && scheduleData.data && user) {
        const userId = user.id;
        const yearData = scheduleData.data[date.getFullYear()];
        if (yearData) {
          const monthData = yearData[date.getMonth() + 1];
          if (monthData && monthData.schedule) {
            const userSchedule = monthData.schedule.find(s => String(s.id) === String(userId));
            if (userSchedule && userSchedule.shifts) {
              const dayIndex = day.getDate() - 1;
              calendar[dateStr].shift = userSchedule.shifts[dayIndex] || 'O';
            }
          }
          
          // 工作分配
          if (monthData && monthData.assignments) {
            const userAssignment = monthData.assignments.find(a => String(a.id) === String(userId));
            if (userAssignment && userAssignment.missions) {
              const dayIndex = day.getDate() - 1;
              calendar[dateStr].mission = userAssignment.missions[dayIndex] || null;
            }
          }
          
          // 加班信息
          if (monthData && monthData.overtime) {
            const userOvertime = monthData.overtime.find(o => String(o.id) === String(userId));
            if (userOvertime && userOvertime.overtime_shifts) {
              const dayIndex = day.getDate() - 1;
              const overtimeShift = userOvertime.overtime_shifts[dayIndex];
              if (overtimeShift && overtimeShift !== 'X') {
                calendar[dateStr].overtime = true;
                calendar[dateStr].overtimeShift = overtimeShift;
              }
            }
          }
        }
      }
    });
    
    setCalendarData(calendar);
  }, [user]);
  
  // 創建空的日曆數據
  const createEmptyCalendarData = useCallback((date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const days = eachDayOfInterval({ start, end });
    
    const calendar = {};
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      calendar[dateStr] = {
        date: day,
        shift: null,
        mission: null,
        overtime: false,
        overtimeShift: null
      };
    });
    
    return calendar;
  }, []);
  
  // 處理月份變更
  const handleMonthChange = useCallback((newMonth) => {
    setCurrentMonth(newMonth);
    fetchMonthData(newMonth);
  }, [fetchMonthData]);
  
  // 處理日期選擇
  const handleDateSelect = useCallback((day) => {
    if (!day || !day.date) return;
    
    const dateStr = format(day.date, 'yyyy-MM-dd');
    setSelectedDate(dateStr);
    
    // 更新表單
    setSwapForm(prev => ({
      ...prev,
      from_date: dateStr,
      from_shift: day.shift || '',
      from_mission: day.mission || '',
      from_overtime: day.overtimeShift || ''
    }));
    
    setCalendarDialogOpen(false);
  }, []);
  
  // 提交換班申請
  const submitSwapRequest = useCallback(async () => {
    if (!validateSwapRequest()) return;
    
    setLoading(true);
    try {
      const requestData = {
        swap_type: swapForm.swap_type,
        from_date: swapForm.from_date,
        target_nurse_id: swapForm.target_nurse_id || null,
        notes: swapForm.notes,
        work_area: swapForm.work_area
      };
      
      // 根據換班類型添加相應字段
      if (swapForm.swap_type === 'shift') {
        requestData.from_shift = swapForm.from_shift;
        requestData.to_shift = swapForm.to_shift;
      } else if (swapForm.swap_type === 'mission') {
        requestData.from_mission = swapForm.from_mission;
        requestData.to_mission = swapForm.to_mission;
      } else if (swapForm.swap_type === 'overtime') {
        requestData.from_overtime = swapForm.from_overtime;
        requestData.to_overtime = swapForm.to_overtime;
      }
      
      await apiService.post('/api/shift-swap/', requestData);
      
      setNotification({
        open: true,
        message: '換班申請提交成功',
        type: 'success'
      });
      
      // 重新獲取數據
      await fetchShiftSwapRequests();
      handleCloseSwapDialog();
      
    } catch (error) {
      console.error('提交換班申請失敗:', error);
      setNotification({
        open: true,
        message: error.response?.data?.detail || '提交申請失敗',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [swapForm, fetchShiftSwapRequests]);
  
  // 驗證換班申請
  const validateSwapRequest = useCallback(() => {
    if (!swapForm.from_date) {
      setError('請選擇換班日期');
      return false;
    }
    
    if (swapForm.swap_type === 'shift' && (!swapForm.from_shift || !swapForm.to_shift)) {
      setError('請選擇要換的班別和目標班別');
      return false;
    }
    
    if (swapForm.swap_type === 'mission' && !swapForm.to_mission) {
      setError('請選擇目標工作區域');
      return false;
    }
    
    return true;
  }, [swapForm]);
  
  // 接受換班申請
  const handleAcceptSwap = useCallback(async (requestId) => {
    setLoading(true);
    try {
      await apiService.patch(`/api/shift-swap/${requestId}/accept/`);
      
      setNotification({
        open: true,
        message: '成功接受換班申請',
        type: 'success'
      });
      
      await fetchShiftSwapRequests();
      setDetailDrawerOpen(false);
      
    } catch (error) {
      console.error('接受換班失敗:', error);
      setNotification({
        open: true,
        message: error.response?.data?.detail || '接受換班失敗',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [fetchShiftSwapRequests]);
  
  // 刪除換班申請
  const handleDeleteSwap = useCallback(async (requestId) => {
    setLoading(true);
    try {
      await apiService.delete(`/api/shift-swap/${requestId}/`);
      
      setNotification({
        open: true,
        message: '操作成功',
        type: 'success'
      });
      
      await fetchShiftSwapRequests();
      setDetailDrawerOpen(false);
      
    } catch (error) {
      console.error('刪除換班失敗:', error);
      setNotification({
        open: true,
        message: error.response?.data?.detail || '操作失敗',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [fetchShiftSwapRequests]);
  
  // 對話框處理函數
  const handleOpenSwapDialog = useCallback(() => {
    if (!canRequestSwap(user)) {
      setNotification({
        open: true,
        message: '您沒有權限創建換班申請',
        type: 'warning'
      });
      return;
    }
    setCreateDialogOpen(true);
  }, [user]);
  
  const handleCloseSwapDialog = useCallback(() => {
    setCreateDialogOpen(false);
    setSwapForm({
      swap_type: 'shift',
      from_date: null,
      to_date: null,
      target_nurse_id: '',
      notes: '',
      from_shift: '',
      to_shift: '',
      from_mission: '',
      to_mission: '',
      work_area: ''
    });
    setError('');
  }, []);
  
  const handleOpenDetail = useCallback((request) => {
    setSelectedRequest(request);
    setDetailDrawerOpen(true);
  }, []);
  
  const handleCloseDetail = useCallback(() => {
    setDetailDrawerOpen(false);
    setSelectedRequest(null);
  }, []);
  
  // 渲染換班申請表單
  const renderSwapForm = () => (
    <Dialog 
      open={createDialogOpen} 
      onClose={handleCloseSwapDialog} 
      maxWidth="md" 
      fullWidth
    >
      <DialogTitle>創建換班申請</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Grid container spacing={2}>
          {/* 換班類型選擇 */}
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>換班類型</InputLabel>
              <Select
                value={swapForm.swap_type}
                label="換班類型"
                onChange={(e) => setSwapForm(prev => ({ ...prev, swap_type: e.target.value }))}
              >
                <MenuItem value="shift">換班別</MenuItem>
                <MenuItem value="mission">換工作分配</MenuItem>
                <MenuItem value="overtime">換加班</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {/* 日期選擇 */}
          <Grid item xs={12}>
            <Button
              variant="outlined"
              onClick={() => setCalendarDialogOpen(true)}
              startIcon={<CalendarIcon />}
              fullWidth
            >
              {swapForm.from_date ? `選擇的日期: ${swapForm.from_date}` : '選擇換班日期'}
            </Button>
          </Grid>
          
          {/* 根據換班類型顯示不同的表單內容 */}
          {swapForm.swap_type === 'shift' && (
            <>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="目前班別"
                  value={swapForm.from_shift}
                  disabled
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>希望換成的班別</InputLabel>
                  <Select
                    value={swapForm.to_shift}
                    label="希望換成的班別"
                    onChange={(e) => setSwapForm(prev => ({ ...prev, to_shift: e.target.value }))}
                  >
                    {userAvailableShifts.map(shift => (
                      <MenuItem key={shift} value={shift}>
                        {SHIFT_NAMES[shift] || shift}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}
          
          {swapForm.swap_type === 'mission' && (
            <>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="目前工作區域"
                  value={swapForm.from_mission || '未指定'}
                  disabled
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>希望換成的工作區域</InputLabel>
                  <Select
                    value={swapForm.to_mission}
                    label="希望換成的工作區域"
                    onChange={(e) => setSwapForm(prev => ({ ...prev, to_mission: e.target.value }))}
                  >
                    {WORK_AREAS.map(area => (
                      <MenuItem key={area.value} value={area.value}>
                        {area.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}
          
          {/* 備註 */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="備註 (選填)"
              value={swapForm.notes}
              onChange={(e) => setSwapForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="請輸入換班原因或其他說明..."
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCloseSwapDialog}>取消</Button>
        <Button 
          onClick={submitSwapRequest} 
          variant="contained"
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : '提交申請'}
        </Button>
      </DialogActions>
    </Dialog>
  );
  
  // 渲染日曆對話框
  const renderCalendarDialog = () => (
    <Dialog 
      open={calendarDialogOpen} 
      onClose={() => setCalendarDialogOpen(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>選擇換班日期</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
            <DatePicker
              label="選擇月份"
              views={['year', 'month']}
              value={currentMonth}
              onChange={handleMonthChange}
              renderInput={(params) => <TextField {...params} fullWidth margin="normal" />}
            />
          </LocalizationProvider>
          
          {/* 日曆表格 */}
          <Table sx={{ mt: 2 }}>
            <TableHead>
              <TableRow>
                {WEEK_DAYS.map(day => (
                  <TableCell key={day} align="center" sx={{ fontWeight: 'bold' }}>
                    {day}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {renderCalendarWeeks()}
            </TableBody>
          </Table>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setCalendarDialogOpen(false)}>關閉</Button>
      </DialogActions>
    </Dialog>
  );
  
  // 渲染日曆週
  const renderCalendarWeeks = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    
    const weeks = [];
    let currentWeek = [];
    
    days.forEach((day, index) => {
      const dayOfWeek = getDay(day);
      const adjustedDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 調整為週一開始
      
      // 填充週開始的空白
      if (index === 0) {
        for (let i = 0; i < adjustedDayOfWeek; i++) {
          currentWeek.push(null);
        }
      }
      
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayData = calendarData[dateStr] || { date: day };
      
      currentWeek.push(dayData);
      
      // 如果是週日或最後一天，結束當前週
      if (adjustedDayOfWeek === 6 || index === days.length - 1) {
        // 填充週末的空白
        while (currentWeek.length < 7) {
          currentWeek.push(null);
        }
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
    
    return weeks.map((week, weekIndex) => (
      <TableRow key={weekIndex}>
        {week.map((day, dayIndex) => (
          <TableCell 
            key={dayIndex} 
            sx={{ 
              height: 100, 
              width: '14.28%', 
              border: '1px solid #e0e0e0',
              padding: 0,
              cursor: day ? 'pointer' : 'default',
              '&:hover': day ? { backgroundColor: '#f5f5f5' } : {}
            }}
            onClick={() => day && handleDateSelect(day)}
          >
            {day && <CalendarCell day={day} />}
          </TableCell>
        ))}
      </TableRow>
    ));
  };
  
  // 主要渲染
  return (
    <Box sx={{ p: 3 }}>
      {/* 標題和操作按鈕 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          換班申請管理
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<SyncIcon />}
            onClick={fetchInitialData}
            disabled={loading}
          >
            重新整理
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<FilterListIcon />}
            onClick={() => setFilterDialogOpen(true)}
            disabled={loading}
          >
            篩選 {shiftSwapManager.activeFilterCount > 0 && (
              <Badge badgeContent={shiftSwapManager.activeFilterCount} color="primary" sx={{ ml: 1 }} />
            )}
          </Button>
          
          <Fab
            color="primary"
            onClick={handleOpenSwapDialog}
            size="medium"
            disabled={loading}
          >
            <AddIcon />
          </Fab>
        </Box>
      </Box>
      
      {/* 搜尋框 */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="搜尋換班申請..."
          value={shiftSwapManager.searchTerm}
          onChange={(e) => shiftSwapManager.setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>
      
      {/* 標籤頁 */}
      <Box sx={{ mb: 3 }}>
        <Tabs value={shiftSwapManager.currentTab} onChange={shiftSwapManager.handleTabChange}>
          <Tab label="全部申請" />
          <Tab label="換班別" />
          <Tab label="換工作分配" />
          <Tab label="換加班" />
        </Tabs>
      </Box>
      
      {/* 載入中指示器 */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
          <CircularProgress />
        </Box>
      )}
      
      {/* 換班申請列表 */}
      {!loading && (
        <>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              共 {shiftSwapManager.filteredRequests.length} 筆申請
            </Typography>
          </Box>
          
          <List>
            {shiftSwapManager.paginatedRequests.map((request) => (
              <ListItem
                key={request.id}
                sx={{ mb: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}
                onClick={() => handleOpenDetail(request)}
                button
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1">
                        {request.requestor?.full_name || '未知用戶'}
                      </Typography>
                      <Chip 
                        label={getRequestDisplayStatus(request) === 'pending' ? '待處理' : 
                              getRequestDisplayStatus(request) === 'accepted' ? '已完成' : 
                              getRequestDisplayStatus(request) === 'rejected' ? '已駁回' : 
                              getRequestDisplayStatus(request) === 'expired' ? '已過期' : '已取消'} 
                        size="small"
                        sx={{ 
                          backgroundColor: getRequestDisplayStatus(request) === 'pending' ? '#ff9800' :
                                          getRequestDisplayStatus(request) === 'accepted' ? '#4caf50' :
                                          getRequestDisplayStatus(request) === 'rejected' ? '#f44336' :
                                          getRequestDisplayStatus(request) === 'expired' ? '#ba68c8' : '#9e9e9e',
                          color: 'white'
                        }} 
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2">
                        {request.from_date} - {
                          request.swap_type === 'shift' ? `${request.from_shift} → ${request.to_shift}` :
                          request.swap_type === 'mission' ? `${request.from_mission || '未指定'} → ${request.to_mission || '未指定'}` :
                          `${request.from_overtime || '無'} → ${request.to_overtime || '無'}`
                        }
                      </Typography>
                      {request.notes && (
                        <Typography variant="caption" color="text.secondary">
                          {request.notes}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
          
          {/* 分頁 */}
          {shiftSwapManager.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination 
                count={shiftSwapManager.totalPages} 
                page={shiftSwapManager.page} 
                onChange={(event, newPage) => shiftSwapManager.setPage(newPage)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
      
      {/* 對話框組件 */}
      {renderSwapForm()}
      {renderCalendarDialog()}
      
      <FilterDialog
        open={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        hiddenStatuses={shiftSwapManager.hiddenStatuses}
        onStatusVisibilityChange={shiftSwapManager.handleStatusVisibilityChange}
        shiftStartDate={shiftSwapManager.shiftStartDate}
        onShiftStartDateChange={shiftSwapManager.setShiftStartDate}
        shiftEndDate={shiftSwapManager.shiftEndDate}
        onShiftEndDateChange={shiftSwapManager.setShiftEndDate}
        selectedShifts={shiftSwapManager.selectedShifts}
        onShiftChange={shiftSwapManager.handleShiftChange}
        requestorFilter={shiftSwapManager.requestorFilter}
        onRequestorChange={(e) => shiftSwapManager.setRequestorFilter(e.target.value)}
        onlySameIdentity={shiftSwapManager.onlySameIdentity}
        onSameIdentityChange={(e) => shiftSwapManager.setOnlySameIdentity(e.target.checked)}
        availableRequestors={availableRequestors}
        userAvailableShifts={userAvailableShifts}
        onClearFilters={shiftSwapManager.handleClearFilters}
      />
      
      <RequestDetailDrawer
        open={detailDrawerOpen}
        onClose={handleCloseDetail}
        selectedRequest={selectedRequest}
        user={user}
        isLoading={loading}
        onAccept={handleAcceptSwap}
        onDelete={handleDeleteSwap}
      />
      
      {/* 通知組件 */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
      >
        <Alert 
          severity={notification.type} 
          onClose={() => setNotification(prev => ({ ...prev, open: false }))}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ShiftSwap; 