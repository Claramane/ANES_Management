import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Drawer,
  IconButton,
  Paper,
  TextField,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  OutlinedInput,
  Checkbox,
  Badge,
  FormControlLabel,
  Snackbar,
  Pagination
} from '@mui/material';
import { Close as CloseIcon, Add as AddIcon, FilterList as FilterListIcon } from '@mui/icons-material';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import PublishAnnouncementForm from './PublishAnnouncementForm';
import apiService from '../utils/api'; // 導入真實API服務
import { useAuthStore } from '../store/authStore'; // 導入用戶身份驗證狀態

// --- 顏色映射 ---
const categoryColors = {
  '長官佈達': { backgroundColor: '#ef5350', color: 'white' }, // 偏紅
  '政令宣導': { backgroundColor: '#42a5f5', color: 'white' }, // 偏藍
  '系統公告': { backgroundColor: '#ff9800', color: 'black' }, // 偏橙
  '交班':     { backgroundColor: '#66bb6a', color: 'white' }, // 偏綠
  '閒聊':     { backgroundColor: '#ab47bc', color: 'white' }, // 偏紫
  'default':  { backgroundColor: '#bdbdbd', color: 'black' }  // 預設灰色
};

// 獲取顏色，如果找不到則返回預設值
const getCategoryStyle = (category) => {
  return categoryColors[category] || categoryColors.default;
};

const Announcement = () => {
  const { user } = useAuthStore(); // 獲取當前登入用戶
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [authorFilter, setAuthorFilter] = useState('');
  const [allAuthors, setAllAuthors] = useState([]);
  const [notification, setNotification] = useState({ open: false, message: '', type: 'success' });
  const [page, setPage] = useState(1);
  const pageSize = 30;

  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPublishFormOpen, setIsPublishFormOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  const categories = ['長官佈達', '政令宣導', '系統公告', '交班', '閒聊'];
  
  // 檢查使用者權限，判斷是否有發布公告的權限
  const canPublishAnnouncement = useMemo(() => {
    if (!user) return false;
    // 可以根據貴司需求調整權限邏輯，例如只有特定角色可以發布公告
    return ['admin', 'head_nurse', 'supervisor'].includes(user.role);
  }, [user]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 獲取公告列表
      const announcementResponse = await apiService.announcement.getAll();
      
      // 獲取所有用戶（作者篩選用）
      const usersResponse = await apiService.user.getAll();
      
      // 對公告按時間降序排序
      const sortedData = announcementResponse.data.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      
      setAnnouncements(sortedData);
      
      // 從用戶列表中提取顯示名稱，用於作者篩選
      const authorNames = usersResponse.data.map(user => 
        user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim()
      ).filter(Boolean);
      
      setAllAuthors([...new Set(authorNames)]);

    } catch (err) {
      console.error("獲取數據失敗:", err);
      setError(err.response?.data?.message || err.message || '無法加載數據');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter(ann => {
      // 1. 關鍵字搜尋
      const lowerSearchTerm = searchTerm.toLowerCase();
      const matchesSearch = (
        !searchTerm || // 如果搜尋詞為空，則匹配所有
        (ann.title?.toLowerCase() || '').includes(lowerSearchTerm) ||
        (ann.content?.toLowerCase() || '').includes(lowerSearchTerm) ||
        (ann.author?.full_name?.toLowerCase() || '').includes(lowerSearchTerm)
      );

      // 2. 種類篩選 (多選)
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(ann.category);

      // 3. 日期範圍篩選
      const matchesDate = (
        (!startDate || new Date(ann.created_at) >= startOfDay(startDate)) &&
        (!endDate || new Date(ann.created_at) <= endOfDay(endDate))
      );

      // 4. 作者篩選
      const matchesAuthor = !authorFilter || ann.author?.full_name === authorFilter;

      // 必須滿足所有條件
      return matchesSearch && matchesCategory && matchesDate && matchesAuthor;
    });
  }, [announcements, searchTerm, selectedCategories, startDate, endDate, authorFilter]);

  // 進行分頁處理
  const paginatedAnnouncements = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredAnnouncements.slice(startIndex, startIndex + pageSize);
  }, [filteredAnnouncements, page, pageSize]);

  // 總頁數
  const totalPages = useMemo(() => {
    return Math.ceil(filteredAnnouncements.length / pageSize);
  }, [filteredAnnouncements, pageSize]);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setPage(1); // 搜尋時重置頁碼
  };

  const handleCategoryChange = (event) => {
    const { target: { value } } = event;
    setSelectedCategories(
      // On autofill we get a stringified value.
      typeof value === 'string' ? value.split(',') : value,
    );
    setPage(1); // 變更類別時重置頁碼
  };

  const handleStartDateChange = (newValue) => {
    setStartDate(newValue);
    setPage(1); // 變更日期時重置頁碼
  };

  const handleEndDateChange = (newValue) => {
    // 自動設置為一天的結束
    setEndDate(newValue ? endOfDay(newValue) : null);
    setPage(1); // 變更日期時重置頁碼
  };

  const handleAuthorChange = (event) => {
    setAuthorFilter(event.target.value);
    setPage(1); // 變更作者時重置頁碼
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleOpenDetail = (announcement) => {
    setSelectedAnnouncement(announcement);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedAnnouncement(null);
  };

  const handleOpenPublishForm = () => {
    setIsPublishFormOpen(true);
  };

  const handleClosePublishForm = () => {
    setIsPublishFormOpen(false);
  };

  const handlePublishSubmit = async (formData) => {
    try {
      setIsLoading(true);
      
      // 如果category_id是字符串（名稱），嘗試獲取對應的分類ID
      if (typeof formData.category_id === 'string' && isNaN(parseInt(formData.category_id))) {
        const categoryName = formData.category_id;
        // 獲取所有分類
        const categoriesResponse = await apiService.announcement.getCategories();
        if (categoriesResponse.data) {
          // 查找匹配的分類
          const category = categoriesResponse.data.find(c => c.name === categoryName);
          if (category) {
            formData.category_id = category.id;
          } else {
            throw new Error(`找不到名為 "${categoryName}" 的分類`);
          }
        }
      }
      
      // 將表單數據發送到後端
      const response = await apiService.announcement.create(formData);
      
      if (response.data.success) {
        // 成功後，關閉表單並重新獲取數據
        handleClosePublishForm();
        await fetchData();
        
        // 顯示成功通知
        setNotification({
          open: true,
          message: '公告發布成功！',
          type: 'success'
        });
      } else {
        throw new Error(response.data.message || "發布公告失敗");
      }
    } catch (err) {
      console.error("發布公告時出錯:", err);
      setError(err.response?.data?.message || err.message || "發布公告時發生錯誤");
      
      // 顯示錯誤通知
      setNotification({
        open: true,
        message: err.response?.data?.message || err.message || "發布公告失敗",
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenFilterDialog = () => {
    setIsFilterDialogOpen(true);
  };

  const handleCloseFilterDialog = () => {
    setIsFilterDialogOpen(false);
  };

  const handleClearFilters = () => {
    setSelectedCategories([]);
    setStartDate(null);
    setEndDate(null);
    setAuthorFilter('');
  };
  
  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };
  
  const handleDeleteAnnouncement = async (announcementId) => {
    if (!window.confirm('確定要刪除此公告嗎？此操作無法撤銷。')) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // 發送刪除請求到後端
      const response = await apiService.announcement.delete(announcementId);
      
      if (response.data.success) {
        // 刪除成功後關閉詳情頁
        handleCloseDetail();
        
        // 重新獲取數據
        await fetchData();
        
        // 顯示成功通知
        setNotification({
          open: true,
          message: '公告已成功刪除',
          type: 'success'
        });
      } else {
        throw new Error(response.data.message || "刪除公告失敗");
      }
    } catch (err) {
      console.error("刪除公告時出錯:", err);
      
      // 顯示錯誤通知
      setNotification({
        open: true,
        message: err.response?.data?.message || err.message || "刪除公告失敗",
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategories.length > 0) count++;
    if (startDate || endDate) count++;
    if (authorFilter) count++;
    return count;
  }, [selectedCategories, startDate, endDate, authorFilter]);

  // 檢查當前用戶是否有權限刪除選中的公告
  const canDeleteAnnouncement = useMemo(() => {
    if (!user || !selectedAnnouncement) return false;
    
    // 系統管理員可以刪除任何公告
    if (user.role === 'admin') return true;
    
    // 護理長/主管可以刪除自己發布的公告
    if (['head_nurse', 'supervisor'].includes(user.role)) {
      return selectedAnnouncement.author?.id === user.id;
    }
    
    // 其他角色不能刪除公告
    return false;
  }, [user, selectedAnnouncement]);

  return (
    <Box sx={{ padding: 3 }}>
      {/* Filter Bar Section */}
      <Paper sx={{ p: 1.5, mb: 3, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
         <TextField
            label="搜尋公告"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={handleSearchChange}
            sx={{ flexGrow: 1, minWidth: '180px' }}
         />
         <Button
            variant="outlined"
            startIcon={<FilterListIcon />}
            onClick={handleOpenFilterDialog}
            size="medium"
         >
           <Badge badgeContent={activeFilterCount} color="primary">
              篩選
           </Badge>
         </Button>
         {canPublishAnnouncement && (
           <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenPublishForm}
              size="medium"
           >
              發布新公告
           </Button>
         )}
      </Paper>

      <Box>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : filteredAnnouncements.length > 0 ? (
          <>
            <List component={Paper}>
              {paginatedAnnouncements.map((ann, index) => (
                <React.Fragment key={ann.id}>
                  <ListItem button onClick={() => handleOpenDetail(ann)}>
                    <ListItemText
                      primary={
                         <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>{ann.title}</Typography>
                             <Chip 
                               label={ann.category} 
                               size="small" 
                               sx={{ 
                                 ml: 1, 
                                 ...getCategoryStyle(ann.category) // 應用動態顏色
                               }} 
                             />
                         </Box>
                      }
                      secondary={`發布者: ${ann.author?.full_name || 'N/A'} | 日期: ${format(new Date(ann.created_at), 'yyyy-MM-dd HH:mm', { locale: zhTW })}`}
                    />
                  </ListItem>
                  {index < paginatedAnnouncements.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
            
            {/* 分頁控件 */}
            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Pagination 
                  count={totalPages} 
                  page={page} 
                  onChange={handlePageChange} 
                  color="primary"
                  siblingCount={1}
                  boundaryCount={1}
                />
              </Box>
            )}
          </>
        ) : (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">沒有找到符合條件的公告</Typography>
          </Paper>
        )}
      </Box>

      <Drawer anchor="right" open={isDetailOpen} onClose={handleCloseDetail}>
        <Box sx={{ width: 400, p: 3 }}>
           <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
               <Typography variant="h6">公告詳情</Typography>
               <IconButton onClick={handleCloseDetail}>
                 <CloseIcon />
               </IconButton>
           </Box>
           <Divider sx={{ mb: 2 }}/>
           {selectedAnnouncement && (
             <Box>
               <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>{selectedAnnouncement.title}</Typography>
               <Chip 
                 label={selectedAnnouncement.category} 
                 size="small" 
                 sx={{ 
                   mb: 1,
                   ...getCategoryStyle(selectedAnnouncement.category) // 應用動態顏色
                 }} 
               />
               <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                   發布者: {selectedAnnouncement.author?.full_name || 'N/A'}
               </Typography>
               <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                   發布日期: {format(new Date(selectedAnnouncement.created_at), 'yyyy-MM-dd HH:mm', { locale: zhTW })}
               </Typography>
               {selectedAnnouncement.expires_at && (
                 <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                     有效日期: {format(new Date(selectedAnnouncement.expires_at), 'yyyy-MM-dd', { locale: zhTW })}
                 </Typography>
               )}
               <Divider sx={{ my: 2 }}/>
               <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{selectedAnnouncement.content}</Typography>
               
               {canDeleteAnnouncement && (
                 <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                   <Button 
                     variant="outlined" 
                     color="error"
                     onClick={() => handleDeleteAnnouncement(selectedAnnouncement.id)}
                   >
                     刪除公告
                   </Button>
                 </Box>
               )}
             </Box>
           )}
        </Box>
      </Drawer>

      <Dialog open={isPublishFormOpen} onClose={handleClosePublishForm} maxWidth="sm" fullWidth>
         <DialogTitle>發布新公告</DialogTitle>
         <PublishAnnouncementForm 
            onSubmit={handlePublishSubmit} 
            onCancel={handleClosePublishForm} 
         />
      </Dialog>

      <Dialog open={isFilterDialogOpen} onClose={handleCloseFilterDialog} maxWidth="xs" fullWidth>
        <DialogTitle>篩選公告</DialogTitle>
        <DialogContent dividers>
           <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
             {/* 種類篩選 */} 
             <FormControl component="fieldset" variant="standard">
                <Typography component="legend" variant="subtitle2" sx={{ mb: 0.5 }}>依種類篩選:</Typography> 
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {categories.map((cat) => (
                    <FormControlLabel
                      key={cat}
                      control={
                        <Checkbox 
                          checked={selectedCategories.includes(cat)}
                          onChange={(event) => {
                             const checked = event.target.checked;
                             setSelectedCategories((prev) => 
                               checked ? [...prev, cat] : prev.filter((c) => c !== cat)
                             );
                          }}
                          name={cat}
                          size="small"
                        />
                      }
                      label={<Chip label={cat} size="small" sx={{...getCategoryStyle(cat)}} />}
                      sx={{ mr: 0.5 }} // 調整標籤間距
                    />
                  ))}
                </Box>
             </FormControl>

             {/* 日期篩選 */} 
             <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
                <Typography component="legend" variant="subtitle2" sx={{ mb: 0.5 }}>依發布日期篩選:</Typography> 
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                   <DatePicker
                     label="起始日期"
                     value={startDate}
                     onChange={handleStartDateChange}
                     maxDate={endDate || undefined}
                     renderInput={(params) => <TextField {...params} size="small" fullWidth />} // 使用 fullWidth
                     clearable
                   />
                   <DatePicker
                     label="結束日期"
                     value={endDate}
                     onChange={handleEndDateChange}
                     minDate={startDate || undefined}
                     renderInput={(params) => <TextField {...params} size="small" fullWidth />} // 使用 fullWidth
                     clearable
                   />
                </Box>
             </LocalizationProvider>

             {/* 作者篩選 */} 
             <FormControl size="small" fullWidth> {/* 使用 fullWidth */} 
                <InputLabel>發布者篩選</InputLabel>
                <Select
                  value={authorFilter}
                  label="發布者篩選"
                  onChange={handleAuthorChange}
                >
                  <MenuItem value=""><em>全部發布者</em></MenuItem>
                  {allAuthors.map((author, index) => (
                    <MenuItem key={index} value={author}>{author}</MenuItem>
                  ))}
                </Select>
             </FormControl>

           </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClearFilters}>清除篩選</Button>
          <Button onClick={handleCloseFilterDialog} variant="contained">關閉</Button>
        </DialogActions>
      </Dialog>
      
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        message={notification.message}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.type} 
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

    </Box>
  );
};

export default Announcement; 