import React, { useState, useEffect, useMemo } from 'react';
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
  Snackbar
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { zhTW } from 'date-fns/locale';
import { useScheduleStore } from '../store/scheduleStore';
import { useUserStore } from '../store/userStore';
import { useAuthStore } from '../store/authStore';
import { format, getDaysInMonth, getDay, isValid, parseISO } from 'date-fns';
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

  // 處理日期變更
  const handleDateChange = (newDate) => {
    if (newDate && newDate instanceof Date && !isNaN(newDate.getTime())) {
      updateSelectedDate(newDate);
      // 清除之前的標記
      setMarkings({});
    } else {
      console.error('嘗試設置無效的日期:', newDate);
      updateSelectedDate(new Date());
    }
  };

  // 獲取星期幾名稱
  const getDayName = (day) => {
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    return dayNames[day] || '?';
  };
  
  // 處理點擊標記
  const handleMarkStaff = (dateKey, staffId) => {
    if (!canEdit) {
      setApiError('只有護理長和管理員可以修改加班記錄');
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
      
      // 記錄請求詳情
      console.log('整月批量更新請求:', updateLog);
      
      // 執行批量更新
      if (updateRecords.length > 0) {
        const result = await apiService.overtime.bulkUpdate(updateRecords);
        console.log('整月批量更新結果:', result);
        
        setSuccessMessage(`加班記錄保存成功！共更新 ${result.data || 0} 條記錄`);
        setOpenSnackbar(true);
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

  // 從後端加載加班記錄
  const loadOvertimeRecords = async () => {
    if (!selectedDate || !isValid(selectedDate)) return;
    
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
      
      // 將後端數據轉換為前端需要的格式
      const newMarkings = {};
      response.data.forEach(record => {
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
    } catch (error) {
      console.error('獲取加班記錄失敗:', error);
      // 確保錯誤信息是字符串
      const errorMessage = typeof error === 'object' ? 
        (error.response?.data?.detail || JSON.stringify(error)) : 
        String(error);
      setApiError(errorMessage);
      setOpenSnackbar(true);
    } finally {
      setIsLoadingOvertimeRecords(false);
    }
  };

  // 初始化加載數據
  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          fetchMonthlySchedule(),
          fetchUsers()
        ]);
      } catch (error) {
        console.error('獲取數據失敗:', error);
      }
    };
    
    loadData();
  }, [fetchMonthlySchedule, fetchUsers, selectedDate]);

  // 月份變化時加載加班記錄
  useEffect(() => {
    loadOvertimeRecords();
  }, [selectedDate]);

  // 處理排班數據，篩選出加班人員
  useEffect(() => {
    if (!storeMonthlySchedule || !Array.isArray(storeMonthlySchedule) || storeMonthlySchedule.length === 0) {
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
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      const weekday = getDay(currentDate);
      
      overtimeByDate[dateKey] = {
        date: dateKey,
        day: day,
        weekday: getDayName(weekday),
        staffList: []
      };
    }
    
    // 篩選加班人員（只選擇身份為「麻醉專科護理師」的人員，排除護理長和控台CC）
    nursesWithShifts.forEach(nurse => {
      // 只選擇麻醉專科護理師
      if (nurse.role === 'head_nurse' || nurse.position === 'CC' || nurse.identity !== '麻醉專科護理師') {
        return; // 跳過護理長、控台CC和非麻醉專科護理師
      }
      
      nurse.shifts.forEach((shift, index) => {
        if (shift === 'A') { // 加班
          const day = index + 1;
          if (day <= daysInMonth) {
            const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
            const dateKey = format(currentDate, 'yyyy-MM-dd');
            
            if (overtimeByDate[dateKey]) {
              overtimeByDate[dateKey].staffList.push({
                id: nurse.id,
                name: nurse.name || nurse.full_name,
                position: nurse.position || '一般護理師',
                identity: nurse.identity || '未知身份'
              });
            }
          }
        }
      });
    });
    
    setOvertimeData(overtimeByDate);
  }, [storeMonthlySchedule, selectedDate, daysInMonth]);

  // 格式化錯誤信息為字符串
  const formatErrorMessage = (error) => {
    if (!error) return null;
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    return JSON.stringify(error);
  };

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
            sx={{ width: 200 }}
          />
        </LocalizationProvider>
        
        {canEdit && (
          <Button 
            variant="contained" 
            color="primary" 
            onClick={saveOvertimeRecords}
            disabled={isSaving || Object.keys(markings).length === 0}
            startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            sx={{ ml: 2 }}
          >
            {isSaving ? '保存中...' : '保存加班記錄'}
          </Button>
        )}
      </Box>
      
      <Alert severity="info" sx={{ mb: 2 }}>
        {canEdit 
          ? '點擊護理師姓名可標記排序 (A → B → C → D → E → F → 取消)，相同日期內不會出現重複標記'
          : '您可以查看加班記錄，但只有護理長和管理員可以修改'
        }
      </Alert>
      
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
      
      {!isLoading && Object.keys(overtimeData).length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          當前月份沒有可用的排班數據，請先產生月排班表
        </Alert>
      )}
      
      {!isLoading && Object.keys(overtimeData).length > 0 && (
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table stickyHeader aria-label="加班人員列表">
            <TableHead>
              <TableRow>
                <TableCell width="120px">日期</TableCell>
                <TableCell width="80px">人數</TableCell>
                <TableCell>加班人員 (8:00-16:00)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.values(overtimeData)
                .sort((a, b) => a.day - b.day) // 確保按日期排序
                .map((dayData) => (
                <TableRow 
                  key={dayData.date}
                  sx={{ 
                    '&:nth-of-type(odd)': { bgcolor: 'rgba(0, 0, 0, 0.03)' },
                    ...(dayData.weekday === '日' || dayData.weekday === '六' ? { bgcolor: 'rgba(255, 220, 220, 0.1)' } : {})
                  }}
                >
                  <TableCell>{selectedDate.getMonth() + 1}/{dayData.day}({dayData.weekday})</TableCell>
                  <TableCell>{dayData.staffList.length}人</TableCell>
                  <TableCell>
                    {dayData.staffList.length > 0 ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {dayData.staffList.map((staff) => {
                          const mark = markings[dayData.date]?.[staff.id] || '';
                          const chipLabel = mark ? `${staff.name}${mark}` : staff.name;
                          
                          return (
                            <Tooltip key={staff.id} title={canEdit ? "點擊標記排序" : "只有護理長和管理員可以修改"}>
                              <Chip 
                                label={chipLabel}
                                variant={mark ? "filled" : "outlined"}
                                color={mark ? "primary" : "default"}
                                size="small"
                                onClick={() => handleMarkStaff(dayData.date, staff.id)}
                                sx={{ 
                                  m: 0.3, 
                                  cursor: canEdit ? 'pointer' : 'default',
                                  fontWeight: mark ? 'bold' : 'normal'
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
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
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
    </Box>
  );
};

export default OvertimeStaff; 