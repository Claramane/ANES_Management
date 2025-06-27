import React from 'react';
import {
  Drawer, Box, Typography, IconButton, Divider, Paper, Chip, Button,
  Tooltip, CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowForward as ArrowForwardIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { 
  STATUS_COLORS, 
  SHIFT_COLORS 
} from '../../constants/shiftSwapConstants';
import { 
  getRequestDisplayStatus,
  isRequestExpired,
  checkSwapEligibility,
  canDeleteRequest,
  getDeleteButtonText
} from '../../utils/shiftSwapUtils';

/**
 * 換班請求詳情抽屜組件
 * @param {Object} props - 組件屬性
 * @returns {JSX.Element} 詳情抽屜組件
 */
const RequestDetailDrawer = ({
  open,
  onClose,
  selectedRequest,
  user,
  isLoading,
  onAccept,
  onDelete
}) => {
  if (!selectedRequest) return null;
  
  const isRequester = selectedRequest.requestor_id === user?.id;
  const isTargeted = selectedRequest.target_nurse_id === user?.id;
  const eligibilityCheck = checkSwapEligibility(selectedRequest, user);
  const displayStatus = getRequestDisplayStatus(selectedRequest);
  const canAccept = !isRequester && 
                   (selectedRequest.target_nurse_id === null || isTargeted) && 
                   selectedRequest.status === 'pending' && 
                   !isRequestExpired(selectedRequest) && 
                   eligibilityCheck.eligible;
  
  // 獲取班別顏色
  const getShiftStyle = (shift) => {
    return {
      backgroundColor: SHIFT_COLORS[shift] || '#757575',
      color: shift === 'O' ? 'black' : 'white',
      width: '35px',
      height: '35px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: '50%',
      fontSize: '16px',
      fontWeight: 'bold'
    };
  };
  
  // 獲取加班標籤樣式
  const getOvertimeStyle = (content) => {
    return {
      backgroundColor: content === '未指定' || content === '無' ? '#E0E0E0' : '#FF8A65',
      color: content === '未指定' || content === '無' ? '#666' : 'white',
      minWidth: '40px',
      height: '28px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: '6px',
      fontSize: '13px',
      fontWeight: 'bold',
      padding: '0 8px'
    };
  };
  
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
    >
      <Box sx={{ width: 400, p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">換班詳情</Typography>
          <IconButton onClick={onClose}>
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
              {/* 原班別 */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ mb: 0.5 }}>
                  {selectedRequest.swap_type === 'overtime' ? '原加班' : 
                   selectedRequest.swap_type === 'mission' ? '原工作區域' : '原班別'}
                </Typography>
                {selectedRequest.swap_type === 'overtime' ? (
                  <Box sx={{ ...getOvertimeStyle(selectedRequest.from_overtime || '無') }}>
                    {selectedRequest.from_overtime ? (selectedRequest.from_overtime + '加') : '無加班'}
                  </Box>
                ) : selectedRequest.swap_type === 'mission' ? (
                  <Chip 
                    label={selectedRequest.from_mission || '未指定'}
                    sx={{ 
                      backgroundColor: '#4dabf5',
                      color: 'white',
                      height: '24px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  />
                ) : (
                  <Box sx={{ ...getShiftStyle(selectedRequest.from_shift) }}>
                    {selectedRequest.from_shift || 'O'}
                  </Box>
                )}
                {selectedRequest.from_mission && selectedRequest.swap_type !== 'mission' && (
                  <Typography variant="caption" sx={{ mt: 0.5 }}>
                    {selectedRequest.from_mission}
                  </Typography>
                )}
              </Box>
              
              {/* 箭頭 */}
              <ArrowForwardIcon sx={{ mx: 2, color: '#666' }} />
              
              {/* 目標班別 */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ mb: 0.5 }}>
                  {selectedRequest.swap_type === 'overtime' ? '目標狀態' : 
                   selectedRequest.swap_type === 'mission' ? '目標工作區域' : '目標班別'}
                </Typography>
                {selectedRequest.swap_type === 'overtime' ? (
                  <Box sx={{ ...getOvertimeStyle(selectedRequest.to_overtime || '無') }}>
                    {selectedRequest.to_overtime === '未指定' ? '不加班' : selectedRequest.to_overtime || '無'}
                  </Box>
                ) : selectedRequest.swap_type === 'mission' ? (
                  <Chip 
                    label={selectedRequest.to_mission || '未指定'}
                    sx={{ 
                      backgroundColor: '#81c784',
                      color: 'white',
                      height: '24px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  />
                ) : (
                  <Box sx={{ ...getShiftStyle(selectedRequest.to_shift) }}>
                    {selectedRequest.to_shift || 'O'}
                  </Box>
                )}
                {selectedRequest.to_mission && selectedRequest.swap_type !== 'mission' && (
                  <Typography variant="caption" sx={{ mt: 0.5 }}>
                    {selectedRequest.to_mission}
                  </Typography>
                )}
              </Box>
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
            {/* 接受按鈕 */}
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
                    onClick={() => onAccept(selectedRequest.id)}
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
                sx={{ color: '#ba68c8', borderColor: '#ba68c8' }}
              >
                已過期
              </Button>
            )}
            
            {/* 刪除/駁回按鈕 */}
            {canDeleteRequest(selectedRequest, user) && (
              <Button 
                variant="outlined" 
                color="error"
                onClick={() => onDelete(selectedRequest.id)}
                disabled={isLoading}
                startIcon={<DeleteIcon />}
              >
                {isLoading ? <CircularProgress size={24} /> : getDeleteButtonText(selectedRequest, user)}
              </Button>
            )}
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
};

export default RequestDetailDrawer; 