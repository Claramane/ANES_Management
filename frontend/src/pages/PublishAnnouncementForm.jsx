import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  FormHelperText,
  DialogActions, 
  DialogContent,
  CircularProgress
} from '@mui/material';
import { useAuthStore } from '../store/authStore'; // 導入用戶狀態
import apiService from '../utils/api'; // 導入API服務

const PublishAnnouncementForm = ({ onSubmit, onCancel }) => {
  const { user } = useAuthStore(); // 獲取當前用戶信息
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [errors, setErrors] = useState({});
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  // 獲取所有可用分類
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const response = await apiService.announcement.getCategories();
        if (response.data) {
          setCategories(response.data);
        }
      } catch (error) {
        console.error('無法獲取公告分類:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // 根據用戶角色決定可用的種類
  const availableCategories = useMemo(() => {
    // 如果從API獲取到了分類，就使用API的分類
    if (categories.length > 0) {
      // 管理員和護理長可以看到所有分類
      if (user?.role === 'admin' || user?.role === 'head_nurse') {
        return categories;
      }
      // 其他用戶只能看到指定分類
      return categories.filter(cat => 
        ['交班', '閒聊'].includes(cat.name)
      );
    }
    
    // 作為後備，使用硬編碼的分類
    const allCategories = ['長官佈達', '政令宣導', '系統公告', '交班', '閒聊'];
    const restrictedCategories = ['交班', '閒聊'];
    
    if (user?.role === 'admin' || user?.role === 'head_nurse' || user?.role === 'supervisor') {
      return allCategories.map(name => ({ id: name, name }));
    } else {
      return restrictedCategories.map(name => ({ id: name, name }));
    }
  }, [user, categories]);

  // 在可用種類變化時，如果當前選擇的種類不在新列表中，則重置
  useEffect(() => {
    if (category && !availableCategories.some(cat => cat.id === category)) {
      setCategory(''); // 或者設置為可用列表的第一個
    }
  }, [availableCategories, category]);

  const validateForm = () => {
    const newErrors = {};
    if (!title.trim()) newErrors.title = '標題不能為空';
    if (!content.trim()) newErrors.content = '內容不能為空';
    if (!category) newErrors.category = '請選擇公告種類';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (validateForm()) {
      try {
        // 準備表單數據
        const formData = {
          title,
          content,
          category_id: category
        };
        
        // 調用父組件的onSubmit
        await onSubmit(formData);
        
        // 如果提交成功則清空表單
        setTitle('');
        setContent('');
        setCategory('');
      } catch (error) {
        console.error('提交表單時出錯:', error);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogContent dividers> {/* 使用 dividers 添加分隔線 */} 
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}> {/* pt:1 給上方留點空隙 */} 
          <TextField
            label="公告標題"
            variant="outlined"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={!!errors.title}
            helperText={errors.title}
            required
          />
          <TextField
            label="公告內容"
            variant="outlined"
            fullWidth
            multiline
            rows={6} // 增加行數
            value={content}
            onChange={(e) => setContent(e.target.value)}
            error={!!errors.content}
            helperText={errors.content}
            required
          />
          <FormControl fullWidth error={!!errors.category} required>
            <InputLabel>公告種類</InputLabel>
            <Select
              value={category}
              label="公告種類"
              onChange={(e) => setCategory(e.target.value)}
              disabled={loading}
            >
              <MenuItem value="" disabled><em>請選擇...</em></MenuItem>
              {loading ? (
                <MenuItem disabled>
                  <CircularProgress size={20} />
                  &nbsp;載入中...
                </MenuItem>
              ) : (
                availableCategories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                ))
              )}
            </Select>
            {errors.category && <FormHelperText>{errors.category}</FormHelperText>}
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>取消</Button>
        <Button 
          type="submit" 
          variant="contained"
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : '發布'}
        </Button>
      </DialogActions>
    </form>
  );
};

export default PublishAnnouncementForm; 