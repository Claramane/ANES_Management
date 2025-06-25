import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box,
  Typography, Chip, FormControl, InputLabel, Select, MenuItem,
  FormControlLabel, Checkbox, TextField
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { zhTW } from 'date-fns/locale';
import { 
  STATUSES, 
  HIDE_STATUS_LABELS, 
  STATUS_COLORS,
  SHIFT_COLORS,
  ALL_SHIFTS 
} from '../../constants/shiftSwapConstants';

/**
 * 過濾器對話框組件
 * @param {Object} props - 組件屬性
 * @returns {JSX.Element} 過濾器對話框
 */
const FilterDialog = ({
  open,
  onClose,
  hiddenStatuses,
  onStatusVisibilityChange,
  shiftStartDate,
  onShiftStartDateChange,
  shiftEndDate,
  onShiftEndDateChange,
  selectedShifts,
  onShiftChange,
  requestorFilter,
  onRequestorChange,
  onlySameIdentity,
  onSameIdentityChange,
  availableRequestors,
  userAvailableShifts,
  onClearFilters
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>篩選換班請求</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          {/* 狀態篩選 - 修改為隱藏/顯示操作 */}
          <Box>
            <Typography component="legend" variant="subtitle2" sx={{ mb: 0.5 }}>
              狀態顯示設定：
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {STATUSES.map(status => (
                <Chip
                  key={status}
                  label={HIDE_STATUS_LABELS[status] || `隱藏${status}`}
                  onClick={() => onStatusVisibilityChange(status)}
                  color={hiddenStatuses.includes(status) ? "primary" : "default"}
                  variant={hiddenStatuses.includes(status) ? "filled" : "outlined"}
                  sx={{ 
                    margin: 0.5,
                    ...(hiddenStatuses.includes(status) ? 
                      { backgroundColor: '#e0e0e0', color: '#757575' } : 
                      STATUS_COLORS[status])
                  }}
                />
              ))}
            </Box>
          </Box>
          
          {/* 要換班的日期範圍篩選 */}
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
            <Typography component="legend" variant="subtitle2" sx={{ mb: 0.5 }}>
              依要換班的日期篩選：
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <DatePicker
                label="起始日期"
                value={shiftStartDate}
                onChange={onShiftStartDateChange}
                maxDate={shiftEndDate || undefined}
                renderInput={(params) => <TextField {...params} size="small" fullWidth />}
              />
              <DatePicker
                label="結束日期"
                value={shiftEndDate}
                onChange={onShiftEndDateChange}
                minDate={shiftStartDate || undefined}
                renderInput={(params) => <TextField {...params} size="small" fullWidth />}
              />
            </Box>
          </LocalizationProvider>
          
          {/* 班別篩選 */}
          <Box>
            <Typography component="legend" variant="subtitle2" sx={{ mb: 0.5 }}>
              依要換掉的班別篩選：
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {userAvailableShifts.map(shift => (
                <Chip
                  key={shift}
                  label={shift}
                  onClick={() => onShiftChange(shift)}
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
              onChange={onRequestorChange}
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
                onChange={onSameIdentityChange}
              />
            }
            label="顯示麻護和恢復室的完整申請"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClearFilters}>清除篩選</Button>
        <Button onClick={onClose} variant="contained">關閉</Button>
      </DialogActions>
    </Dialog>
  );
};

export default FilterDialog; 