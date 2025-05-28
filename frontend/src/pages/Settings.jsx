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
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Collapse,
  Chip
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { 
  Delete as DeleteIcon, 
  Add as AddIcon, 
  Fingerprint as FingerprintIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Devices as DevicesIcon,
  Schedule as ScheduleIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material';
import { useSettingsStore } from '../store/settingsStore';
import apiService from '../utils/api';
import { useAuthStore } from '../store/authStore';

const Settings = () => {
  const { settings, isLoading, error, fetchSettings } = useSettingsStore();
  const { user, getPasskeys, deletePasskey, registerPasskey } = useAuthStore();
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

  // Passkey管理狀態
  const [passkeys, setPasskeys] = useState([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPasskey, setSelectedPasskey] = useState(null);
  const [passkeyError, setPasskeyError] = useState('');
  const [expandedPasskey, setExpandedPasskey] = useState(null);

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

  // 加載Passkey列表
  useEffect(() => {
    loadPasskeys();
  }, []);

  const loadPasskeys = async () => {
    try {
      const data = await getPasskeys();
      setPasskeys(data);
    } catch (error) {
      setPasskeyError('獲取Passkey列表失敗');
    }
  };

  const handlePasskeyRegister = async () => {
    setIsRegistering(true);
    setPasskeyError('');
    
    try {
      const success = await registerPasskey();
      if (success) {
        await loadPasskeys();
      }
    } catch (error) {
      setPasskeyError('註冊Passkey失敗');
    } finally {
      setIsRegistering(false);
    }
  };

  const handlePasskeyDeleteClick = (passkey) => {
    setSelectedPasskey(passkey);
    setDeleteDialogOpen(true);
  };

  const handlePasskeyDeleteConfirm = async () => {
    try {
      await deletePasskey(selectedPasskey.id);
      await loadPasskeys();
      setDeleteDialogOpen(false);
    } catch (error) {
      setPasskeyError('刪除Passkey失敗');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
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

  const handlePasskeyToggle = (passkeyId) => {
    setExpandedPasskey(expandedPasskey === passkeyId ? null : passkeyId);
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
      
      {/* Passkey管理區塊 */}
      <Paper sx={{ padding: 3, marginBottom: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <FingerprintIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">
            Passkey管理
          </Typography>
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        {/* Passkey功能說明 */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>什麼是Passkey？</strong>
          </Typography>
          <Typography variant="body2" component="div">
            Passkey是一種更安全、更便利的登入方式，使用您裝置的生物識別（如指紋、Face ID）或PIN碼進行身份驗證：
            <br />• <strong>更安全</strong>：無需密碼，避免密碼洩露風險
            <br />• <strong>更便利</strong>：一鍵登入，無需記憶複雜密碼  
            <br />• <strong>跨裝置</strong>：可在多個裝置上註冊使用
            <br />• <strong>隱私保護</strong>：生物識別資料不會離開您的裝置
          </Typography>
        </Alert>
        
        {passkeyError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {passkeyError}
          </Alert>
        )}
        
        <Typography variant="subtitle1" gutterBottom>
          已註冊的Passkey
        </Typography>
        
        {passkeys.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            尚未註冊任何Passkey
          </Typography>
        ) : (
          <List sx={{ width: '100%' }}>
            {passkeys.map((passkey) => (
              <React.Fragment key={passkey.id}>
                <ListItem disablePadding>
                  <ListItemButton 
                    onClick={() => handlePasskeyToggle(passkey.id)}
                    sx={{ 
                      borderRadius: 1,
                      mb: 0.5,
                      '&:hover': {
                        backgroundColor: 'action.hover'
                      }
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <DevicesIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                          <Typography variant="body1" fontWeight="medium">
                            {passkey.device_name}
                          </Typography>
                          <Chip 
                            label="已驗證" 
                            size="small" 
                            color="success" 
                            sx={{ ml: 'auto', mr: 1 }}
                          />
                        </Box>
                      }
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePasskeyDeleteClick(passkey);
                        }}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                      {expandedPasskey === passkey.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </Box>
                  </ListItemButton>
                </ListItem>
                
                <Collapse in={expandedPasskey === passkey.id} timeout="auto" unmountOnExit>
                  <Box sx={{ 
                    ml: 2, 
                    mr: 2, 
                    mb: 2, 
                    p: 2, 
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'grey.200'
                  }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <ScheduleIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            創建時間
                          </Typography>
                        </Box>
                        <Typography variant="body2" fontWeight="medium">
                          {formatDate(passkey.created_at)}
                        </Typography>
                      </Grid>
                      
                      {passkey.last_used_at && (
                        <Grid item xs={12} sm={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <AccessTimeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              最後使用
                            </Typography>
                          </Box>
                          <Typography variant="body2" fontWeight="medium">
                            {formatDate(passkey.last_used_at)}
                          </Typography>
                        </Grid>
                      )}
                      
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            狀態：
                          </Typography>
                          <Chip 
                            label={passkey.is_active ? "啟用中" : "已停用"} 
                            size="small" 
                            color={passkey.is_active ? "success" : "default"}
                          />
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                </Collapse>
                
                {expandedPasskey !== passkey.id && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
        
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handlePasskeyRegister}
            disabled={isLoading || isRegistering}
          >
            {isRegistering ? <CircularProgress size={24} /> : '註冊新的Passkey'}
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
              系統版本: v0.8.8 beta
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body1">
              最後更新: 2025-05-27
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Passkey刪除確認對話框 */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle sx={{ color: 'error.main' }}>
          ⚠️ 確認刪除Passkey
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            您即將刪除以下Passkey：
          </DialogContentText>
          {selectedPasskey && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2">
                <strong>裝置：</strong>{selectedPasskey.device_name}
              </Typography>
              <Typography variant="body2">
                <strong>創建時間：</strong>{formatDate(selectedPasskey.created_at)}
              </Typography>
              {selectedPasskey.last_used_at && (
                <Typography variant="body2">
                  <strong>最後使用：</strong>{formatDate(selectedPasskey.last_used_at)}
                </Typography>
              )}
            </Box>
          )}
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>重要提醒：</strong>
              <br />• 刪除後將無法使用此Passkey登入系統
              <br />• 此操作無法撤銷
              <br />• 建議保留至少一個Passkey以備使用
              <br />• 如果這是您的最後一個Passkey，請確保您記得密碼
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            取消
          </Button>
          <Button onClick={handlePasskeyDeleteConfirm} color="error" variant="contained">
            確認刪除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings; 