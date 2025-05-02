import axios from 'axios';

// 配置 axios 實例
const api = axios.create({
  baseURL: 'http://localhost:8000/api', // 後端 API 地址，添加 /api 前綴
  timeout: 10000, // 請求超時時間
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
    // 處理錯誤，確保返回標準化錯誤信息
    let errorMessage = '發生未知錯誤';
    
    if (error.response) {
      // 服務器返回了錯誤響應
      const responseData = error.response.data;
      if (typeof responseData === 'string') {
        errorMessage = responseData;
      } else if (responseData && responseData.detail) {
        if (typeof responseData.detail === 'object') {
          errorMessage = JSON.stringify(responseData.detail);
        } else {
          errorMessage = responseData.detail;
        }
      } else if (responseData && typeof responseData === 'object') {
        errorMessage = JSON.stringify(responseData);
      }
      
      error.message = errorMessage;
    } else if (error.request) {
      // 請求發出但沒有收到響應
      errorMessage = '無法連接到伺服器，請檢查網絡連接';
      error.message = errorMessage;
    } else {
      // 請求設置過程中出錯
      errorMessage = error.message || '請求處理錯誤';
      error.message = errorMessage;
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
  
  // 公式班表相關
  formulaSchedule: {
    getAll: () => api.get('/formula-schedules'),
    getAllWithPatterns: () => api.get('/formula-schedules?include_patterns=true&include_assignments=true'),
    getAllPatterns: () => api.get('/formula-schedules/patterns'),
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
    getMonthlySchedule: (year, month) => api.get(`/schedules/monthly/${year}/${month}`),
    updateSchedule: (scheduleId, data) => api.put(`/schedules/${scheduleId}`, data),
    publishSchedule: (versionId) => api.post(`/schedules/versions/${versionId}/publish`),
    saveMonth: (data) => api.post('/schedules/saveMonth', data),
    updateShift: (shiftData) => api.post('/schedules/updateShift', shiftData),
    resetAreaCodes: (year, month) => api.post('/schedules/resetAreaCodes', { year, month }),
    bulkUpdateAreaCodes: (updates) => api.post('/schedules/bulkUpdateAreaCodes', updates),
    getScheduleDetails: (year, month) => api.get(`/schedules/details?year=${year}&month=${month}`)
  },
  
  // 換班相關
  shiftSwap: {
    getRequests: () => api.get('/shift-swaps'),
    createRequest: (data) => api.post('/shift-swaps', data),
    acceptRequest: (requestId) => api.post(`/shift-swaps/${requestId}/accept`),
    validateRequest: (requestId) => api.post(`/shift-swaps/${requestId}/validate`),
    getShiftRules: () => api.get('/shift-rules'),
    updateShiftRule: (ruleId, data) => api.put(`/shift-rules/${ruleId}`, data),
  },
  
  // 公告相關
  announcement: {
    getAll: () => api.get('/announcements'),
    getById: (id) => api.get(`/announcements/${id}`),
    create: (data) => api.post('/announcements', data),
    update: (id, data) => api.put(`/announcements/${id}`, data),
    delete: (id) => api.delete(`/announcements/${id}`),
    getCategories: () => api.get('/announcements/categories'),
    createCategory: (data) => api.post('/announcements/categories', data),
    updateCategory: (id, data) => api.put(`/announcements/categories/${id}`, data),
    deleteCategory: (id) => api.delete(`/announcements/categories/${id}`),
  },
  
  // 加班相關
  overtime: {
    // 獲取自己的加班記錄
    getMyRecords: (startDate, endDate) => api.get('/overtime/me', {
      params: { start_date: startDate, end_date: endDate }
    }),
    
    // 獲取所有加班記錄（僅護理長/admin）
    getAllRecords: (startDate, endDate, userId) => api.get('/overtime', {
      params: { 
        start_date: startDate, 
        end_date: endDate,
        user_id: userId 
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
    
    // 批量創建加班記錄（僅護理長/admin）
    bulkCreate: (records, userId) => api.post('/overtime/bulk', {
      records: records,
      user_id: userId
    }),
    
    // 批量更新加班記錄（僅護理長/admin）
    bulkUpdate: async (recordsArray) => {
      console.log('API Call: 批量更新整月加班記錄', { 記錄數量: recordsArray.length });
      
      // 處理每個記錄中的overtime_shift值
      const processedRecords = recordsArray.map(record => ({
        date: record.date,
        overtime_shift: record.overtime_shift === null || record.overtime_shift === undefined ? '' : record.overtime_shift,
        user_ids: record.user_ids
      }));
      
      return api.put('/overtime/bulk-month', {
        records: processedRecords
      });
    }
  },
};

// 導出 API 實例和服務
export { api };
export default apiService; 