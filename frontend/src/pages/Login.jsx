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
import { Fingerprint } from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

function Login() {
  const navigate = useNavigate();
  const { login, checkAuthStatus, isLoading, error } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);

  useEffect(() => {
    // 檢查是否已有有效的認證狀態，如果有則跳轉到儀表板
    // 只在組件首次掛載時檢查，避免在登入過程中重複觸發
    const timeoutId = setTimeout(() => {
      if (checkAuthStatus()) {
        navigate('/dashboard');
      }
    }, 100); // 短暫延遲，確保組件已完全渲染

    return () => clearTimeout(timeoutId);
  }, []); // 移除checkAuthStatus和navigate依賴，只在組件掛載時執行一次

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
      // 設置登入方式標記
      localStorage.setItem('loginMethod', 'password');
      navigate('/dashboard');
    }
  };

  const handlePasskeyLogin = async () => {
    setIsPasskeyLoading(true);
    setFormError('');

    try {
      console.log('開始Passkey登入流程...');
      
      // 開始WebAuthn認證流程
      const startResponse = await api.post('/webauthn/authenticate/start');
      console.log('收到認證選項:', startResponse.data);
      
      const options = startResponse.data.publicKey;
      
      if (!options) {
        throw new Error('伺服器未返回有效的認證選項');
      }

      // base64UrlToArrayBuffer 工具
      const base64UrlToArrayBuffer = (base64url) => {
        if (!base64url) throw new Error('base64url字串為空');
        let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        const binary = window.atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
      };

      // 檢查瀏覽器是否支援WebAuthn
      if (!window.PublicKeyCredential) {
        throw new Error('此瀏覽器不支援WebAuthn');
      }

      console.log('處理認證選項...');
      
      // 轉換 challenge
      if (!options.challenge) {
        throw new Error('認證選項中缺少challenge');
      }
      options.challenge = base64UrlToArrayBuffer(options.challenge);

      // 修正 allowCredentials 的 id 型別
      if (options.allowCredentials && Array.isArray(options.allowCredentials)) {
        console.log('轉換allowCredentials:', options.allowCredentials.length, '個憑證');
        options.allowCredentials = options.allowCredentials.map(cred => {
          if (!cred.id) {
            console.warn('憑證缺少id:', cred);
            return cred;
          }
          return {
            ...cred,
            id: base64UrlToArrayBuffer(cred.id)
          };
        });
      } else {
        console.log('沒有allowCredentials或不是陣列');
      }

      console.log('調用瀏覽器WebAuthn API...');
      
      // 調用瀏覽器的WebAuthn API
      const credential = await navigator.credentials.get({
        publicKey: options,
        // 移除 mediation: 'conditional'，因為它可能會導致問題
        // mediation: 'conditional'
      });

      if (!credential) {
        throw new Error('用戶取消認證或認證失敗');
      }

      console.log('收到憑證:', credential);

      // 完成認證流程
      const arrayBufferToBase64Url = (buffer) => {
        if (!buffer) return null;
        const bytes = new Uint8Array(buffer);
        // 使用 reduce 將 bytes 轉換為 base64 string，避免 String.fromCharCode 的問題
        const base64 = btoa(bytes.reduce((data, byte) => data + String.fromCharCode(byte), ''));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      };
      
      const rawIdBase64url = arrayBufferToBase64Url(credential.rawId);
      console.log('準備發送認證完成請求...');
      
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

      console.log('認證完成，設置用戶狀態...');

      // 使用返回的用戶資料進行登入
      const { setAuth } = useAuthStore.getState();
      setAuth(finishResponse.data.access_token, finishResponse.data.user);
      
      // 設置登入方式標記
      localStorage.setItem('loginMethod', 'passkey');
      
      console.log('跳轉到dashboard...');
      navigate('/dashboard');
    } catch (error) {
      console.error('Passkey登入失敗:', error);
      
      // 更詳細的錯誤處理
      let errorMessage = 'Passkey登入失敗';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = '用戶取消了認證或認證失敗';
      } else if (error.name === 'InvalidStateError') {
        errorMessage = '認證器狀態無效';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = '瀏覽器不支援此認證方式';
      } else if (error.name === 'SecurityError') {
        errorMessage = '安全錯誤：請確保在HTTPS環境下使用';
      } else if (error.name === 'AbortError') {
        errorMessage = '認證過程被中止';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setFormError(errorMessage);
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
        <Typography variant="h4" gutterBottom fontWeight="bold">
          恩主公麻醉科班表小查查
        </Typography>
        <Paper
          elevation={0}
          sx={{
            p: 4,
            width: '100%',
            mt: 2,
            borderRadius: 2,
            boxShadow: 'none',
            border: '1px solid #e0e0e0',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Avatar
              src="/favicon.png"
              alt="恩主公麻醉科班表小查查"
              sx={{ m: 1, width: 56, height: 56 }}
            />
            <Typography component="h1" variant="h5" fontWeight="bold">
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
          © {new Date().getFullYear()} 恩主公麻醉科班表小查查
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          v0.9.5 beta | 最後更新: 2025-10-01
        </Typography>
      </Box>
    </Container>
  );
}

export default Login; 