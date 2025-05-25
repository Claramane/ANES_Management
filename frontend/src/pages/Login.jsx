import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Avatar,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import { LockOutlined, Fingerprint } from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading, error } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);

  useEffect(() => {
    // 如果已登入，直接跳轉到儀表板
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    // 表單驗證
    if (!username.trim()) {
      setFormError('請輸入用戶名');
      return;
    }
    if (!password) {
      setFormError('請輸入密碼');
      return;
    }

    // 執行登入
    const success = await login(username, password);
    if (success) {
      navigate('/dashboard');
    }
  };

  const handlePasskeyLogin = async () => {
    setIsPasskeyLoading(true);
    setFormError('');

    try {
      // 開始WebAuthn認證流程
      const startResponse = await api.post('/webauthn/authenticate/start');
      const options = startResponse.data.publicKey;

      // base64UrlToArrayBuffer 工具
      const base64UrlToArrayBuffer = (base64url) => {
        let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        const binary = window.atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
      };

      // 轉換 challenge
      options.challenge = base64UrlToArrayBuffer(options.challenge);

      // 修正 allowCredentials 的 id 型別
      if (options.allowCredentials && Array.isArray(options.allowCredentials)) {
        options.allowCredentials = options.allowCredentials.map(cred => ({
          ...cred,
          id: base64UrlToArrayBuffer(cred.id)
        }));
      }

      // 調用瀏覽器的WebAuthn API
      const credential = await navigator.credentials.get({
        publicKey: options
      });

      // 完成認證流程
      const arrayBufferToBase64Url = (buffer) => {
        const bytes = new Uint8Array(buffer);
        // 使用 reduce 將 bytes 轉換為 base64 string，避免 String.fromCharCode 的問題
        const base64 = btoa(bytes.reduce((data, byte) => data + String.fromCharCode(byte), ''));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      };
      const rawIdBase64url = arrayBufferToBase64Url(credential.rawId);
      const finishResponse = await api.post('/webauthn/authenticate/finish', {
        id: rawIdBase64url,
        raw_id: rawIdBase64url,
        response: {
          client_data_json: arrayBufferToBase64Url(credential.response.clientDataJSON),
          authenticator_data: arrayBufferToBase64Url(credential.response.authenticatorData),
          signature: arrayBufferToBase64Url(credential.response.signature),
          user_handle: credential.response.userHandle
            ? arrayBufferToBase64Url(credential.response.userHandle)
            : null
        },
        type: credential.type
      });

      // 使用返回的用戶資料進行登入
      const { setAuth } = useAuthStore.getState();
      setAuth(finishResponse.data.access_token, finishResponse.data.user);
      navigate('/dashboard');
    } catch (error) {
      console.error('Passkey登入失敗:', error);
      setFormError(error.response?.data?.detail || 'Passkey登入失敗');
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography variant="h4" gutterBottom>
          護理班表管理系統
        </Typography>
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: '100%',
            mt: 2,
            borderRadius: 2,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Avatar sx={{ m: 1, bgcolor: 'primary.main' }}>
              <LockOutlined />
            </Avatar>
            <Typography component="h1" variant="h5">
              登入
            </Typography>
            {(error || formError) && (
              <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
                {Array.isArray(error || formError)
                  ? (error || formError).map((e, i) => <div key={i}>{e.msg || JSON.stringify(e)}</div>)
                  : typeof (error || formError) === 'object'
                    ? (error?.detail || error?.message || JSON.stringify(error || formError))
                    : (error || formError)}
              </Alert>
            )}
            <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1, width: '100%' }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                label="用戶名"
                name="username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading || isPasskeyLoading}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="密碼"
                type="password"
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || isPasskeyLoading}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2, py: 1.2 }}
                disabled={isLoading || isPasskeyLoading}
              >
                {isLoading ? <CircularProgress size={24} /> : '登入'}
              </Button>
              
              <Divider sx={{ my: 2 }}>或</Divider>
              
              <Tooltip title="使用Passkey登入">
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Fingerprint />}
                  onClick={handlePasskeyLogin}
                  disabled={isLoading || isPasskeyLoading}
                  sx={{ py: 1.2 }}
                >
                  {isPasskeyLoading ? <CircularProgress size={24} /> : '使用Passkey登入'}
                </Button>
              </Tooltip>
            </Box>
          </Box>
        </Paper>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
          © {new Date().getFullYear()} 護理班表管理系統
        </Typography>
      </Box>
    </Container>
  );
}

export default Login; 