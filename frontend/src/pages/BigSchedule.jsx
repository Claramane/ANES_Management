import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const BigSchedule = () => {
  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h4" gutterBottom>
        大排班表
      </Typography>
      <Paper sx={{ padding: 3, marginTop: 2 }}>
        <Typography variant="body1">
          這是大排班表頁面，功能尚在開發中...
        </Typography>
      </Paper>
    </Box>
  );
};

export default BigSchedule; 