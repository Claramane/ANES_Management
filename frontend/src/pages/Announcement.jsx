import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const Announcement = () => {
  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h4" gutterBottom>
        公告管理
      </Typography>
      <Paper sx={{ padding: 3, marginTop: 2 }}>
        <Typography variant="body1">
          這是公告管理頁面，功能尚在開發中...
        </Typography>
      </Paper>
    </Box>
  );
};

export default Announcement; 