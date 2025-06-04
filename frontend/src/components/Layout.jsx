import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Home as HomeIcon,
  Event as EventIcon,
  CalendarMonth as CalendarMonthIcon,
  ViewWeek as ViewWeekIcon,
  Sync as SyncIcon,
  Announcement as AnnouncementIcon,
  Settings as SettingsIcon,
  People as PeopleIcon,
  Logout as LogoutIcon,
  History as HistoryIcon,
  Work as WorkIcon,
} from '@mui/icons-material';

import { useAuthStore } from '../store/authStore';

const drawerWidth = 240;

function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const isHeadNurse = user?.role === 'head_nurse' || user?.role === 'admin';

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDesktopDrawerToggle = () => {
    setDesktopOpen(!desktopOpen);
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // 一般選單項目
  const menuItems = [
    { text: '首頁', icon: <HomeIcon />, path: '/dashboard' },
    { text: '週班表', icon: <ViewWeekIcon />, path: '/weekly-schedule' },
    { text: '月班表', icon: <CalendarMonthIcon />, path: '/monthly-schedule' },
    { text: '醫師班表', icon: <EventIcon />, path: '/doctor-schedule' },
    { text: '換班申請', icon: <SyncIcon />, path: '/shift-swap' },
    { text: '加班人員', icon: <WorkIcon />, path: '/overtime-staff' },
    { text: '公告專區', icon: <AnnouncementIcon />, path: '/announcements' },
    { text: '系統設定', icon: <SettingsIcon />, path: '/settings' },
    // { text: '歷史紀錄', icon: <HistoryIcon />, path: '/version-history' },
  ];

  // 護理長專用選單 
  const headNurseMenuItems = [
    { text: '公式班表', icon: <EventIcon />, path: '/formula' },
    { text: '用戶管理', icon: <PeopleIcon />, path: '/user-management' },
  ];

  const drawer = (
    <div>
      <Toolbar sx={{ justifyContent: 'center' }}>
        <Typography 
          variant="h6" 
          component="div"
          sx={{
            fontSize: { s: '2rem', sm: '1.1rem' },
            textAlign: 'center',
            whiteSpace: 'normal',
            lineHeight: 1.2,
            py: 1
          }}
        >
          恩主公麻醉科
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
                setDesktopOpen(false);
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      {isHeadNurse && (
        <>
          <Divider />
          <List>
            {headNurseMenuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  selected={location.pathname === item.path}
                  onClick={() => {
                    navigate(item.path);
                    setMobileOpen(false);
                    setDesktopOpen(false);
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </>
      )}
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: '100%',
          ml: 0,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDesktopDrawerToggle}
            sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              flexGrow: 1,
              fontSize: { xs: '0.9rem', sm: '1.1rem', md: '1.25rem' },
              whiteSpace: { xs: 'normal', sm: 'normal' },
              lineHeight: { xs: 1.2, sm: 1.5 }
            }}
          >
            {/* 根據當前頁面路徑顯示標題 */}
            {[...menuItems, ...headNurseMenuItems].find(
              (item) => item.path === location.pathname
            )?.text || (
              <>
                恩主公麻醉科
              </>
            )}
          </Typography>
          <IconButton
            size="large"
            edge="end"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              {user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'U'}
            </Avatar>
          </IconButton>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
          >
            <MenuItem disabled>
              {user?.full_name || user?.username}
              <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                {user?.identity ? `(${user.identity})` : user?.role === 'head_nurse' ? '(護理長)' : '(護理師)'}
              </Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              登出
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: 0, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        {/* 手機版導航抽屜 */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        {/* 桌面版也用 temporary 抽屜 */}
        <Drawer
          variant="temporary"
          open={desktopOpen}
          onClose={handleDesktopDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 0.25, sm: 2, md: 3 },  // 手機2px、平板16px、桌面24px
          width: '100%',
          ml: 0,
          mt: '64px',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}

export default Layout; 