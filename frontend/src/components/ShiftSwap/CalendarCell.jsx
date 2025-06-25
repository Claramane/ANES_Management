import React from 'react';
import { Box } from '@mui/material';
import { ViewWeek as ViewWeekIcon, Work as WorkIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import { SHIFT_COLORS } from '../../constants/shiftSwapConstants';

/**
 * 日曆單元格組件
 * @param {Object} day - 日期數據對象
 * @returns {JSX.Element} 日曆單元格
 */
const CalendarCell = ({ day }) => {
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

export default CalendarCell; 