import React from 'react';
import { Button, CircularProgress } from '@mui/material';
import ShuffleIcon from '@mui/icons-material/Shuffle';

/**
 * 智能分配按鈕組件
 */
const OvertimeAllocationButton = ({ 
  onClick, 
  disabled = false, 
  isAllocating = false,
  variant = "contained",
  color = "warning",
  size = "medium"
}) => {
  return (
    <Button 
      variant={variant}
      color={color}
      size={size}
      onClick={onClick}
      disabled={disabled || isAllocating}
      startIcon={isAllocating ? <CircularProgress size={20} color="inherit" /> : <ShuffleIcon />}
    >
      {isAllocating ? '分配中...' : '智能分配'}
    </Button>
  );
};

export default OvertimeAllocationButton;