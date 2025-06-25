import { useState, useEffect, useMemo, useCallback } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { 
  getRequestDisplayStatus, 
  isRequestExpired 
} from '../utils/shiftSwapUtils';
import { PAGE_SIZE } from '../constants/shiftSwapConstants';

/**
 * 換班申請管理的自定義Hook
 * @param {Array} swapRequests - 換班請求列表
 * @param {Object} user - 當前用戶
 * @returns {Object} 包含狀態和方法的對象
 */
export const useShiftSwap = (swapRequests = [], user = null) => {
  // 篩選相關狀態
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [hiddenStatuses, setHiddenStatuses] = useState([]);
  const [shiftStartDate, setShiftStartDate] = useState(null);
  const [shiftEndDate, setShiftEndDate] = useState(null);
  const [selectedShifts, setSelectedShifts] = useState([]);
  const [requestorFilter, setRequestorFilter] = useState('');
  const [onlySameIdentity, setOnlySameIdentity] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  
  // 分頁狀態
  const [page, setPage] = useState(1);
  
  // 過濾後的請求列表
  const [filteredRequests, setFilteredRequests] = useState([]);

  // 更新過濾後的請求列表
  const updateFilteredRequests = useCallback((requests) => {
    const filtered = requests.filter(req => {
      // 0. 根據當前標籤過濾
      const matchesTab = currentTab === 0 || 
        (currentTab === 1 && req.swap_type === 'shift') ||
        (currentTab === 2 && req.swap_type === 'mission') ||
        (currentTab === 3 && req.swap_type === 'overtime');
      
      // 1. 關鍵字搜尋
      const lowerSearchTerm = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        (req.notes?.toLowerCase() || '').includes(lowerSearchTerm) ||
        (req.requestor?.full_name?.toLowerCase() || '').includes(lowerSearchTerm) ||
        (req.target_nurse?.full_name?.toLowerCase() || '').includes(lowerSearchTerm) ||
        (req.from_shift?.toLowerCase() || '').includes(lowerSearchTerm) ||
        (req.to_shift?.toLowerCase() || '').includes(lowerSearchTerm) ||
        (req.from_mission?.toLowerCase() || '').includes(lowerSearchTerm) ||
        (req.to_mission?.toLowerCase() || '').includes(lowerSearchTerm);
      
      // 檢查請求是否過期
      const displayStatus = getRequestDisplayStatus(req);
      
      // 2. 狀態篩選 - 使用 hiddenStatuses 進行過濾
      const isVisible = !hiddenStatuses.includes(displayStatus);
      
      // 4. 要換班的日期範圍篩選
      const matchesShiftDate = 
        (!shiftStartDate || new Date(req.from_date) >= startOfDay(shiftStartDate)) &&
        (!shiftEndDate || new Date(req.from_date) <= endOfDay(shiftEndDate));
      
      // 5. 班別篩選
      const matchesShift = selectedShifts.length === 0 || selectedShifts.includes(req.from_shift);
      
      // 6. 請求者篩選
      const matchesRequestor = !requestorFilter || req.requestor?.id === requestorFilter;
      
      // 7. 僅顯示相同身份類型
      const matchesIdentity = !onlySameIdentity || 
        (user && req.requestor && req.requestor.identity === user.identity);
      
      return matchesTab && matchesSearch && isVisible && matchesShiftDate && 
             matchesShift && matchesRequestor && matchesIdentity;
    });
    
    // 按 from_date 日期降冪排序（較新的日期在前）
    const sortedRequests = [...filtered].sort((a, b) => {
      if (!a.from_date) return 1;
      if (!b.from_date) return -1;
      
      const dateA = new Date(a.from_date);
      const dateB = new Date(b.from_date);
      
      return dateB - dateA;
    });
    
    setFilteredRequests(sortedRequests);
    setPage(1); // 重置頁碼
  }, [searchTerm, hiddenStatuses, shiftStartDate, shiftEndDate, 
      selectedShifts, requestorFilter, onlySameIdentity, user, currentTab]);

  // 當過濾條件變更時更新結果
  useEffect(() => {
    if (swapRequests.length > 0) {
      updateFilteredRequests(swapRequests);
    }
  }, [swapRequests, updateFilteredRequests]);

  // 計算活動過濾器數量
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedStatus.length > 0) count++;
    if (hiddenStatuses.length > 0) count++;
    if (shiftStartDate || shiftEndDate) count++;
    if (selectedShifts.length > 0) count++;
    if (requestorFilter) count++;
    if (onlySameIdentity) count++;
    return count;
  }, [selectedStatus, hiddenStatuses, shiftStartDate, shiftEndDate, 
      selectedShifts, requestorFilter, onlySameIdentity]);

  // 進行分頁處理
  const paginatedRequests = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return filteredRequests.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRequests, page]);

  // 計算總頁數
  const totalPages = useMemo(() => {
    return Math.ceil(filteredRequests.length / PAGE_SIZE);
  }, [filteredRequests]);

  // 處理狀態隱藏/顯示
  const handleStatusVisibilityChange = useCallback((status) => {
    setHiddenStatuses(prev => {
      if (prev.includes(status)) {
        return prev.filter(s => s !== status);
      } else {
        return [...prev, status];
      }
    });
  }, []);

  // 處理班別選擇變更
  const handleShiftChange = useCallback((shift) => {
    setSelectedShifts(prev => {
      if (prev.includes(shift)) {
        return prev.filter(s => s !== shift);
      } else {
        return [...prev, shift];
      }
    });
  }, []);

  // 清除所有過濾器
  const handleClearFilters = useCallback(() => {
    setSelectedStatus([]);
    setHiddenStatuses([]);
    setShiftStartDate(null);
    setShiftEndDate(null);
    setSelectedShifts([]);
    setRequestorFilter('');
    setOnlySameIdentity(false);
  }, []);

  // 處理標籤切換
  const handleTabChange = useCallback((event, newValue) => {
    setCurrentTab(newValue);
  }, []);

  return {
    // 狀態
    searchTerm,
    selectedStatus,
    hiddenStatuses,
    shiftStartDate,
    shiftEndDate,
    selectedShifts,
    requestorFilter,
    onlySameIdentity,
    currentTab,
    page,
    filteredRequests,
    paginatedRequests,
    totalPages,
    activeFilterCount,

    // 設置函數
    setSearchTerm,
    setSelectedStatus,
    setHiddenStatuses,
    setShiftStartDate,
    setShiftEndDate,
    setSelectedShifts,
    setRequestorFilter,
    setOnlySameIdentity,
    setCurrentTab,
    setPage,

    // 處理函數
    handleStatusVisibilityChange,
    handleShiftChange,
    handleClearFilters,
    handleTabChange,
    updateFilteredRequests,
  };
}; 