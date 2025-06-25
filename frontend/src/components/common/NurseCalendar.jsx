import React from 'react';
import { Box, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { ViewWeek as ViewWeekIcon, Work as WorkIcon } from '@mui/icons-material';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday } from 'date-fns';
import { SHIFT_COLORS } from '../../constants/shiftSwapConstants';

// 日曆單元格樣式
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
    border: '2px solid #4caf50'
  },
  '&.clickable': {
    cursor: 'pointer',
  },
  '&.expired': {
    backgroundColor: '#fafafa',
    opacity: 0.6,
    cursor: 'not-allowed',
  }
};

// 護理師日曆單元格組件
const NurseCalendarCell = ({ day, onClick, isExpired = false, isSelected = false }) => {
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
    <div 
      className="cell-content" 
      style={{ 
        display: 'flex', 
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        cursor: onClick && !isExpired ? 'pointer' : 'default'
      }}
      onClick={() => onClick && !isExpired && onClick(day)}
    >
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

/**
 * 護理師班表月曆組件
 * @param {Object} props
 * @param {Date} props.selectedDate - 選中的月份日期
 * @param {Array} props.calendarData - 日曆數據 (週陣列格式)
 * @param {Function} props.onDateClick - 日期點擊處理函數
 * @param {Function} props.isDateExpired - 判斷日期是否過期的函數
 * @param {Function} props.isDateSelected - 判斷日期是否被選中的函數
 * @param {Boolean} props.showTable - 是否使用表格格式 (false = 使用Grid格式)
 * @param {Object} props.cellHeight - 單元格高度設置
 * @param {Boolean} props.clickable - 是否可點擊
 */
const NurseCalendar = ({ 
  selectedDate,
  calendarData = [],
  onDateClick,
  isDateExpired = () => false,
  isDateSelected = () => false,
  showTable = true,
  cellHeight = { xs: '70px', sm: '90px' },
  clickable = false
}) => {
  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
  
  if (showTable) {
    // 表格格式 (適用於 Dashboard)
    return (
      <Box component="table" sx={{ 
        width: '100%', 
        height: '100%',
        borderCollapse: 'collapse',
        border: '1px solid #e0e0e0',
        tableLayout: 'fixed'
      }}>
        {/* 表頭 */}
        <Box component="thead">
          <Box component="tr">
            {weekDays.map(day => (
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
        
        {/* 表格主體 */}
        <Box component="tbody">
          {calendarData.map((week, weekIndex) => (
            <Box component="tr" key={weekIndex}>
              {week.map((dayData, dayIndex) => {
                const isExpired = isDateExpired(dayData);
                const isSelected = isDateSelected(dayData);
                
                return (
                  <Box 
                    component="td" 
                    key={dayIndex}
                    sx={{
                      ...calendarCellStyle,
                      height: cellHeight,
                      ...(dayData.date && isToday(dayData.date) && { 
                        backgroundColor: '#e8f5e9',
                        border: '2px solid #4caf50'
                      }),
                      ...(isSelected && {
                        backgroundColor: '#e3f2fd',
                        border: '2px solid #2196f3'
                      }),
                      ...(isExpired && {
                        backgroundColor: '#fafafa',
                        opacity: 0.6,
                        cursor: 'not-allowed'
                      }),
                      ...((!dayData.date) && { 
                        backgroundColor: '#f9f9f9',
                        opacity: 0.5
                      }),
                      ...(clickable && dayData.date && !isExpired && {
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: '#f0f0f0'
                        }
                      })
                    }}
                  >
                    {dayData.date && (
                      <NurseCalendarCell 
                        day={dayData} 
                        onClick={clickable ? onDateClick : null}
                        isExpired={isExpired}
                        isSelected={isSelected}
                      />
                    )}
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>
      </Box>
    );
  } else {
    // HTML table 格式 (適用於 ShiftSwap)
    return (
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
                  const isExpired = isDateExpired(day);
                  const isSelected = isDateSelected(day);
                  
                  return (
                    <td 
                      key={dayIndex}
                      className={`
                        ${!day.date ? 'empty-cell' : ''}
                        ${day.date && isToday(day.date) ? 'today' : ''}
                        ${isSelected ? 'selected' : ''}
                        ${isExpired ? 'expired-cell' : ''} 
                      `}
                      onClick={() => day.date && !isExpired && clickable && onDateClick && onDateClick(day)}
                      style={{
                        cursor: isExpired ? 'not-allowed' : (clickable && day.date ? 'pointer' : 'default'),
                        opacity: isExpired ? 0.5 : 1
                      }}
                    >
                      {day.date && (
                        <NurseCalendarCell 
                          day={day} 
                          onClick={clickable ? onDateClick : null}
                          isExpired={isExpired}
                          isSelected={isSelected}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
};

export default NurseCalendar;
export { SHIFT_COLORS, NurseCalendarCell }; 