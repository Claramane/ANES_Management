import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress
} from '@mui/material';

/**
 * 加班分配確認對話框
 */
export const AllocationConfirmDialog = ({ 
  open, 
  onClose, 
  onFullAllocation, 
  onPartialAllocation 
}) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>確認智能分配</DialogTitle>
      <DialogContent>
        <DialogContentText>
          請選擇智能分配的方式。系統將使用統一分數導向算法，確保所有班別都按分數最低優先原則分配，達到最佳平衡。
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          取消
        </Button>
        <Button onClick={onPartialAllocation} color="info" autoFocus>
          智能補齊未分配班別
        </Button>
        <Button onClick={onFullAllocation} color="warning">
          全部重新智能分配
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * 加班分配進度對話框
 */
export const AllocationProgressDialog = ({ 
  open, 
  onCancel 
}) => {
  return (
    <Dialog
      open={open}
      disableEscapeKeyDown
      aria-labelledby="smart-progress-title"
      aria-describedby="smart-progress-description"
    >
      <DialogTitle id="smart-progress-title">正在進行智能分配</DialogTitle>
      <DialogContent>
        <Box sx={{ p: 2 }}>
          <Typography id="smart-progress-description" sx={{ mb: 2 }}>
            系統正在使用統一分數導向算法分配加班人選，所有班別都按分數最低優先原則進行分配，確保最大化零分接近度。
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            分數系統：A=2.0, B=1.0, C=0.8, D=0.3, E=0.0, F=0.0，未加班=-0.365
          </Typography>
          <LinearProgress variant="indeterminate" sx={{ my: 2 }} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="error">
          取消分配
        </Button>
      </DialogActions>
    </Dialog>
  );
};