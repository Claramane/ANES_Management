import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Grid,
  Card,
  CardContent,
  IconButton,
  Tab,
  Tabs,
  styled,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Tooltip
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Group as GroupIcon,
  Settings as SettingsIcon,
  Edit as EditIcon,
  DragIndicator as DragIndicatorIcon,
  Info as InfoIcon,
  TouchApp as TouchAppIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { StrictModeDroppable } from '../components/StrictModeDroppable';
import { api } from '../utils/api';  // 導入配置好的api實例

// 定義自訂拖動樣式
const getItemStyle = (isDragging, draggableStyle) => ({
  // 基本樣式
  userSelect: 'none',
  // 拖動中的樣式變化
  opacity: isDragging ? 0.8 : 1,
  boxShadow: 'none',
  // 直接使用原始draggableStyle，不額外添加transform變換
  ...draggableStyle,
  // 強制拖動中的元素始終在頂部
  zIndex: isDragging ? 9999 : undefined,
  // 移除scale變換，保持原始位置
  transform: draggableStyle.transform,
  // 確保拖動效果不受任何形式的CSS變換影響
  transformOrigin: '0 0',
  margin: isDragging ? 0 : undefined
});

// 定義自訂群組拖放樣式
const getGroupDroppableStyle = (isDraggingOver) => ({
  backgroundColor: isDraggingOver ? 'rgba(187, 222, 251, 0.2)' : 'inherit',
  transition: 'background-color 0.3s',
  borderRadius: '4px',
  outline: isDraggingOver ? '2px dashed #1976d2' : 'none',
});

// 定義自訂池拖放樣式
const getPoolDroppableStyle = (isDraggingOver) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 0.8,
  padding: '8px',
  minHeight: '50px',
  backgroundColor: isDraggingOver ? 'rgba(187, 222, 251, 0.2)' : '#f9f9f9',
  transition: 'background-color 0.3s',
  borderRadius: '4px',
  border: isDraggingOver ? '2px dashed #1976d2' : '1px dashed #ccc'
});

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

// 班表類型ID映射
const FORMULA_TYPE_IDS = {
  [FORMULA_TYPES.ANESTHESIA_SPECIALIST]: 1,
  [FORMULA_TYPES.RECOVERY_NURSE]: 2,
  [FORMULA_TYPES.ANESTHESIA_LEADER]: 3,
  [FORMULA_TYPES.ANESTHESIA_SECRETARY]: 4,
};

// 不同班表類型的班次設定
const SHIFT_TYPES_BY_FORMULA = {
  [FORMULA_TYPES.ANESTHESIA_SPECIALIST]: ['D', 'A', 'N', 'O'],
  [FORMULA_TYPES.RECOVERY_NURSE]: ['A', 'K', 'C', 'F', 'O'],
  [FORMULA_TYPES.ANESTHESIA_LEADER]: ['A', 'E', 'O'],
  [FORMULA_TYPES.ANESTHESIA_SECRETARY]: ['B', 'E', 'O'],
};

// 班次顏色設定
const SHIFT_COLORS = {
  'D': '#c5b5ac',
  'A': '#c6c05f',
  'N': '#aa77c4',
  'K': '#8AA6C1',
  'C': '#a9d0ab',
  'F': '#d8bd89',
  'E': '#cb9cc8',
  'B': '#e7b284',
  'O': '#e7e7e7'
};

// 班次工時映射
const HOUR_MAPPING_BY_FORMULA = {
  [FORMULA_TYPES.ANESTHESIA_SPECIALIST]: { D: 10, A: 8, N: 8, O: 0 },
  [FORMULA_TYPES.RECOVERY_NURSE]: { A: 8, K: 8, C: 8, F: 8, O: 0 },
  [FORMULA_TYPES.ANESTHESIA_LEADER]: { A: 8, E: 4, O: 0 },
  [FORMULA_TYPES.ANESTHESIA_SECRETARY]: { B: 8, E: 4, O: 0 }
};

// 班次單元格樣式
const ShiftCell = styled(TableCell)(({ shift }) => ({
  backgroundColor: SHIFT_COLORS[shift] || '#f0f0f0',
  color: shift === 'O' ? '#3b3b3a' : '#3b3b3a',
  cursor: 'pointer',
  padding: '12px 8px',  // 增加內邊距，讓格子變大
  textAlign: 'center',
  fontWeight: 'bold',
  fontSize: '1.7rem',
  border: '1.5px solid #e0e0e0',
  height: '60px',      // 設置固定高度
  width: '60px',       // 設置固定寬度
  '&:hover': {
    opacity: 0.8,
  },
  '& > span': {
    fontSize: 'inherit'
  }
}));

// 表格標題單元格樣式
const HeaderCell = styled(TableCell)({
  backgroundColor: '#f5f5f5',
  fontWeight: 'bold',
  textAlign: 'center',
  padding: '10px',
  border: '1px solid #e0e0e0',
  fontSize: '0.9rem',       // 增大標題字體
  whiteSpace: 'nowrap'      // 防止文字換行
});

// 護理師名稱單元格樣式
const NameCell = styled(TableCell)({
  backgroundColor: '#ffffff',  // 改為白色背景
  fontSize: '1.3rem',
  padding: '10px 15px',
  minWidth: '200px',  // 增加寬度以容納更多護理師
  border: '1px solid #e0e0e0',
  '& .MuiTypography-root': {
    fontSize: '1.3rem'
  },
  '& .MuiChip-root': {
    fontSize: '1rem'
  },
  '&.draggable-active': {
    backgroundColor: '#f0f8ff', // 拖動過程中顯示淡藍色背景
    outline: '2px dashedrgb(160, 185, 206)',
    transition: 'background-color 0.3s'
  }
});

// 組別數字單元格樣式
const GroupNumberCell = styled(TableCell)({
  backgroundColor: '#ffffff',  // 白色背景
  fontSize: '1rem',           // 小一點點的字體
  fontWeight: 'bold',       // 正常字重
  textAlign: 'center',
  padding: '8px 5px',         // 調整內邊距
  width: '60px',              // 固定寬度
  border: '1px solid #e0e0e0'
});

// 工時統計單元格樣式
const HoursCell = styled(TableCell)({
  textAlign: 'center',
  fontSize: '1rem',
  padding: '12px 8px',
  border: '1.5px solid #e0e0e0',
  width: '65px',
  height: '60px',
  backgroundColor: '#ffffff',
  whiteSpace: 'nowrap'
});

// 自訂Tab樣式
const StyledTab = styled(Tab)(({ theme }) => ({
  fontWeight: 'bold',
  minHeight: '30px',
  fontSize: '1rem',
  [theme.breakpoints.up('md')]: {
    fontSize: '0.9rem',
  },
}));

const Formula = () => {
  // 狀態管理
  const [formulaSchedules, setFormulaSchedules] = useState([]); // 只在初始化或明確需要時 fetch
  const [users, setUsers] = useState([]); // 只在 formulaSchedules 有資料時 fetch
  const [formulaPatterns, setFormulaPatterns] = useState({}); // 只在 formulaSchedules 和 users 都有資料時組合
  const [availableNurses, setAvailableNurses] = useState([]); // 只在 currentType 變動時根據 users 計算
  const [snpNurses, setSnpNurses] = useState([]); // 小夜包班護理師
  const [lnpNurses, setLnpNurses] = useState([]); // 大夜包班護理師
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [mainTabValue, setMainTabValue] = useState(0);
  const [groupManageType, setGroupManageType] = useState(FORMULA_TYPES.ANESTHESIA_SPECIALIST);
  const [isEditingGroups, setIsEditingGroups] = useState(false);
  const [tempFormulaSchedules, setTempFormulaSchedules] = useState([]); // 編輯用本地副本
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState('');
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogContent, setDialogContent] = useState('');
  const [scheduleEditMode, setScheduleEditMode] = useState(false);
  const [tempFormulaPatterns, setTempFormulaPatterns] = useState({});
  const [pendingUpdates, setPendingUpdates] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragHint, setDragHint] = useState(null);
  const [focusedCell, setFocusedCell] = useState({ groupId: null, dayIndex: null });
  const [quickEdit, setQuickEdit] = useState(null); // { groupId, dayIndex, editing }
  const tableBoxRef = useRef(null);
  const [, forceRender] = useState({}); // 用於強制重新渲染的狀態

  // 強制重新渲染函數
  const forceUpdate = () => {
    forceRender({});
  };

  // 取得當前班表類型
  const currentType = useMemo(() => {
    if (mainTabValue === 4) {
      return groupManageType;
    }
    const types = Object.values(FORMULA_TYPES);
    return types[mainTabValue] || FORMULA_TYPES.ANESTHESIA_SPECIALIST;
  }, [mainTabValue, groupManageType]);

  // 取得當前班表類型的班次
  const currentShiftTypes = useMemo(() =>
    SHIFT_TYPES_BY_FORMULA[currentType] || [], [currentType]);

  // 1. 初始化時只 fetch 一次 formulaSchedules
  const fetchFormulaSchedules = async () => {
    try {
      setLoading(true);
      const res = await api.get('/formula-schedules/?include_patterns=true&include_assignments=true');
      if (!res || !res.data) throw new Error('API返回的數據格式不正確');
      setFormulaSchedules(res.data);
      setError(null);
    } catch (error) {
      setError('獲取公式班表設定時發生錯誤: ' + (error.message || '未知錯誤'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFormulaSchedules();
  }, []);

  // 2. formulaSchedules 拿到後再 fetch users
  useEffect(() => {
    if (!formulaSchedules || formulaSchedules.length === 0) return;
    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 使用配置好的 api 實例而不是直接 fetch
        const res = await api.get('/users', {
          params: {
            include_inactive: true,  // 獲取所有用戶以便處理復權邏輯
            limit: 1000
          }
        });
        const data = res.data;
        
        if (!Array.isArray(data)) throw new Error('API返回的數據不是數組');
        
        // 篩選掉停權用戶
        const activeUsers = data.filter(user => user.is_active !== false);
        
        // 處理復權用戶：確保復權用戶沒有分組資料的話，需要根據其身份設置到正確的公式班類型和待指定區域
        const usersNeedingUpdate = [];
        const processedUsers = activeUsers.map(user => {
          // 如果用戶沒有group_data或group_data格式不正確，根據身份自動分配
          if (!user.group_data || user.group_data === '' || user.group_data === 'null') {
            let formulaTypeId = null;
            
            // 根據用戶身份確定公式班類型
            switch (user.identity) {
              case '麻醉專科護理師':
                formulaTypeId = FORMULA_TYPE_IDS[FORMULA_TYPES.ANESTHESIA_SPECIALIST]; // 1
                break;
              case '恢復室護理師':
                formulaTypeId = FORMULA_TYPE_IDS[FORMULA_TYPES.RECOVERY_NURSE]; // 2
                break;
              case '麻醉科Leader':
                formulaTypeId = FORMULA_TYPE_IDS[FORMULA_TYPES.ANESTHESIA_LEADER]; // 3
                break;
              case '麻醉科書記':
                formulaTypeId = FORMULA_TYPE_IDS[FORMULA_TYPES.ANESTHESIA_SECRETARY]; // 4
                break;
              default:
                // 對於其他身份（如護理長），不設置group_data
                return user;
            }
            
            if (formulaTypeId) {
              // 記錄需要更新的用戶
              usersNeedingUpdate.push({
                id: user.id,
                name: user.full_name || user.name,
                group_data: JSON.stringify([formulaTypeId, null])
              });
              
              // 設置為待指定狀態 [formulaTypeId, null]
              return {
                ...user,
                group_data: JSON.stringify([formulaTypeId, null])
              };
            }
          }
          
          return user;
        });
        
        setUsers(processedUsers);
        
        // 如果有復權用戶需要更新group_data，批次更新到資料庫
        if (usersNeedingUpdate.length > 0) {
          try {
            const updatePromises = usersNeedingUpdate.map(user => 
              api.put(`/users/${user.id}`, {
                group_data: user.group_data
              })
            );
            
            await Promise.all(updatePromises);
            
            console.log(`成功為 ${usersNeedingUpdate.length} 名復權用戶設置分組資料`);
          } catch (updateError) {
            console.error('更新復權用戶分組資料失敗:', updateError);
            // 不設置error狀態，因為用戶數據已經正確顯示在前端
          }
        }
        
        setError(null);
      } catch (error) {
        setError('獲取護理師列表時發生錯誤: ' + (error.message || '未知錯誤'));
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [formulaSchedules]);

  // 3. formulaPatterns 只在 formulaSchedules 和 users 都有資料時組合
  useEffect(() => {
    if (!formulaSchedules || formulaSchedules.length === 0 || !users || users.length === 0) return;
    const allFormulas = {};
    Object.values(FORMULA_TYPES).forEach(type => {
      const schedule = formulaSchedules.find(s => s.id === FORMULA_TYPE_IDS[type]);
      const groupedUsers = users.filter(user => {
        if (!user.group_data) return false;
        try {
          const [ft, grpId] = JSON.parse(user.group_data);
          return ft === FORMULA_TYPE_IDS[type] && grpId !== null;
        } catch { return false; }
      });
      const patterns = [];
      if (schedule && Array.isArray(schedule.patterns)) {
        schedule.patterns.forEach(p => {
          const weekPattern = p.pattern.split('');
          const groupMembers = groupedUsers.filter(user => {
            try {
              const grpId = JSON.parse(user.group_data)[1];
              return grpId === p.group_number;
            } catch { return false; }
          }).map(user => ({ id: user.id.toString(), name: user.full_name || user.name }));
          patterns.push({ groupId: p.group_number, weekPattern, members: groupMembers });
        });
      }
      allFormulas[type] = patterns;
    });
    setFormulaPatterns(allFormulas);
    setTempFormulaPatterns(allFormulas);
  }, [formulaSchedules, users]);

  // 4. availableNurses 只在 currentType 變動時根據 users 計算
  useEffect(() => {
    if (!users || users.length === 0) return;
    const formulaTypeValue = FORMULA_TYPE_IDS[currentType];
    
    // 過濾出不同類型的護理師
    const filtered = users.filter(user => {
      if (!user.group_data) return false;
      try {
        const groupData = JSON.parse(user.group_data);
        return Array.isArray(groupData) && groupData[0] === formulaTypeValue && groupData[1] === null;
      } catch (e) { return false; }
    });
    
    // 過濾小夜包班護理師
    const snpFiltered = users.filter(user => {
      if (!user.group_data) return false;
      try {
        const groupData = JSON.parse(user.group_data);
        return Array.isArray(groupData) && groupData[0] === formulaTypeValue && groupData[1] === 'SNP';
      } catch (e) { return false; }
    });
    
    // 過濾大夜包班護理師
    const lnpFiltered = users.filter(user => {
      if (!user.group_data) return false;
      try {
        const groupData = JSON.parse(user.group_data);
        return Array.isArray(groupData) && groupData[0] === formulaTypeValue && groupData[1] === 'LNP';
      } catch (e) { return false; }
    });
    
    setAvailableNurses(filtered);
    setSnpNurses(snpFiltered);
    setLnpNurses(lnpFiltered);
  }, [currentType, users]);

  // 拖放開始處理
  const handleDragStart = (start) => {
    setIsDragging(true);
    
    // 設置拖動起始資訊
    document.body.style.cursor = 'grabbing';
    
    // 不再設置提示訊息
    console.log('拖動開始:', start);
  };

  // 拖放結束處理
  const handleDragEnd = (result) => {
    console.log('拖動結束:', result);
    
    // 恢復游標
    document.body.style.cursor = '';
    
    // 清除拖動狀態和提示
    setIsDragging(false);
    setDragHint(null);
    
    const { source, destination, draggableId } = result;
    
    // 如果沒有目標位置或者不是在編輯模式，則不處理
    if (!destination || !scheduleEditMode) {
      console.log('無效的拖動：沒有目標或不在編輯模式');
      return;
    }
    
    // 如果拖回原處，不處理
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      console.log('拖回原處，不處理');
      return;
    }
    
    // 獲取公式班類型值
    const formulaTypeMap = {
      [FORMULA_TYPES.ANESTHESIA_SPECIALIST]: 1,
      [FORMULA_TYPES.RECOVERY_NURSE]: 2,
      [FORMULA_TYPES.ANESTHESIA_LEADER]: 3,
      [FORMULA_TYPES.ANESTHESIA_SECRETARY]: 4,
    };
    const formulaType = formulaTypeMap[currentType];
    
    console.log('拖動來源:', source.droppableId, '目標:', destination.droppableId, '元素ID:', draggableId);
    
    // 從池到組別
    if ((source.droppableId === 'pool' || source.droppableId === 'snp-pool' || source.droppableId === 'lnp-pool') && 
        destination.droppableId.startsWith('group-')) {
      if (!scheduleEditMode) return; // 只在編輯模式下允許拖動
      const groupId = parseInt(destination.droppableId.split('-')[1], 10);
      const nurseIdWithPrefix = draggableId.replace('pool-', '').replace('snp-', '').replace('lnp-', '');
      const nurseId = nurseIdWithPrefix;
      
      // 根據來源確定護理師
      let nurse;
      if (source.droppableId === 'pool') {
        nurse = availableNurses.find(n => n.id.toString() === nurseId);
        // 從待指派列表中移除
        setAvailableNurses(prev => prev.filter(n => n.id.toString() !== nurseId));
      } else if (source.droppableId === 'snp-pool') {
        nurse = snpNurses.find(n => n.id.toString() === nurseId);
        // 從小夜包班列表中移除
        setSnpNurses(prev => prev.filter(n => n.id.toString() !== nurseId));
      } else if (source.droppableId === 'lnp-pool') {
        nurse = lnpNurses.find(n => n.id.toString() === nurseId);
        // 從大夜包班列表中移除
        setLnpNurses(prev => prev.filter(n => n.id.toString() !== nurseId));
      }
      
      if (!nurse) {
        console.error('未找到護理師:', nurseId);
        return;
      }
      
      // 更新tempFormulaSchedules
      setTempFormulaSchedules(prev => {
        const copy = JSON.parse(JSON.stringify(prev)); // 深拷貝確保完全不共用引用
        const idx = copy.findIndex(f => f.id === FORMULA_TYPE_IDS[currentType]);
        if (idx === -1) return copy;
        
        // 確保groups陣列中包含members
        for (let i = 0; i < copy[idx].patterns.length; i++) {
          const p = copy[idx].patterns[i];
          if (!p.members) p.members = [];
          
          // 如果是目標組別，添加護理師
          if (Number(p.group_number) === Number(groupId)) {
            p.members.push({ 
              id: nurse.id.toString(), 
              name: nurse.name || nurse.full_name 
            });
          }
        }
        
        // 檢查目標組別是否存在，如果不存在則創建
        const targetGroupExists = copy[idx].patterns.some(p => Number(p.group_number) === Number(groupId));
        if (!targetGroupExists) {
          copy[idx].patterns.push({
            group_number: Number(groupId),
            pattern: 'OOOOOOO',
            members: [{ 
              id: nurse.id.toString(), 
              name: nurse.name || nurse.full_name 
            }]
          });
        }
        
        return copy;
      });
      
      // 添加到待更新列表
      setPendingUpdates(prev => {
        const update = {
          nurseId: nurse.id,
          nurseName: nurse.name || nurse.full_name,
          formulaType: FORMULA_TYPE_IDS[currentType],
          groupId: groupId,
          action: 'add'
        };
        console.log('add pendingUpdate', update);
        return [...prev, update];
      });
    }
    // 從組別拖回池中
    else if (source.droppableId.startsWith('group-') && destination.droppableId === 'pool') {
      const sourceGroupId = parseInt(source.droppableId.split('-')[1], 10);
      // 從member-前綴中獲取護理師ID
      const nurseId = draggableId.replace('member-', '');
      
      // 使用暫存數據找到源組別
      const scheduleFormula = tempFormulaSchedules.find(f => f.id === FORMULA_TYPE_IDS[currentType]);
      if (!scheduleFormula || !Array.isArray(scheduleFormula.patterns)) {
        console.error('未找到公式班表資料');
        return;
      }
      
      // 從patterns中找到對應groupId的pattern
      const sourcePattern = scheduleFormula.patterns.find(p => Number(p.group_number) === Number(sourceGroupId));
      if (!sourcePattern) {
        console.error('未找到源組別pattern:', sourceGroupId);
        return;
      }
      
      // 確保pattern有members屬性
      if (!sourcePattern.members || !Array.isArray(sourcePattern.members)) {
        console.error('源組別沒有members資料');
        return;
      }
      
      // 找到護理師
      const nurseIndex = sourcePattern.members.findIndex(m => m.id.toString() === nurseId);
      if (nurseIndex === -1) {
        console.error('未找到護理師ID:', nurseId);
        return;
      }
      
      const nurse = sourcePattern.members[nurseIndex];
      if (!nurse) {
        console.error('未找到護理師:', nurseIndex);
        return;
      }
      
      console.log('拖動護理師:', nurse, '從組別', sourceGroupId, '到待指派區');
      
      // 從班表中移除
      setTempFormulaSchedules(prev => {
        const copy = JSON.parse(JSON.stringify(prev)); // 深拷貝確保完全不共用引用
        const idx = copy.findIndex(f => f.id === FORMULA_TYPE_IDS[currentType]);
        if (idx === -1) return copy;
        
        // 更新所有pattern的members
        for (let i = 0; i < copy[idx].patterns.length; i++) {
          const p = copy[idx].patterns[i];
          if (Number(p.group_number) === Number(sourceGroupId)) {
            // 保留現有的members，但過濾掉要移除的護理師
            p.members = (p.members || []).filter(m => m.id.toString() !== nurseId);
          }
        }
        
        return copy;
      });
      
      // 添加到待指派列表
      setAvailableNurses(prev => [...prev, {
        id: nurse.id,
        name: nurse.name || nurse.full_name
      }]);
      
      // 更新pendingUpdates
      setPendingUpdates(prev => [...prev, {
        nurseId: nurse.id,
        nurseName: nurse.name,
        formulaType: FORMULA_TYPE_IDS[currentType],
        groupId: null, // 設為null表示未分配
        action: 'remove',
        sourceGroupId
      }]);
    }
    // 從組別拖到小夜包班區域
    else if (source.droppableId.startsWith('group-') && destination.droppableId === 'snp-pool') {
      const sourceGroupId = parseInt(source.droppableId.split('-')[1], 10);
      const nurseId = draggableId.replace('member-', '');
      
      // 使用暫存數據找到源組別
      const scheduleFormula = tempFormulaSchedules.find(f => f.id === FORMULA_TYPE_IDS[currentType]);
      if (!scheduleFormula || !Array.isArray(scheduleFormula.patterns)) {
        console.error('未找到公式班表資料');
        return;
      }
      
      // 從patterns中找到對應groupId的pattern
      const sourcePattern = scheduleFormula.patterns.find(p => Number(p.group_number) === Number(sourceGroupId));
      if (!sourcePattern) {
        console.error('未找到源組別pattern:', sourceGroupId);
        return;
      }
      
      // 確保pattern有members屬性
      if (!sourcePattern.members || !Array.isArray(sourcePattern.members)) {
        console.error('源組別沒有members資料');
        return;
      }
      
      // 找到護理師
      const nurseIndex = sourcePattern.members.findIndex(m => m.id.toString() === nurseId);
      if (nurseIndex === -1) {
        console.error('未找到護理師ID:', nurseId);
        return;
      }
      
      const nurse = sourcePattern.members[nurseIndex];
      if (!nurse) {
        console.error('未找到護理師:', nurseIndex);
        return;
      }
      
      console.log('拖動護理師:', nurse, '從組別', sourceGroupId, '到小夜包班區');
      
      // 從班表中移除
      setTempFormulaSchedules(prev => {
        const copy = JSON.parse(JSON.stringify(prev));
        const idx = copy.findIndex(f => f.id === FORMULA_TYPE_IDS[currentType]);
        if (idx === -1) return copy;
        
        // 更新所有pattern的members
        for (let i = 0; i < copy[idx].patterns.length; i++) {
          const p = copy[idx].patterns[i];
          if (Number(p.group_number) === Number(sourceGroupId)) {
            p.members = (p.members || []).filter(m => m.id.toString() !== nurseId);
          }
        }
        
        return copy;
      });
      
      // 添加到小夜包班列表
      setSnpNurses(prev => [...prev, {
        id: nurse.id,
        name: nurse.name || nurse.full_name
      }]);
      
      // 更新pendingUpdates，將group_data設為[formulaType, 'SNP']
      setPendingUpdates(prev => [...prev, {
        nurseId: nurse.id,
        nurseName: nurse.name,
        formulaType: FORMULA_TYPE_IDS[currentType],
        groupId: 'SNP', // 標記為小夜包班
        action: 'remove',
        sourceGroupId
      }]);
    }
    // 從組別拖到大夜包班區域
    else if (source.droppableId.startsWith('group-') && destination.droppableId === 'lnp-pool') {
      const sourceGroupId = parseInt(source.droppableId.split('-')[1], 10);
      const nurseId = draggableId.replace('member-', '');
      
      // 使用暫存數據找到源組別
      const scheduleFormula = tempFormulaSchedules.find(f => f.id === FORMULA_TYPE_IDS[currentType]);
      if (!scheduleFormula || !Array.isArray(scheduleFormula.patterns)) {
        console.error('未找到公式班表資料');
        return;
      }
      
      // 從patterns中找到對應groupId的pattern
      const sourcePattern = scheduleFormula.patterns.find(p => Number(p.group_number) === Number(sourceGroupId));
      if (!sourcePattern) {
        console.error('未找到源組別pattern:', sourceGroupId);
        return;
      }
      
      // 確保pattern有members屬性
      if (!sourcePattern.members || !Array.isArray(sourcePattern.members)) {
        console.error('源組別沒有members資料');
        return;
      }
      
      // 找到護理師
      const nurseIndex = sourcePattern.members.findIndex(m => m.id.toString() === nurseId);
      if (nurseIndex === -1) {
        console.error('未找到護理師ID:', nurseId);
        return;
      }
      
      const nurse = sourcePattern.members[nurseIndex];
      if (!nurse) {
        console.error('未找到護理師:', nurseIndex);
        return;
      }
      
      console.log('拖動護理師:', nurse, '從組別', sourceGroupId, '到大夜包班區');
      
      // 從班表中移除
      setTempFormulaSchedules(prev => {
        const copy = JSON.parse(JSON.stringify(prev));
        const idx = copy.findIndex(f => f.id === FORMULA_TYPE_IDS[currentType]);
        if (idx === -1) return copy;
        
        // 更新所有pattern的members
        for (let i = 0; i < copy[idx].patterns.length; i++) {
          const p = copy[idx].patterns[i];
          if (Number(p.group_number) === Number(sourceGroupId)) {
            p.members = (p.members || []).filter(m => m.id.toString() !== nurseId);
          }
        }
        
        return copy;
      });
      
      // 添加到大夜包班列表
      setLnpNurses(prev => [...prev, {
        id: nurse.id,
        name: nurse.name || nurse.full_name
      }]);
      
      // 更新pendingUpdates，將group_data設為[formulaType, 'LNP']
      setPendingUpdates(prev => [...prev, {
        nurseId: nurse.id,
        nurseName: nurse.name,
        formulaType: FORMULA_TYPE_IDS[currentType],
        groupId: 'LNP', // 標記為大夜包班
        action: 'remove',
        sourceGroupId
      }]);
    }
    // 從小夜包班區域拖到待指派區域
    else if (source.droppableId === 'snp-pool' && destination.droppableId === 'pool') {
      const nurseId = draggableId.replace('snp-', '');
      const nurse = snpNurses.find(n => n.id.toString() === nurseId);
      
      if (!nurse) {
        console.error('未找到護理師:', nurseId);
        return;
      }
      
      // 從小夜包班列表移除
      setSnpNurses(prev => prev.filter(n => n.id.toString() !== nurseId));
      
      // 添加到待指派列表
      setAvailableNurses(prev => [...prev, {
        id: nurse.id,
        name: nurse.name || nurse.full_name
      }]);
      
      // 更新pendingUpdates，將group_data設為[formulaType, null]
      setPendingUpdates(prev => [...prev, {
        nurseId: nurse.id,
        nurseName: nurse.name || nurse.full_name,
        formulaType: FORMULA_TYPE_IDS[currentType],
        groupId: null, // 設為null表示未分配
        action: 'change-pool'
      }]);
    }
    // 從大夜包班區域拖到待指派區域
    else if (source.droppableId === 'lnp-pool' && destination.droppableId === 'pool') {
      const nurseId = draggableId.replace('lnp-', '');
      const nurse = lnpNurses.find(n => n.id.toString() === nurseId);
      
      if (!nurse) {
        console.error('未找到護理師:', nurseId);
        return;
      }
      
      // 從大夜包班列表移除
      setLnpNurses(prev => prev.filter(n => n.id.toString() !== nurseId));
      
      // 添加到待指派列表
      setAvailableNurses(prev => [...prev, {
        id: nurse.id,
        name: nurse.name || nurse.full_name
      }]);
      
      // 更新pendingUpdates，將group_data設為[formulaType, null]
      setPendingUpdates(prev => [...prev, {
        nurseId: nurse.id,
        nurseName: nurse.name || nurse.full_name,
        formulaType: FORMULA_TYPE_IDS[currentType],
        groupId: null, // 設為null表示未分配
        action: 'change-pool'
      }]);
    }
    // 從小夜包班區域拖到大夜包班區域
    else if (source.droppableId === 'snp-pool' && destination.droppableId === 'lnp-pool') {
      const nurseId = draggableId.replace('snp-', '');
      const nurse = snpNurses.find(n => n.id.toString() === nurseId);
      
      if (!nurse) {
        console.error('未找到護理師:', nurseId);
        return;
      }
      
      // 從小夜包班列表移除
      setSnpNurses(prev => prev.filter(n => n.id.toString() !== nurseId));
      
      // 添加到大夜包班列表
      setLnpNurses(prev => [...prev, {
        id: nurse.id,
        name: nurse.name || nurse.full_name
      }]);
      
      // 更新pendingUpdates，將group_data設為[formulaType, 'LNP']
      setPendingUpdates(prev => [...prev, {
        nurseId: nurse.id,
        nurseName: nurse.name || nurse.full_name,
        formulaType: FORMULA_TYPE_IDS[currentType],
        groupId: 'LNP', // 設為大夜包班
        action: 'change-pool'
      }]);
    }
    // 從大夜包班區域拖到小夜包班區域
    else if (source.droppableId === 'lnp-pool' && destination.droppableId === 'snp-pool') {
      const nurseId = draggableId.replace('lnp-', '');
      const nurse = lnpNurses.find(n => n.id.toString() === nurseId);
      
      if (!nurse) {
        console.error('未找到護理師:', nurseId);
        return;
      }
      
      // 從大夜包班列表移除
      setLnpNurses(prev => prev.filter(n => n.id.toString() !== nurseId));
      
      // 添加到小夜包班列表
      setSnpNurses(prev => [...prev, {
        id: nurse.id,
        name: nurse.name || nurse.full_name
      }]);
      
      // 更新pendingUpdates，將group_data設為[formulaType, 'SNP']
      setPendingUpdates(prev => [...prev, {
        nurseId: nurse.id,
        nurseName: nurse.name || nurse.full_name,
        formulaType: FORMULA_TYPE_IDS[currentType],
        groupId: 'SNP', // 設為小夜包班
        action: 'change-pool'
      }]);
    }
    // 從待指派區域拖到小夜包班區域
    else if (source.droppableId === 'pool' && destination.droppableId === 'snp-pool') {
      const nurseId = draggableId.replace('pool-', '');
      const nurse = availableNurses.find(n => n.id.toString() === nurseId);
      
      if (!nurse) {
        console.error('未找到護理師:', nurseId);
        return;
      }
      
      // 從待指派列表移除
      setAvailableNurses(prev => prev.filter(n => n.id.toString() !== nurseId));
      
      // 添加到小夜包班列表
      setSnpNurses(prev => [...prev, {
        id: nurse.id,
        name: nurse.name || nurse.full_name
      }]);
      
      // 更新pendingUpdates，將group_data設為[formulaType, 'SNP']
      setPendingUpdates(prev => [...prev, {
        nurseId: nurse.id,
        nurseName: nurse.name || nurse.full_name,
        formulaType: FORMULA_TYPE_IDS[currentType],
        groupId: 'SNP', // 設為小夜包班
        action: 'change-pool'
      }]);
    }
    // 從待指派區域拖到大夜包班區域
    else if (source.droppableId === 'pool' && destination.droppableId === 'lnp-pool') {
      const nurseId = draggableId.replace('pool-', '');
      const nurse = availableNurses.find(n => n.id.toString() === nurseId);
      
      if (!nurse) {
        console.error('未找到護理師:', nurseId);
        return;
      }
      
      // 從待指派列表移除
      setAvailableNurses(prev => prev.filter(n => n.id.toString() !== nurseId));
      
      // 添加到大夜包班列表
      setLnpNurses(prev => [...prev, {
        id: nurse.id,
        name: nurse.name || nurse.full_name
      }]);
      
      // 更新pendingUpdates，將group_data設為[formulaType, 'LNP']
      setPendingUpdates(prev => [...prev, {
        nurseId: nurse.id,
        nurseName: nurse.name || nurse.full_name,
        formulaType: FORMULA_TYPE_IDS[currentType],
        groupId: 'LNP', // 設為大夜包班
        action: 'change-pool'
      }]);
    }
    // 從一個組別到另一個組別
    else if (source.droppableId.startsWith('group-') && destination.droppableId.startsWith('group-')) {
      if (!scheduleEditMode) return;
      const sourceGroupId = parseInt(source.droppableId.split('-')[1], 10);
      const destGroupId = parseInt(destination.droppableId.split('-')[1], 10);
      if (sourceGroupId === destGroupId) {
        console.log('相同組別，不處理');
        return;
      }
      
      const nurseId = draggableId.replace('member-', '');
      
      // 從tempFormulaSchedules中找到對應的公式班表
      const scheduleFormula = tempFormulaSchedules.find(f => f.id === FORMULA_TYPE_IDS[currentType]);
      if (!scheduleFormula || !Array.isArray(scheduleFormula.patterns)) {
        console.error('未找到公式班表資料');
        return;
      }
      
      // 找到源組別的pattern
      const sourcePattern = scheduleFormula.patterns.find(p => Number(p.group_number) === Number(sourceGroupId));
      if (!sourcePattern) {
        console.error('未找到源組別pattern:', sourceGroupId);
        return;
      }
      
      // 確保pattern有members屬性
      if (!sourcePattern.members || !Array.isArray(sourcePattern.members)) {
        console.error('源組別沒有members資料');
        return;
      }
      
      // 找到護理師
      const nurseIndex = sourcePattern.members.findIndex(m => m.id.toString() === nurseId);
      if (nurseIndex === -1) {
        console.error('未找到護理師ID:', nurseId);
        return;
      }
      
      const nurse = sourcePattern.members[nurseIndex];
      if (!nurse) {
        console.error('未找到護理師:', nurseIndex);
        return;
      }
      
      console.log('拖動護理師:', nurse, '從組別', sourceGroupId, '到組別', destGroupId);
      
      // 更新tempFormulaSchedules
      setTempFormulaSchedules(prev => {
        const copy = JSON.parse(JSON.stringify(prev)); // 深拷貝確保完全不共用引用
        const idx = copy.findIndex(f => f.id === FORMULA_TYPE_IDS[currentType]);
        if (idx === -1) return copy;
        
        // 更新所有的patterns
        let destPatternFound = false;
        for (let i = 0; i < copy[idx].patterns.length; i++) {
          const p = copy[idx].patterns[i];
          // 從源組別移除護理師
          if (Number(p.group_number) === Number(sourceGroupId)) {
            p.members = (p.members || []).filter(m => m.id.toString() !== nurseId);
          }
          // 添加護理師到目標組別
          else if (Number(p.group_number) === Number(destGroupId)) {
            destPatternFound = true;
            if (!p.members) p.members = [];
            p.members.push({ ...nurse });
          }
        }
        
        // 如果沒找到目標組別，創建一個新的
        if (!destPatternFound) {
          copy[idx].patterns.push({
            group_number: Number(destGroupId),
            pattern: 'OOOOOOO',
            members: [{ ...nurse }]
          });
        }
        
        return copy;
      });
      
      // 更新pendingUpdates
      setPendingUpdates(prev => {
        const update = {
          nurseId: nurse.id,
          nurseName: nurse.name,
          formulaType: FORMULA_TYPE_IDS[currentType],
          groupId: destGroupId,
          action: 'move',
          sourceGroupId
        };
        return [...prev, update];
      });
    }
  };

  // 批量更新護理師group_data的函數
  const batchUpdateNurseGroupData = async () => {
    try {
      if (pendingUpdates.length === 0) {
        setTimeout(() => setSuccess(null), 3000);
        return;
      }

      setLoading(true);

      // 創建所有更新操作的Promise，使用 api 實例
      const updatePromises = pendingUpdates.map(update => {
        // 構建要更新的護理師資料
        const updatedNurse = {
          group_data: JSON.stringify([update.formulaType, update.groupId])
        };
        console.log('更新護理師', update.nurseId, 'group_data:', [update.formulaType, update.groupId]);
        // 使用 api.put 而不是 fetch，自動處理 baseURL 和 Authorization
        return api.put(`/users/${update.nurseId}`, updatedNurse);
      });

      // 等待所有更新完成
      const results = await Promise.all(updatePromises);

      // 檢查是否所有請求都成功（axios 成功請求會返回 response 對象）
      const allSuccessful = results.every(res => res.status === 200 || res.status === 204);

      setLoading(false);

      if (allSuccessful) {
        setSuccess(`成功更新 ${pendingUpdates.length} 名護理師的組別設定`);
        setPendingUpdates([]); // 清空暫存更新
        setFormulaPatterns(tempFormulaSchedules); // 更新正式資料
      } else {
        setError('部分更新失敗，請重試');
      }

      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 3000);
    } catch (error) {
      console.error('批量更新護理師組別時發生錯誤:', error);
      setError('批量更新護理師組別時發生錯誤: ' + error.message);
      setLoading(false);
    }
  };

  // 處理主要Tab切換
  const handleMainTabChange = (event, newValue) => {
    setMainTabValue(newValue);
  };

  // 處理組別管理類型變更
  const handleGroupManageTypeChange = (event) => {
    setGroupManageType(event.target.value);
  };

  // 處理班次點擊 - 循環切換班次
  const handleShiftClick = (groupId, dayIndex) => {
    // 如果不在編輯模式，直接返回
    if (!scheduleEditMode) return;
    
    // 根據編輯模式選擇使用臨時資料或正式資料
    const currentFormula = tempFormulaPatterns[currentType];
    if (!currentFormula) return;
    
    const groupIdx = currentFormula.findIndex(g => Number(g.groupId) === Number(groupId));
    if (groupIdx === -1) return;
    
    const newPatterns = [...currentFormula];
    const currentPattern = newPatterns[groupIdx].weekPattern;
    const currentShift = currentPattern[dayIndex];
    const currentShiftIndex = currentShiftTypes.indexOf(currentShift);
    const nextShiftIndex = (currentShiftIndex + 1) % currentShiftTypes.length;
    currentPattern[dayIndex] = currentShiftTypes[nextShiftIndex];
    
    // 更新臨時資料
    setTempFormulaPatterns(prev => ({
      ...prev,
      [currentType]: newPatterns
    }));
    
    // 同時更新tempFormulaSchedules
    setTempFormulaSchedules(prev => {
      const copy = prev.map(f => ({ ...f, patterns: [...(f.patterns || [])] }));
      const idx = copy.findIndex(f => f.id === FORMULA_TYPE_IDS[currentType]);
      if (idx === -1) return copy;
      
      // 找到對應的pattern並更新
      const patterns = copy[idx].patterns.map(p => {
        if (Number(p.group_number) === Number(groupId)) {
          const patternArray = p.pattern.split('');
          patternArray[dayIndex] = currentShiftTypes[nextShiftIndex];
          return { ...p, pattern: patternArray.join('') };
        }
        return p;
      });
      
      copy[idx].patterns = patterns;
      return copy;
    });
  };

  // 處理重置按鈕點擊
  const handleReset = () => {
    const currentFormula = formulaPatterns[currentType];
    if (!currentFormula) return;

    // 將所有班次重置為休假(O)
    const newPatterns = currentFormula.map(group => ({
      ...group,
      weekPattern: Array(7).fill('O')
    }));
    
    // 更新state
    setFormulaPatterns(prev => ({
      ...prev,
      [currentType]: newPatterns
    }));

    setSuccess('已重置所有班次為休假');
    
    // 3秒後清除成功訊息
    setTimeout(() => setSuccess(null), 3000);
  };

  // 保存公式班表模式到後端
  const saveFormulaPatterns = async () => {
    try {
      setLoading(true);
      
      // 獲取當前的公式班表類型
      const currentFormula = formulaPatterns[currentType] || [];
      
      // 如果沒有數據，直接返回
      if (currentFormula.length === 0) {
        console.log('沒有班表數據需要更新');
        return true;
      }
      
      // 獲取對應的formulaSchedule ID
      const formulaId = FORMULA_TYPE_IDS[currentType];
      
      // 準備要提交的pattern數據
      const patternsToUpdate = currentFormula.map(group => ({
        group_number: group.groupId,
        pattern: group.weekPattern.join('')
      }));
      
      console.log(`正在更新 ${FORMULA_TYPE_NAMES[currentType]} 的班表模式:`, patternsToUpdate);
      
      // 發送更新請求到後端
      const response = await api.put(`/formula-schedules/${formulaId}`, {
        patterns: patternsToUpdate
      });
      
      if (response && response.status === 200) {
        console.log('班表模式更新成功');
        return true;
      } else {
        console.error('班表模式更新失敗:', response);
        setError('班表模式更新失敗');
        return false;
      }
    } catch (error) {
      console.error('保存班表模式時發生錯誤:', error);
      setError('保存班表模式時發生錯誤: ' + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 處理保存按鈕點擊
  const handleSave = async () => {
    setLoading(true);
    try {
      // 只更新 patterns
      const currentType = Object.values(FORMULA_TYPES)[mainTabValue];
      const formulaId = FORMULA_TYPE_IDS[currentType];
      
      // 從tempFormulaSchedules中獲取當前公式班表
      const currentSchedule = tempFormulaSchedules.find(s => s.id === formulaId);
      if (!currentSchedule || !Array.isArray(currentSchedule.patterns)) {
        console.error('未找到有效的公式班表資料');
        throw new Error('未找到有效的公式班表資料');
      }
      
      // 保存patterns而不丟失members信息
      const patternsToUpdate = currentSchedule.patterns.map(p => ({
        group_number: p.group_number,
        pattern: p.pattern
      }));
      
      console.log('正在更新公式班表:', patternsToUpdate);
      
      // 發送API請求更新班表模式
      await api.put(`/formula-schedules/${formulaId}`, { patterns: patternsToUpdate });
      
      // 同步formulaPatterns中的members資訊到tempFormulaPatterns
      const syncedPatterns = { ...formulaPatterns };
      Object.values(FORMULA_TYPES).forEach(type => {
        const typeId = FORMULA_TYPE_IDS[type];
        const schedule = tempFormulaSchedules.find(s => s.id === typeId);
        
        if (schedule && Array.isArray(schedule.patterns)) {
          syncedPatterns[type] = schedule.patterns.map(p => {
            // 將API格式轉換為formulaPatterns格式
            return {
              groupId: p.group_number,
              weekPattern: typeof p.pattern === 'string' ? p.pattern.split('') : Array(7).fill('O'),
              members: p.members || []
            };
          });
        }
      });
      
      // 更新護理師分組數據
      await batchUpdateNurseGroupData();

      
      // 更新正式資料
      setFormulaPatterns(syncedPatterns);
      
      // 退出編輯模式
      setScheduleEditMode(false);
      
      // 清除藍色選取框，確保在保存後不會殘留選取狀態
      setFocusedCell(null);
      setQuickEdit(null);
      // 強制刷新UI
      forceUpdate();
      
      // 重新獲取最新數據
      await fetchFormulaSchedules();
      
      setTimeout(() => setSuccess(null), 1000);
    } catch (error) {
      setError('保存班表失敗: ' + error.message);
      setTimeout(() => setError(null), 1000);
    } finally {
      setLoading(false);
    }
  };

  // 處理編輯組別按鈕點擊
  const handleEditGroups = () => {
    if (isEditingGroups) {
      // 如果目前是編輯狀態，則顯示確認對話框
      setDialogTitle('確認儲存組別設定');
      setDialogContent('確定要儲存這些組別設定嗎？這可能會影響現有的班表排班。');
      setDialogAction('save');
      setDialogOpen(true);
    } else {
      // 進入編輯模式時，做一份 formulaSchedules 的深拷貝
      setTempFormulaSchedules(JSON.parse(JSON.stringify(formulaSchedules)));
      setIsEditingGroups(true);
    }
  };

  // 處理將護理師移動到待指派區域的函數
  const handleRemoveNurseToPool = (nurseId, sourceArea, sourceGroupId = null) => {
    if (!scheduleEditMode) return; // 只在編輯模式下處理
    
    let nurse;
    // 確保 nurseId 是字符串
    const nurseIdStr = nurseId.toString();
    
    // 根據來源區域獲取護理師信息並從原區域移除
    if (sourceArea === 'group') {
      // 從組別移除護理師
      // 使用暫存數據找到源組別
      const scheduleFormula = tempFormulaSchedules.find(f => f.id === FORMULA_TYPE_IDS[currentType]);
      if (!scheduleFormula || !Array.isArray(scheduleFormula.patterns)) {
        console.error('未找到公式班表資料');
        return;
      }
      
      // 從patterns中找到對應groupId的pattern
      const sourcePattern = scheduleFormula.patterns.find(p => Number(p.group_number) === Number(sourceGroupId));
      if (!sourcePattern) {
        console.error('未找到源組別pattern:', sourceGroupId);
        return;
      }
      
      // 確保pattern有members屬性
      if (!sourcePattern.members || !Array.isArray(sourcePattern.members)) {
        console.error('源組別沒有members資料');
        return;
      }
      
      // 找到護理師
      const nurseIndex = sourcePattern.members.findIndex(m => m.id.toString() === nurseIdStr);
      if (nurseIndex === -1) {
        console.error('未找到護理師ID:', nurseIdStr);
        return;
      }
      
      nurse = sourcePattern.members[nurseIndex];
      if (!nurse) {
        console.error('未找到護理師:', nurseIndex);
        return;
      }
      
      // 從班表中移除
      setTempFormulaSchedules(prev => {
        const copy = JSON.parse(JSON.stringify(prev)); // 深拷貝確保完全不共用引用
        const idx = copy.findIndex(f => f.id === FORMULA_TYPE_IDS[currentType]);
        if (idx === -1) return copy;
        
        // 更新所有pattern的members
        for (let i = 0; i < copy[idx].patterns.length; i++) {
          const p = copy[idx].patterns[i];
          if (Number(p.group_number) === Number(sourceGroupId)) {
            // 保留現有的members，但過濾掉要移除的護理師
            p.members = (p.members || []).filter(m => m.id.toString() !== nurseIdStr);
          }
        }
        
        return copy;
      });
    } else if (sourceArea === 'snp') {
      // 從小夜包班區域移除
      // 確保使用 toString() 進行比較
      nurse = snpNurses.find(n => n.id.toString() === nurseIdStr);
      if (!nurse) {
        console.error('未找到小夜包班護理師:', nurseIdStr);
        // 嘗試使用數字形式比較
        nurse = snpNurses.find(n => Number(n.id) === Number(nurseIdStr));
        if (!nurse) {
          console.error('使用數字比較後仍未找到小夜包班護理師:', nurseIdStr);
          return;
        }
      }
      setSnpNurses(prev => prev.filter(n => n.id.toString() !== nurseIdStr));
    } else if (sourceArea === 'lnp') {
      // 從大夜包班區域移除
      // 確保使用 toString() 進行比較
      nurse = lnpNurses.find(n => n.id.toString() === nurseIdStr);
      if (!nurse) {
        console.error('未找到大夜包班護理師:', nurseIdStr);
        // 嘗試使用數字形式比較
        nurse = lnpNurses.find(n => Number(n.id) === Number(nurseIdStr));
        if (!nurse) {
          console.error('使用數字比較後仍未找到大夜包班護理師:', nurseIdStr);
          return;
        }
      }
      setLnpNurses(prev => prev.filter(n => n.id.toString() !== nurseIdStr));
    } else {
      console.error('未知的來源區域:', sourceArea);
      return;
    }
    
    // 將護理師添加到待指派區域
    setAvailableNurses(prev => [...prev, {
      id: nurse.id,
      name: nurse.name || nurse.full_name
    }]);
    
    // 更新pendingUpdates
    setPendingUpdates(prev => {
      const update = {
        nurseId: nurse.id,
        nurseName: nurse.name,
        formulaType: FORMULA_TYPE_IDS[currentType],
        groupId: null, // 設為null表示未分配
        action: 'remove',
        sourceGroupId: sourceArea === 'group' ? sourceGroupId : undefined
      };
      return [...prev, update];
    });
  };

  // 處理對話框確認
  const handleDialogConfirm = () => {
    if (dialogAction === 'save') {
      // 儲存組別設定到後端
      saveFormulaGroupCounts();
    } else if (dialogAction === 'reset-schedule') {
      // 確認重置公式：清空當前班表
      handleReset();
    }
    
    setDialogOpen(false);
  };

  // 處理對話框取消
  const handleDialogCancel = () => {
    if (dialogAction === 'save') {
      // 恢復原始設定
      setTempFormulaSchedules(JSON.parse(JSON.stringify(formulaSchedules)));
    }
    
    setDialogOpen(false);
  };

  // 組別數量變更 - 只修改 num_groups 的值
  const handleGroupCountChange = (formulaId, newValue) => {
    const value = Math.max(1, Math.min(20, parseInt(newValue) || 1));
    setTempFormulaSchedules(prev => prev.map(f => {
      if (f.id !== formulaId) return f;
      // 只更新 num_groups，不動 patterns
      return { ...f, num_groups: value };
    }));
  };

  // 儲存組別設定
  const saveFormulaGroupCounts = async () => {
    try {
      setLoading(true);
      // 只 PATCH/PUT 有變動的 formula-schedule
      const updatePromises = tempFormulaSchedules.map(f => {
        const original = formulaSchedules.find(o => o.id === f.id);
        if (!original) return null;
        
        // 檢查是否有變動
        const numGroupsChanged = f.num_groups !== original.num_groups;
        
        // 如果組別數量沒有變動，則不需要更新
        if (!numGroupsChanged) return null;
        
        console.log(`更新公式班表 ${f.id}，設定組數為 ${f.num_groups}`);
        
        // 只傳送 num_groups 給後端，由後端處理 patterns 的增減
        return api.put(`/formula-schedules/${f.id}`, {
          num_groups: f.num_groups
        });
      }).filter(Boolean);
      
      await Promise.all(updatePromises);
      setSuccess('組別設定已成功儲存到資料庫');
      setIsEditingGroups(false);
      await fetchFormulaSchedules();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError('儲存組別設定時發生錯誤: ' + (error.message || '未知錯誤'));
      setLoading(false);
    }
  };

  // 處理鍵盤輸入班別（支援快速填寫模式）
  const handleKeyDown = (e) => {
    if (!scheduleEditMode) return;
    
    // 快速填寫模式
    if (quickEdit && quickEdit.editing && quickEdit.groupId != null && quickEdit.dayIndex != null) {
      const allowedShifts = SHIFT_TYPES_BY_FORMULA[currentType];
      const key = e.key.toUpperCase();
      
      // 處理方向鍵
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        
        // 計算新的dayIndex
        let newDayIndex = quickEdit.dayIndex;
        if (e.key === 'ArrowLeft') {
          newDayIndex = Math.max(0, quickEdit.dayIndex - 1);
        } else if (e.key === 'ArrowRight') {
          newDayIndex = Math.min(6, quickEdit.dayIndex + 1);
        }
        
        // 更新quickEdit狀態
        setQuickEdit({
          ...quickEdit,
          dayIndex: newDayIndex
        });
        
        return;
      }
      
      // Enter 或 Esc 退出時阻止默認行為
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        // 確保立即清除quickEdit狀態並強制刷新UI
        setQuickEdit(null);
        // 立即呼叫forceUpdate確保組件重新渲染
        forceUpdate();
        return;
      }
      
      // 只有當輸入有效班別時才阻止默認行為
      if (allowedShifts.includes(key)) {
        e.preventDefault();
        
        // 更新tempFormulaSchedules - 使用深拷貝並保留members
        setTempFormulaSchedules(prev => {
          // 使用深拷貝確保不會有引用問題
          const copy = JSON.parse(JSON.stringify(prev));
          const idx = copy.findIndex(f => f.id === FORMULA_TYPE_IDS[currentType]);
          if (idx === -1) return copy;
          
          // 直接修改patterns，保留其中的members資訊
          for (let i = 0; i < copy[idx].patterns.length; i++) {
            const p = copy[idx].patterns[i];
            if (Number(p.group_number) === Number(quickEdit.groupId)) {
              // 更新pattern字串中的對應位置
              const patternArray = p.pattern.split('');
              patternArray[quickEdit.dayIndex] = key;
              p.pattern = patternArray.join('');
              // members保持不變
            }
          }
          
          return copy;
        });
        
        // 同時更新tempFormulaPatterns
        setTempFormulaPatterns(prev => {
          // 複製一份當前類型的資料
          const prevCopy = JSON.parse(JSON.stringify(prev));
          const currentFormula = prevCopy[currentType] ? prevCopy[currentType] : [];
          
          // 找到對應的組別
          const groupIndex = currentFormula.findIndex(g => 
            Number(g.groupId) === Number(quickEdit.groupId)
          );
          
          if (groupIndex === -1) return prevCopy;
          
          // 更新該組別的weekPattern
          currentFormula[groupIndex].weekPattern[quickEdit.dayIndex] = key;
          
          // 返回更新後的資料
          return {
            ...prevCopy,
            [currentType]: currentFormula
          };
        });
        
        // 游標自動跳到下一格
        if (quickEdit.dayIndex < 6) {
          setQuickEdit({ ...quickEdit, dayIndex: quickEdit.dayIndex + 1 });
        } else {
          setQuickEdit(null); // 最後一格自動退出
          // 立即呼叫forceUpdate確保組件重新渲染
          forceUpdate();
        }
        return;
      }
    }
    
    // 一般的單格編輯模式
    if (!focusedCell || focusedCell.groupId == null || focusedCell.dayIndex == null) return;
    
    const cellAllowedShifts = SHIFT_TYPES_BY_FORMULA[currentType];
    const cellKey = e.key.toUpperCase();
    
    // 只有當輸入有效班別時才阻止默認行為
    if (cellAllowedShifts.includes(cellKey)) {
      e.preventDefault();
      
      // 更新tempFormulaSchedules - 使用深拷貝並保留members
      setTempFormulaSchedules(prev => {
        // 使用深拷貝確保不會有引用問題
        const copy = JSON.parse(JSON.stringify(prev));
        const idx = copy.findIndex(f => f.id === FORMULA_TYPE_IDS[currentType]);
        if (idx === -1) return copy;
        
        // 直接修改patterns，保留其中的members資訊
        for (let i = 0; i < copy[idx].patterns.length; i++) {
          const p = copy[idx].patterns[i];
          if (Number(p.group_number) === Number(focusedCell.groupId)) {
            // 更新pattern字串中的對應位置
            const patternArray = p.pattern.split('');
            patternArray[focusedCell.dayIndex] = cellKey;
            p.pattern = patternArray.join('');
            // members保持不變
          }
        }
        
        return copy;
      });
      
      // 同時更新tempFormulaPatterns
      setTempFormulaPatterns(prev => {
        // 複製一份當前類型的資料
        const prevCopy = JSON.parse(JSON.stringify(prev));
        const currentFormula = prevCopy[currentType] ? prevCopy[currentType] : [];
        
        // 找到對應的組別
        const groupIndex = currentFormula.findIndex(g => 
          Number(g.groupId) === Number(focusedCell.groupId)
        );
        
        if (groupIndex === -1) return prevCopy;
        
        // 更新該組別的weekPattern
        currentFormula[groupIndex].weekPattern[focusedCell.dayIndex] = cellKey;
        
        // 返回更新後的資料
        return {
          ...prevCopy,
          [currentType]: currentFormula
        };
      });
    }
  };

  // 編輯/保存切換 handler
  const handleEditToggle = () => {
    if (scheduleEditMode) {
      handleSave();
    } else {
      setScheduleEditMode(true);
      setPendingUpdates([]);
      
      // 確保深拷貝formulaPatterns和formulaSchedules
      const patternsDeepCopy = JSON.parse(JSON.stringify(formulaPatterns));
      setTempFormulaPatterns(patternsDeepCopy);
      
      // 深拷貝formulaSchedules並為每個pattern添加members信息
      const schedulesDeepCopy = JSON.parse(JSON.stringify(formulaSchedules));
      
      // 為tempFormulaSchedules的patterns添加成員信息
      Object.values(FORMULA_TYPES).forEach(type => {
        const typeId = FORMULA_TYPE_IDS[type];
        const schedule = schedulesDeepCopy.find(s => s.id === typeId);
        
        if (schedule && Array.isArray(schedule.patterns)) {
          // 同步pattern內容
          schedule.patterns.forEach(p => {
            // 獲取該組別的成員
            const groupMembers = users.filter(user => {
              if (!user.group_data) return false;
              try {
                const [ft, grpId] = JSON.parse(user.group_data);
                return ft === typeId && grpId === p.group_number;
              } catch { return false; }
            }).map(user => ({ 
              id: user.id.toString(), 
              name: user.full_name || user.name 
            }));
            
            // 將成員信息附加到pattern上
            p.members = groupMembers;
          });
        }
      });
      
      setTempFormulaSchedules(schedulesDeepCopy);
      console.log('已進入編輯模式，臨時資料已設置', schedulesDeepCopy);
    }
  };

  // 處理組別循環向上
  const handleGroupRotateUp = async () => {
    if (!scheduleEditMode) {
      setError('請先進入編輯模式');
      return;
    }
    
    try {
      setLoading(true);
      
      // 獲取當前公式班表ID
      const formulaId = FORMULA_TYPE_IDS[currentType];
      
      // 從tempFormulaSchedules獲取當前公式的patterns
      const currentFormula = tempFormulaSchedules.find(f => f.id === formulaId);
      if (!currentFormula) {
        setError('無法獲取當前公式班表信息');
        setLoading(false);
        return;
      }
      
      // 確保有patterns
      if (!currentFormula.patterns || currentFormula.patterns.length === 0) {
        setError('當前公式班表沒有班表模式');
        setLoading(false);
        return;
      }
      
      // 創建臨時數據的深拷貝
      const updatedSchedules = JSON.parse(JSON.stringify(tempFormulaSchedules));
      const updatedPatterns = JSON.parse(JSON.stringify(tempFormulaPatterns));
      
      // 找到當前公式的index
      const formulaIndex = updatedSchedules.findIndex(f => f.id === formulaId);
      if (formulaIndex === -1) {
        setError('找不到當前公式班表');
        setLoading(false);
        return;
      }
      
      // 對patterns按組別排序
      const sortedPatterns = [...updatedSchedules[formulaIndex].patterns]
        .sort((a, b) => Number(a.group_number) - Number(b.group_number));
      
      // 計算最大組別
      const groups = sortedPatterns.map(p => Number(p.group_number));
      const maxGroup = Math.max(...groups);
      
      // 創建一個臨時對象來存儲每個組別對應的pattern
      const patternsByGroup = {};
      sortedPatterns.forEach(p => {
        patternsByGroup[p.group_number] = p.pattern;
      });
      
      // 循環移動pattern內容（向上）
      sortedPatterns.forEach(p => {
        const groupNumber = Number(p.group_number);
        const nextGroupNumber = groupNumber === maxGroup ? 1 : groupNumber + 1;
        // 將下一個組別的pattern分配給當前組別
        p.pattern = patternsByGroup[nextGroupNumber];
      });
      
      // 更新formulaSchedules中的patterns
      updatedSchedules[formulaIndex].patterns = sortedPatterns;
      
      // 同時更新tempFormulaPatterns以保持一致性
      if (updatedPatterns[currentType]) {
        const patternArray = sortedPatterns.map(p => ({
          groupId: p.group_number,
          weekPattern: typeof p.pattern === 'string' ? p.pattern.split('') : Array(7).fill('O'),
          members: p.members || []
        }));
        updatedPatterns[currentType] = patternArray;
      }
      
      // 更新本地狀態
      setTempFormulaSchedules(updatedSchedules);
      setTempFormulaPatterns(updatedPatterns);
      
    } catch (error) {
      console.error('班表循環移動失敗:', error);
      setError('班表循環移動失敗: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // 處理組別循環向下
  const handleGroupRotateDown = async () => {
    if (!scheduleEditMode) {
      setError('請先進入編輯模式');
      return;
    }
    
    try {
      setLoading(true);
      
      // 獲取當前公式班表ID
      const formulaId = FORMULA_TYPE_IDS[currentType];
      
      // 從tempFormulaSchedules獲取當前公式的patterns
      const currentFormula = tempFormulaSchedules.find(f => f.id === formulaId);
      if (!currentFormula) {
        setError('無法獲取當前公式班表信息');
        setLoading(false);
        return;
      }
      
      // 確保有patterns
      if (!currentFormula.patterns || currentFormula.patterns.length === 0) {
        setError('當前公式班表沒有班表模式');
        setLoading(false);
        return;
      }
      
      // 創建臨時數據的深拷貝
      const updatedSchedules = JSON.parse(JSON.stringify(tempFormulaSchedules));
      const updatedPatterns = JSON.parse(JSON.stringify(tempFormulaPatterns));
      
      // 找到當前公式的index
      const formulaIndex = updatedSchedules.findIndex(f => f.id === formulaId);
      if (formulaIndex === -1) {
        setError('找不到當前公式班表');
        setLoading(false);
        return;
      }
      
      // 對patterns按組別排序
      const sortedPatterns = [...updatedSchedules[formulaIndex].patterns]
        .sort((a, b) => Number(a.group_number) - Number(b.group_number));
      
      // 計算最大組別
      const groups = sortedPatterns.map(p => Number(p.group_number));
      const maxGroup = Math.max(...groups);
      
      // 創建一個臨時對象來存儲每個組別對應的pattern
      const patternsByGroup = {};
      sortedPatterns.forEach(p => {
        patternsByGroup[p.group_number] = p.pattern;
      });
      
      // 循環移動pattern內容（向下）
      sortedPatterns.forEach(p => {
        const groupNumber = Number(p.group_number);
        const prevGroupNumber = groupNumber === 1 ? maxGroup : groupNumber - 1;
        // 將前一個組別的pattern分配給當前組別
        p.pattern = patternsByGroup[prevGroupNumber];
      });
      
      // 更新formulaSchedules中的patterns
      updatedSchedules[formulaIndex].patterns = sortedPatterns;
      
      // 同時更新tempFormulaPatterns以保持一致性
      if (updatedPatterns[currentType]) {
        const patternArray = sortedPatterns.map(p => ({
          groupId: p.group_number,
          weekPattern: typeof p.pattern === 'string' ? p.pattern.split('') : Array(7).fill('O'),
          members: p.members || []
        }));
        updatedPatterns[currentType] = patternArray;
      }
      
      // 更新本地狀態
      setTempFormulaSchedules(updatedSchedules);
      setTempFormulaPatterns(updatedPatterns);
      

      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('班表循環移動失敗:', error);
      setError('班表循環移動失敗: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 渲染班表內容
  const renderScheduleContent = () => {
    // 根據編輯模式選擇使用臨時資料或正式資料
    let patterns = [];
    
    if (scheduleEditMode) {
      // 編輯模式下，從tempFormulaSchedules中獲取patterns
      const currentFormula = tempFormulaSchedules.find(f => f.id === FORMULA_TYPE_IDS[currentType]);
      if (currentFormula && currentFormula.patterns) {
        patterns = currentFormula.patterns.map(p => {
          // 將pattern字串轉為weekPattern陣列
          const weekPattern = typeof p.pattern === 'string' ? p.pattern.split('') : Array(7).fill('O');
          
          // 直接使用pattern中已有的members，如果沒有則創建空陣列
          const members = p.members || [];
          
          return {
            groupId: p.group_number,
            weekPattern,
            members
          };
        });
      }
    } else {
      // 非編輯模式使用formulaPatterns
      patterns = formulaPatterns[currentType] || [];
    }
    
    // 如果沒有數據，顯示空表格
    if (patterns.length === 0) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body1" color="textSecondary">
            尚未設定公式班表資料，請先設定組別並編輯班表。
          </Typography>
        </Box>
      );
    }
    
    // 將patterns排序
    const displayGroups = [...patterns].sort((a, b) => Number(a.groupId) - Number(b.groupId));

    // 輸出調試訊息
    console.log('渲染班表內容:', displayGroups);

    return (
      <DragDropContext 
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
      >
        <Box 
          ref={tableBoxRef} 
          onKeyDown={handleKeyDown}
          sx={{ outline: 'none' }} // 確保容器永遠沒有外框
        >
          <Paper sx={{ overflow: 'auto', boxShadow: 'none' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <HeaderCell sx={{ width: '60px' }}>組別</HeaderCell>
                  <HeaderCell>公式班成員</HeaderCell>
                  <HeaderCell>一</HeaderCell>
                  <HeaderCell>二</HeaderCell>
                  <HeaderCell>三</HeaderCell>
                  <HeaderCell>四</HeaderCell>
                  <HeaderCell>五</HeaderCell>
                  <HeaderCell>六</HeaderCell>
                  <HeaderCell>日</HeaderCell>
                  <HeaderCell>工時/H</HeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayGroups.map((group, index) => (
                  <StrictModeDroppable 
                    droppableId={`group-${group.groupId}`} 
                    key={`group-${group.groupId}`} 
                    direction="horizontal"
                    isDropDisabled={!scheduleEditMode}
                  >
                    {(provided, snapshot) => (
                      <TableRow 
                        ref={provided.innerRef} 
                        {...provided.droppableProps}
                        key={`group-row-${group.groupId}`}
                        sx={getGroupDroppableStyle(snapshot.isDraggingOver)}
                      >
                        <GroupNumberCell
                          sx={{
                            backgroundColor: snapshot.isDraggingOver ? '#bbdefb' : '#ffffff',
                            cursor: scheduleEditMode ? 'pointer' : 'default',
                            // 只有在quickEdit存在且處於編輯狀態且該單元格是當前編輯的組別時才顯示選取框
                            outline: (quickEdit && quickEdit.editing && quickEdit.groupId === group.groupId) 
                              ? '2px solid #1976d2' 
                              : 'none',
                            // 設置樣式過渡效果
                            transition: 'outline 0.2s ease, background-color 0.3s'
                          }}
                          tabIndex={0}
                          onClick={() => {
                            if (scheduleEditMode) {
                              // 進入快速編輯模式並更新狀態
                              setQuickEdit({ groupId: group.groupId, dayIndex: 0, editing: true });
                            }
                          }}
                        >
                          {group.groupId}
                        </GroupNumberCell>
                        <NameCell
                          className={snapshot.isDraggingOver ? 'draggable-active' : ''}
                        >
                          {group.members.map((member, idx) => (
                            <Draggable 
                              key={`member-${member.id}`} 
                              draggableId={`member-${member.id}`} 
                              index={idx}
                              isDragDisabled={!scheduleEditMode}
                            >
                              {(prov, snapshot) => (
                                <Chip
                                  ref={prov.innerRef}
                                  {...prov.draggableProps}
                                  {...prov.dragHandleProps}
                                  label={member.name}
                                  size="medium"
                                  onDelete={scheduleEditMode ? () => handleRemoveNurseToPool(member.id, 'group', group.groupId) : undefined}
                                  sx={{ 
                                    marginRight: 0.5,
                                    marginBottom: 0.5,
                                    cursor: scheduleEditMode ? 'grab' : 'default',
                                    backgroundColor: scheduleEditMode ? '#f0f7ff' : undefined,
                                    border: scheduleEditMode ? '1px solid #bbdefb' : undefined,
                                    '&:hover': scheduleEditMode ? {
                                      backgroundColor: '#e3f2fd',
                                      zIndex: 1
                                    } : {},
                                    position: 'relative',
                                    touchAction: 'none',
                                    // 確保拖拽時不會因為層級而被遮擋
                                    zIndex: snapshot.isDragging ? 9999 : 1
                                  }}
                                  style={{
                                    ...prov.draggableProps.style,
                                    ...(snapshot.isDragging ? {
                                      opacity: 0.8,
                                      boxShadow: 'none',
                                      transform: prov.draggableProps.style?.transform,
                                      zIndex: 9999
                                    } : {})
                                  }}
                                />
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </NameCell>
                        {group.weekPattern.map((shift, dayIndex) => (
                          <ShiftCell
                            key={`${group.groupId}-${dayIndex}`}
                            shift={shift}
                            tabIndex={0}
                            onClick={() => {
                              if (scheduleEditMode) {
                                // 只設置狀態，不進行焦點設置
                                setFocusedCell({ groupId: group.groupId, dayIndex });
                                // 只在編輯模式下調用handleShiftClick
                                handleShiftClick(group.groupId, dayIndex);
                              }
                            }}
                            onFocus={() => {
                              if (scheduleEditMode) setFocusedCell({ groupId: group.groupId, dayIndex });
                            }}
                            sx={{ 
                              cursor: scheduleEditMode ? 'pointer' : 'not-allowed',
                              // 移除選取外框，除非在快速編輯模式下
                              outline: (quickEdit && quickEdit.editing && quickEdit.groupId === group.groupId && quickEdit.dayIndex === dayIndex) 
                                ? '2px solid #1976d2' 
                                : 'none',
                              // 確保樣式變更有過渡效果
                              transition: 'outline 0.2s ease, background-color 0.3s'
                            }}
                          >
                            <span>{shift}</span>
                          </ShiftCell>
                        ))}
                        <HoursCell>
                          {group.weekPattern.reduce((sum, sh) => sum + (HOUR_MAPPING_BY_FORMULA[currentType][sh] || 0), 0)}
                        </HoursCell>
                      </TableRow>
                    )}
                  </StrictModeDroppable>
                ))}
              </TableBody>
            </Table>
          </Paper>

          {/* Pool: 待指派清單 */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              待指派護理師
              {scheduleEditMode && (
                <Chip 
                  label="可拖動" 
                  color="primary" 
                  variant="outlined" 
                  size="small" 
                  sx={{ ml: 2, fontSize: '0.75rem' }} 
                />
              )}
            </Typography>
            <StrictModeDroppable 
              droppableId="pool" 
              direction="horizontal"
              isDropDisabled={!scheduleEditMode}
            >
              {(provided, snapshot) => (
                <Box 
                  ref={provided.innerRef} 
                  {...provided.droppableProps} 
                  sx={getPoolDroppableStyle(snapshot.isDraggingOver)}
                >
                  {scheduleEditMode && availableNurses.length === 0 && !snapshot.isDraggingOver && (
                    <Typography color="textSecondary" sx={{ padding: '10px', fontStyle: 'italic' }}>
                      目前沒有待指派的護理師
                    </Typography>
                  )}
                  {availableNurses.map((nurse, idx) => (
                    <Draggable 
                      key={`pool-${nurse.id}`} 
                      draggableId={`pool-${nurse.id}`} 
                      index={idx}
                      isDragDisabled={!scheduleEditMode}
                    >
                      {(prov, snapshot) => (
                        <Chip
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          {...prov.dragHandleProps}
                          label={nurse.name || nurse.full_name}
                          size="medium"
                          sx={{ 
                            marginRight: 0.5,
                            marginBottom: 0.5,
                            cursor: scheduleEditMode ? 'grab' : 'default',
                            backgroundColor: scheduleEditMode ? '#f0f7ff' : undefined,
                            border: scheduleEditMode ? '1px solid #bbdefb' : undefined,
                            '&:hover': scheduleEditMode ? {
                              backgroundColor: '#e3f2fd',
                              zIndex: 1
                            } : {},
                            position: 'relative',
                            touchAction: 'none',
                            // 確保拖拽時不會因為層級而被遮擋
                            zIndex: snapshot.isDragging ? 9999 : 1
                          }}
                          style={{
                            ...prov.draggableProps.style,
                            ...(snapshot.isDragging ? {
                              opacity: 0.8,
                              boxShadow: 'none',
                              transform: prov.draggableProps.style?.transform,
                              zIndex: 9999
                            } : {})
                          }}
                        />
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  
                  {scheduleEditMode && snapshot.isDraggingOver && (
                    <Box sx={{ 
                      position: 'absolute', 
                      width: '100%', 
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none'
                    }}>
                      <Typography variant="body1" sx={{ color: '#3f51b5', fontWeight: 'bold' }}>
                        放置到此區域
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </StrictModeDroppable>
            
            {/* 小夜包班和大夜包班區域 */}
            <Grid container spacing={2} sx={{ mt: 3, mb: 2 }}>
              {/* 小夜包班護理師 */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  小夜包班護理師
                  {scheduleEditMode && (
                    <Chip 
                      label="可拖動" 
                      color="secondary" 
                      variant="outlined" 
                      size="small" 
                      sx={{ ml: 2, fontSize: '0.75rem' }} 
                    />
                  )}
                </Typography>
                <StrictModeDroppable 
                  droppableId="snp-pool" 
                  direction="horizontal"
                  isDropDisabled={!scheduleEditMode}
                >
                  {(provided, snapshot) => (
                    <Box 
                      ref={provided.innerRef} 
                      {...provided.droppableProps} 
                      sx={{
                        ...getPoolDroppableStyle(snapshot.isDraggingOver),
                        backgroundColor: snapshot.isDraggingOver ? 'rgba(236, 196, 253, 0.2)' : '#faf4fa',
                        border: snapshot.isDraggingOver ? '2px dashed #9c27b0' : '1px dashed #ce93d8',
                        minHeight: '80px'
                      }}
                    >
                      {scheduleEditMode && snpNurses.length === 0 && !snapshot.isDraggingOver && (
                        <Typography color="textSecondary" sx={{ padding: '10px', fontStyle: 'italic' }}>
                          目前沒有小夜包班護理師
                        </Typography>
                      )}
                      {snpNurses.map((nurse, idx) => (
                        <Draggable 
                          key={`snp-${nurse.id}`} 
                          draggableId={`snp-${nurse.id}`} 
                          index={idx}
                          isDragDisabled={!scheduleEditMode}
                        >
                          {(prov, snapshot) => (
                            <Chip
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              label={nurse.name || nurse.full_name}
                              size="medium"
                              color="secondary"
                              onDelete={scheduleEditMode ? () => handleRemoveNurseToPool(nurse.id, 'snp') : undefined}
                              sx={{ 
                                marginRight: 0.5,
                                marginBottom: 0.5,
                                cursor: scheduleEditMode ? 'grab' : 'default',
                                backgroundColor: scheduleEditMode ? '#f3e5f5' : undefined,
                                border: scheduleEditMode ? '1px solid #ce93d8' : undefined,
                                '&:hover': scheduleEditMode ? {
                                  backgroundColor: '#e1bee7',
                                  zIndex: 1
                                } : {},
                                position: 'relative',
                                touchAction: 'none',
                                zIndex: snapshot.isDragging ? 9999 : 1
                              }}
                              style={{
                                ...prov.draggableProps.style,
                                ...(snapshot.isDragging ? {
                                  opacity: 0.8,
                                  boxShadow: 'none',
                                  transform: prov.draggableProps.style?.transform,
                                  zIndex: 9999
                                } : {})
                              }}
                            />
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      
                      {scheduleEditMode && snapshot.isDraggingOver && (
                        <Box sx={{ 
                          position: 'absolute', 
                          width: '100%', 
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          pointerEvents: 'none'
                        }}>
                          <Typography variant="body1" sx={{ color: '#9c27b0', fontWeight: 'bold' }}>
                            放置到小夜包班區域
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}
                </StrictModeDroppable>
              </Grid>
              
              {/* 大夜包班護理師 */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  大夜包班護理師
                  {scheduleEditMode && (
                    <Chip 
                      label="可拖動" 
                      color="error" 
                      variant="outlined" 
                      size="small" 
                      sx={{ ml: 2, fontSize: '0.75rem' }} 
                    />
                  )}
                </Typography>
                <StrictModeDroppable 
                  droppableId="lnp-pool" 
                  direction="horizontal"
                  isDropDisabled={!scheduleEditMode}
                >
                  {(provided, snapshot) => (
                    <Box 
                      ref={provided.innerRef} 
                      {...provided.droppableProps} 
                      sx={{
                        ...getPoolDroppableStyle(snapshot.isDraggingOver),
                        backgroundColor: snapshot.isDraggingOver ? 'rgba(255, 205, 210, 0.2)' : '#fdf5f5',
                        border: snapshot.isDraggingOver ? '2px dashed #f44336' : '1px dashed #ef9a9a',
                        minHeight: '80px'
                      }}
                    >
                      {scheduleEditMode && lnpNurses.length === 0 && !snapshot.isDraggingOver && (
                        <Typography color="textSecondary" sx={{ padding: '10px', fontStyle: 'italic' }}>
                          目前沒有大夜包班護理師
                        </Typography>
                      )}
                      {lnpNurses.map((nurse, idx) => (
                        <Draggable 
                          key={`lnp-${nurse.id}`} 
                          draggableId={`lnp-${nurse.id}`} 
                          index={idx}
                          isDragDisabled={!scheduleEditMode}
                        >
                          {(prov, snapshot) => (
                            <Chip
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              label={nurse.name || nurse.full_name}
                              size="medium"
                              color="error"
                              onDelete={scheduleEditMode ? () => handleRemoveNurseToPool(nurse.id, 'lnp') : undefined}
                              sx={{ 
                                marginRight: 0.5,
                                marginBottom: 0.5,
                                cursor: scheduleEditMode ? 'grab' : 'default',
                                backgroundColor: scheduleEditMode ? '#ffebee' : undefined,
                                border: scheduleEditMode ? '1px solid #ef9a9a' : undefined,
                                '&:hover': scheduleEditMode ? {
                                  backgroundColor: '#ffcdd2',
                                  zIndex: 1
                                } : {},
                                position: 'relative',
                                touchAction: 'none',
                                zIndex: snapshot.isDragging ? 9999 : 1
                              }}
                              style={{
                                ...prov.draggableProps.style,
                                ...(snapshot.isDragging ? {
                                  opacity: 0.8,
                                  boxShadow: 'none',
                                  transform: prov.draggableProps.style?.transform,
                                  zIndex: 9999
                                } : {})
                              }}
                            />
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      
                      {scheduleEditMode && snapshot.isDraggingOver && (
                        <Box sx={{ 
                          position: 'absolute', 
                          width: '100%', 
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          pointerEvents: 'none'
                        }}>
                          <Typography variant="body1" sx={{ color: '#f44336', fontWeight: 'bold' }}>
                            放置到大夜包班區域
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}
                </StrictModeDroppable>
              </Grid>
            </Grid>
            
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {scheduleEditMode && (
                  <>
                    <Tooltip title="調整完成後，請記得點擊保存按鈕">
                      <IconButton color="info" sx={{ mr: 1 }}>
                        <InfoIcon />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Box>
            </Box>

            {scheduleEditMode && (
              <Paper sx={{ p: 2, mt: 2, backgroundColor: '#f5f5f5', border: '1px solid #e0e0e0', boxShadow: 'none' }}>
                <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <InfoIcon sx={{ mr: 1, color: 'info.main' }} />
                  操作指南
                </Typography>
                <Typography variant="body2" fontSize="0.8rem">
                  • 拖動護理師姓名卡片可以改變其所屬組別<br />
                  • 拖動至「待指派護理師」區域可將護理師從組別中移除<br />
                  • 拖動至「小夜包班護理師」區域可設定為小夜包班<br />
                  • 拖動至「大夜包班護理師」區域可設定為大夜包班<br />
                  • 點擊護理師名字上的 [X] 按鈕可快速將其移至待指派區域<br />
                  • 點擊「保存」按鈕將提交所有變更<br />
                  • 組別變更將影響護理師的排班
                </Typography>
              </Paper>
            )}
          </Box>
        </Box>
      </DragDropContext>
    );
  };

  // 渲染組別管理內容
  const renderGroupContent = () => {
    if (loading && formulaSchedules.length === 0) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
          <Typography variant="h6" sx={{ ml: 2 }}>載入公式班表設定中...</Typography>
        </Box>
      );
    }

    // 獲取顯示數據
    const displaySchedules = isEditingGroups ? tempFormulaSchedules : formulaSchedules;
    
    // 按照指定順序(ID順序)排序顯示數據
    const sortedSchedules = [...displaySchedules].sort((a, b) => a.id - b.id);
    
    console.log('排序後的組別順序:', sortedSchedules.map(s => 
      `ID: ${s.id}, 名稱: ${FORMULA_TYPE_NAMES[Object.keys(FORMULA_TYPE_IDS).find(type => FORMULA_TYPE_IDS[type] === s.id)]}`
    ));

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontSize: '1.5rem' }}>公式班表組別設定</Typography>
          <Box>
            <Button
              variant={isEditingGroups ? "contained" : "outlined"}
              color={isEditingGroups ? "primary" : "info"}
              startIcon={isEditingGroups ? <SaveIcon /> : <EditIcon />}
              onClick={handleEditGroups}
              sx={{ fontSize: '1rem', padding: '6px 17px' }}
              disabled={loading}
            >
              {isEditingGroups ? "儲存組別" : "編輯組別"}
            </Button>
          </Box>
        </Box>
        
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            <Typography variant="body2" color="text.secondary">更新中...</Typography>
          </Box>
        )}
        
        <Grid container spacing={3}>
          {sortedSchedules.map((f) => (
            <Grid item xs={12} sm={6} md={3} key={f.id}>
              <Card sx={{ height: '100%', boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontSize: '1.3rem' }}>
                    {FORMULA_TYPE_NAMES[Object.keys(FORMULA_TYPE_IDS).find(type => FORMULA_TYPE_IDS[type] === f.id)]}
                  </Typography>
                  <TextField
                    label="組別數量"
                    type="number"
                    fullWidth
                    value={f.num_groups || 1}
                    onChange={e => isEditingGroups && handleGroupCountChange(f.id, e.target.value)}
                    inputProps={{ 
                      min: 1, 
                      max: 20,
                      style: { fontSize: '1.2rem', padding: '12px 14px' } 
                    }}
                    InputLabelProps={{
                      style: { fontSize: '1.1rem' }
                    }}
                    disabled={!isEditingGroups || loading}
                    sx={{ mt: 2 }}
                    FormHelperTextProps={{
                      style: { fontSize: '1rem' }
                    }}
                  />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
        
        <Alert severity="info" sx={{ mt: 3, fontSize: '0.6rem', '& .MuiAlert-message': { fontSize: '0.9rem' } }}>
          請按下編輯組別來調整組別數量，修改後請記得儲存。
        </Alert>
      </Box>
    );
  };

  if (loading && Object.keys(formulaSchedules).length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Card sx={{ boxShadow: 'none', border: '1px solid #e0e0e0' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={mainTabValue}
            onChange={handleMainTabChange}
            variant="fullWidth"
            scrollButtons="auto"
            textColor="primary"
            indicatorColor="primary"
            aria-label="班表類型標籤"
          >
            <StyledTab label="麻醉專科護理師" />
            <StyledTab label="恢復室護理師" />
            <StyledTab label="麻醉科Leader" />
            <StyledTab label="麻醉科書記" />
            <StyledTab label="組別管理" />
          </Tabs>
        </Box>

        {mainTabValue < 4 && (
          <Box sx={{ p: 1 , display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              {scheduleEditMode && (
                <Alert 
                  icon={<TouchAppIcon />}
                  severity="info" 
                  sx={{ 
                    '& .MuiAlert-message': { 
                      fontSize: '0.8rem', 
                      display: 'flex', 
                      alignItems: 'center' 
                    } 
                  }}
                >
                  現在可以拖動護理師，調整組別
                </Alert>
              )}
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', ml: 2 }}>
              {scheduleEditMode && (
                <>
                  <Tooltip title="調整完成後，請記得點擊保存按鈕">
                    <IconButton color="info" sx={{ mr: 1 }}>
                      <InfoIcon />
                    </IconButton>
                  </Tooltip>
                </>
              )}
              <Tooltip title="所有護理師組別向上移動">
                <IconButton 
                  color="primary" 
                  size="small" 
                  onClick={handleGroupRotateUp}
                  disabled={loading || !scheduleEditMode}
                  sx={{ mr: 0.5 }}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="所有護理師組別向下移動">
                <IconButton 
                  color="primary" 
                  size="small" 
                  onClick={handleGroupRotateDown}
                  disabled={loading || !scheduleEditMode}
                  sx={{ mr: 1 }}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Button
                variant={scheduleEditMode ? 'contained' : 'outlined'}
                color="primary"
                startIcon={scheduleEditMode ? <SaveIcon /> : <EditIcon />}
                onClick={handleEditToggle}
                disabled={loading}
              >
                {scheduleEditMode ? '保存' : '編輯'}
              </Button>
            </Box>
          </Box>
        )}

        <Divider />

        <CardContent>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          )}

          {!loading && (
            <>
              {mainTabValue < 4 ? renderScheduleContent() : renderGroupContent()}
            </>
          )}
        </CardContent>
      </Card>

      {/* 確認對話框 */}
      <Dialog
        open={dialogOpen}
        onClose={handleDialogCancel}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title" sx={{ fontSize: '1.5rem' }}>{dialogTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description" sx={{ fontSize: '1.2rem' }}>
            {dialogContent}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogCancel} color="error" sx={{ fontSize: '1.1rem' }}>取消</Button>
          <Button onClick={handleDialogConfirm} color="primary" autoFocus sx={{ fontSize: '1.1rem' }}>確認</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Formula; 