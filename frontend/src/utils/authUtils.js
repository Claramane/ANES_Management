// 認證相關工具函數
import { useAuthStore } from '../store/authStore';

// 手動觸發認證狀態檢查
export const forceAuthCheck = () => {
  const { checkAuthStatus, logout } = useAuthStore.getState();
  
  if (!checkAuthStatus()) {
    logout();
    
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    
    return false;
  }
  
  return true;
}; 