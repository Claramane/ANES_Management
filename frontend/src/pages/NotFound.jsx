import React from 'react';
import { Box, Button, Typography, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Home as HomeIcon } from '@mui/icons-material';

function NotFound() {
  const navigate = useNavigate();

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          py: 10,
        }}
      >
        <Typography variant="h1" color="primary" sx={{ fontSize: '6rem', fontWeight: 'bold' }}>
          404
        </Typography>
        <Typography variant="h4" gutterBottom>
          找不到頁面
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph sx={{ maxWidth: '500px', mb: 4 }}>
          很抱歉，您嘗試訪問的頁面不存在或已被移除。請確認 URL 是否正確，或返回首頁。
        </Typography>
        <Button
          variant="contained"
          size="large"
          startIcon={<HomeIcon />}
          onClick={() => navigate('/')}
        >
          返回首頁
        </Button>
      </Box>
    </Container>
  );
}

export default NotFound; 