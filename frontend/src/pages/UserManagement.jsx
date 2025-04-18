import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Paper, 
  Button, 
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useUserStore } from '../store/userStore';

const UserManagement = () => {
  const { users, isLoading, error, fetchUsers, addUser, updateUser, deleteUser } = useUserStore();
  const [localError, setLocalError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [errors, setErrors] = useState({});
  
  // 對話框狀態
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  
  // 當前選中的用戶
  const [selectedUser, setSelectedUser] = useState(null);
  
  // 表單數據
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'nurse',
    identity: '麻醉專科護理師',
    group: 1,
    is_active: true,
    hire_date: new Date().toISOString().split('T')[0]  // 預設為今天日期
  });

  // 全域編輯模式切換
  const [editMode, setEditMode] = useState(false);
  
  // 可排序的用戶列表
  const [sortableUsers, setSortableUsers] = useState([]);
  
  // 存儲原始用戶數據用於比較
  const [originalUsers, setOriginalUsers] = useState([]);
  
  // 初始化排序用戶列表
  useEffect(() => {
    if (users && users.length > 0) {
      // 按照身份權重初始排序
      const sorted = [...users].sort((a, b) => {
        const weightA = getIdentityWeight(a.identity);
        const weightB = getIdentityWeight(b.identity);
        return weightA - weightB;
      });
      setSortableUsers(sorted);
      setOriginalUsers(JSON.parse(JSON.stringify(sorted))); // 深拷貝保存原始狀態
    }
  }, [users]);
  
  const handleEditModeChange = async (event) => {
    const newEditMode = event.target.checked;
    
    // 如果從編輯模式切換回非編輯模式，保存所有變更
    if (editMode && !newEditMode) {
      try {
        // 比較當前用戶和原始用戶數據，找出變更
        const updatesPromises = sortableUsers.map(async (currentUser) => {
          const originalUser = originalUsers.find(u => u.id === currentUser.id);
          
          if (!originalUser) return Promise.resolve(); // 新增的用戶已經保存過了
          
          const changes = {};
          let hasChanges = false;
          
          // 檢查所有可能變更的字段
          ['full_name', 'email', 'identity', 'group'].forEach(field => {
            if (currentUser[field] !== originalUser[field]) {
              changes[field] = currentUser[field];
              hasChanges = true;
            }
          });
          
          // 如果有變更，提交到服務器
          if (hasChanges) {
            return updateUser(currentUser.id, changes);
          }
          
          return Promise.resolve();
        });
        
        await Promise.all(updatesPromises);
        
        // 保存護理師順序信息
        saveNurseOrder();
        
        setSuccess('所有變更已保存！');
        
        // 3秒後自動清除成功訊息
        setTimeout(() => {
          setSuccess(null);
        }, 3000);
        
        // 更新原始數據
        setOriginalUsers(JSON.parse(JSON.stringify(sortableUsers)));
      } catch (err) {
        console.error('Error saving changes:', err);
        setLocalError('保存變更失敗：' + (err.response?.data?.detail || err.message));
      }
    }
    
    setEditMode(newEditMode);
  };

  // 保存護理師順序到userStore
  const saveNurseOrder = () => {
    // 按身份分類用戶
    const nursesByIdentity = {};
    
    sortableUsers.forEach(user => {
      if (user.identity) {
        if (!nursesByIdentity[user.identity]) {
          nursesByIdentity[user.identity] = [];
        }
        nursesByIdentity[user.identity].push(user.id);
      }
    });
    
    // 保存各身份的用戶順序
    Object.entries(nursesByIdentity).forEach(([identity, userIds]) => {
      useUserStore.getState().updateUserOrder(identity, userIds);
    });
    
    console.log('已保存護理師排序：', nursesByIdentity);
  };

  // 處理數據更新（不直接提交到數據庫，只更新本地狀態）
  const handleUpdateUser = (userId, updateData) => {
    // 更新本地排序列表
    setSortableUsers(prevUsers => {
      return prevUsers.map(user => user.id === userId ? { ...user, ...updateData } : user);
    });
  };

  // 身份排序權重
  const getIdentityWeight = (identity) => {
    const weights = {
      '護理長': 1,
      '麻醉科Leader': 2,
      '麻醉專科護理師': 3,
      '恢復室護理師': 4,
      '麻醉科書記': 5
    };
    return weights[identity] || 999;
  };

  // 加載用戶數據
  const loadUsers = useCallback(async () => {
    try {
      await fetchUsers();
    } catch (err) {
      console.error('Error loading users:', err);
    }
  }, [fetchUsers]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // 處理表單輸入改變
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // 處理員工編號的驗證 (只允許正整數)
    if (name === 'username') {
      if (value !== '' && !/^[1-9]\d*$/.test(value)) {
        // 不是正整數，設置錯誤但不更新值
        setErrors({
          ...errors,
          username: '請輸入正整數作為員工編號'
        });
        return;
      } else {
        // 清除錯誤
        const newErrors = { ...errors };
        delete newErrors.username;
        setErrors(newErrors);
      }
    }
    
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // 檢查表單是否有錯誤
  const hasFormErrors = () => {
    return Object.keys(errors).length > 0 || !formData.username || !formData.full_name || !formData.email || !formData.password;
  };

  // 處理表格內選擇更改
  const handleSelectChange = (userId, field, value) => {
    handleUpdateUser(userId, { [field]: value });
  };

  // 處理添加用戶
  const handleAddUser = () => {
    setFormData({
      username: '',
      email: '',
      full_name: '',
      password: '',
      role: 'nurse',
      identity: '麻醉專科護理師',
      group: 1,
      is_active: true,
      hire_date: new Date().toISOString().split('T')[0]  // 預設為今天日期
    });
    setErrors({});
    setOpenAddDialog(true);
  };

  // 提交添加用戶
  const submitAddUser = async () => {
    try {
      // 驗證員工編號是否為正整數
      if (!/^[1-9]\d*$/.test(formData.username)) {
        setErrors({
          ...errors,
          username: '請輸入正整數作為員工編號'
        });
        return;
      }
      
      // 檢查員工編號是否已存在
      const existingUser = sortableUsers.find(user => user.username === formData.username);
      if (existingUser) {
        setErrors({
          ...errors,
          username: '此員工編號已存在'
        });
        return;
      }
      
      const newUser = await addUser(formData);
      
      // 添加到排序列表
      setSortableUsers(prevUsers => [...prevUsers, newUser]);
      
      setSuccess('成功添加用戶！');
      
      // 3秒後自動清除成功訊息
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
      
      setOpenAddDialog(false);
    } catch (err) {
      console.error('Error adding user:', err);
      setLocalError('添加用戶失敗：' + (err.response?.data?.detail || err.message));
    }
  };

  // 處理刪除用戶
  const handleDelete = (user) => {
    setSelectedUser(user);
    setOpenDeleteDialog(true);
  };

  // 提交刪除用戶
  const submitDeleteUser = async () => {
    try {
      await deleteUser(selectedUser.id);
      
      // 從排序列表中移除
      setSortableUsers(prevUsers => prevUsers.filter(user => user.id !== selectedUser.id));
      
      setSuccess('成功刪除用戶！');
      
      // 3秒後自動清除成功訊息
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
      
      setOpenDeleteDialog(false);
    } catch (err) {
      console.error('Error deleting user:', err);
      setLocalError('刪除用戶失敗：' + (err.response?.data?.detail || err.message));
    }
  };
  
  // 處理用戶向上移動
  const handleMoveUp = (index) => {
    if (index === 0) return; // 已經是第一個，不能再上移
    
    const newUsers = [...sortableUsers];
    const temp = newUsers[index];
    newUsers[index] = newUsers[index - 1];
    newUsers[index - 1] = temp;
    
    setSortableUsers(newUsers);
  };
  
  // 處理用戶向下移動
  const handleMoveDown = (index) => {
    if (index === sortableUsers.length - 1) return; // 已經是最後一個，不能再下移
    
    const newUsers = [...sortableUsers];
    const temp = newUsers[index];
    newUsers[index] = newUsers[index + 1];
    newUsers[index + 1] = temp;
    
    setSortableUsers(newUsers);
  };
  
  // 計算年資
  const calculateYearsOfService = (hireDateStr) => {
    if (!hireDateStr) return '';
    
    const hireDate = new Date(hireDateStr);
    const today = new Date();
    
    // 計算年數
    let years = today.getFullYear() - hireDate.getFullYear();
    let months = today.getMonth() - hireDate.getMonth();
    
    // 調整月數和年數
    if (months < 0) {
      years--;
      months += 12;
    }
    
    // 如果今天的日期小於入職日期的日期，再減一個月
    if (today.getDate() < hireDate.getDate()) {
      months--;
      if (months < 0) {
        years--;
        months += 12;
      }
    }
    
    return { years, months };
  };
  
  return (
    <Box sx={{ padding: 3 }}>
      {/* 頁面標題 */}
      <Box sx={{ 
        marginBottom: 3, 
        display: 'flex', 
        alignItems: 'center' 
      }}>
        <Typography 
          variant="h5" 
          component="h1" 
          sx={{ 
            fontWeight: 'bold',
            color: '#1976d2' // 藍色，可以根據需要調整
          }}
        >
          用戶管理
        </Typography>
      </Box>
      
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
          <CircularProgress />
        </Box>
      )}
      
      {(error || localError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || localError}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={editMode}
              onChange={handleEditModeChange}
              name="editMode"
              color="primary"
            />
          }
          label="編輯"
        />
        
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddUser}
        >
          添加護理師
        </Button>
      </Box>
      
      <Paper sx={{ width: '100%', overflow: 'auto' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {editMode && (
                  <TableCell width="100px" align="center">
                    排序
                  </TableCell>
                )}
                <TableCell>員工編號</TableCell>
                <TableCell>姓名</TableCell>
                <TableCell>電子郵件</TableCell>
                <TableCell>入職日期</TableCell>
                <TableCell>身份</TableCell>
                {editMode && <TableCell>刪除</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {sortableUsers.map((user, index) => (
                <TableRow
                  key={user.id}
                  sx={{ 
                    bgcolor: user.role === 'head_nurse' ? '#f5f5f5' : 'white',
                    '&:hover': { bgcolor: user.role === 'head_nurse' ? '#f0f0f0' : '#f9f9f9' }
                  }}
                >
                  {editMode && (
                    <TableCell>
                      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Tooltip title="上移">
                          <IconButton 
                            size="small" 
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0 || user.role === 'head_nurse' || user.role === 'admin'}
                          >
                            <ArrowUpwardIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="下移">
                          <IconButton 
                            size="small" 
                            onClick={() => handleMoveDown(index)}
                            disabled={index === sortableUsers.length - 1 || user.role === 'head_nurse' || user.role === 'admin'}
                          >
                            <ArrowDownwardIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  )}
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.full_name}</TableCell>
                  <TableCell>
                    {editMode && user.role !== 'head_nurse' && user.role !== 'admin' ? (
                      <TextField
                        size="small"
                        value={user.email || ''}
                        onChange={(e) => handleSelectChange(user.id, 'email', e.target.value)}
                      />
                    ) : (
                      user.email
                    )}
                  </TableCell>
                  <TableCell>
                    {editMode && user.role !== 'head_nurse' && user.role !== 'admin' ? (
                      <TextField
                        size="small"
                        type="date"
                        value={user.hire_date || ''}
                        onChange={(e) => handleSelectChange(user.id, 'hire_date', e.target.value)}
                      />
                    ) : (
                      <>
                        {user.hire_date} 
                        {user.hire_date && (
                          <span style={{ color: '#666', marginLeft: '8px' }}>
                            {(() => {
                              const service = calculateYearsOfService(user.hire_date);
                              return `[${service.years}年${service.months}個月]`;
                            })()}
                          </span>
                        )}
                      </>
                    )}
                  </TableCell>
                  <TableCell>
                    {editMode && user.role !== 'head_nurse' && user.role !== 'admin' ? (
                      <FormControl size="small" fullWidth>
                        <Select
                          value={user.identity || ''}
                          onChange={(e) => handleSelectChange(user.id, 'identity', e.target.value)}
                          displayEmpty
                        >
                          <MenuItem value="麻醉專科護理師">麻醉專科護理師</MenuItem>
                          <MenuItem value="恢復室護理師">恢復室護理師</MenuItem>
                          <MenuItem value="麻醉科Leader">麻醉科Leader</MenuItem>
                          <MenuItem value="麻醉科書記">麻醉科書記</MenuItem>
                        </Select>
                      </FormControl>
                    ) : (
                      user.identity
                    )}
                  </TableCell>
                  <TableCell>
                    {editMode && user.role !== 'head_nurse' && user.role !== 'admin' ? (
                      <IconButton 
                        color="error" 
                        onClick={() => handleDelete(user)}
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    ) : null }
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      
      {/* 添加用戶對話框 */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)}>
        <DialogTitle>添加護理師</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="員工編號"
            type="text"
            fullWidth
            variant="outlined"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            error={!!errors.username}
            helperText={errors.username || '請輸入正整數作為員工編號'}
            inputProps={{ 
              inputMode: 'numeric',
              pattern: '[1-9][0-9]*'
            }}
            required
          />
          <TextField
            margin="dense"
            label="電子郵件"
            type="email"
            fullWidth
            variant="outlined"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
          />
          <TextField
            margin="dense"
            label="姓名"
            type="text"
            fullWidth
            variant="outlined"
            name="full_name"
            value={formData.full_name}
            onChange={handleInputChange}
            required
          />
          <TextField
            margin="dense"
            label="密碼"
            type="password"
            fullWidth
            variant="outlined"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            required
          />
          <TextField
            margin="dense"
            label="入職日期"
            type="date"
            fullWidth
            variant="outlined"
            name="hire_date"
            value={formData.hire_date}
            onChange={handleInputChange}
            InputLabelProps={{
              shrink: true,
            }}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>身份</InputLabel>
            <Select
              name="identity"
              value={formData.identity}
              onChange={handleInputChange}
              label="身份"
            >
              <MenuItem value="麻醉專科護理師">麻醉專科護理師</MenuItem>
              <MenuItem value="恢復室護理師">恢復室護理師</MenuItem>
              <MenuItem value="麻醉科Leader">麻醉科Leader</MenuItem>
              <MenuItem value="麻醉科書記">麻醉科書記</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>組別</InputLabel>
            <Select
              name="group"
              value={formData.group}
              onChange={handleInputChange}
              label="組別"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((group) => (
                <MenuItem key={group} value={group}>
                  {group}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)}>取消</Button>
          <Button 
            onClick={submitAddUser} 
            variant="contained" 
            color="primary"
            disabled={isLoading || hasFormErrors()}
          >
            添加
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 刪除用戶確認對話框 */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle>確認刪除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            確定要刪除護理師 "{selectedUser?.full_name}" 嗎？此操作無法撤銷。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>取消</Button>
          <Button 
            onClick={submitDeleteUser} 
            variant="contained" 
            color="error"
            disabled={isLoading}
          >
            刪除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement; 