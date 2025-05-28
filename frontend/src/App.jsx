import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { zhTW } from '@mui/material/locale';

// 組件
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WeeklySchedule from './pages/WeeklySchedule';
import MonthlySchedule from './pages/MonthlySchedule';
import BigSchedule from './pages/BigSchedule';
import Formula from './pages/Formula';
import ShiftSwapPage from './pages/ShiftSwap';
import AnnouncementPage from './pages/Announcement';
import UserManagement from './pages/UserManagement';
import SettingsPage from './pages/Settings';
import VersionHistory from './pages/VersionHistory';
import OvertimeStaff from './pages/OvertimeStaff';
import NotFound from './pages/NotFound';

// 自訂Hook
import { useAuthStore } from './store/authStore';
import apiService, { api } from './utils/api';
import { cleanExpiredScheduleCache } from './utils/scheduleCache';

// 主題設定
const theme = createTheme({
  palette: {
    primary: {
      main: '#2196f3',
    },
    secondary: {
      main: '#f50057',
    },
    success: {
      main: 'rgba(76, 175, 80, 0.85)',  // 淡化的成功綠色
      light: 'rgba(76, 175, 80, 0.6)',
      dark: 'rgba(56, 142, 60, 0.9)',
    },
    error: {
      main: 'rgba(244, 67, 54, 0.85)',  // 淡化的錯誤紅色
      light: 'rgba(244, 67, 54, 0.6)',
      dark: 'rgba(211, 47, 47, 0.9)',
    }
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
  },
}, zhTW);

// 需要驗證的路由
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// 護理長專用路由
const HeadNurseRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // 允許 head_nurse、boss 角色以及 admin 用戶訪問
  if (user?.role !== 'head_nurse' && user?.role !== 'boss' && user?.role !== 'admin') {
    console.log("用戶角色不符合要求：", user?.role);
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function App() {
  const { initializeAuth, token, user, setAuth } = useAuthStore();
  
  // 在應用啟動時檢查token是否過期，並自動同步user資料
  useEffect(() => {
    // 清理過期的緩存
    cleanExpiredScheduleCache();
    
    initializeAuth();
    // 只要有token就一定fetch /users/me
    if (token) {
      api.get('/users/me')
        .then(res => {
          setAuth(token, res.data);
        })
        .catch(err => {
          // 若token無效自動登出
          if (err.response && err.response.status === 401) {
            setAuth(null, null);
          }
        });
    }
  }, [initializeAuth, token, setAuth]);
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="weekly-schedule" element={<WeeklySchedule />} />
            <Route path="monthly-schedule" element={<MonthlySchedule />} />
            <Route path="big-schedule" element={<BigSchedule />} />
            <Route path="formula" element={<Formula />} />
            <Route path="shift-swap" element={<ShiftSwapPage />} />
            <Route path="announcements" element={<AnnouncementPage />} />
            <Route path="overtime-staff" element={<OvertimeStaff />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="version-history" element={<VersionHistory />} />
            
            {/* 護理長專用路由 */}
            <Route path="user-management" element={
              <HeadNurseRoute>
                <UserManagement />
              </HeadNurseRoute>
            } />
          </Route>
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App; 