import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import PersonIcon from '@mui/icons-material/Person'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'

const NAV_ITEMS = [
  { label: '班表', icon: <CalendarMonthIcon />, path: '/app/schedule' },
  { label: '換班', icon: <SwapHorizIcon />, path: '/app/swap' },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, signOut } = useAuth()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const currentTab = NAV_ITEMS.findIndex(item => location.pathname.startsWith(item.path))

  return (
    <Box display="flex" flexDirection="column" minHeight="100vh">
      <AppBar position="static" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', color: 'text.primary' }}>
        <Toolbar variant="dense">
          <Typography variant="subtitle1" fontWeight={600} sx={{ flexGrow: 1 }}>
            麻醉科班表
          </Typography>
          <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
            <PersonIcon fontSize="small" />
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled sx={{ opacity: 1 }}>
              <Box>
                <Typography variant="body2" fontWeight={500}>{profile?.full_name ?? '—'}</Typography>
                <Typography variant="caption" color="text.secondary">{profile?.identity ?? profile?.role}</Typography>
              </Box>
            </MenuItem>
            <MenuItem onClick={() => { setAnchorEl(null); signOut() }}>登出</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="main" flexGrow={1} overflow="auto">
        <Outlet />
      </Box>

      <Paper elevation={0} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
        <BottomNavigation
          value={currentTab}
          onChange={(_, newValue) => navigate(NAV_ITEMS[newValue].path)}
          showLabels
        >
          {NAV_ITEMS.map((item) => (
            <BottomNavigationAction key={item.path} label={item.label} icon={item.icon} />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  )
}
