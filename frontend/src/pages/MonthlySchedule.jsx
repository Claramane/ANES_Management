import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Alert,
  CircularProgress,
  styled,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Tabs,
  Tab
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { zhTW } from 'date-fns/locale';
import { useScheduleStore } from '../store/scheduleStore';
import { useUserStore } from '../store/userStore';
import { useAuthStore } from '../store/authStore';
import { format, getDaysInMonth, getDay, isValid } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';

// 自訂Tab樣式
const StyledTab = styled(Tab)(({ theme }) => ({
  fontWeight: 'bold',
  minHeight: '30px',
  fontSize: '1rem',
  [theme.breakpoints.up('md')]: {
    fontSize: '0.9rem',
  },
}));

// 確保日期有效性的工具函數
const ensureValidDate = (date) => {
  if (date && date instanceof Date && !isNaN(date.getTime())) {
    return date;
  }
  console.warn('發現無效日期，使用當前日期替代:', date);
  return new Date();
};

// 班次顏色設定
const ShiftCell = styled(TableCell)(({ shift }) => {
  const colors = { 
    'D': '#c5b5ac', // 白班 22-08
    'A': '#c6c05f', // 小夜班 8-16
    'N': '#aa77c4', // 大夜班 14-22
    'K': '#8AA6C1', // 早班 9-17
    'C': '#a9d0ab', // 中班 10-18
    'F': '#d8bd89', // 晚班 12-20
    'E': '#cb9cc8', // 半班 8-12
    'B': '#e7b284', // 日班 8-17
    'O': '#e7e7e7', // 排休 OFF
    'V': '#e0755f',  // 休假 OFF
    'R': '#a9c4ce'  // 靜養假 OFF
  };
  
  return {
    backgroundColor: colors[shift || 'O'] || 'inherit',
    color: 'black',
    cursor: 'pointer',
    padding: '4px 2px',
    textAlign: 'center',
    fontWeight: 'normal',
    fontSize: '14px',
    minWidth: '28px',
    width: '28px',
    height: '28px',
    border: '1px solid #ddd'
  };
});

const MonthlySchedule = () => {
  const { 
    monthlySchedule: storeMonthlySchedule, 
    isLoading, 
    error: storeError, 
    selectedDate: storeSelectedDate, 
    updateSelectedDate,
    generateMonthlySchedule, 
    saveMonthlySchedule,
    fetchMonthlySchedule,
    updateShift,
    isTemporarySchedule
  } = useScheduleStore();

  const { nurseUsers, fetchUsers } = useUserStore();
  const { user } = useAuthStore();
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [scheduleData, setScheduleData] = useState([]);
  
  // 添加臨時日期狀態
  const [tempDate, setTempDate] = useState(null);
  
  // 編輯模式狀態
  const [isEditMode, setIsEditMode] = useState(false);
  
  // 標籤頁狀態
  const [activeTab, setActiveTab] = useState(0); // 0: 常規月班表, 1: 小夜班包班, 2: 大夜班包班
  
  // 確認對話框狀態
  const [openGenerateDialog, setOpenGenerateDialog] = useState(false);
  const [openSaveDialog, setOpenSaveDialog] = useState(false);
  
  // 新增對話框狀態
  const [openEmptyScheduleDialog, setOpenEmptyScheduleDialog] = useState(false);
  const [pendingDate, setPendingDate] = useState(null);
  
  // 添加快速編輯狀態管理
  const [quickEdit, setQuickEdit] = useState(null); // { nurseIndex, dayIndex, editing }
  const [focusedCell, setFocusedCell] = useState({ nurseIndex: null, dayIndex: null });
  const tableBoxRef = useRef(null);
  const [, forceRender] = useState({}); // 用於強制重新渲染的狀態
  
  // 強制重新渲染函數
  const forceUpdate = () => {
    forceRender({});
  };
  
  // 開啟/關閉對話框的函數
  const handleOpenGenerateDialog = () => setOpenGenerateDialog(true);
  const handleCloseGenerateDialog = () => setOpenGenerateDialog(false);
  const handleOpenSaveDialog = () => setOpenSaveDialog(true);
  const handleCloseSaveDialog = () => setOpenSaveDialog(false);
  
  // 處理標籤切換
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  // 檢查是否有編輯權限
  const hasEditPermission = useMemo(() => {
    return user?.role === 'head_nurse' || user?.role === 'admin';
  }, [user]);
  
  // 確保選擇的日期是有效的
  const selectedDate = useMemo(() => {
    console.log('MonthlySchedule - storeSelectedDate:', storeSelectedDate,
               'instanceof Date:', storeSelectedDate instanceof Date);
    try {
      return ensureValidDate(storeSelectedDate);
    } catch (error) {
      console.error('處理日期時出錯:', error);
      return new Date();
    }
  }, [storeSelectedDate]);

  // 初始化 - 載入用戶數據
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);
  
  // 獲取當前選擇月份的天數
  const daysInMonth = useMemo(() => {
    try {
      return getDaysInMonth(selectedDate);
    } catch (error) {
      console.error('獲取月份天數失敗:', error);
      return 30; // 默認返回30天
    }
  }, [selectedDate]);

  // 獲取當前月份格式化字符串
  const formattedDate = useMemo(() => {
    try {
      if (!isValid(selectedDate)) return '無效日期';
      return format(selectedDate, 'yyyy年MM月');
    } catch (error) {
      console.error('格式化日期失敗:', error);
      return '無效日期';
    }
  }, [selectedDate]);

  // 從store獲取排班數據並格式化
  useEffect(() => {
    console.log('MonthlySchedule - 收到儲存的排班數據:', storeMonthlySchedule);
    
    if (storeMonthlySchedule && Array.isArray(storeMonthlySchedule)) {
      console.log('處理陣列類型的排班數據，長度:', storeMonthlySchedule.length);
      setScheduleData(storeMonthlySchedule);
    } else {
      console.log('排班數據不是陣列或為空，嘗試從其他結構解析');
      
      try {
        // 嘗試獲取巢狀結構中的數據
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth() + 1;
        
        if (storeMonthlySchedule && 
            storeMonthlySchedule[year] && 
            storeMonthlySchedule[year][month] && 
            storeMonthlySchedule[year][month].schedule) {
          
          const extractedData = storeMonthlySchedule[year][month].schedule;
          console.log('從嵌套結構中提取的排班數據:', extractedData);
          setScheduleData(extractedData);
        } else {
          console.log('無法從嵌套結構中提取數據，設置為空數組');
          setScheduleData([]);
        }
      } catch (err) {
        console.error('解析排班數據出錯:', err);
        setScheduleData([]);
      }
    }
  }, [storeMonthlySchedule, selectedDate]);

  // 獲取星期幾名稱
  const getDayName = (day) => {
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    return dayNames[day] || '?';
  };

  // 獲取班次顏色類名
  const getShiftClass = (shift) => {
    return `shift-${shift.toLowerCase()}`;
  };

  // 護理長置頂並設定特殊班表
  const sortedMonthlySchedule = useMemo(() => {
    if (!scheduleData.length) return [];
    
    // 複製一份避免直接修改原數據
    let sorted = [...scheduleData];
    
    // 根據當前標籤過濾數據
    if (activeTab === 0) {
      // 常規月班表: 過濾掉待分派或夜班人員 (SNP 或 LNP)
      sorted = sorted.filter(nurse => {
        // 首先檢查是否有special_type屬性（由更新包班人員按鈕設置）
        if (nurse.special_type === 'SNP' || nurse.special_type === 'LNP') {
          return false; // 過濾掉有特殊類型標記的護理師
        }
        
        // 如果沒有special_type，再檢查nurse自身的group_data
        if (nurse.group_data) {
          try {
            const groupData = JSON.parse(nurse.group_data);
            // 如果 groupData 是數組且第二個元素是 'SNP' 或 'LNP'，則過濾掉
            if (Array.isArray(groupData) && (groupData[1] === 'SNP' || groupData[1] === 'LNP')) {
              return false;
            }
          } catch (e) {
            // 解析失敗則繼續檢查
            console.warn(`護理師 ${nurse.name || nurse.id} 的group_data解析失敗:`, e);
          }
        }
        
        // 如果nurse自身沒有group_data或解析失敗，嘗試從nurseUsers中查找
        const userFromStore = nurseUsers.find(u => u.id === nurse.id);
        if (userFromStore && userFromStore.group_data) {
          try {
            const groupData = JSON.parse(userFromStore.group_data);
            // 如果 groupData 是數組且第二個元素是 'SNP' 或 'LNP'，則過濾掉
            if (Array.isArray(groupData) && (groupData[1] === 'SNP' || groupData[1] === 'LNP')) {
              return false;
            }
          } catch (e) {
            // 解析失敗則保留該護理師
            console.warn(`nurseUsers中護理師 ${userFromStore.name || userFromStore.id} 的group_data解析失敗:`, e);
          }
        }
        
        // 默認保留該護理師
        return true;
      });
    } else if (activeTab === 1) {
      // 小夜班包班: 只顯示 SNP 的護理師
      sorted = sorted.filter(nurse => {
        // 首先檢查是否有special_type屬性
        if (nurse.special_type === 'SNP') {
          return true; // 保留小夜班特殊類型的護理師
        }
        
        // 如果沒有special_type，再檢查nurse自身的group_data
        if (nurse.group_data) {
          try {
            const groupData = JSON.parse(nurse.group_data);
            // 如果 groupData 是數組且第二個元素是 'SNP'，則保留
            if (Array.isArray(groupData) && groupData[1] === 'SNP') {
              return true;
            }
          } catch (e) {
            // 解析失敗繼續檢查
            console.warn(`護理師 ${nurse.name || nurse.id} 的group_data解析失敗:`, e);
          }
        }
        
        // 嘗試從nurseUsers中查找
        const userFromStore = nurseUsers.find(u => u.id === nurse.id);
        if (userFromStore && userFromStore.group_data) {
          try {
            const groupData = JSON.parse(userFromStore.group_data);
            // 如果 groupData 是數組且第二個元素是 'SNP'，則保留
            if (Array.isArray(groupData) && groupData[1] === 'SNP') {
              return true;
            }
          } catch (e) {
            console.warn(`nurseUsers中護理師 ${userFromStore.name || userFromStore.id} 的group_data解析失敗:`, e);
          }
        }
        
        // 默認過濾掉不是SNP的護理師
        return false;
      });
    } else if (activeTab === 2) {
      // 大夜班包班: 只顯示 LNP 的護理師
      sorted = sorted.filter(nurse => {
        // 首先檢查是否有special_type屬性
        if (nurse.special_type === 'LNP') {
          return true; // 保留大夜班特殊類型的護理師
        }
        
        // 如果沒有special_type，再檢查nurse自身的group_data
        if (nurse.group_data) {
          try {
            const groupData = JSON.parse(nurse.group_data);
            // 如果 groupData 是數組且第二個元素是 'LNP'，則保留
            if (Array.isArray(groupData) && groupData[1] === 'LNP') {
              return true;
            }
          } catch (e) {
            // 解析失敗繼續檢查
            console.warn(`護理師 ${nurse.name || nurse.id} 的group_data解析失敗:`, e);
          }
        }
        
        // 嘗試從nurseUsers中查找
        const userFromStore = nurseUsers.find(u => u.id === nurse.id);
        if (userFromStore && userFromStore.group_data) {
          try {
            const groupData = JSON.parse(userFromStore.group_data);
            // 如果 groupData 是數組且第二個元素是 'LNP'，則保留
            if (Array.isArray(groupData) && groupData[1] === 'LNP') {
              return true;
            }
          } catch (e) {
            console.warn(`nurseUsers中護理師 ${userFromStore.name || userFromStore.id} 的group_data解析失敗:`, e);
          }
        }
        
        // 默認過濾掉不是LNP的護理師
        return false;
      });
    }
    
    // 從userStore獲取用戶排序信息
    const userStore = useUserStore.getState();
    const userOrder = userStore.userOrder || {};
    
    // 列出所有用戶資料
    console.log('排班前用戶資料:', sorted.map(n => `${n.full_name || n.name || '未知'}(id:${n.id},role:${n.role},identity:${n.identity})`));
    
    // 按身份分組
    const nursesByIdentity = {};
    const unknownIdentity = [];
    
    // 將護理師按身份分組
    sorted.forEach(nurse => {
      if (nurse.identity) {
        if (!nursesByIdentity[nurse.identity]) {
          nursesByIdentity[nurse.identity] = [];
        }
        nursesByIdentity[nurse.identity].push(nurse);
      } else {
        unknownIdentity.push(nurse);
      }
    });
    
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
    
    // 對每個身份組的護理師進行排序
    Object.keys(nursesByIdentity).forEach(identity => {
      const orderIds = userOrder[identity] || [];
      
      if (orderIds.length > 0) {
        // 如果有保存的排序，按排序順序排列
        nursesByIdentity[identity].sort((a, b) => {
          const indexA = orderIds.indexOf(a.id);
          const indexB = orderIds.indexOf(b.id);
          
          // 如果ID不在排序列表中，放在最後
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          
          return indexA - indexB;
        });
      } else {
        // 如果沒有保存的排序，按姓名排序
        nursesByIdentity[identity].sort((a, b) => 
          (a.name || '').localeCompare(b.name || '')
        );
      }
    });
    
    // 按身份權重合併所有組
    const result = [];
    
    // 獲取排序後的身份列表
    const sortedIdentities = Object.keys(nursesByIdentity).sort(
      (a, b) => getIdentityWeight(a) - getIdentityWeight(b)
    );
    
    // 按順序添加各身份的護理師
    sortedIdentities.forEach(identity => {
      result.push(...nursesByIdentity[identity]);
    });
    
    // 添加未知身份的護理師
    result.push(...unknownIdentity);
    
    console.log('月班表護理師排序後:', result.map(n => `${n.full_name || n.name || '未知'}(id:${n.id},role:${n.role})`));
    
    // 處理空的shifts數組
    return result.map(nurse => {
      // 確保shifts存在並且有效
      if (!nurse.shifts || !Array.isArray(nurse.shifts) || nurse.shifts.length === 0) {
        return {
          ...nurse,
          shifts: Array(daysInMonth).fill('O') // 使用字符串'O'而非對象
        };
      }
      
      // 確保shifts長度與當月天數一致
      if (nurse.shifts.length < daysInMonth) {
        const newShifts = [...nurse.shifts];
        while (newShifts.length < daysInMonth) {
          newShifts.push('O');
        }
        return {
          ...nurse,
          shifts: newShifts
        };
      }
      
      return nurse;
    });
  }, [scheduleData, daysInMonth, nurseUsers, activeTab]);

  // 切換班次
  const toggleShift = (nurseIndex, dayIndex, specificShift = null) => {
    // 檢查編輯權限和編輯模式
    if (!hasEditPermission || !isEditMode || isLoading) return; 
    
    const nurse = sortedMonthlySchedule[nurseIndex];
    if (!nurse || !nurse.shifts || nurse.shifts[dayIndex] === undefined) {
      console.error('無效的護士或班次數據');
      return;
    }

    // 確保日期正確性
    const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), dayIndex + 1);
    console.log('切換班次 - 前端日期:', currentDate.toISOString(), '年:', selectedDate.getFullYear(), 
                '月:', selectedDate.getMonth(), '日索引:', dayIndex, '實際天數:', dayIndex + 1);

    // 根據護理師身份確定可用的班次類型
    const identity = nurse.identity;
    let shiftTypes = [];
    
    // 根據身份設定可用班次
    if (identity === '麻醉專科護理師') {
      shiftTypes = ['D', 'A', 'N', 'O', 'V', 'R']; // 白班、小夜班、大夜班、休假
    } else if (identity === '恢復室護理師') {
      shiftTypes = ['A', 'K', 'C', 'F', 'O', 'V', 'R']; // 小夜班、早班、中班、晚班、休假
    } else if (identity === '麻醉科Leader') {
      shiftTypes = ['A', 'E', 'O', 'V', 'R']; // 小夜班、半班、休假
    } else if (identity === '麻醉科書記') {
      shiftTypes = ['B', 'E', 'O', 'V', 'R']; // 日班、半班、休假
    } else {
      // 默認班次類型（所有可能的班次）
      shiftTypes = ['D', 'A', 'N', 'O', 'K', 'C', 'F', 'E', 'B', 'V', 'R'];
    }
    
    // 獲取當前班次
    const currentShift = nurse.shifts[dayIndex] || 'O';
    let newShift;
    
    if (specificShift && shiftTypes.includes(specificShift)) {
      // 如果提供了特定班次，直接使用
      newShift = specificShift;
    } else {
      // 否則循環切換班次
      const currentShiftIndex = shiftTypes.indexOf(currentShift);
      // 如果找不到當前班次，從第一個班次開始
      const nextShiftIndex = (currentShiftIndex === -1) ? 0 : (currentShiftIndex + 1) % shiftTypes.length;
      newShift = shiftTypes[nextShiftIndex];
    }
    
    // 找出在原始數據中的索引位置
    const originalIndex = scheduleData.findIndex(n => n.id === nurse.id);
    if (originalIndex === -1) {
      console.error('找不到對應的護理師ID:', nurse.id);
      return;
    }
    
    // 更新本地狀態
    const newScheduleData = [...scheduleData];
    newScheduleData[originalIndex].shifts[dayIndex] = newShift;
    setScheduleData(newScheduleData);
    
    // 通知store更新
    updateShift({ nurseIndex: originalIndex, dayIndex, newShift });
    
    console.log(`更新護理師 ${nurse.name} (ID: ${nurse.id}, 索引: ${originalIndex}, 身份: ${identity}) 的第 ${dayIndex+1} 天班次為 ${newShift}`);
  };

  // 切換編輯模式
  const toggleEditMode = () => {
    if (isEditMode) {
      // 保存模式下，顯示確認對話框
      handleOpenSaveDialog();
    } else {
      // 進入編輯模式
      setIsEditMode(true);
    }
  };

  // 處理保存後的操作
  const handleAfterSave = () => {
    setIsEditMode(false);
  };

  // 統計特定班次數量
  const countShifts = (shifts, type) => {
    if (!shifts || !Array.isArray(shifts)) {
      return 0;
    }
    return shifts.filter(shift => shift === type).length;
  };

  // 計算總工時
  const calculateTotalHours = (shifts) => {
    if (!shifts || !Array.isArray(shifts)) {
      return 0;
    }
    const hourMapping = { 'D': 10, 'A': 8, 'N': 8, 'O': 0, 'V': 0, 'R': 0, 'K': 8, 'C': 8, 'F': 8, 'E': 4, 'B': 8 };
    return shifts.reduce((total, shift) => {
      return total + (hourMapping[shift] || 0);
    }, 0);
  };

  // 獲取班次時間
  const getShiftTime = (shift) => {
    const shiftTimes = {
      'A': '8-16',
      'B': '8-17',
      'N': '14-22',
      'D': '22-08',
      'E': '8-12',
      'K': '9-17',
      'C': '10-18',
      'F': '12-20',
      'O': 'OFF',
      'V': 'OFF',
      'R': 'REPO'
    };
    return shiftTimes[shift] || shift;
  };

  // 統計每日各班次數量
  const countDailyShifts = (day, type) => {
    if (!scheduleData || !Array.isArray(scheduleData)) {
      return 0;
    }
    return scheduleData
      .filter(nurse => 
        nurse && 
        nurse.shifts && 
        nurse.shifts[day] === type
      )
      .length;
  };

  // 生成PDF
  const generatePDF = async () => {
    const element = document.getElementById('monthly-schedule');
    
    if (!element) return;
    
    try {
      // 隱藏不需要在PDF中顯示的元素
      const hideElements = element.querySelectorAll('.hide-for-pdf');
      hideElements.forEach(el => {
        el.style.display = 'none';
      });
      
      // 調整標題格式
      const titleElement = element.querySelector('h4');
      const originalTitle = titleElement.innerText;
      const originalTitleStyle = titleElement.style.cssText;
      
      titleElement.innerText = `恩主公麻醉科護理人員${formattedDate}班表`;
      titleElement.style.textAlign = 'center';
      titleElement.style.fontSize = '24px';
      titleElement.style.marginBottom = '20px';
      titleElement.style.width = '100%';
      
      // 調整表格字體大小
      const table = element.querySelector('table');
      const originalFontSize = window.getComputedStyle(table).fontSize;
      table.style.fontSize = '8px';
      
      // 生成PDF
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = canvas.height * imgWidth / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
      pdf.save(`${formattedDate}班表.pdf`);
      
      // 恢復原始顯示
      hideElements.forEach(el => {
        el.style.display = '';
      });
      
      titleElement.innerText = originalTitle;
      titleElement.style.cssText = originalTitleStyle;
      table.style.fontSize = originalFontSize;
      
      setSuccess('PDF已生成');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('生成PDF失敗:', error);
    }
  };

  // 處理班表生成功能
  const handleGenerateSchedule = async () => {
    try {
      handleCloseGenerateDialog(); // 關閉確認對話框
      setError(null); // 清除之前的錯誤
      const response = await generateMonthlySchedule();
      
      // 如果 response 是數組，直接更新本地狀態
      if (Array.isArray(response)) {
        setScheduleData(response);
      } 
      // 如果 response 是嵌套結構，提取 schedule 數組
      else if (response && typeof response === 'object') {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth() + 1;
        
        if (response[year] && 
            response[year][month] && 
            response[year][month].schedule) {
          
          const extractedData = response[year][month].schedule;
          console.log('生成班表成功，提取的排班數據:', extractedData);
          setScheduleData(extractedData);
        }
      }
      
      setSuccess('月班表已生成並顯示（尚未儲存）');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('生成月班表失敗:', error);
      // 避免直接渲染錯誤對象，而是顯示錯誤信息字串
      let errorMessage = '生成月班表失敗，請稍後重試';
      
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error.message === 'string') {
        errorMessage = error.message;
      } else if (error && error.data && typeof error.data.message === 'string') {
        errorMessage = error.data.message;
      }
      
      setError(errorMessage);
      setTimeout(() => setError(null), 5000);
    }
  };

  // 處理保存月班表
  const handleSaveSchedule = async () => {
    try {
      handleCloseSaveDialog(); // 關閉確認對話框
      await saveMonthlySchedule();
      handleAfterSave(); // 處理保存後的操作
    } catch (error) {
      console.error('保存月班表失敗:', error);
      // 避免直接渲染錯誤對象，而是顯示錯誤信息字串
      let errorMessage = '保存月班表失敗，請稍後重試';
      
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error.message === 'string') {
        errorMessage = error.message;
      } else if (error && error.data && typeof error.data.message === 'string') {
        errorMessage = error.data.message;
      }
      
      setError(errorMessage);
      setTimeout(() => setError(null), 5000);
    }
  };

  // 處理日期變更
  const handleDateChange = (newDate) => {
    if (newDate && newDate instanceof Date && !isNaN(newDate.getTime())) {
      // 只更新臨時日期，不觸發API調用
      setTempDate(newDate);
    } else {
      console.error('嘗試設置無效的日期:', newDate);
      setTempDate(new Date());
    }
  };
  
  // 處理日期確認
  const handleDateAccept = () => {
    if (tempDate && tempDate instanceof Date && !isNaN(tempDate.getTime())) {
      // 在確認按鈕點擊後更新實際日期，觸發API調用
      updateSelectedDate(tempDate);
    }
  };

  // 開啟/關閉空白班表確認對話框
  const handleOpenEmptyScheduleDialog = () => setOpenEmptyScheduleDialog(true);
  const handleCloseEmptyScheduleDialog = () => {
    setOpenEmptyScheduleDialog(false);
  };

  // 處理空白班表對話框取消操作
  const handleEmptyScheduleCancel = () => {
    // 關閉對話框
    setOpenEmptyScheduleDialog(false);
    // 清空選擇的日期防止重複彈窗
    setPendingDate(null);
    
    // 可以在這裡加入其他取消操作的邏輯
    setError('未創建空白班表，請選擇其他日期或點擊"帶入排班公式"按鈕');
    setTimeout(() => setError(null), 3000);
  };

  // 修改日期變更時獲取班表的邏輯
  useEffect(() => {
    if (isValid(selectedDate)) {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;
      
      console.log('日期變更後獲取班表:', year, month);
      
      // 呼叫API獲取班表
      const getSchedule = async () => {
        try {
          await fetchMonthlySchedule();
          
          // 直接在這裡檢查store中的數據，而不是本地的scheduleData
          const storeSchedule = useScheduleStore.getState().monthlySchedule;
          
          if (!storeSchedule || storeSchedule.length === 0) {
            // 如果是空的，詢問用戶是否創建空白班表
            setPendingDate(selectedDate);
            handleOpenEmptyScheduleDialog();
          }
        } catch (error) {
          console.error('獲取班表失敗:', error);
          // 即使失敗，也詢問用戶是否創建空白班表
          setPendingDate(selectedDate);
          handleOpenEmptyScheduleDialog();
        }
      };
      
      getSchedule();
    }
  }, [selectedDate, fetchMonthlySchedule]);

  // 生成空白班表的函數
  const generateEmptySchedule = async () => {
    try {
      // 關閉確認對話框
      handleCloseEmptyScheduleDialog();
      
      setError(null);
      
      // 獲取當前已知的護理師資料
      const nurses = nurseUsers;
      if (!nurses || nurses.length === 0) {
        setError('無法生成空白班表：找不到護理師資料');
        return;
      }
      
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;
      const daysInSelectedMonth = getDaysInMonth(selectedDate);
      
      // 生成空白班表
      const emptySchedule = nurses.map(nurse => ({
        id: nurse.id,
        name: nurse.full_name || nurse.name || `護理師 ${nurse.id}`,
        role: nurse.role || 'nurse',
        identity: nurse.identity || '',
        group_data: nurse.group_data || '',
        shifts: Array(daysInSelectedMonth).fill('O'),
        area_codes: Array(daysInSelectedMonth).fill(null)
      }));
      
      // 更新本地狀態
      setScheduleData(emptySchedule);
      
      // 設置為臨時班表 - 使用正確的方式更新store
      // 重要：同時清除error狀態，避免錯誤提示持續顯示
      useScheduleStore.setState({ 
        monthlySchedule: emptySchedule,
        isTemporarySchedule: true,
        error: null // 清除錯誤狀態
      });
      
      setSuccess(`已為 ${year}年${month}月 生成空白班表（尚未儲存）`);
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (error) {
      console.error('生成空白班表失敗:', error);
      setError('生成空白班表失敗: ' + (error.message || String(error)));
      setTimeout(() => setError(null), 5000);
    }
  };

  // 處理鍵盤輸入班別
  const handleKeyDown = (e) => {
    if (!hasEditPermission || !isEditMode || isLoading) return;
    
    // 快速填寫模式
    if (quickEdit && quickEdit.editing && quickEdit.nurseIndex != null && quickEdit.dayIndex != null) {
      // 獲取護理師身份，確定可用班次
      const nurse = sortedMonthlySchedule[quickEdit.nurseIndex];
      if (!nurse) return;
      
      const identity = nurse.identity;
      let allowedShifts = [];
      
      // 根據身份設定可用班次
      if (identity === '麻醉專科護理師') {
        allowedShifts = ['D', 'A', 'N', 'O', 'V', 'R'];
      } else if (identity === '恢復室護理師') {
        allowedShifts = ['A', 'K', 'C', 'F', 'O', 'V', 'R'];
      } else if (identity === '麻醉科Leader') {
        allowedShifts = ['A', 'E', 'O', 'V', 'R'];
      } else if (identity === '麻醉科書記') {
        allowedShifts = ['B', 'E', 'O', 'V', 'R'];
      } else {
        allowedShifts = ['D', 'A', 'N', 'O', 'K', 'C', 'F', 'E', 'B', 'V', 'R'];
      }
      
      const key = e.key.toUpperCase();
      const daysInSelectedMonth = daysInMonth;
      
      // 處理方向鍵
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        
        // 計算新的dayIndex和nurseIndex
        let newDayIndex = quickEdit.dayIndex;
        let newNurseIndex = quickEdit.nurseIndex;
        
        if (e.key === 'ArrowLeft') {
          newDayIndex = Math.max(0, quickEdit.dayIndex - 1);
        } else if (e.key === 'ArrowRight') {
          newDayIndex = Math.min(daysInSelectedMonth - 1, quickEdit.dayIndex + 1);
        } else if (e.key === 'ArrowUp') {
          newNurseIndex = Math.max(0, quickEdit.nurseIndex - 1);
        } else if (e.key === 'ArrowDown') {
          newNurseIndex = Math.min(sortedMonthlySchedule.length - 1, quickEdit.nurseIndex + 1);
        }
        
        // 更新quickEdit狀態
        setQuickEdit({
          ...quickEdit,
          dayIndex: newDayIndex,
          nurseIndex: newNurseIndex
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
        
        // 更新班表數據
        toggleShift(quickEdit.nurseIndex, quickEdit.dayIndex, key);
        
        // 游標自動跳到下一格
        if (quickEdit.dayIndex < daysInSelectedMonth - 1) {
          setQuickEdit({ ...quickEdit, dayIndex: quickEdit.dayIndex + 1 });
        } else {
          // 如果是最後一格，檢查是否有下一位護理師
          if (quickEdit.nurseIndex < sortedMonthlySchedule.length - 1) {
            // 跳到下一位護理師的第一格
            setQuickEdit({ 
              nurseIndex: quickEdit.nurseIndex + 1, 
              dayIndex: 0, 
              editing: true 
            });
          } else {
            // 已經是最後一位護理師的最後一格，退出編輯模式
            setQuickEdit(null);
            forceUpdate();
          }
        }
        return;
      }
    }
    
    // 一般的單格編輯模式
    if (!focusedCell || focusedCell.nurseIndex == null || focusedCell.dayIndex == null) return;
    
    // 獲取護理師身份，確定可用班次
    const nurse = sortedMonthlySchedule[focusedCell.nurseIndex];
    if (!nurse) return;
    
    const identity = nurse.identity;
    let allowedShifts = [];
    
    // 根據身份設定可用班次
    if (identity === '麻醉專科護理師') {
      allowedShifts = ['D', 'A', 'N', 'O', 'V', 'R'];
    } else if (identity === '恢復室護理師') {
      allowedShifts = ['A', 'K', 'C', 'F', 'O', 'V', 'R'];
    } else if (identity === '麻醉科Leader') {
      allowedShifts = ['A', 'E', 'O', 'V', 'R'];
    } else if (identity === '麻醉科書記') {
      allowedShifts = ['B', 'E', 'O', 'V', 'R'];
    } else {
      allowedShifts = ['D', 'A', 'N', 'O', 'K', 'C', 'F', 'E', 'B', 'V', 'R'];
    }
    
    const key = e.key.toUpperCase();
    
    // 只有當輸入有效班別時才阻止默認行為
    if (allowedShifts.includes(key)) {
      e.preventDefault();
      // 使用指定的班別更新
      toggleShift(focusedCell.nurseIndex, focusedCell.dayIndex, key);
    }
  };

  // 在組件中添加新的函數，用於更新包班人員
  const handleUpdateNurseCategories = async () => {
    try {
      // 設置加載狀態 - 使用 store 的方法而不是 setIsLoading
      useScheduleStore.setState({ isLoading: true, error: null });
      setError(null);

      // 1. 使用API獲取最新的公式班表設定
      const authStorage = localStorage.getItem('auth-storage');
      let token = null;
      if (authStorage) {
        const { state } = JSON.parse(authStorage);
        token = state.token;
      }
      
      if (!token) {
        setError('未找到認證令牌，請先登入');
        useScheduleStore.setState({ isLoading: false });
        return;
      }
      
      // 並行發送兩個請求
      const [formulaSchedulesRes, usersRes] = await Promise.all([
        // 獲取公式班表設定
        fetch('/api/formula-schedules/?include_patterns=true&include_assignments=true', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        // 獲取所有用戶
        fetch('/api/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (!formulaSchedulesRes.ok || !usersRes.ok) {
        throw new Error('獲取數據失敗');
      }
      
      const formulaSchedules = await formulaSchedulesRes.json();
      const users = await usersRes.json();

      // 2. 根據公式班表設定更新當前班表中護理師的分類
      // 從原始班表複製一份，準備修改
      const updatedScheduleData = [...scheduleData];

      // 遍歷所有護理師，更新其分類標記
      for (const nurse of updatedScheduleData) {
        // 在users中查找該護理師
        const userInfo = users.find(u => u.id === nurse.id);
        
        if (userInfo && userInfo.group_data) {
          try {
            // 解析group_data數據
            const groupData = JSON.parse(userInfo.group_data);
            
            if (Array.isArray(groupData) && groupData.length >= 2) {
              const groupId = groupData[1];
              
              // 不修改nurse.group_data，只設置臨時標記
              // 如果是小夜包班(SNP)或大夜包班(LNP)，設置相應標記
              if (groupId === 'SNP' || groupId === 'LNP') {
                nurse.special_type = groupId;
              } else {
                // 如果是常規組別或待分配，清除special_type
                nurse.special_type = null;
              }
            }
          } catch (e) {
            console.error(`解析護理師 ${nurse.name} 的group_data出錯:`, e);
          }
        }
      }
      
      // 3. 更新本地狀態並設置為臨時更改（尚未儲存）
      setScheduleData(updatedScheduleData);
      useScheduleStore.setState({
        monthlySchedule: updatedScheduleData,
        isTemporarySchedule: true,
        isLoading: false
      });
      
      setSuccess('已從公式班表更新護理師分類，請記得儲存班表以保存更改');
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (error) {
      console.error('更新護理師分類失敗:', error);
      setError('更新護理師分類失敗: ' + (error.message || '未知錯誤'));
      setTimeout(() => setError(null), 5000);
      // 恢復加載狀態
      useScheduleStore.setState({ isLoading: false });
    }
  };

  return (
    <Box sx={{ padding: 1 }} id="monthly-schedule">
      <Typography variant="h4" gutterBottom sx={{ mb: 1 }}>
        {formattedDate}工作表
      </Typography>
      
      {/* 標籤頁導航 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          textColor="primary"
          indicatorColor="primary"
          aria-label="月班表類型標籤"
        >
          <StyledTab label="常規月班表" />
          <StyledTab label="小夜班包班" />
          <StyledTab label="大夜班包班" />
        </Tabs>
      </Box>
      
      <Box className="hide-for-pdf" sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
          <DatePicker
            views={['year', 'month']}
            label="選擇年月"
            minDate={new Date('2020-01-01')}
            maxDate={new Date('2030-12-31')}
            value={selectedDate}
            onChange={handleDateChange}
            onAccept={handleDateAccept}
            sx={{ width: 200 }}
            openTo="month"
            closeOnSelect={false}
            slotProps={{
              actionBar: {
                actions: ['cancel', 'accept'],
              },
              toolbar: {
                hidden: false,
              },
            }}
          />
        </LocalizationProvider>
        
        {hasEditPermission && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {/* 只在編輯模式下顯示相關按鈕，且只在常規月班表標籤顯示 */}
            {isEditMode && activeTab === 0 && (
              <>
                <Button 
                  variant="contained" 
                  color="secondary"
                  onClick={handleUpdateNurseCategories}
                  disabled={isLoading}
                  title="從公式班表更新護理師分類"
                >
                  更新包班人員
                </Button>
                <Button 
                  variant="contained" 
                  color="primary"
                  onClick={handleOpenGenerateDialog}
                  disabled={isLoading}
                >
                  帶入排班公式
                </Button>
              </>
            )}
            
            {/* 生成PDF按鈕始終顯示 */}
            <Button 
              variant="contained" 
              color="warning"
              onClick={generatePDF}
              disabled={!scheduleData.length}
            >
              生成 PDF
            </Button>
            
            {/* 編輯/儲存按鈕 */}
            <Button 
              variant="contained" 
              color={isEditMode ? "success" : "info"}
              onClick={toggleEditMode}
              disabled={isLoading || !scheduleData.length}
              startIcon={isEditMode ? <SaveIcon /> : <EditIcon />}
            >
              {isEditMode ? '儲存班表' : '編輯'}
            </Button>
          </Box>
        )}
      </Box>
      
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
          <CircularProgress />
        </Box>
      )}
      
      {/* 顯示臨時班表提示 */}
      {isTemporarySchedule && scheduleData.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          當前顯示的是臨時生成的班表，尚未儲存到資料庫。若要永久保存此班表，請點擊「儲存班表」按鈕。
        </Alert>
      )}
      
      {/* 只有在非臨時班表狀態下才顯示資料庫查詢錯誤 */}
      {storeError && !isTemporarySchedule && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {typeof storeError === 'string' ? storeError : 
           (storeError?.message || '操作過程中發生錯誤')}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {typeof error === 'string' ? error : 
           (error?.message || '操作過程中發生錯誤')}
        </Alert>
      )}
      
      {sortedMonthlySchedule.length > 0 ? (
        <TableContainer 
          component={Paper} 
          sx={{ 
            overflowX: 'auto', 
            padding: 0,
            width: '100%',
            '& .MuiPaper-root': {
              boxShadow: 'none'
            }
          }}
        >
          <Box 
            ref={tableBoxRef} 
            onKeyDown={handleKeyDown}
            tabIndex={0} // 確保可以接收focus事件
            sx={{ outline: 'none' }} // 隱藏focus外框
          >
            <Table sx={{ 
              minWidth: 650, 
              width: '100%',
              tableLayout: 'fixed',
              '& .MuiTableCell-root': {
                borderLeft: '1px solid rgba(224, 224, 224, 0.3)',
                borderRight: '1px solid rgba(224, 224, 224, 0.3)',
                borderTop: '1px solid rgba(224, 224, 224, 0.3)',
                borderBottom: '1px solid rgba(224, 224, 224, 0.3)',
              }
            }} 
            size="small"
            stickyHeader
            >
              <TableHead>
                <TableRow>
                  <TableCell width="80px" align="center">姓名</TableCell>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                    try {
                      const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
                      const weekday = isValid(date) ? getDay(date) : 0;
                      return (
                        <TableCell 
                          key={day} 
                          align="center" 
                          padding="none" 
                          sx={{ 
                            minWidth: '30px',
                            fontSize: '12px',
                            bgcolor: '#f5f5f5',
                            fontWeight: 'bold'
                          }}
                        >
                          {day}<br />
                          {getDayName(weekday)}
                        </TableCell>
                      );
                    } catch (error) {
                      console.error(`渲染日期 ${day} 時出錯:`, error);
                      return (
                        <TableCell 
                          key={day} 
                          align="center" 
                          padding="none" 
                          sx={{ 
                            minWidth: '30px',
                            fontSize: '12px',
                            bgcolor: '#f5f5f5',
                            fontWeight: 'bold'
                          }}
                        >
                          {day}<br />?
                        </TableCell>
                      );
                    }
                  })}
                  <TableCell align="center" width="40px" sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>D</TableCell>
                  <TableCell align="center" width="40px" sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>V</TableCell>
                  <TableCell 
                    align="center" 
                    width="60px" 
                    sx={{ 
                      whiteSpace: 'nowrap', 
                      bgcolor: '#f5f5f5', 
                      fontWeight: 'bold',
                      writingMode: 'horizontal-tb',
                      textAlign: 'center',
                      padding: '6px 2px'
                    }}
                  >
                    總時數
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedMonthlySchedule.map((nurse, nurseIndex) => (
                  <TableRow key={nurse.id}>
                    <TableCell 
                      component="th" 
                      scope="row" 
                      sx={{ 
                        whiteSpace: 'nowrap', 
                        padding: '6px',
                        // 當該護理師處於quickEdit模式時添加高亮
                        backgroundColor: (quickEdit && quickEdit.editing && quickEdit.nurseIndex === nurseIndex) 
                          ? '#f0f7ff' 
                          : 'inherit'
                      }} 
                      align="center"
                      onClick={() => {
                        if (hasEditPermission && isEditMode) {
                          // 點擊姓名時進入快速編輯模式並設置焦點到第一天
                          setQuickEdit({ nurseIndex, dayIndex: 0, editing: true });
                          // 設置焦點
                          tableBoxRef.current?.focus();
                        }
                      }}
                    >
                      {nurse.name}
                    </TableCell>
                    {nurse.shifts.map((shift, dayIndex) => (
                      <ShiftCell
                        key={dayIndex}
                        shift={shift || 'O'}
                        onClick={() => {
                          if (hasEditPermission && isEditMode) {
                            // 點擊單元格時設置焦點
                            setFocusedCell({ nurseIndex, dayIndex });
                            tableBoxRef.current?.focus();
                            // 標準點擊切換班次
                            toggleShift(nurseIndex, dayIndex);
                          }
                        }}
                        padding="none"
                        style={{ 
                          cursor: hasEditPermission && isEditMode ? 'pointer' : 'default',
                          // 當該單元格處於quickEdit模式時添加高亮邊框
                          outline: (quickEdit && quickEdit.editing && quickEdit.nurseIndex === nurseIndex && quickEdit.dayIndex === dayIndex) 
                            ? '2px solid #1976d2' 
                            : 'none',
                          transition: 'outline 0.2s ease, background-color 0.3s'
                        }}
                      >
                        {shift || 'O'}
                      </ShiftCell>
                    ))}
                    <TableCell align="center" padding="none">{countShifts(nurse.shifts, 'D')}</TableCell>
                    <TableCell align="center" padding="none">{countShifts(nurse.shifts, 'V')}</TableCell>
                    <TableCell align="center" padding="none">{calculateTotalHours(nurse.shifts)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableBody>
                {['A', 'E', 'N', 'D'].map(shiftType => (
                  <TableRow key={shiftType}>
                    <TableCell padding="none" sx={{ paddingLeft: '6px' }} align="center">{shiftType}</TableCell>
                    {Array.from({ length: daysInMonth }, (_, i) => i).map(day => (
                      <TableCell key={day} align="center" padding="none">
                        {countDailyShifts(day, shiftType)}
                      </TableCell>
                    ))}
                    <TableCell colSpan={3} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </TableContainer>
      ) : !isLoading && (
        <Paper sx={{ padding: 3, marginTop: 2 }}>
          <Typography variant="body1" align="center">
            {activeTab === 0 ? '尚未生成班表，請點擊"生成月班表"按鈕' : '目前沒有此類型護理師的班表數據'}
          </Typography>
        </Paper>
      )}
      
      <Box className="hide-for-pdf" sx={{ mt: 3 }}>
        <Paper sx={{ padding: 2 }}>
          <Typography variant="h6" gutterBottom>
            班次說明
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#a08887' }} />
              <Typography variant="body2">D: 22-08 (10h)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#d9d06e' }} />
              <Typography variant="body2">A: 8-16 (8h)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#8387da' }} />
              <Typography variant="body2">N: 14-22 (8h)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#8AA6C1' }} />
              <Typography variant="body2">K: 9-17 (8h)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#67dcbd' }} />
              <Typography variant="body2">C: 10-18 (8h)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#FFA07A' }} />
              <Typography variant="body2">F: 12-20 (8h)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#FFB6C1' }} />
              <Typography variant="body2">E: 8-12 (4h)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#FFDAB9' }} />
              <Typography variant="body2">B: 8-17 (8h)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#FFFFFF', border: '1px solid #ddd' }} />
              <Typography variant="body2">O: OFF (0h)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#e0755f', border: '1px solid #ddd' }} />
              <Typography variant="body2">V: VACA (0h)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, backgroundColor: '#a9c4ce', border: '1px solid #ddd' }} />
              <Typography variant="body2">R: REPO (0h)</Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
      
      {/* 生成月班表確認對話框 */}
      <Dialog
        open={openGenerateDialog}
        onClose={handleCloseGenerateDialog}
        aria-labelledby="generate-dialog-title"
        aria-describedby="generate-dialog-description"
      >
        <DialogTitle id="generate-dialog-title">
          確認帶入排班公式
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="generate-dialog-description">
            您即將為 {formattedDate} 帶入公式排班。這個操作會依據公式班生成新的班表，但不會覆蓋資料庫中已存在的班表，直到您點擊「儲存班表」按鈕。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseGenerateDialog}>
            取消
          </Button>
          <Button onClick={handleGenerateSchedule} color="primary" autoFocus>
            確認帶入
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 儲存班表確認對話框 */}
      <Dialog
        open={openSaveDialog}
        onClose={handleCloseSaveDialog}
        aria-labelledby="save-dialog-title"
        aria-describedby="save-dialog-description"
      >
        <DialogTitle id="save-dialog-title">
          確認儲存班表
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="save-dialog-description">
            您即將儲存 {formattedDate} 的排班表到資料庫。這個操作會覆蓋資料庫中已存在的班表版本。確定要儲存嗎？
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSaveDialog} color="primary">
            取消
          </Button>
          <Button onClick={handleSaveSchedule} color="primary" autoFocus>
            確認儲存
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 空白班表確認對話框 */}
      <Dialog
        open={openEmptyScheduleDialog}
        onClose={handleCloseEmptyScheduleDialog}
        aria-labelledby="empty-schedule-dialog-title"
        aria-describedby="empty-schedule-dialog-description"
      >
        <DialogTitle id="empty-schedule-dialog-title">
          無法找到班表資料
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="empty-schedule-dialog-description">
            資料庫中找不到 {pendingDate ? format(pendingDate, 'yyyy年MM月') : ''} 的排班表。是否要創建一個新的空白班表？
            空白班表將包含所有護理師，所有班次預設為休假(O)。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEmptyScheduleCancel} color="primary">
            取消
          </Button>
          <Button onClick={generateEmptySchedule} color="primary" autoFocus>
            創建空白班表
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MonthlySchedule; 