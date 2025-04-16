import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const ShiftSwap = () => {
  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h4" gutterBottom>
        換班申請
      </Typography>
      <Paper sx={{ padding: 3, marginTop: 2 }}>
        <Typography variant="body1">
          這是換班申請頁面，功能尚在開發中...
        </Typography>
      </Paper>
    </Box>
  );
};

export default ShiftSwap; 