import axios from 'axios';

// 配置 axios 實例
const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api', // 使用環境變數，如果未設定則使用預設值
  timeout: 10000, // 請求超時時間
  withCredentials: true, // 預設帶上 cookie，支援 session
});

// 添加請求攔截器
api.interceptors.request.use(
  (config) => {
    // 從 localStorage 獲取 auth 資訊
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      const { state } = JSON.parse(authStorage);
      if (state.token) {
        config.headers.Authorization = `Bearer ${state.token}`;
      }
    }
    return config;
  },
  (error) => {
    // 格式化錯誤信息為字符串
    if (typeof error === 'object') {
      return Promise.reject(error.message || '請求處理錯誤');
    }
    return Promise.reject(error);
  }
);

// 添加響應攔截器
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 處理401未授權錯誤 - 自動跳轉到登入頁面
    if (error.response && error.response.status === 401) {
      // 清除本地存儲的認證資訊
      localStorage.removeItem('auth-storage');
      
      // 清除其他可能的緩存
      try {
        // 動態導入並調用清除緩存函數
        Promise.all([
          import('../utils/cacheUtils').then(module => module.clearAllCache && module.clearAllCache()),
          import('../utils/scheduleCache').then(module => module.clearAllScheduleCache && module.clearAllScheduleCache())
        ]).catch(err => console.warn('清除緩存時發生錯誤:', err));
      } catch (err) {
        console.warn('動態導入緩存清除模組失敗:', err);
      }
      
      // 只有在不是登入頁面時才跳轉，避免無限循環
      if (window.location.pathname !== '/login') {
        // 使用 window.location.href 確保完全重新載入頁面
        window.location.href = '/login';
        return Promise.reject(new Error('登入已過期，請重新登入'));
      }
    }
    
    // 處理錯誤，確保返回標準化錯誤信息
    let errorMessage = '發生未知錯誤';
    
    if (error.response) {
      // 服務器返回了錯誤響應
      const responseData = error.response.data;
      if (typeof responseData === 'string') {
        errorMessage = responseData;
      } else if (responseData && responseData.detail) {
        if (typeof responseData.detail === 'object') {
          try {
            errorMessage = JSON.stringify(responseData.detail);
          } catch (e) {
            errorMessage = '無法序列化錯誤詳情';
          }
        } else {
          errorMessage = responseData.detail;
        }
      } else if (responseData && typeof responseData === 'object') {
        try {
          errorMessage = JSON.stringify(responseData);
        } catch (e) {
          errorMessage = '無法序列化錯誤響應數據';
        }
      }
      
      error.message = errorMessage;
    } else if (error.request) {
      // 請求發出但沒有收到響應
      errorMessage = '無法連接到伺服器，請檢查網絡連接';
      error.message = errorMessage;
    } else {
      // 請求設置過程中出錯
      if (typeof error === 'object' && error !== null) {
        try {
          // 嘗試從錯誤對象中提取有用的信息
          if (error.message) {
            errorMessage = error.message;
          } else {
            // 嘗試將整個對象序列化為字符串
            errorMessage = JSON.stringify(error);
          }
        } catch (e) {
          errorMessage = '發生無法序列化的錯誤';
        }
      } else {
        errorMessage = error?.message || '請求處理錯誤';
      }
      error.message = errorMessage;
    }
    
    // 確保error是可序列化的
    if (typeof error === 'object' && error !== null) {
      try {
        // 測試是否可以序列化
        JSON.stringify(error);
      } catch (e) {
        // 如果不能序列化，創建一個新的Error對象
        const serializableError = new Error(errorMessage);
        serializableError.originalError = '原始錯誤無法序列化';
        return Promise.reject(serializableError);
      }
    }
    
    return Promise.reject(error);
  }
);

// 創建一個特殊的API實例，用於緩存資料的請求，不會觸發自動跳轉
const apiForCachedData = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api',
  timeout: 10000,
  withCredentials: true,
});

// 為緩存資料API添加請求攔截器
apiForCachedData.interceptors.request.use(
  (config) => {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      const { state } = JSON.parse(authStorage);
      if (state.token) {
        config.headers.Authorization = `Bearer ${state.token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 為緩存資料API添加響應攔截器 - 不自動跳轉，只是靜默失敗
apiForCachedData.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 對於緩存資料請求，401錯誤不跳轉，只是返回錯誤
    if (error.response && error.response.status === 401) {
      return Promise.reject(new Error('TOKEN_EXPIRED'));
    }
    return Promise.reject(error);
  }
);

// API服務
const apiService = {
  // 用戶相關
  user: {
    getProfile: () => api.get('/users/me'),
    getAll: () => api.get('/users'),
    create: (userData) => api.post('/users', userData),
    update: (userId, userData) => api.put(`/users/${userId}`, userData),
    delete: (userId) => api.delete(`/users/${userId}`),
    changePassword: (passwordData) => api.post('/users/change-password', passwordData),
    updateProfile: (profileData) => api.put('/users/me', profileData),
  },
  
  // 用戶相關 - 另一個命名空間(兼容現有代碼)
  users: {
    getUsers: () => api.get('/users'),
  },
  
  // 公式班表相關
  formulaSchedule: {
    getAll: () => api.get('/formula-schedules/'),
    getAllWithPatterns: () => api.get('/formula-schedules?include_patterns=true&include_assignments=true'),
    getAllPatterns: () => api.get('/formula-schedules/patterns/'),
    getPatternsByFormula: (formulaId) => api.get(`/formula-schedules/patterns?formula_id=${formulaId}`),
    getPatternsByGroup: (groupNumber) => api.get(`/formula-schedules/patterns?group_number=${groupNumber}`),
    getById: (id) => api.get(`/formula-schedules/${id}`),
    create: (data) => api.post('/formula-schedules', data),
    update: (id, data) => api.put(`/formula-schedules/${id}`, data),
    delete: (id) => api.delete(`/formula-schedules/${id}`),
    assignNurse: (nurseId, formulaId, data) => api.post('/formula-assignments', { 
      nurse_id: nurseId, 
      formula_id: formulaId,
      ...data
    }),
    getPatterns: (formulaId) => api.get(`/formula-schedules/${formulaId}?include_patterns=true`),
    createPattern: (data) => api.post('/formula-patterns', data),
    updatePattern: (patternId, data) => api.put(`/formula-patterns/${patternId}`, data),
    deletePattern: (patternId) => api.delete(`/formula-patterns/${patternId}`),
  },
  
  // 班表相關
  schedule: {
    generateMonth: (year, month, options = {}) => api.post('/schedules/generate', { year, month, ...options }),
    getMonthlySchedule: (year, month) => {
      console.log(`正在獲取月班表: ${year}年${month}月`);
      // 確保year和month為字符串
      const yearStr = String(year);
      const monthStr = String(month).padStart(2, '0');
      return api.get(`/schedules/monthly/${yearStr}/${monthStr}`)
        .then(response => {
          console.log('月班表API響應成功:', {
            狀態: response.status,
            數據長度: JSON.stringify(response.data).length,
            數據類型: typeof response.data,
            是數組: Array.isArray(response.data),
            鍵列表: response.data ? Object.keys(response.data) : []
          });
          return response;
        })
        .catch(error => {
          console.error('獲取月班表失敗:', error);
          throw error;
        });
    },
    updateSchedule: (scheduleId, data) => api.put(`/schedules/${scheduleId}`, data),
    publishSchedule: (versionId) => api.post(`/schedules/versions/${versionId}/publish`),
    saveMonth: (data) => api.post('/schedules/saveMonth', data),
    updateShift: (shiftData) => api.post('/shift-swap/update-shift', shiftData), // 更新個別班表內容
    resetAreaCodes: (year, month) => api.post('/schedules/resetAreaCodes', { year, month }),
    bulkUpdateAreaCodes: (updates) => api.post('/shift-swap/update-areas', updates), // 批量更新班表區域代碼，工作位置分配
    getScheduleDetails: (year, month) => api.get(`/schedules/details?year=${year}&month=${month}`)
  },
  
  // 換班相關
  shiftSwap: {
    getRequests: () => api.get('/shift-swap/'),
    getById: (id) => api.get(`/shift-swap/${id}`),
    getMyRequests: () => api.get('/shift-swap/me'),
    create: (data) => api.post('/shift-swap', data),
    update: (id, data) => api.put(`/shift-swap/${id}`, data),
    accept: (requestId, data) => api.put(`/shift-swap/${requestId}/accept`, data),
    reject: (requestId) => api.put(`/shift-swap/${requestId}/reject`),
    cancel: (requestId) => api.put(`/shift-swap/${requestId}`, { status: 'cancelled' }),
    getRules: () => api.get('/shift-swap/rules'),
    createRule: (data) => api.post('/shift-swap/rules', data),
    updateRule: (ruleId, data) => api.put(`/shift-swap/rules/${ruleId}`, data),
    deleteRule: (ruleId) => api.delete(`/shift-swap/rules/${ruleId}`),
    getAvailableMonths: () => api.get('/shift-swap/available-months'),
    validate: (requestId) => api.post('/shift-swap/validate', { request_id: requestId }),
  },
  
  // 公告相關
  announcement: {
    getAll: () => api.get('/announcements/'),
    getById: (id) => api.get(`/announcements/${id}`),
    create: (data) => api.post('/announcements', data),
    update: (id, data) => api.put(`/announcements/${id}`, data),
    delete: (id) => api.delete(`/announcements/${id}`),
    getCategories: () => api.get('/announcements/categories/'),
    createCategory: (data) => api.post('/announcements/categories', data),
    updateCategory: (id, data) => api.put(`/announcements/categories/${id}`, data),
    deleteCategory: (id) => api.delete(`/announcements/categories/${id}`),
  },
  
  // 加班相關
  overtime: {
    // 獲取自己的加班記錄
    getMyRecords: (startDate, endDate) => api.get('/overtime/me', {
      params: { 
        start_date: startDate, 
        end_date: endDate
      }
    }),
    
    // 獲取所有加班記錄（僅護理長/admin）
    getAllRecords: (startDate, endDate, userId) => api.get('/overtime', {
      params: { 
        start_date: startDate, 
        end_date: endDate,
        ...(userId ? { user_id: userId } : {})
      }
    }),
    
    // 創建加班記錄（僅護理長/admin）
    create: (data) => api.post('/overtime', data),
    
    // 為特定用戶創建加班記錄（僅護理長/admin）
    createForUser: (userId, data) => api.post(`/overtime/user/${userId}`, data),
    
    // 更新加班記錄（僅護理長/admin）
    update: (recordId, data) => api.put(`/overtime/${recordId}`, data),
    
    // 刪除加班記錄（僅護理長/admin）
    delete: (recordId) => api.delete(`/overtime/${recordId}`),
    
    // 批量更新加班記錄 - 用於換班功能
    bulkUpdate: (records) => api.put('/overtime/bulk-month', {
      records: records
    }),
    
    // 在換班流程中更新加班記錄 - 專為換班功能提供
    updateOvertime: (overtimeData) => api.post('/shift-swap/update-overtime', overtimeData),
    
    // 在換班流程中批量更新加班記錄 - 專為換班功能提供
    updateOvertimeMonth: (records) => {
      // 檢查 records 是否已經包含 records 屬性，避免雙重嵌套
      const data = Array.isArray(records) ? { records } : records;
      
      // 添加診斷日誌
      console.log('發送加班記錄更新請求:', data);
      
      return api.post('/shift-swap/update-overtime-month', data);
    },
    
    // 獲取月度加班分數（個人）
    getMyMonthlyScores: (year, month) => api.get('/overtime/monthly-scores/me', {
      params: { 
        year, 
        month
      }
    }),
    
    // 獲取所有用戶的月度加班分數（僅護理長/admin）
    getAllMonthlyScores: (year, month, userId) => api.get('/overtime/monthly-scores', {
      params: { year, month, user_id: userId }
    }),
    
    // 創建或更新月度加班分數（僅護理長/admin）
    createOrUpdateMonthlyScore: (data) => api.post('/overtime/monthly-scores', data),
    
    // 批量創建或更新月度加班分數（僅護理長/admin）
    bulkCreateOrUpdateMonthlyScores: (scoresArray) => api.post('/overtime/monthly-scores/bulk', {
      scores: scoresArray
    }),
    
    // 刪除月度加班分數（僅護理長/admin）
    deleteMonthlyScore: (scoreId) => api.delete(`/overtime/monthly-scores/${scoreId}`)
  },
};

// 導出 API 實例和服務
export { api, apiForCachedData };
export default apiService; 