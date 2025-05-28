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
  Typography,
  Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useUserStore } from '../store/userStore';

const UserManagement = () => {
  const { users, isLoading, error, fetchUsers, addUser, updateUser, deactivateUser, activateUser } = useUserStore();
  const [localError, setLocalError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [errors, setErrors] = useState({});
  
  // 對話框狀態
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openDeactivateDialog, setOpenDeactivateDialog] = useState(false);
  const [openActivateDialog, setOpenActivateDialog] = useState(false);
  
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
    group: null,
    is_active: true,
    hire_date: new Date().toISOString().split('T')[0]  // 預設為今天日期
  });

  // 全域編輯模式切換
  const [editMode, setEditMode] = useState(false);
  
  // 可排序的用戶列表
  const [sortableUsers, setSortableUsers] = useState([]);
  
  // 存儲原始用戶數據用於比較
  const [originalUsers, setOriginalUsers] = useState([]);
  
  // 顯示停權用戶的開關
  const [showInactiveUsers, setShowInactiveUsers] = useState(false);
  
  // 初始化排序用戶列表
  useEffect(() => {
    if (users) {  // 移除 length > 0 的檢查
      // 根據 showInactiveUsers 過濾用戶
      const filteredUsers = showInactiveUsers 
        ? users 
        : users.filter(user => user.is_active !== false);
      
      // 按照複合條件進行排序
      const sorted = [...filteredUsers].sort(sortNurses);
      
      setSortableUsers(sorted);
      setOriginalUsers(JSON.parse(JSON.stringify(sorted))); // 深拷貝保存原始狀態
    }
  }, [users, showInactiveUsers]);
  
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
          ['full_name', 'email', 'identity', 'role', 'group'].forEach(field => {
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
      // 更新用戶數據
      const updatedUsers = prevUsers.map(user => 
        user.id === userId ? { ...user, ...updateData } : user
      );
      
      // 重新排序
      return updatedUsers.sort(sortNurses);
    });
  };

  // 身份排序權重
  const getIdentityWeight = (identity) => {
    const weights = {
      '護理長': 1,
      '麻醉科Leader': 2,
      '麻醉專科護理師': 3,
      '恢復室護理師': 4,
      '麻醉科書記': 5,
      'admin': 6
    };
    return weights[identity] || 999;
  };

  // 角色排序權重
  const getRoleWeight = (role) => {
    const weights = {
      'leader': 1,
      'supervise_nurse': 2,
      'nurse': 3,
      'head_nurse': 1, // 護理長通常用identity區分，但為了完整性也給一個權重
      'admin': 4
    };
    return weights[role] || 999;
  };

  // 護理師排序函數 - 結合多層級排序規則
  const sortNurses = (a, b) => {
    // 1. 首先按照身份(identity)排序
    const weightA = getIdentityWeight(a.identity);
    const weightB = getIdentityWeight(b.identity);
    
    if (weightA !== weightB) {
      return weightA - weightB;
    }
    
    // 2. 相同身份下，按照角色(role)排序
    const roleWeightA = getRoleWeight(a.role);
    const roleWeightB = getRoleWeight(b.role);
    
    if (roleWeightA !== roleWeightB) {
      return roleWeightA - roleWeightB;
    }
    
    // 3. 相同角色下，按照入職日期排序（越早越前面）
    if (a.hire_date && b.hire_date) {
      const dateA = new Date(a.hire_date);
      const dateB = new Date(b.hire_date);
      
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA - dateB;
      }
    } else if (a.hire_date) {
      return -1; // a有日期，b沒有，a排前面
    } else if (b.hire_date) {
      return 1;  // b有日期，a沒有，b排前面
    }
    
    // 4. 相同入職日期下，按照員工編號排序（越小越前面）
    if (a.username && b.username) {
      const numA = parseInt(a.username, 10);
      const numB = parseInt(b.username, 10);
      
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      
      // 如果不能轉為數字，就按字串比較
      return String(a.username).localeCompare(String(b.username));
    }
    
    return 0;
  };

  // 加載用戶數據
  const loadUsers = useCallback(async () => {
    try {
      await fetchUsers();
    } catch (err) {
      console.error('Error loading users:', err);
      setLocalError('載入用戶列表失敗：' + (err.response?.data?.detail || err.message));
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
      group: null,
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
      
      // 添加新用戶到列表並重新排序
      const updatedUsers = [...sortableUsers, newUser].sort(sortNurses);
      
      setSortableUsers(updatedUsers);
      setOriginalUsers(JSON.parse(JSON.stringify(updatedUsers))); // 更新原始數據
      
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
  const handleDeactivate = (user) => {
    setSelectedUser(user);
    setOpenDeactivateDialog(true);
  };

  // 處理啟用用戶
  const handleActivate = (user) => {
    setSelectedUser(user);
    setOpenActivateDialog(true);
  };

  // 提交啟用用戶
  const submitActivateUser = async () => {
    try {
      await activateUser(selectedUser.id);
      
      // 重新獲取用戶列表
      await fetchUsers();
      
      setSuccess('成功啟用用戶！');
      
      // 3秒後自動清除成功訊息
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
      
      setOpenActivateDialog(false);
    } catch (err) {
      console.error('Error activating user:', err);
      setLocalError('啟用用戶失敗：' + (err.response?.data?.detail || err.message));
    }
  };

  // 提交停權用戶
  const submitDeactivateUser = async () => {
    try {
      await deactivateUser(selectedUser.id);
      
      // 重新獲取用戶列表
      await fetchUsers();
      
      setSuccess('成功停權用戶！');
      
      // 3秒後自動清除成功訊息
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
      
      setOpenDeactivateDialog(false);
    } catch (err) {
      console.error('Error deactivating user:', err);
      setLocalError('停權用戶失敗：' + (err.response?.data?.detail || err.message));
    }
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
            color: '#1976d2'
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

      {!isLoading && !error && !localError && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
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
              
              <FormControlLabel
                control={
                  <Switch
                    checked={showInactiveUsers}
                    onChange={(e) => setShowInactiveUsers(e.target.checked)}
                    name="showInactiveUsers"
                    color="secondary"
                  />
                }
                label="顯示停權用戶"
              />
            </Box>
            
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
                    <TableCell>員工編號</TableCell>
                    <TableCell>姓名</TableCell>
                    <TableCell>狀態</TableCell>
                    <TableCell>電子郵件</TableCell>
                    <TableCell>入職日期</TableCell>
                    <TableCell>身份</TableCell>
                    {editMode && <TableCell>角色</TableCell>}
                    {editMode && <TableCell>操作</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortableUsers && sortableUsers.length > 0 ? (
                    sortableUsers.map((user, index) => (
                      <TableRow
                        key={user.id}
                        sx={{ 
                          bgcolor: user.role === 'head_nurse' ? '#f5f5f5' : 
                                   user.is_active === false ? '#ffebee' : 'white',
                          '&:hover': { 
                            bgcolor: user.role === 'head_nurse' ? '#f0f0f0' : 
                                     user.is_active === false ? '#ffcdd2' : '#f9f9f9' 
                          }
                        }}
                      >
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.full_name}</TableCell>
                        <TableCell>
                          {user.is_active === false ? (
                            <Tooltip title="停權">
                              <CancelIcon sx={{ color: '#f44336', fontSize: 24 }} />
                            </Tooltip>
                          ) : (
                            <Tooltip title="正常">
                              <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 24 }} />
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell>
                          {editMode && user.role !== 'head_nurse' && user.role !== 'admin' && user.is_active !== false ? (
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
                          {user.hire_date && (
                            <>
                              {user.hire_date}
                              <span style={{ color: '#666', marginLeft: '8px' }}>
                                {(() => {
                                  const service = calculateYearsOfService(user.hire_date);
                                  return `[${service.years}年${service.months}個月]`;
                                })()}
                              </span>
                            </>
                          )}
                        </TableCell>
                        <TableCell>
                          {editMode && user.role !== 'head_nurse' && user.role !== 'admin' && user.is_active !== false ? (
                            <FormControl size="small" fullWidth>
                              <Select
                                value={user.identity || ''}
                                onChange={(e) => handleSelectChange(user.id, 'identity', e.target.value)}
                                displayEmpty
                              >
                                <MenuItem value="護理長">護理長</MenuItem>
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
                        {editMode && (
                          <TableCell>
                            {user.role !== 'admin' && user.is_active !== false ? (
                              <FormControl size="small" fullWidth>
                                <Select
                                  value={user.role || 'nurse'}
                                  onChange={(e) => handleSelectChange(user.id, 'role', e.target.value)}
                                  displayEmpty
                                >
                                  <MenuItem value="nurse">一般護理師</MenuItem>
                                  <MenuItem value="leader">Leader</MenuItem>
                                  <MenuItem value="supervise_nurse">A組護理師</MenuItem>
                                  <MenuItem value="head_nurse">護理長</MenuItem>
                                  <MenuItem value="clerk">書記</MenuItem>
                                </Select>
                              </FormControl>
                            ) : (
                              user.role
                            )}
                          </TableCell>
                        )}
                        {editMode && (
                          <TableCell>
                            {user.role !== 'head_nurse' && user.role !== 'admin' ? (
                              user.is_active === false ? (
                                <Tooltip title="啟用用戶">
                                  <IconButton 
                                    color="success" 
                                    onClick={() => handleActivate(user)}
                                    size="small"
                                  >
                                    <CheckCircleIcon />
                                  </IconButton>
                                </Tooltip>
                              ) : (
                                <Tooltip title="停權用戶">
                                  <IconButton 
                                    color="error" 
                                    onClick={() => handleDeactivate(user)}
                                    size="small"
                                  >
                                    <BlockIcon />
                                  </IconButton>
                                </Tooltip>
                              )
                            ) : null }
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={editMode ? 8 : 6} align="center">
                        沒有找到用戶
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}

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
              <MenuItem value="護理長">護理長</MenuItem>
              <MenuItem value="麻醉專科護理師">麻醉專科護理師</MenuItem>
              <MenuItem value="恢復室護理師">恢復室護理師</MenuItem>
              <MenuItem value="麻醉科Leader">麻醉科Leader</MenuItem>
              <MenuItem value="麻醉科書記">麻醉科書記</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>角色</InputLabel>
            <Select
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              label="角色"
            >
              <MenuItem value="nurse">一般護理師</MenuItem>
              <MenuItem value="leader">Leader</MenuItem>
              <MenuItem value="supervise_nurse">A組護理師</MenuItem>
              <MenuItem value="head_nurse">護理長</MenuItem>
              <MenuItem value="clerk">書記</MenuItem>
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
      
      {/* 停權用戶確認對話框 */}
      <Dialog open={openDeactivateDialog} onClose={() => setOpenDeactivateDialog(false)}>
        <DialogTitle sx={{ color: '#d32f2f' }}>⚠️ 確認停權護理師</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            確定要停權護理師 <strong>"{selectedUser?.full_name}"</strong> 嗎？
          </DialogContentText>
          <DialogContentText sx={{ mb: 2, color: '#ff9800', fontWeight: 'bold' }}>
            ℹ️ 說明：停權後該用戶將無法登入系統，但歷史資料會保留。
          </DialogContentText>
          <DialogContentText component="div" sx={{ ml: 2 }}>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>用戶無法登入系統</li>
              <li>不會出現在新的班表安排中</li>
              <li>歷史班表記錄會保留</li>
              <li>可以隨時重新啟用</li>
            </ul>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeactivateDialog(false)}>取消</Button>
          <Button 
            onClick={submitDeactivateUser} 
            variant="contained" 
            color="error"
            disabled={isLoading}
          >
            確認停權
          </Button>
        </DialogActions>
      </Dialog>

      {/* 啟用用戶確認對話框 */}
      <Dialog open={openActivateDialog} onClose={() => setOpenActivateDialog(false)}>
        <DialogTitle sx={{ color: '#2e7d32' }}>✅ 確認啟用護理師</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            確定要啟用護理師 <strong>"{selectedUser?.full_name}"</strong> 嗎？
          </DialogContentText>
          <DialogContentText sx={{ mb: 2, color: '#2e7d32', fontWeight: 'bold' }}>
            ✅ 啟用後該用戶將恢復正常使用權限。
          </DialogContentText>
          <DialogContentText component="div" sx={{ ml: 2 }}>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>用戶可以正常登入系統</li>
              <li>可以參與新的班表安排</li>
              <li>恢復所有系統功能</li>
            </ul>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenActivateDialog(false)}>取消</Button>
          <Button 
            onClick={submitActivateUser} 
            variant="contained" 
            color="success"
            disabled={isLoading}
          >
            確認啟用
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement; 