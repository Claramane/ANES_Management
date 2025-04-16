import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import jwtDecode from 'jwt-decode';
import { api } from '../utils/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      
      // 登入
      login: async (username, password) => {
        set({ isLoading: true, error: null });
        try {
          const formData = new FormData();
          formData.append('username', username);
          formData.append('password', password);
          
          const response = await api.post('/login', formData, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          });
          
          const token = response.data.access_token;
          
          // 先設置令牌，這樣後續請求可以使用它
          set({
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null
          });
          
          // 獲取用戶資料，明確傳遞令牌
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
          // 不再自動登出，即使 token 過期
          // if (error.response?.status === 401) {
          //   get().logout();
          // }
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
          
          // 使用用戶ID進行更新，而不是使用 /users/me 路由
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
            // 處理可能是陣列的情況
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
      }
    }),
    {
      name: 'auth-storage', // 本地存儲名稱
      getStorage: () => localStorage, // 使用localStorage
    }
  )
); 