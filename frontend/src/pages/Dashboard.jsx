import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  CardActions,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Event as EventIcon,
  Sync as SyncIcon,
  Announcement as AnnouncementIcon,
  ArrowForward as ArrowForwardIcon,
  Today as TodayIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import apiService from '../utils/api';

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [todaySchedule, setTodaySchedule] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [swapRequests, setSwapRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        // 這裡是簡化模型，實際可能需要單獨API
        // 獲取當天班表
        // const today = new Date();
        // const todayScheduleRes = await apiService.schedule.getTodaySchedule();
        // setTodaySchedule(todayScheduleRes.data);

        // 獲取公告
        // const announcementsRes = await apiService.announcement.getAll();
        // setAnnouncements(announcementsRes.data.slice(0, 5));

        // 獲取換班請求
        // const swapRequestsRes = await apiService.shiftSwap.getRequests();
        // setSwapRequests(swapRequestsRes.data.slice(0, 5));

        // 模擬數據 - 實際上應該從API獲取
        setTodaySchedule({
          shift_type: 'D',
          area_code: '開刀房三房',
          work_time: '08:00-16:00'
        });

        setAnnouncements([
          { id: 1, title: '五月份班表已發布', category: { name: '班表相關' }, created_at: '2023-04-25T10:30:00' },
          { id: 2, title: '護理部會議通知', category: { name: '會議通知' }, created_at: '2023-04-23T14:15:00' },
          { id: 3, title: '醫院年度健康檢查', category: { name: '公告' }, created_at: '2023-04-20T09:45:00' }
        ]);

        setSwapRequests([
          { id: 1, original_date: '2023-05-05', original_shift_type: 'D', target_date: '2023-05-10', target_shift_type: 'D', status: 'pending' },
          { id: 2, original_date: '2023-05-12', original_shift_type: 'A', target_date: '2023-05-15', target_shift_type: 'A', status: 'pending' }
        ]);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError('獲取數據失敗，請稍後再試');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getShiftLabel = (shift) => {
    const shiftMap = {
      'D': '白班',
      'A': '小夜班',
      'N': '大夜班',
      'O': '休假'
    };
    return shiftMap[shift] || shift;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="page-container">
      <Typography variant="h4" gutterBottom>
        歡迎，{user?.full_name || user?.username}
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {/* 今日班表卡片 */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TodayIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">今日班表</Typography>
              </Box>
              
              {todaySchedule ? (
                <Box sx={{ mt: 2 }}>
                  <Chip 
                    label={getShiftLabel(todaySchedule.shift_type)} 
                    color="primary" 
                    className={`shift-${todaySchedule.shift_type}`} 
                    sx={{ fontWeight: 'bold', mb: 1 }}
                  />
                  <Typography variant="body1">區域: {todaySchedule.area_code}</Typography>
                  <Typography variant="body1">時間: {todaySchedule.work_time}</Typography>
                </Box>
              ) : (
                <Typography variant="body1" color="text.secondary">
                  今日無班表安排
                </Typography>
              )}
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/weekly-schedule')}
              >
                查看週班表
              </Button>
            </CardActions>
          </Card>
        </Grid>
        
        {/* 最新公告卡片 */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AnnouncementIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">最新公告</Typography>
              </Box>
              
              {announcements.length > 0 ? (
                <List dense>
                  {announcements.map((announcement) => (
                    <ListItem key={announcement.id} disablePadding sx={{ mb: 1 }}>
                      <ListItemText
                        primary={announcement.title}
                        secondary={
                          <>
                            <Chip 
                              label={announcement.category.name} 
                              size="small" 
                              sx={{ mr: 1, fontSize: '0.7rem' }} 
                            />
                            {new Date(announcement.created_at).toLocaleDateString()}
                          </>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body1" color="text.secondary">
                  目前無公告
                </Typography>
              )}
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/announcements')}
              >
                查看所有公告
              </Button>
            </CardActions>
          </Card>
        </Grid>
        
        {/* 換班請求卡片 */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SyncIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">待處理換班請求</Typography>
              </Box>
              
              {swapRequests.length > 0 ? (
                <List dense>
                  {swapRequests.map((request) => (
                    <ListItem key={request.id} sx={{ mb: 1 }}>
                      <ListItemIcon>
                        <Chip 
                          label={getShiftLabel(request.original_shift_type)} 
                          size="small"
                          className={`shift-${request.original_shift_type}`}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${formatDate(request.original_date)} → ${formatDate(request.target_date)}`}
                        secondary={`${getShiftLabel(request.original_shift_type)} → ${getShiftLabel(request.target_shift_type)}`}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body1" color="text.secondary">
                  目前無待處理換班請求
                </Typography>
              )}
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/shift-swap')}
              >
                查看換班申請
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard; 