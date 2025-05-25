import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import jwtDecode from 'jwt-decode';
import { api } from '../utils/api';

// Helper function to convert ArrayBuffer to base64url
function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  let base64 = window.btoa(binary);
  // base64url 替換
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Helper function to convert base64url to ArrayBuffer
function base64UrlToArrayBuffer(base64url) {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  // 補齊 padding
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      
      // 登入
      login: async (username, password, isPasskeyLogin = false) => {
        set({ isLoading: true, error: null });
        try {
          let response;
          
          if (isPasskeyLogin) {
            // Passkey登入不需要密碼
            // 在 Login.jsx 中，我們會先呼叫 /webauthn/authenticate/finish
            // 並用回傳的 user 資料來呼叫這個 login 方法
            // 所以這裡我們假設 passkey 驗證已在後端完成
            // 並且 username 欄位會是後端回傳的 user.username
             const userResponse = await api.get('/users/me', {
              headers: {
                // 這裡需要一個方法來獲取 passkey 驗證後端產生的 token
                // 暫時假設 finishResponse.data.user 已經包含了 token
                // 或者 finish API 直接回傳 JWT token
                // 這裡的邏輯需要配合後端 /webauthn/authenticate/finish 的回傳
                // 目前的 authStore.js 在 isPasskeyLogin 時是寫死的 'passkey-auth-token'
                // 這部分需要調整
                Authorization: `Bearer passkey-auth-token` 
              }
            });
            set({
              token: 'passkey-auth-token', // 這裡應該是真的 token
              isAuthenticated: true,
              isLoading: false,
              error: null,
              user: userResponse.data // 確保 user 資料被設定
            });
            return true;

          } else {
            // 傳統密碼登入
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);
            
            response = await api.post('/login', formData, {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            });
          }
          
          const token = response.data.access_token;
          
          // 設置令牌
          set({
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null
          });
          
          // 獲取用戶資料
          const userResponse = await api.get('/users/me', {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          // 更新用戶資料
          set({
            user: userResponse.data
          });
          
          return true;
        } catch (error) {
          console.error('登入失敗:', error);
          set({
            isLoading: false,
            error: error.response?.data?.detail || '登入失敗，請檢查賬號密碼'
          });
          return false;
        }
      },
      
      // 登出
      logout: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          error: null
        });
      },
      
      // 直接設置認證狀態（用於Passkey登入）
      setAuth: (token, user) => {
        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
      },
      
      // 重新獲取用戶資料
      refreshUserData: async () => {
        const { token } = get();
        if (!token) return;
        
        try {
          const response = await api.get('/users/me');
          
          set({
            user: response.data
          });
          
          return response.data;
        } catch (error) {
          console.error('Failed to refresh user data:', error);
          return null;
        }
      },
      
      // 更新用戶個人資料
      updateProfile: async (profileData) => {
        set({ isLoading: true, error: null });
        try {
          const { user } = get();
          if (!user || !user.id) {
            throw new Error('用戶資料不存在');
          }
          
          const response = await api.put(`/users/${user.id}`, profileData);
          
          set({
            user: response.data,
            isLoading: false
          });
          
          return response.data;
        } catch (error) {
          console.error('更新個人資料失敗:', error);
          let errorMessage = '更新個人資料失敗';
          if (error.response?.data?.detail) {
            if (Array.isArray(error.response.data.detail)) {
              errorMessage = error.response.data.detail.map(item => item.msg).join(', ');
            } else {
              errorMessage = error.response.data.detail;
            }
          }
          
          set({
            isLoading: false,
            error: errorMessage
          });
          throw error;
        }
      },

      // 註冊Passkey
      registerPasskey: async () => {
        set({ isLoading: true, error: null });
        try {
          // 開始註冊流程
          const startResponse = await api.post('/webauthn/register/start');
          const optionsFromServer = startResponse.data.publicKey;

          if (!optionsFromServer || typeof optionsFromServer !== 'object') {
            console.error('Invalid optionsFromServer:', optionsFromServer);
            throw new Error('從伺服器獲取註冊選項失敗');
          }

          // 轉換 challenge 和 user.id 為 ArrayBuffer
          const publicKeyCredentialCreationOptions = {
            ...optionsFromServer,
            challenge: base64UrlToArrayBuffer(optionsFromServer.challenge),
            user: {
              ...optionsFromServer.user,
              id: base64UrlToArrayBuffer(optionsFromServer.user.id),
            },
            //確保 pubKeyCredParams 是正確的格式
             pubKeyCredParams: optionsFromServer.pubKeyCredParams.map(param => ({
              type: param.type,
              alg: param.alg,
            })),
             // 確保 excludeCredentials 中的 id 是 ArrayBuffer (如果存在)
            excludeCredentials: optionsFromServer.excludeCredentials?.map(cred => ({
              ...cred,
              id: base64UrlToArrayBuffer(cred.id),
            })) || [],
          };
          
          // 調用瀏覽器的WebAuthn API
          const credential = await navigator.credentials.create({
            publicKey: publicKeyCredentialCreationOptions
          });

          // Debug: log id/rawId
          console.log('credential.id', credential.id);
          console.log('rawId as base64url', arrayBufferToBase64Url(credential.rawId));
          console.log('id == rawId?', credential.id === arrayBufferToBase64Url(credential.rawId));
          // 進一步驗證 base64url encode/decode
          const rawIdBase64url = arrayBufferToBase64Url(credential.rawId);
          const rawIdDecoded = base64UrlToArrayBuffer(rawIdBase64url);
          console.log('credential.rawId Uint8Array', new Uint8Array(credential.rawId));
          console.log('base64UrlToArrayBuffer(arrayBufferToBase64Url(credential.rawId)) Uint8Array', new Uint8Array(rawIdDecoded));
          console.log('rawId bytes equal?', new Uint8Array(credential.rawId).every((v, i) => v === new Uint8Array(rawIdDecoded)[i]));

          // 完成註冊流程
          await api.post('/webauthn/register/finish', {
            id: credential.id,
            raw_id: arrayBufferToBase64Url(credential.rawId),
            response: {
              client_data_json: arrayBufferToBase64Url(credential.response.clientDataJSON),
              attestation_object: arrayBufferToBase64Url(credential.response.attestationObject),
            },
            type: credential.type
          });

          set({ isLoading: false });
          return true;
        } catch (error) {
          console.error('Passkey註冊失敗:', error);
          set({
            isLoading: false,
            error: error.message || error.response?.data?.detail || 'Passkey註冊失敗'
          });
          return false;
        }
      },

      // 獲取Passkey列表
      getPasskeys: async () => {
        try {
          const response = await api.get('/webauthn/credentials');
          return response.data;
        } catch (error) {
          console.error('獲取Passkey列表失敗:', error);
          throw error;
        }
      },

      // 刪除Passkey
      deletePasskey: async (credentialId) => {
        try {
          await api.delete(`/webauthn/credentials/${credentialId}`);
          return true;
        } catch (error) {
          console.error('刪除Passkey失敗:', error);
          throw error;
        }
      }
    }),
    {
      name: 'auth-storage',
      getStorage: () => localStorage,
    }
  )
); 