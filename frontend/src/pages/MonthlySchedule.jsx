import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Alert,
  CircularProgress,
  styled
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { zhTW } from 'date-fns/locale';
import { useScheduleStore } from '../store/scheduleStore';
import { useUserStore } from '../store/userStore';
import { format, getDaysInMonth, getDay, isValid } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// 確保日期有效性的工具函數
const ensureValidDate = (date) => {
  if (date && date instanceof Date && !isNaN(date.getTime())) {
    return date;
  }
  console.warn('發現無效日期，使用當前日期替代:', date);
  return new Date();
};

// 班次顏色設定
const ShiftCell = styled(TableCell)(({ shift }) => {
  const colors = { 
    'D': '#a08887', // 白班 22-08
    'A': '#d9d06e', // 小夜班 8-16
    'N': '#8387da', // 大夜班 14-22
    'K': '#8AA6C1', // 早班 9-17
    'C': '#67dcbd', // 中班 10-18
    'F': '#FFA07A', // 晚班 12-20
    'E': '#FFB6C1', // 半班 8-12
    'B': '#FFDAB9', // 日班 8-17
    'O': '#FFFFFF', // 休假 OFF
    'V': '#FFFFFF'  // 休假 OFF
  };
  
  return {
    backgroundColor: colors[shift || 'O'] || 'inherit',
    color: 'black',
    cursor: 'pointer',
    padding: '4px 2px',
    textAlign: 'center',
    fontWeight: 'normal',
    fontSize: '14px',
    minWidth: '28px',
    width: '28px',
    height: '28px',
    border: '1px solid #ddd'
  };
});

const MonthlySchedule = () => {
  const { 
    monthlySchedule: storeMonthlySchedule, 
    isLoading, 
    error: storeError, 
    selectedDate: storeSelectedDate, 
    updateSelectedDate,
    generateMonthlySchedule, 
    saveMonthlySchedule,
    fetchMonthlySchedule,
    updateShift
  } = useScheduleStore();

  const { nurseUsers, fetchUsers } = useUserStore();
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [scheduleData, setScheduleData] = useState([]);
  
  // 確保選擇的日期是有效的
  const selectedDate = useMemo(() => {
    console.log('MonthlySchedule - storeSelectedDate:', storeSelectedDate,
               'instanceof Date:', storeSelectedDate instanceof Date);
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

  // 從store獲取排班數據並格式化
  useEffect(() => {
    console.log('MonthlySchedule - 收到存储的排班数据:', storeMonthlySchedule);
    
    if (storeMonthlySchedule && Array.isArray(storeMonthlySchedule)) {
      console.log('处理数组类型的排班数据，长度:', storeMonthlySchedule.length);
      setScheduleData(storeMonthlySchedule);
    } else {
      console.log('排班数据不是数组或为空，尝试从其他结构解析');
      
      try {
        // 尝试获取嵌套结构中的数据
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth() + 1;
        
        if (storeMonthlySchedule && 
            storeMonthlySchedule[year] && 
            storeMonthlySchedule[year][month] && 
            storeMonthlySchedule[year][month].schedule) {
          
          const extractedData = storeMonthlySchedule[year][month].schedule;
          console.log('从嵌套结构中提取的排班数据:', extractedData);
          setScheduleData(extractedData);
        } else {
          console.log('无法从嵌套结构中提取数据，设置为空数组');
          setScheduleData([]);
        }
      } catch (err) {
        console.error('解析排班数据出错:', err);
        setScheduleData([]);
      }
    }
  }, [storeMonthlySchedule, selectedDate]);

  // 獲取星期幾名稱
  const getDayName = (day) => {
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    return dayNames[day] || '?';
  };

  // 獲取班次顏色類名
  const getShiftClass = (shift) => {
    return `shift-${shift.toLowerCase()}`;
  };

  // 護理長置頂並設定特殊班表
  const sortedMonthlySchedule = useMemo(() => {
    if (!scheduleData.length) return [];
    
    // 複製一份避免直接修改原數據
    const sorted = [...scheduleData];
    
    // 從userStore獲取用戶排序信息
    const userStore = useUserStore.getState();
    const userOrder = userStore.userOrder || {};
    
    // 列出所有用戶資料
    console.log('排班前用戶資料:', sorted.map(n => `${n.full_name || n.name || '未知'}(id:${n.id},role:${n.role},identity:${n.identity})`));
    
    // 按身份分組
    const nursesByIdentity = {};
    const unknownIdentity = [];
    
    // 將護理師按身份分組
    sorted.forEach(nurse => {
      if (nurse.identity) {
        if (!nursesByIdentity[nurse.identity]) {
          nursesByIdentity[nurse.identity] = [];
        }
        nursesByIdentity[nurse.identity].push(nurse);
      } else {
        unknownIdentity.push(nurse);
      }
    });
    
    // 身份排序權重
    const getIdentityWeight = (identity) => {
      const weights = {
        '護理長': 1,
        '麻醉科Leader': 2,
        '麻醉專科護理師': 3,
        '恢復室護理師': 4,
        '麻醉科書記': 5
      };
      return weights[identity] || 999;
    };
    
    // 對每個身份組的護理師進行排序
    Object.keys(nursesByIdentity).forEach(identity => {
      const orderIds = userOrder[identity] || [];
      
      if (orderIds.length > 0) {
        // 如果有保存的排序，按排序順序排列
        nursesByIdentity[identity].sort((a, b) => {
          const indexA = orderIds.indexOf(a.id);
          const indexB = orderIds.indexOf(b.id);
          
          // 如果ID不在排序列表中，放在最後
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          
          return indexA - indexB;
        });
      } else {
        // 如果沒有保存的排序，按姓名排序
        nursesByIdentity[identity].sort((a, b) => 
          (a.name || '').localeCompare(b.name || '')
        );
      }
    });
    
    // 按身份權重合併所有組
    const result = [];
    
    // 獲取排序後的身份列表
    const sortedIdentities = Object.keys(nursesByIdentity).sort(
      (a, b) => getIdentityWeight(a) - getIdentityWeight(b)
    );
    
    // 按順序添加各身份的護理師
    sortedIdentities.forEach(identity => {
      result.push(...nursesByIdentity[identity]);
    });
    
    // 添加未知身份的護理師
    result.push(...unknownIdentity);
    
    console.log('月班表護理師排序後:', result.map(n => `${n.full_name || n.name || '未知'}(id:${n.id},role:${n.role})`));
    
    // 處理空的shifts數組
    return result.map(nurse => {
      // 確保shifts存在並且有效
      if (!nurse.shifts || !Array.isArray(nurse.shifts) || nurse.shifts.length === 0) {
        return {
          ...nurse,
          shifts: Array(daysInMonth).fill('O') // 使用字符串'O'而非對象
        };
      }
      
      // 確保shifts長度與當月天數一致
      if (nurse.shifts.length < daysInMonth) {
        const newShifts = [...nurse.shifts];
        while (newShifts.length < daysInMonth) {
          newShifts.push('O');
        }
        return {
          ...nurse,
          shifts: newShifts
        };
      }
      
      return nurse;
    });
  }, [scheduleData, daysInMonth]);

  // 切換班次
  const toggleShift = (nurseIndex, dayIndex) => {
    if (isLoading) return;
    
    const nurse = sortedMonthlySchedule[nurseIndex];
    if (!nurse || !nurse.shifts || nurse.shifts[dayIndex] === undefined) {
      console.error('無效的護士或班次數據');
      return;
    }

    const currentShift = nurse.shifts[dayIndex] || 'O';
    const shiftTypes = ['D', 'A', 'N', 'O', 'K', 'C', 'F', 'E', 'B', 'V'];
    const nextShiftIndex = (shiftTypes.indexOf(currentShift) + 1) % shiftTypes.length;
    const newShift = shiftTypes[nextShiftIndex];
    
    // 找出在原始數據中的索引位置
    const originalIndex = scheduleData.findIndex(n => n.id === nurse.id);
    if (originalIndex === -1) {
      console.error('找不到對應的護理師ID:', nurse.id);
      return;
    }
    
    // 更新本地狀態
    const newScheduleData = [...scheduleData];
    newScheduleData[originalIndex].shifts[dayIndex] = newShift;
    setScheduleData(newScheduleData);
    
    // 通知store更新
    updateShift({ nurseIndex: originalIndex, dayIndex, newShift });
    
    console.log(`更新護理師 ${nurse.name} (ID: ${nurse.id}, 索引: ${originalIndex}) 的第 ${dayIndex+1} 天班次為 ${newShift}`);
  };

  // 統計特定班次數量
  const countShifts = (shifts, type) => {
    if (!shifts || !Array.isArray(shifts)) {
      return 0;
    }
    return shifts.filter(shift => shift === type).length;
  };

  // 計算總工時
  const calculateTotalHours = (shifts) => {
    if (!shifts || !Array.isArray(shifts)) {
      return 0;
    }
    const hourMapping = { 
      'D': 10, 'A': 8, 'N': 8, 'O': 0, 'V': 0, 
      'K': 8, 'C': 8, 'F': 8, 'E': 4, 'B': 8 
    };
    return shifts.reduce((total, shift) => {
      return total + (hourMapping[shift] || 0);
    }, 0);
  };

  // 獲取班次時間
  const getShiftTime = (shift) => {
    const shiftTimes = {
      'A': '8-16',
      'B': '8-17',
      'N': '14-22',
      'D': '22-08',
      'E': '8-12',
      'K': '9-17',
      'C': '10-18',
      'F': '12-20',
      'O': 'OFF',
      'V': 'OFF'
    };
    return shiftTimes[shift] || shift;
  };

  // 統計每日各班次數量
  const countDailyShifts = (day, type) => {
    if (!scheduleData || !Array.isArray(scheduleData)) {
      return 0;
    }
    return scheduleData
      .filter(nurse => 
        nurse && 
        nurse.shifts && 
        nurse.shifts[day] === type
      )
      .length;
  };

  // 生成PDF
  const generatePDF = async () => {
    const element = document.getElementById('monthly-schedule');
    
    if (!element) return;
    
    try {
      // 隱藏不需要在PDF中顯示的元素
      const hideElements = element.querySelectorAll('.hide-for-pdf');
      hideElements.forEach(el => {
        el.style.display = 'none';
      });
      
      // 調整標題格式
      const titleElement = element.querySelector('h4');
      const originalTitle = titleElement.innerText;
      const originalTitleStyle = titleElement.style.cssText;
      
      titleElement.innerText = `恩主公麻醉科護理人員${formattedDate}班表`;
      titleElement.style.textAlign = 'center';
      titleElement.style.fontSize = '24px';
      titleElement.style.marginBottom = '20px';
      titleElement.style.width = '100%';
      
      // 調整表格字體大小
      const table = element.querySelector('table');
      const originalFontSize = window.getComputedStyle(table).fontSize;
      table.style.fontSize = '8px';
      
      // 生成PDF
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = canvas.height * imgWidth / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
      pdf.save(`${formattedDate}班表.pdf`);
      
      // 恢復原始顯示
      hideElements.forEach(el => {
        el.style.display = '';
      });
      
      titleElement.innerText = originalTitle;
      titleElement.style.cssText = originalTitleStyle;
      table.style.fontSize = originalFontSize;
      
      setSuccess('PDF已生成');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('生成PDF失敗:', error);
    }
  };

  // 加載數據的邏輯
  useEffect(() => {
    const loadData = async () => {
      try {
        // 在第一次加載時確保store已初始化
        if (typeof useScheduleStore.getState().initialize === 'function') {
          useScheduleStore.getState().initialize();
        }
        await fetchUsers();
        
        try {
          const response = await fetchMonthlySchedule();
          console.log('获取的原始排班数据:', response);
          
          // 尝试直接从返回的响应中提取数据
          if (response) {
            const year = selectedDate.getFullYear();
            const month = selectedDate.getMonth() + 1;
            
            if (response[year] && 
                response[year][month] && 
                response[year][month].schedule) {
              
              const extractedData = response[year][month].schedule;
              console.log('直接从API响应提取的排班数据:', extractedData);
              setScheduleData(extractedData);
            }
          }
        } catch (scheduleError) {
          console.error('獲取排班數據失敗，但將繼續載入界面:', scheduleError);
          // 這裡只顯示錯誤，但不阻止界面載入
          setError('排班數據暫時無法獲取，但您仍可以使用其他功能');
          setTimeout(() => setError(null), 5000);
        }
      } catch (error) {
        console.error('加载数据失败:', error);
        setError('數據加載失敗，請稍後重試');
      }
    };
    
    loadData();
  }, [fetchUsers, fetchMonthlySchedule, selectedDate]);

  // 處理班表生成功能
  const handleGenerateSchedule = async () => {
    try {
      setError(null); // 清除之前的錯誤
      const response = await generateMonthlySchedule();
      setSuccess('月班表已生成');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('生成月班表失敗:', error);
      setError('生成月班表失敗，但您仍可以使用其他功能');
      setTimeout(() => setError(null), 5000);
    }
  };

  // 處理保存月班表
  const handleSaveSchedule = async () => {
    try {
      await saveMonthlySchedule();
      setSuccess('月班表已保存');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('保存月班表失敗:', error);
    }
  };

  // 處理日期變更
  const handleDateChange = (newDate) => {
    if (newDate && newDate instanceof Date && !isNaN(newDate.getTime())) {
      updateSelectedDate(newDate);
    } else {
      console.error('嘗試設置無效的日期:', newDate);
      updateSelectedDate(new Date());
    }
  };

  // 日期變更時重新獲取班表
  useEffect(() => {
    if (isValid(selectedDate)) {
      fetchMonthlySchedule();
    }
  }, [selectedDate, fetchMonthlySchedule]);

  return (
    <Box sx={{ padding: 1 }} id="monthly-schedule">
      <Typography variant="h4" gutterBottom sx={{ mb: 1 }}>
        {formattedDate}工作表
      </Typography>
      
      <Box className="hide-for-pdf" sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
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
        
        <Button 
          variant="contained" 
          color="primary"
          onClick={handleGenerateSchedule}
          disabled={isLoading}
        >
          生成月班表
        </Button>
        
        <Button 
          variant="contained" 
          color="success"
          onClick={handleSaveSchedule}
          disabled={isLoading || !scheduleData.length}
        >
          儲存班表
        </Button>
        
        <Button 
          variant="contained" 
          color="warning"
          onClick={generatePDF}
          disabled={!scheduleData.length}
        >
          生成 PDF
        </Button>
      </Box>
      
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
          <CircularProgress />
        </Box>
      )}
      
      {storeError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {storeError}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {scheduleData.length > 0 ? (
        <TableContainer 
          component={Paper} 
          sx={{ 
            overflowX: 'auto', 
            padding: 0,
            width: '100%',
            '& .MuiPaper-root': {
              boxShadow: 'none'
            }
          }}
        >
          <Table sx={{ 
            minWidth: 650, 
            width: '100%',
            tableLayout: 'fixed',
            '& .MuiTableCell-root': {
              borderLeft: '1px solid rgba(224, 224, 224, 0.3)',
              borderRight: '1px solid rgba(224, 224, 224, 0.3)',
              borderTop: '1px solid rgba(224, 224, 224, 0.3)',
              borderBottom: '1px solid rgba(224, 224, 224, 0.3)',
            }
          }} 
          size="small"
          stickyHeader
          >
            <TableHead>
              <TableRow>
                <TableCell width="80px" align="center">姓名</TableCell>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  try {
                    const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
                    const weekday = isValid(date) ? getDay(date) : 0;
                    return (
                      <TableCell 
                        key={day} 
                        align="center" 
                        padding="none" 
                        sx={{ 
                          minWidth: '30px',
                          fontSize: '12px',
                          bgcolor: '#f5f5f5',
                          fontWeight: 'bold'
                        }}
                      >
                        {day}<br />
                        {getDayName(weekday)}
                      </TableCell>
                    );
                  } catch (error) {
                    console.error(`渲染日期 ${day} 時出錯:`, error);
                    return (
                      <TableCell 
                        key={day} 
                        align="center" 
                        padding="none" 
                        sx={{ 
                          minWidth: '30px',
                          fontSize: '12px',
                          bgcolor: '#f5f5f5',
                          fontWeight: 'bold'
                        }}
                      >
                        {day}<br />?
                      </TableCell>
                    );
                  }
                })}
                <TableCell align="center" width="40px" sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>D</TableCell>
                <TableCell align="center" width="40px" sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>V</TableCell>
                <TableCell 
                  align="center" 
                  width="60px" 
                  sx={{ 
                    whiteSpace: 'nowrap', 
                    bgcolor: '#f5f5f5', 
                    fontWeight: 'bold',
                    writingMode: 'horizontal-tb',
                    textAlign: 'center',
                    padding: '6px 2px'
                  }}
                >
                  總時數
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedMonthlySchedule.map((nurse, nurseIndex) => (
                <TableRow key={nurse.id}>
                  <TableCell component="th" scope="row" sx={{ whiteSpace: 'nowrap', padding: '6px' }} align="center">
                    {nurse.name}
                  </TableCell>
                  {nurse.shifts.map((shift, dayIndex) => (
                    <ShiftCell
                      key={dayIndex}
                      shift={shift || 'O'}
                      onClick={() => toggleShift(nurseIndex, dayIndex)}
                      padding="none"
                    >
                      {shift || 'O'}
                    </ShiftCell>
                  ))}
                  <TableCell align="center" padding="none">{countShifts(nurse.shifts, 'D')}</TableCell>
                  <TableCell align="center" padding="none">{countShifts(nurse.shifts, 'V')}</TableCell>
                  <TableCell align="center" padding="none">{calculateTotalHours(nurse.shifts)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableBody>
              {['A', 'E', 'N', 'D'].map(shiftType => (
                <TableRow key={shiftType}>
                  <TableCell padding="none" sx={{ paddingLeft: '6px' }} align="center">{shiftType}</TableCell>
                  {Array.from({ length: daysInMonth }, (_, i) => i).map(day => (
                    <TableCell key={day} align="center" padding="none">
                      {countDailyShifts(day, shiftType)}
                    </TableCell>
                  ))}
                  <TableCell colSpan={3} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : !isLoading && (
        <Paper sx={{ padding: 3, marginTop: 2 }}>
          <Typography variant="body1" align="center">
            尚未生成班表，請點擊"生成月班表"按鈕
          </Typography>
        </Paper>
      )}
      
      <Box className="hide-for-pdf" sx={{ mt: 3 }}>
        <Paper sx={{ padding: 2 }}>
          <Typography variant="h6" gutterBottom>
            班次說明
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#a08887' }} />
              <Typography variant="body2">D: 22-08 (10h)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#d9d06e' }} />
              <Typography variant="body2">A: 8-16 (8h)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#8387da' }} />
              <Typography variant="body2">N: 14-22 (8h)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#8AA6C1' }} />
              <Typography variant="body2">K: 9-17 (8h)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#67dcbd' }} />
              <Typography variant="body2">C: 10-18 (8h)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#FFA07A' }} />
              <Typography variant="body2">F: 12-20 (8h)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#FFB6C1' }} />
              <Typography variant="body2">E: 8-12 (4h)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#FFDAB9' }} />
              <Typography variant="body2">B: 8-17 (8h)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#FFFFFF', border: '1px solid #ddd' }} />
              <Typography variant="body2">O: OFF (0h)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#FFFFFF', border: '1px solid #ddd' }} />
              <Typography variant="body2">V: OFF (0h)</Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default MonthlySchedule; 