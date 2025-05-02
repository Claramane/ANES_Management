import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  Grid, 
  Divider,
  Alert,
  CircularProgress,
  TextField,
  IconButton,
  InputAdornment
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useSettingsStore } from '../store/settingsStore';
import apiService from '../utils/api';
import { useAuthStore } from '../store/authStore';

const Settings = () => {
  const { settings, isLoading, error, fetchSettings } = useSettingsStore();
  const { user } = useAuthStore();
  const [success, setSuccess] = useState(false);
  
  // 密碼修改狀態
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false
  });
  
  // 個人資料編輯狀態
  const [profileForm, setProfileForm] = useState({
    email: user?.email || ''
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  // 加載設定
  useEffect(() => {
    const loadSettings = async () => {
      try {
        await fetchSettings();
      } catch (err) {
        console.error('Error loading settings:', err);
      }
    };

    loadSettings();
  }, [fetchSettings]);

  // 當用戶資料更新時，更新個人資料表單
  useEffect(() => {
    if (user) {
      setProfileForm({
        email: user.email || ''
      });
    }
  }, [user]);
  
  // 處理密碼表單變更
  const handlePasswordChange = (field) => (event) => {
    setPasswordForm({
      ...passwordForm,
      [field]: event.target.value
    });
    
    // 清除錯誤
    setPasswordError('');
  };
  
  // 切換密碼可見性
  const handleTogglePasswordVisibility = (field) => () => {
    setShowPassword({
      ...showPassword,
      [field]: !showPassword[field]
    });
  };
  
  // 提交密碼修改
  const handlePasswordSubmit = async () => {
    // 表單驗證
    if (!passwordForm.current_password) {
      setPasswordError('請輸入當前密碼');
      return;
    }
    if (!passwordForm.new_password) {
      setPasswordError('請輸入新密碼');
      return;
    }
    if (passwordForm.new_password.length < 6) {
      setPasswordError('新密碼必須至少6個字元');
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('確認密碼與新密碼不一致');
      return;
    }
    
    setPasswordLoading(true);
    setPasswordError('');
    
    try {
      await apiService.user.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      
      // 成功修改密碼
      setPasswordSuccess(true);
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
      
      // 3秒後清除成功消息
      setTimeout(() => {
        setPasswordSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('修改密碼失敗:', error);
      let errorMessage = '修改密碼失敗';
      if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          errorMessage = error.response.data.detail.map(item => item.msg).join(', ');
        } else {
          errorMessage = error.response.data.detail;
        }
      }
      setPasswordError(errorMessage);
    } finally {
      setPasswordLoading(false);
    }
  };

  // 處理個人資料表單變更
  const handleProfileChange = (event) => {
    setProfileForm({
      ...profileForm,
      [event.target.name]: event.target.value
    });
    
    // 清除錯誤
    setProfileError('');
  };
  
  // 提交個人資料修改
  const handleProfileSubmit = async () => {
    // 基本表單驗證
    if (!profileForm.email) {
      setProfileError('請輸入電子郵件');
      return;
    }
    
    // 電子郵件格式驗證
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profileForm.email)) {
      setProfileError('請輸入有效的電子郵件地址');
      return;
    }
    
    setProfileLoading(true);
    setProfileError('');
    
    try {
      await useAuthStore.getState().updateProfile({
        email: profileForm.email
      });
      
      // 成功修改個人資料
      setProfileSuccess(true);
      
      // 3秒後清除成功消息
      setTimeout(() => {
        setProfileSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('修改個人資料失敗:', error);
      let errorMessage = '修改個人資料失敗';
      if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          errorMessage = error.response.data.detail.map(item => item.msg).join(', ');
        } else {
          errorMessage = error.response.data.detail;
        }
      }
      setProfileError(errorMessage);
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <Box sx={{ padding: 3 }}>
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
          <CircularProgress />
        </Box>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {typeof error === 'object' && error !== null ? 
            (Array.isArray(error.detail) 
              ? error.detail.map(item => item.msg).join(', ') 
              : (error.detail || JSON.stringify(error))
            ) 
            : error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          設定已成功保存！
        </Alert>
      )}
      
      {/* 個人資料修改區塊 */}
      <Paper sx={{ padding: 3, marginBottom: 3 }}>
        <Typography variant="h6" gutterBottom>
          個人資料設定
        </Typography>
        
        <Divider sx={{ my: 2 }} />
        
        {profileError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {typeof profileError === 'object' && profileError !== null ? 
              (Array.isArray(profileError.detail) 
                ? profileError.detail.map(item => item.msg).join(', ') 
                : (profileError.detail || JSON.stringify(profileError))
              ) 
              : profileError}
          </Alert>
        )}
        
        {profileSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            個人資料已成功更新！
          </Alert>
        )}
        
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="電子郵件"
              type="email"
              name="email"
              value={profileForm.email}
              onChange={handleProfileChange}
              disabled={profileLoading}
              required
            />
          </Grid>
        </Grid>
        
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleProfileSubmit}
            disabled={profileLoading}
          >
            {profileLoading ? <CircularProgress size={24} /> : '更新資料'}
          </Button>
        </Box>
      </Paper>
      
      {/* 密碼修改區塊 */}
      <Paper sx={{ padding: 3, marginBottom: 3 }}>
        <Typography variant="h6" gutterBottom>
          修改密碼
        </Typography>
        
        <Divider sx={{ my: 2 }} />
        
        {passwordError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {typeof passwordError === 'object' && passwordError !== null ? 
              (Array.isArray(passwordError.detail) 
                ? passwordError.detail.map(item => item.msg).join(', ') 
                : (passwordError.detail || JSON.stringify(passwordError))
              ) 
              : passwordError}
          </Alert>
        )}
        
        {passwordSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            密碼已成功修改！
          </Alert>
        )}
        
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="當前密碼"
              type={showPassword.current ? 'text' : 'password'}
              value={passwordForm.current_password}
              onChange={handlePasswordChange('current_password')}
              disabled={passwordLoading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={handleTogglePasswordVisibility('current')}
                      edge="end"
                    >
                      {showPassword.current ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="新密碼"
              type={showPassword.new ? 'text' : 'password'}
              value={passwordForm.new_password}
              onChange={handlePasswordChange('new_password')}
              disabled={passwordLoading}
              helperText="密碼必須至少6個字元"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={handleTogglePasswordVisibility('new')}
                      edge="end"
                    >
                      {showPassword.new ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="確認新密碼"
              type={showPassword.confirm ? 'text' : 'password'}
              value={passwordForm.confirm_password}
              onChange={handlePasswordChange('confirm_password')}
              disabled={passwordLoading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={handleTogglePasswordVisibility('confirm')}
                      edge="end"
                    >
                      {showPassword.confirm ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
        </Grid>
        
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<LockIcon />}
            onClick={handlePasswordSubmit}
            disabled={passwordLoading}
          >
            {passwordLoading ? <CircularProgress size={24} /> : '修改密碼'}
          </Button>
        </Box>
      </Paper>
      
      <Paper sx={{ padding: 3, marginTop: 3 }}>
        <Typography variant="h6" gutterBottom>
          系統信息
        </Typography>
        
        <Divider sx={{ my: 2 }} />
        
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body1">
              系統版本: 1.0.0
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body1">
              最後更新: 2023-04-09
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default Settings; 