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
    return Promise.reject(error);
  }
);

// 添加響應攔截器
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 不再處理 401 未授權錯誤，保持登入狀態
    // if (error.response && error.response.status === 401) {
    //   // 清除本地存儲的 auth 資訊
    //   localStorage.removeItem('auth-storage');
    // }
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
    generateMonth: (year, month) => api.post('/schedules/generate', { year, month }),
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
};

// 導出 API 實例和服務
export { api };
export default apiService; 