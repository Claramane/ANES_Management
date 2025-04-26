import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableHead, 
  TableBody, 
  TableRow, 
  TableCell, 
  Button, 
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Drawer,
  Divider,
  Card,
  CardContent,
  Grid,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Tabs,
  Tab,
  Collapse,
  AppBar,
  Toolbar,
  IconButton
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useSettingsStore } from '../store/settingsStore';
import { useUserStore } from '../store/userStore';
import { useScheduleStore } from '../store/scheduleStore';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

// 定義班表類型
const FORMULA_TYPES = {
  ANESTHESIA_SPECIALIST: 'anesthesia_specialist', // 麻醉專科護理師
  RECOVERY_NURSE: 'recovery_nurse', // 恢復室護理師
  ANESTHESIA_LEADER: 'anesthesia_leader', // 麻醉科Leader
  ANESTHESIA_SECRETARY: 'anesthesia_secretary', // 麻醉科書記
};

// 班表類型顯示名稱映射
const FORMULA_TYPE_NAMES = {
  [FORMULA_TYPES.ANESTHESIA_SPECIALIST]: '麻醉專科護理師',
  [FORMULA_TYPES.RECOVERY_NURSE]: '恢復室護理師',
  [FORMULA_TYPES.ANESTHESIA_LEADER]: '麻醉科Leader',
  [FORMULA_TYPES.ANESTHESIA_SECRETARY]: '麻醉科書記',
};

// 身份與班表類型映射
const IDENTITY_TO_FORMULA_TYPE = {
  '麻醉專科護理師': FORMULA_TYPES.ANESTHESIA_SPECIALIST,
  '恢復室護理師': FORMULA_TYPES.RECOVERY_NURSE,
  '麻醉科Leader': FORMULA_TYPES.ANESTHESIA_LEADER,
  '麻醉科書記': FORMULA_TYPES.ANESTHESIA_SECRETARY,
};

// 不同班表類型的班次設定
const SHIFT_TYPES_BY_FORMULA = {
  [FORMULA_TYPES.ANESTHESIA_SPECIALIST]: ['D', 'A', 'N', 'O'],
  [FORMULA_TYPES.RECOVERY_NURSE]: ['A', 'K', 'C', 'F', 'O'],
  [FORMULA_TYPES.ANESTHESIA_LEADER]: ['A', 'E', 'O'],
  [FORMULA_TYPES.ANESTHESIA_SECRETARY]: ['B', 'E', 'O'],
};

// 工時設定
const HOUR_MAPPING_BY_FORMULA = {
  [FORMULA_TYPES.ANESTHESIA_SPECIALIST]: { 'D': 10, 'A': 8, 'N': 8, 'O': 0 },
  [FORMULA_TYPES.RECOVERY_NURSE]: { 'A': 8, 'K': 8, 'C': 8, 'F': 8, 'O': 0 },
  [FORMULA_TYPES.ANESTHESIA_LEADER]: { 'A': 8, 'E': 4, 'O': 0 },
  [FORMULA_TYPES.ANESTHESIA_SECRETARY]: { 'B': 8, 'E': 4, 'O': 0 },
};

const ShiftCell = styled(TableCell)(({ shift, formulaType }) => {
  // Leader 特殊顏色設置
  if (formulaType === FORMULA_TYPES.ANESTHESIA_LEADER) {
    return {
      backgroundColor: 
        shift === 'A' ? '#9ABCA7' : 
        shift === 'E' ? '#c57f5c' : 
        shift === 'O' ? '#eddcd7' : 'inherit',
      color: 'black',
      cursor: 'pointer',
      padding: '8px',
      textAlign: 'center',
    };
  }
  
  // 秘書特殊顏色設置
  if (formulaType === FORMULA_TYPES.ANESTHESIA_SECRETARY) {
    return {
      backgroundColor: 
        shift === 'B' ? '#9ABCA7' : 
        shift === 'E' ? '#8AA6C1' : 
        shift === 'O' ? '#eddcd7' : 'inherit',
      color: 'black',
      cursor: 'pointer',
      padding: '8px',
      textAlign: 'center',
    };
  }

  // 恢復室護理師特殊顏色設置
  if (formulaType === FORMULA_TYPES.RECOVERY_NURSE) {
    return {
      backgroundColor: 
        shift === 'K' ? '#8AA6C1' : 
        shift === 'A' ? '#9ABCA7' : 
        shift === 'C' ? '#D7A084' : 
        shift === 'F' ? '#d897d2' : 
        shift === 'O' ? '#eddcd7' : 'inherit',
      color: 'black',
      cursor: 'pointer',
      padding: '8px',
      textAlign: 'center',
    };
  }
  
  // 其他角色使用原有顏色
  return {
    backgroundColor: 
      shift === 'D' ? '#8AA6C1' : 
      shift === 'A' ? '#9ABCA7' : 
      shift === 'N' ? '#D7A084' : 
      shift === 'O' ? '#eddcd7' : 'inherit',
    color: 'black',
    cursor: 'pointer',
    padding: '8px',
    textAlign: 'center',
  };
});

const ShiftLetter = styled('span')(({ disabled }) => ({
  fontSize: '24px',
  fontWeight: 'bold',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
}));

const StyledTable = styled(Table)({
  width: '100%',
  borderCollapse: 'collapse',
  marginBottom: '20px',
});

const StyledButton = styled(Button)(({ variant }) => ({
  padding: '10px 20px',
  backgroundColor: variant === 'save' ? '#4CAF50' : '#f44336',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '16px',
  '&:hover': {
    backgroundColor: variant === 'save' ? '#45a049' : '#d32f2f',
  },
  marginRight: variant === 'save' ? '10px' : '0',
}));

// 抽屜寬度
const drawerWidth = 240;

const FormulaSchedule = () => {
  const { settings, isLoading: isLoadingSettings, error: settingsError, fetchSettings } = useSettingsStore();
  const { nurseUsers, isLoading: isLoadingUsers, error: usersError, fetchUsers, updateUser } = useUserStore();
  const { 
    formulaSchedules, 
    isLoading: isLoadingSchedule, 
    error: scheduleError, 
    fetchFormulaSchedules, 
    saveFormulaSchedule, 
    resetFormulaSchedule 
  } = useScheduleStore();
  
  const [scheduleData, setScheduleData] = useState([]);
  const [isSaved, setIsSaved] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [currentFormulaType, setCurrentFormulaType] = useState(FORMULA_TYPES.ANESTHESIA_SPECIALIST);
  const [editingUser, setEditingUser] = useState(null);
  const [subMenuOpen, setSubMenuOpen] = useState(false);

  const dayNames = ['一', '二', '三', '四', '五', '六', '日'];
  
  // 根據當前公式班表類型獲取班次類型
  const shiftTypes = useMemo(() => {
    return SHIFT_TYPES_BY_FORMULA[currentFormulaType] || ['D', 'A', 'N', 'O'];
  }, [currentFormulaType]);

  // 從設置中獲取當前公式班表類型的組別數量
  const groupCount = useMemo(() => {
    if (!settings) return 3;
    
    // 獲取當前類型的組別數量設置
    const groupCountMap = {
      [FORMULA_TYPES.ANESTHESIA_SPECIALIST]: settings.anesthesia_specialist_groups,
      [FORMULA_TYPES.RECOVERY_NURSE]: settings.recovery_nurse_groups,
      [FORMULA_TYPES.ANESTHESIA_LEADER]: settings.anesthesia_leader_groups,
      [FORMULA_TYPES.ANESTHESIA_SECRETARY]: settings.anesthesia_secretary_groups,
    };
    
    return groupCountMap[currentFormulaType] || settings.regularGroupCount || 3;
  }, [settings, currentFormulaType]);

  // 是否正在加載
  const isLoading = useMemo(() => {
    return isLoadingSettings || isLoadingUsers || isLoadingSchedule || localLoading;
  }, [isLoadingSettings, isLoadingUsers, isLoadingSchedule, localLoading]);

  // 錯誤消息
  const errorMessage = useMemo(() => {
    return settingsError || usersError || scheduleError || localError;
  }, [settingsError, usersError, scheduleError, localError]);

  // 根據身份獲取用戶
  const getUsersByIdentity = (identity) => {
    if (!nurseUsers || nurseUsers.length === 0) return [];
    
    // 按照 ID 從小到大排序
    return nurseUsers
      .filter(user => user && user.identity === identity)
      .sort((a, b) => a.id - b.id);
  };

  // 獲取當前類型的用戶
  const currentUsers = useMemo(() => {
    const identityMap = {
      [FORMULA_TYPES.ANESTHESIA_SPECIALIST]: '麻醉專科護理師',
      [FORMULA_TYPES.RECOVERY_NURSE]: '恢復室護理師',
      [FORMULA_TYPES.ANESTHESIA_LEADER]: '麻醉科Leader',
      [FORMULA_TYPES.ANESTHESIA_SECRETARY]: '麻醉科書記',
    };
    
    // 獲取對應身份的護理師並按 ID 排序
    return getUsersByIdentity(identityMap[currentFormulaType]) || [];
  }, [currentFormulaType, nurseUsers]);

  // 獲取當前類型對應的 tableType 值
  const getCurrentTableType = useCallback(() => {
    const tableTypeMap = {
      [FORMULA_TYPES.ANESTHESIA_SPECIALIST]: 1,
      [FORMULA_TYPES.RECOVERY_NURSE]: 2,
      [FORMULA_TYPES.ANESTHESIA_LEADER]: 3,
      [FORMULA_TYPES.ANESTHESIA_SECRETARY]: 4,
    };
    return tableTypeMap[currentFormulaType] || 1;
  }, [currentFormulaType]);

  // 獲取當前類型的用戶名字
  const getUserNamesByGroup = (groupId) => {
    if (!currentUsers || currentUsers.length === 0) return '';
    
    // 處理特殊分組類型，為麻醉專科護理師特殊班次顯示組員
    if (currentFormulaType === FORMULA_TYPES.ANESTHESIA_SPECIALIST && 
       (groupId === 'evening_shift' || groupId === 'night_shift')) {
      
      console.log(`獲取特殊分組 ${groupId} 的護理師`);
      
      // 篩選屬於該特殊分組的用戶
      const specialShiftUsers = currentUsers.filter(user => {
        if (!user.group_data) return false;
        
        try {
          let groupData;
          if (typeof user.group_data === 'string') {
            groupData = JSON.parse(user.group_data);
          } else if (typeof user.group_data === 'object') {
            groupData = user.group_data;
          } else {
            return false;
          }
          
          // 檢查用戶是否被分配到特定的特殊班次
          return groupData[currentFormulaType] === groupId;
        } catch (e) {
          console.warn(`解析特殊班次用戶 ${user.id} 的 group_data 失敗:`, e);
          return false;
        }
      });
      
      const names = specialShiftUsers.map(user => user.full_name).join(', ');
      console.log(`特殊分組 ${groupId} 的護理師: ${names || '無'}`);
      return names;
    }
    
    // 從 group_data 中提取當前類型的組別
    const groupNumber = parseInt(groupId, 10);
    console.log(`嘗試獲取組別 ${groupNumber} 的護理師，當前類型: ${currentFormulaType}`);
    
    // 篩選屬於當前組別的用戶
    const filteredUsers = currentUsers.filter(user => {
      // 優先使用 group_data 字段
      if (user.group_data) {
        try {
          // 嘗試解析 JSON
          let groupData;
          if (typeof user.group_data === 'string') {
            groupData = JSON.parse(user.group_data);
          } else if (typeof user.group_data === 'object') {
            groupData = user.group_data;
          } else {
            return false;
          }
          
          // 特殊分組的用戶不計入普通分組
          if (currentFormulaType === FORMULA_TYPES.ANESTHESIA_SPECIALIST && 
              (groupData[currentFormulaType] === 'evening_shift' || 
               groupData[currentFormulaType] === 'night_shift')) {
            return false;
          }
          
          // 檢查此用戶是否在此公式類型的此組別中
          const userGroupNumber = groupData[currentFormulaType];
          if (userGroupNumber !== undefined) {
            const userGroupInt = parseInt(userGroupNumber, 10);
            console.log(`用戶 ${user.full_name} 的組別為 ${userGroupInt}，比較對象為 ${groupNumber}`);
            return userGroupInt === groupNumber;
          } else {
            // 如果在 group_data 中找不到當前類型的數據，則使用常規 group 字段
            console.log(`用戶 ${user.full_name} 在 group_data 中找不到當前類型 ${currentFormulaType} 的組別，使用常規組別 ${user.group}`);
            return parseInt(user.group, 10) === groupNumber;
          }
        } catch (e) {
          // 解析失敗時使用常規 group 字段
          console.warn(`解析用戶 ${user.id} 的 group_data 失敗:`, e);
          return parseInt(user.group, 10) === groupNumber;
        }
      } else {
        // 如果沒有 group_data，使用常規 group 字段
        console.log(`用戶 ${user.full_name} 無 group_data，使用常規組別 ${user.group} 與 ${groupNumber} 比較`);
        return parseInt(user.group, 10) === groupNumber;
      }
    });
    
    const names = filteredUsers.map(user => user.full_name).join(', ');
    console.log(`組別 ${groupNumber} 的護理師: ${names || '無'}`);
    return names;
  };

  // 初始化排班表
  const initializeSchedules = useCallback((count) => {
    // 設置默認班次為休息 'O'，不論當前公式類型
    const defaultShift = 'O';
    
    const newSchedule = Array(count || groupCount).fill(null).map(() => ({
      shifts: Array(7).fill(defaultShift),
      nurses: []
    }));
    setScheduleData(newSchedule);
    setIsSaved(false); // 確保新建立的排班表未保存狀態
    return newSchedule;
  }, [groupCount]);

  // 計算工時
  const calculateWorkHours = (shifts) => {
    const hourMapping = HOUR_MAPPING_BY_FORMULA[currentFormulaType] || { 'D': 10, 'A': 8, 'N': 8, 'O': 0 };
    return shifts.reduce((total, shift) => total + (hourMapping[shift] || 0), 0);
  };

  // 修改成專門針對初始化載入的函數
  const initializeView = async () => {
    try {
      setLocalLoading(true);
      
      // 先確保獲取完成所有API數據
      await Promise.all([
        fetchFormulaSchedules(),
        fetchSettings(),
        fetchUsers()
      ]);
      
      // 確認數據已完全載入後再更新視圖
      console.log('初始化完成，formulaSchedules:', formulaSchedules);
      
      // 延遲一點時間確保狀態更新
      setTimeout(() => {
        console.log('準備初始化麻醉專科護理師視圖');
        updateScheduleDataForType(FORMULA_TYPES.ANESTHESIA_SPECIALIST);
      }, 200);
    } catch (err) {
      setLocalError('載入資料失敗：' + err.message);
      setLocalLoading(false);
    }
  };

  // 切換班次
  const toggleShift = (scheduleIndex, dayIndex) => {
    if (isSaved) {
      // 如果已保存，則顯示提示
      setLocalError('排班表已鎖定，請先解除鎖定再進行編輯');
      setTimeout(() => setLocalError(null), 3000);
      return;
    }
    
    const newSchedule = [...scheduleData];
    const currentShift = newSchedule[scheduleIndex].shifts[dayIndex];
    const nextShiftIndex = (shiftTypes.indexOf(currentShift) + 1) % shiftTypes.length;
    newSchedule[scheduleIndex].shifts[dayIndex] = shiftTypes[nextShiftIndex];
    setScheduleData(newSchedule);
  };

  // 按鈕和表格切換相關
  const handleSaveSchedule = async () => {
    try {
      setLocalLoading(true);
      setLocalError(null);
      setSuccess(null);

      if (!isSaved) {
        // 獲取每個組別的護理師列表
        console.log('正在準備儲存公式班表數據');
        
        // 準備數據 - 為每個組獲取護理師ID
        const formulaData = scheduleData.map((schedule, index) => {
          const groupId = index + 1;
          console.log(`處理組別 ${groupId} 的數據`);
          
          // 獲取屬於該組的護理師
          const nursesInGroup = currentUsers.filter(nurse => {
            // 首先嘗試從 group_data 獲取分組信息
            if (nurse.group_data) {
              try {
                let groupData;
                if (typeof nurse.group_data === 'string') {
                  groupData = JSON.parse(nurse.group_data);
                } else {
                  groupData = nurse.group_data;
                }
                
                // 檢查是否屬於當前類型的此組
                const nurseGroupId = groupData[currentFormulaType];
                return parseInt(nurseGroupId, 10) === groupId;
              } catch (e) {
                console.warn(`解析用戶 ${nurse.id} 的 group_data 失敗:`, e);
              }
            }
            
            // 如果沒有 group_data 或解析失敗，使用常規 group 字段
            return parseInt(nurse.group, 10) === groupId;
          });
          
          const nurseIds = nursesInGroup.map(nurse => nurse.id);
          console.log(`組別 ${groupId} 有 ${nurseIds.length} 名護理師:`, nurseIds);
          
          return {
            shifts: schedule.shifts,
            nurses: nurseIds
          };
        });

        console.log('準備儲存的公式班表數據:', formulaData);
        await saveFormulaSchedule(currentFormulaType, formulaData);
        
        setSuccess('排班表已成功保存！');
        setIsSaved(true);
      } else {
        // 解除鎖定
        setIsSaved(false);
        setSuccess('已解除排班表鎖定，您現在可以編輯');
      }
      
      // 3秒後清除成功消息
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('保存排班表失敗:', err);
      setLocalError('保存排班表失敗：' + (err.response?.data?.detail || err.message));
    } finally {
      setLocalLoading(false);
    }
  };

  // 重置排班表
  const handleResetSchedule = async () => {
    if (window.confirm('確定要清空所有公式排班嗎？此操作不可撤銷！')) {
      try {
        setLocalLoading(true);
        setLocalError(null);
        
        await resetFormulaSchedule(currentFormulaType, groupCount);
        
        // 重置本地數據
        initializeSchedules();
        setIsSaved(false);
        setSuccess('排班表已成功重置！');
        
        // 3秒後清除成功消息
        setTimeout(() => {
          setSuccess(null);
        }, 3000);
      } catch (err) {
        console.error('Error resetting schedule:', err);
        setLocalError('重置排班表失敗：' + (err.response?.data?.detail || err.message));
      } finally {
        setLocalLoading(false);
      }
    }
  };

  // 處理組別變更
  const handleGroupChange = async (userId, newGroup) => {
    try {
      setLocalLoading(true);
      setLocalError(null);
      
      // 獲取當前用戶
      const user = currentUsers.find(u => u.id === userId);
      if (!user) {
        throw new Error('找不到指定的用戶');
      }
      
      console.log(`更新用戶 ${userId} (${user.full_name}) 的組別: ${newGroup}`);
      
      // 格式化 newGroup 為數字（或null），或保留特殊值（小夜班包班/大夜班包班）
      let formattedGroup = newGroup === '' ? null : newGroup;
      
      // 如果不是特殊值且是數字字符串，轉換為數字
      if (formattedGroup !== 'evening_shift' && formattedGroup !== 'night_shift' && !isNaN(formattedGroup)) {
        formattedGroup = parseInt(formattedGroup, 10);
      }
      
      // 準備 group_data
      let groupData = {};
      
      // 如果用戶已有 group_data，解析並保留其他類型的設置
      if (user.group_data) {
        try {
          if (typeof user.group_data === 'string') {
            groupData = JSON.parse(user.group_data);
          } else if (typeof user.group_data === 'object') {
            groupData = { ...user.group_data };
          }
        } catch (e) {
          console.warn(`解析用戶 ${userId} 的 group_data 失敗:`, e);
        }
      }
      
      // 更新當前公式類型的組別
      if (formattedGroup === null) {
        delete groupData[currentFormulaType];
      } else {
        groupData[currentFormulaType] = formattedGroup;
      }
      
      // 序列化為JSON字符串
      const groupDataString = JSON.stringify(groupData);
      
      // 更新用戶數據
      const updateData = {
        // 只有當formattedGroup為數字時才更新常規group字段，保持向後兼容
        group: typeof formattedGroup === 'number' ? formattedGroup : user.group,
        group_data: groupDataString
      };
      
      console.log(`用戶 ${userId} 更新數據:`, updateData);
      
      await updateUser(userId, updateData);
      
      // 更新前端狀態
      const updatedUsers = nurseUsers.map(u => {
        if (u.id === userId) {
          return { 
            ...u, 
            group: typeof formattedGroup === 'number' ? formattedGroup : u.group,
            group_data: groupDataString
          };
        }
        return u;
      });
      
      // 手動強制更新 UI
      setTimeout(() => {
        // 重新渲染組件
        setScheduleData([...scheduleData]);
      }, 10);
      
      // setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating user group:', err);
      setLocalError('更新用戶組別失敗：' + (err.response?.data?.detail || err.message));
    } finally {
      setLocalLoading(false);
      setEditingUser(null);
    }
  };

  // 切換公式班表類型
  const handleFormulaTypeChange = (type) => {
    console.log(`嘗試切換公式類型從 ${currentFormulaType} 到 ${type}`);
    
    // 如果有未保存的變更，提示用戶
    if (!isSaved && scheduleData.length > 0) {
      if (!window.confirm('您有未保存的變更，確定要切換嗎？這些變更將會丟失。')) {
        return;
      }
    }
    
    // 設置載入狀態以防止閃爍
    setLocalLoading(true);
    
    // 更新類型，但不在此處立即觸發更新 - 讓useEffect處理
    setCurrentFormulaType(type);
  };

  // 切換子菜單
  const toggleSubMenu = () => {
    setSubMenuOpen(!subMenuOpen);
  };

  // 根據當前選擇的公式類型更新排班數據
  const updateScheduleDataForType = useCallback((type) => {
    console.log('更新排班數據，類型:', type);
    
    if (!formulaSchedules || !type) {
      console.log('formulaSchedules或type不存在，無法更新排班數據');
      initializeSchedules(groupCount);
      setLocalLoading(false);
      return;
    }
    
    // 獲取此類型的數據
    const formulaData = formulaSchedules[type]?.formula_data || [];
    
    if (formulaData && formulaData.length > 0) {
      console.log(`找到類型 ${type} 的公式班表數據，共 ${formulaData.length} 組`);
      
      // 確保數據長度與當前應有的組別數量一致
      let adjustedData = [...formulaData];
      
      // 調整長度以匹配 groupCount
      if (adjustedData.length < groupCount) {
        // 需要添加更多組
        while (adjustedData.length < groupCount) {
          adjustedData.push({
            shifts: Array(7).fill('O'),
            nurses: []
          });
        }
      } else if (adjustedData.length > groupCount) {
        // 需要移除多餘的組
        adjustedData = adjustedData.slice(0, groupCount);
      }
      
      setScheduleData(adjustedData);
      setIsSaved(true);
    } else {
      console.log(`沒有找到類型 ${type} 的排班數據，初始化新的`);
      initializeSchedules(groupCount);
      setIsSaved(false);
    }
    
    // 完成數據更新後，取消載入狀態
    setLocalLoading(false);
  }, [formulaSchedules, initializeSchedules, groupCount]);

  // 監聽currentFormulaType的變化，確保切換類型時更新數據
  useEffect(() => {
    console.log('當前公式類型已更改為:', currentFormulaType);
    if (formulaSchedules && Object.keys(formulaSchedules).length > 0) {
      console.log('currentFormulaType變化檢測到formulaSchedules數據，更新數據');
      updateScheduleDataForType(currentFormulaType);
    }
  }, [currentFormulaType, formulaSchedules, updateScheduleDataForType]);

  useEffect(() => {
    // 頁面載入時調用初始化函數
    console.log('頁面載入，調用initializeView');
    initializeView();
  }, []); // 空依賴數組確保只在組件掛載時執行一次

  // 當設置變更時，重新加載排班數據
  useEffect(() => {
    if (settings && !isLoadingSchedule && !isLoadingSettings) {
      console.log('系統設置已更新，檢查組別數量變化');
      // 如果當前視圖已打開，更新界面
      updateScheduleDataForType(currentFormulaType);
    }
  }, [settings, updateScheduleDataForType, currentFormulaType, isLoadingSchedule, isLoadingSettings]);

  // 處理所有用戶組別增加
  const handleIncreaseAllGroups = async () => {
    try {
      setLocalLoading(true);
      setLocalError(null);
      
      // 篩選出已經有組別的護理師，且屬於當前類型
      const usersWithGroup = currentUsers.filter(user => {
        // 嘗試從 group_data 獲取當前類型的組別
        let hasGroup = false;
        if (user.group_data) {
          try {
            let groupData;
            if (typeof user.group_data === 'string') {
              groupData = JSON.parse(user.group_data);
            } else {
              groupData = user.group_data;
            }
            
            // 檢查當前類型的組別是否存在
            hasGroup = groupData && groupData[currentFormulaType];
          } catch (e) {
            console.warn(`解析用戶 ${user.id} 的 group_data 失敗:`, e);
          }
        }
        
        // 如果從 group_data 沒有找到，則檢查常規 group 字段
        return hasGroup || (user.group && user.group > 0);
      });
      
      if (usersWithGroup.length === 0) {
        setSuccess('沒有已分配組別的護理師可供操作！');
        setTimeout(() => setSuccess(null), 3000);
        setLocalLoading(false);
        return;
      }
      
      const updatePromises = usersWithGroup.map(async (user) => {
        // 獲取當前組別
        let currentGroup = null;
        let groupData = {};
        
        // 嘗試從 group_data 獲取當前類型的組別
        if (user.group_data) {
          try {
            if (typeof user.group_data === 'string') {
              groupData = JSON.parse(user.group_data);
            } else {
              groupData = { ...user.group_data };
            }
            
            if (groupData[currentFormulaType]) {
              currentGroup = parseInt(groupData[currentFormulaType], 10);
            }
          } catch (e) {
            console.warn(`解析用戶 ${user.id} 的 group_data 失敗:`, e);
          }
        }
        
        // 如果從 group_data 沒有找到，則使用常規 group 字段
        if (currentGroup === null) {
          currentGroup = user.group || 1;
        }
        
        // 計算新組別，實現循環 (如果達到最大值則回到 1)
        const newGroup = currentGroup >= groupCount ? 1 : currentGroup + 1;
        
        // 更新 group_data
        groupData[currentFormulaType] = newGroup;
        const groupDataString = JSON.stringify(groupData);
        
        // 更新用戶數據
        return updateUser(user.id, { 
          group: newGroup, // 保持向后兼容
          group_data: groupDataString 
        });
      });
      
      await Promise.all(updatePromises);
      
      // 刷新視圖
      setTimeout(() => {
        fetchUsers().then(() => {
          // 強制重新渲染
          setScheduleData([...scheduleData]);
        });
      }, 100);
      
      // setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error increasing all groups:', err);
      setLocalError('更新用戶組別失敗：' + (err.response?.data?.detail || err.message));
    } finally {
      setLocalLoading(false);
    }
  };
  
  // 處理所有用戶組別減少
  const handleDecreaseAllGroups = async () => {
    try {
      setLocalLoading(true);
      setLocalError(null);
      
      // 篩選出已經有組別的護理師，且屬於當前類型
      const usersWithGroup = currentUsers.filter(user => {
        // 嘗試從 group_data 獲取當前類型的組別
        let hasGroup = false;
        if (user.group_data) {
          try {
            let groupData;
            if (typeof user.group_data === 'string') {
              groupData = JSON.parse(user.group_data);
            } else {
              groupData = user.group_data;
            }
            
            // 檢查當前類型的組別是否存在
            hasGroup = groupData && groupData[currentFormulaType];
          } catch (e) {
            console.warn(`解析用戶 ${user.id} 的 group_data 失敗:`, e);
          }
        }
        
        // 如果從 group_data 沒有找到，則檢查常規 group 字段
        return hasGroup || (user.group && user.group > 0);
      });
      
      if (usersWithGroup.length === 0) {
        setSuccess('沒有已分配組別的護理師可供操作！');
        setTimeout(() => setSuccess(null), 3000);
        setLocalLoading(false);
        return;
      }
      
      const updatePromises = usersWithGroup.map(async (user) => {
        // 獲取當前組別
        let currentGroup = null;
        let groupData = {};
        
        // 嘗試從 group_data 獲取當前類型的組別
        if (user.group_data) {
          try {
            if (typeof user.group_data === 'string') {
              groupData = JSON.parse(user.group_data);
            } else {
              groupData = { ...user.group_data };
            }
            
            if (groupData[currentFormulaType]) {
              currentGroup = parseInt(groupData[currentFormulaType], 10);
            }
          } catch (e) {
            console.warn(`解析用戶 ${user.id} 的 group_data 失敗:`, e);
          }
        }
        
        // 如果從 group_data 沒有找到，則使用常規 group 字段
        if (currentGroup === null) {
          currentGroup = user.group || 1;
        }
        
        // 計算新組別，實現循環 (如果達到最小值則跳到最大值)
        const newGroup = currentGroup <= 1 ? groupCount : currentGroup - 1;
        
        // 更新 group_data
        groupData[currentFormulaType] = newGroup;
        const groupDataString = JSON.stringify(groupData);
        
        // 更新用戶數據
        return updateUser(user.id, { 
          group: newGroup, // 保持向后兼容
          group_data: groupDataString 
        });
      });
      
      await Promise.all(updatePromises);
      
      // 刷新視圖
      setTimeout(() => {
        fetchUsers().then(() => {
          // 強制重新渲染
          setScheduleData([...scheduleData]);
        });
      }, 100);
      
      // setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error decreasing all groups:', err);
      setLocalError('更新用戶組別失敗：' + (err.response?.data?.detail || err.message));
    } finally {
      setLocalLoading(false);
    }
  };

  // 當組別數量改變時更新排班表
  useEffect(() => {
    if (scheduleData.length > 0 && groupCount && !isSaved) {
      const newSchedule = [...scheduleData];
      
      // 調整數組長度以匹配 groupCount
      while (newSchedule.length < groupCount) {
        newSchedule.push({ shifts: Array(7).fill('O'), nurses: [] });
      }
      if (newSchedule.length > groupCount) {
        newSchedule.length = groupCount;
      }
      
      setScheduleData(newSchedule);
    }
  }, [groupCount, scheduleData.length, isSaved, scheduleData]);

  return (
    <Box sx={{ width: '100%' }}>
      {/* 公式班表類型頁籤 - 直接顯示，不使用折疊面板 */}
      <Box sx={{ mb: 3 }}>
        <Paper>
          <Tabs
            value={currentFormulaType}
            onChange={(e, newValue) => handleFormulaTypeChange(newValue)}
            variant="fullWidth"
            indicatorColor="primary"
            textColor="primary"
          >
            {Object.entries(FORMULA_TYPES).map(([key, value]) => (
              <Tab key={value} label={FORMULA_TYPE_NAMES[value]} value={value} />
            ))}
          </Tabs>
        </Paper>
      </Box>
      
      {/* 恢復原本的簡單加載指示器 */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
          <CircularProgress />
        </Box>
      )}
      
      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {typeof errorMessage === 'string' ? errorMessage : 
           (errorMessage?.message || '操作過程中發生錯誤')}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      
      {/* 移除內容可見性控制，直接顯示內容 */}
      <Paper sx={{ padding: 3, marginTop: 2, overflowX: 'auto' }}>
        <StyledTable>
          <TableHead>
            <TableRow>
              <TableCell>組別</TableCell>
              <TableCell>護理人員</TableCell>
              {dayNames.map((day, index) => (
                <TableCell key={index}>{day}</TableCell>
              ))}
              <TableCell>工時/H</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {scheduleData.map((schedule, index) => (
              <TableRow key={index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{getUserNamesByGroup(index + 1)}</TableCell>
                {schedule.shifts.map((shift, dayIndex) => (
                  <ShiftCell 
                    key={dayIndex} 
                    shift={shift}
                    formulaType={currentFormulaType}
                    onClick={() => toggleShift(index, dayIndex)}
                  >
                    <ShiftLetter disabled={isSaved}>
                      {shift}
                    </ShiftLetter>
                  </ShiftCell>
                ))}
                <TableCell>{calculateWorkHours(schedule.shifts)}</TableCell>
              </TableRow>
            ))}
            
            {/* 僅當選擇麻醉專科護理師時顯示特殊班次分組 */}
            {currentFormulaType === FORMULA_TYPES.ANESTHESIA_SPECIALIST && (
              <>
                <TableRow>
                  <TableCell colSpan={10} sx={{ p: 0 }}>
                    <Divider sx={{ my: 1 }} />
                  </TableCell>
                </TableRow>
                
                {/* 小夜班包班組 */}
                <TableRow sx={{ backgroundColor: '#fff7e6' }}>
                  <TableCell>小夜班包班</TableCell>
                  <TableCell>{getUserNamesByGroup('evening_shift')}</TableCell>
                  <TableCell colSpan={7} align="center">
                    固定擔任小夜班（A: 8-16）
                  </TableCell>
                  <TableCell>-</TableCell>
                </TableRow>
                
                {/* 大夜班包班組 */}
                <TableRow sx={{ backgroundColor: '#e6f7ff' }}>
                  <TableCell>大夜班包班</TableCell>
                  <TableCell>{getUserNamesByGroup('night_shift')}</TableCell>
                  <TableCell colSpan={7} align="center">
                    固定擔任大夜班（N: 14-22）
                  </TableCell>
                  <TableCell>-</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </StyledTable>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
          <StyledButton 
            variant="save"
            onClick={handleSaveSchedule} 
            disabled={isLoading}
          >
            {isSaved ? '解除儲存' : '儲存'}
          </StyledButton>
          
          <StyledButton 
            variant="reset"
            onClick={handleResetSchedule} 
            disabled={isLoading}
          >
            清空
          </StyledButton>
          
          <Button 
            variant="contained"
            color="primary" 
            onClick={handleIncreaseAllGroups} 
            disabled={isLoading}
            startIcon={<ArrowUpwardIcon />}
            sx={{ height: '42px' }}
          >
            組別+1
          </Button>
          
          <Button 
            variant="contained"
            color="primary" 
            onClick={handleDecreaseAllGroups} 
            disabled={isLoading}
            startIcon={<ArrowDownwardIcon />}
            sx={{ height: '42px' }}
          >
            組別-1
          </Button>
        </Box>

        {/* 用戶列表 */}
        <Divider sx={{ my: 3 }} />
        <Typography variant="h6" gutterBottom>
          {FORMULA_TYPE_NAMES[currentFormulaType]}護理人員列表
        </Typography>
        
        {currentUsers && currentUsers.length > 0 ? (
          <Box sx={{ mb: 4 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>姓名</TableCell>
                  <TableCell>員工編號</TableCell>
                  <TableCell>組別</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentUsers.map((user) => {
                  // 從 group_data 獲取當前公式類型的組別
                  let currentTypeGroup = '';
                  try {
                    if (user.group_data) {
                      let groupData;
                      if (typeof user.group_data === 'string') {
                        groupData = JSON.parse(user.group_data);
                      } else if (typeof user.group_data === 'object') {
                        groupData = user.group_data;
                      }
                      
                      if (groupData && groupData[currentFormulaType]) {
                        currentTypeGroup = groupData[currentFormulaType];
                      }
                    }
                  } catch (e) {
                    console.warn(`解析用戶 ${user.id} 的 group_data 失敗:`, e);
                  }
                  
                  // 如果無法從 group_data 獲取，則使用常規 group 字段
                  const displayGroup = currentTypeGroup || user.group || '';
                  
                  return (
                    <TableRow key={user.id}>
                      <TableCell>{user.full_name}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>
                        <FormControl size="small" fullWidth>
                          <Select
                            value={displayGroup}
                            onChange={(e) => handleGroupChange(user.id, e.target.value)}
                            displayEmpty
                          >
                            <MenuItem value="">
                              <em>未分配</em>
                            </MenuItem>
                            {Array.from({ length: groupCount }, (_, i) => i + 1).map((group) => (
                              <MenuItem key={group} value={group}>
                                {group}
                              </MenuItem>
                            ))}
                            {/* 為麻醉專科護理師提供特殊班次選項 */}
                            {currentFormulaType === FORMULA_TYPES.ANESTHESIA_SPECIALIST && (
                              <>
                                <Divider sx={{ my: 1 }} />
                                <MenuItem value="evening_shift">小夜班包班</MenuItem>
                                <MenuItem value="night_shift">大夜班包班</MenuItem>
                              </>
                            )}
                          </Select>
                        </FormControl>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        ) : (
          <Alert severity="info" sx={{ mt: 2 }}>
            此分類中沒有可用的護理人員，請先在用戶管理中添加相應身份的人員。
          </Alert>
        )}
      </Paper>
    </Box>
  );
};

export default FormulaSchedule; 