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
  Tooltip,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider
} from '@mui/material';
import { Fingerprint } from '@mui/icons-material';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

function Login() {
  const navigate = useNavigate();
  const { login, checkAuthStatus, isLoading, error, setAuth } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [isLineLoading, setIsLineLoading] = useState(false);
  const [isPasswordMode, setIsPasswordMode] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrAuthUrl, setQrAuthUrl] = useState('');
  const [isLineQrLoading, setIsLineQrLoading] = useState(false);
  const [qrSessionId, setQrSessionId] = useState('');

  useEffect(() => {
    let timer;
    if (qrModalOpen && qrSessionId) {
      const poll = async () => {
        try {
          const resp = await api.get('/auth/line/qr/status', {
            params: { session_id: qrSessionId }
          });
          const status = resp.data?.status;
          if (status === 'success' && resp.data?.token) {
            const token = resp.data.token;
            const userResp = await api.get('/users/me', {
              headers: { Authorization: `Bearer ${token}` }
            });
            setAuth(token, userResp.data);
            localStorage.setItem('lastUsername', userResp.data.username);
            localStorage.setItem('loginMethod', 'line');
            setQrModalOpen(false);
            setQrSessionId('');
            navigate('/dashboard');
            return; // stop further polling
          }
          if (status === 'need_binding') {
            setFormError('此 LINE 帳號尚未綁定，請先以密碼登入並至設定頁綁定。');
            setQrModalOpen(false);
            setQrSessionId('');
            return;
          }
        } catch (err) {
          console.error('輪詢 LINE 掃碼狀態失敗', err);
        }
        timer = setTimeout(poll, 2000);
      };
      poll();
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [qrModalOpen, qrSessionId, navigate, setAuth]);

  useEffect(() => {
    const savedUsername = localStorage.getItem('lastUsername');
    if (savedUsername) {
      setUsername(savedUsername);
    }

    // 處理 LINE callback：帶 token 則直接登入；帶 line_status 則提示綁定
    const params = new URLSearchParams(window.location.search);
    const tokenFromLine = params.get('token');
    const lineStatus = params.get('line_status');
    const cleanupUrl = () => {
      params.delete('token');
      params.delete('line_status');
      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.replaceState(null, '', newUrl);
    };
    const handleLineCallback = async () => {
      if (tokenFromLine) {
        try {
          const userResp = await api.get('/users/me', {
            headers: { Authorization: `Bearer ${tokenFromLine}` }
          });
          setAuth(tokenFromLine, userResp.data);
          localStorage.setItem('lastUsername', userResp.data.username);
          localStorage.setItem('loginMethod', 'line');
          navigate('/dashboard');
        } catch (e) {
          setFormError('LINE 登入驗證失敗，請再試一次');
        } finally {
          cleanupUrl();
        }
      } else if (lineStatus === 'need_binding') {
        setFormError('此 LINE 帳號尚未綁定，請先以密碼登入並至設定頁綁定。');
        cleanupUrl();
      }
    };
    handleLineCallback();

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

    if (!isPasswordMode) {
      setIsPasswordMode(true);
      return;
    }

    if (!username.trim()) {
      setFormError('請輸入員工編號');
      return;
    }
    if (!password) {
      setFormError('請輸入密碼');
      return;
    }

    const success = await login(username, password);
    if (success) {
      const trimmed = username.trim();
      if (trimmed) {
        localStorage.setItem('lastUsername', trimmed);
      }
      localStorage.setItem('loginMethod', 'password');
      navigate('/dashboard');
    }
  };

  const handlePasskeyLogin = async () => {
    setIsPasskeyLoading(true);
    setFormError('');

    try {
      if (!username.trim()) {
        throw new Error('請先輸入員工編號再使用 Passkey 登入');
      }

      console.log('開始Passkey登入流程...');
      const rememberedUsername = username.trim() || localStorage.getItem('lastUsername') || '';
      // 開始WebAuthn認證流程
      const startResponse = await api.post('/webauthn/authenticate/start', {
        username: rememberedUsername || undefined
      });
      console.log('收到認證選項:', startResponse.data);
      
      const options = startResponse.data.publicKey;
      const challengeToken = startResponse.data.challenge_token;
      
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
        type: credential.type,
        challenge_token: challengeToken
      });

      console.log('認證完成，設置用戶狀態...');

      // 使用返回的用戶資料進行登入
      const { setAuth } = useAuthStore.getState();
      setAuth(finishResponse.data.access_token, finishResponse.data.user);

      if (finishResponse.data?.user?.username) {
        localStorage.setItem('lastUsername', finishResponse.data.user.username);
      }
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

  const handleLineLogin = async () => {
    setIsLineLoading(true);
    setFormError('');
    try {
      const redirect = `${window.location.origin}/login`;
      const resp = await api.get('/auth/line/login', {
        params: { redirect }
      });
      if (resp.data?.auth_url) {
        window.location.href = resp.data.auth_url;
      } else {
        throw new Error('未取得 LINE 登入網址');
      }
    } catch (e) {
      console.error('LINE 登入啟動失敗', e);
      setFormError(e.response?.data?.detail || e.message || 'LINE 登入啟動失敗');
    } finally {
      setIsLineLoading(false);
    }
  };

  const handleLineQrLogin = async () => {
    setIsLineQrLoading(true);
    setFormError('');
    try {
      const redirect = `${window.location.origin}/login`;
      const resp = await api.get('/auth/line/login', {
        params: { redirect, mode: 'qr' }
      });
      if (resp.data?.auth_url) {
        setQrAuthUrl(resp.data.auth_url);
        if (resp.data?.session_id) {
          setQrSessionId(resp.data.session_id);
        }
        setQrModalOpen(true);
      } else {
        throw new Error('未取得 LINE 授權網址');
      }
    } catch (e) {
      console.error('LINE 掃碼登入啟動失敗', e);
      setFormError(e.response?.data?.detail || e.message || 'LINE 掃碼登入啟動失敗');
    } finally {
      setIsLineQrLoading(false);
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
                label="員工編號"
                name="username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading || isPasskeyLoading}
              />

              <Collapse in={isPasswordMode} timeout={300} unmountOnExit>
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
                  disabled={isLoading}
                />
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    disabled={isLoading}
                  >
                    {isLoading ? <CircularProgress size={24} /> : '登入'}
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => {
                      setIsPasswordMode(false);
                      setPassword('');
                      setFormError('');
                    }}
                  >
                    取消
                  </Button>
                </Box>
              </Collapse>

              <Collapse in={!isPasswordMode} timeout={300} unmountOnExit>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
                  <Tooltip title="使用Passkey登入">
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<Fingerprint />}
                      onClick={handlePasskeyLogin}
                      disabled={isLoading || isPasskeyLoading}
                      sx={{ py: 1.2 }}
                    >
                      {isPasskeyLoading ? <CircularProgress size={24} /> : '使用Passkey登入'}
                    </Button>
                  </Tooltip>

                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleLineQrLogin}
                    disabled={isLoading || isLineQrLoading}
                    sx={{ py: 1.2, backgroundColor: '#06C755', color: '#fff', ':hover': { backgroundColor: '#06b84f' } }}
                  >
                    {isLineQrLoading ? <CircularProgress size={24} /> : '使用LINE掃碼登入'}
                  </Button>

                  <Button
                    type="button"
                    fullWidth
                    variant="text"
                    disabled={isLoading}
                    sx={{ py: 1.2 }}
                    onClick={() => setIsPasswordMode(true)}
                  >
                    密碼登入
                  </Button>
                </Box>
              </Collapse>
            </Box>
          </Box>
        </Paper>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
          © {new Date().getFullYear()} 恩主公麻醉科班表小查查
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          v0.10.0 beta | 最後更新: 2025-12-12
        </Typography>
      </Box>

      <Dialog open={qrModalOpen} onClose={() => setQrModalOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          使用 LINE 掃碼登入
          <Button onClick={() => setQrModalOpen(false)} sx={{ minWidth: 0, padding: '4px' }}>
            ×
          </Button>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, pt: 2 }}>
          {qrAuthUrl ? (
            <>
              <QRCodeCanvas
                value={qrAuthUrl}
                size={260}
                includeMargin
                level="M"
              />
              <Typography variant="body2" color="text.secondary" align="center">
                使用手機 LINE 掃描 QR 碼完成登入。若 QR 過期，可點擊重新產生。
              </Typography>
            </>
          ) : (
            <Typography>正在產生 QR Code...</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleLineQrLogin}
            disabled={isLineQrLoading}
            variant="contained"
            sx={{ backgroundColor: '#06C755', ':hover': { backgroundColor: '#06b84f' } }}
          >
            {isLineQrLoading ? <CircularProgress size={20} /> : '重新產生'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default Login; 
