// 排班數據緩存工具
class ScheduleCache {
  constructor() {
    this.memoryCache = new Map(); // 內存緩存，用於同一頁面內的重複請求
    this.currentPage = null; // 當前頁面標識
  }

  // 生成緩存鍵
  generateCacheKey(year, month, type = 'details') {
    return `schedule_${type}_${year}_${month}`;
  }

  // 生成頁面級別的緩存鍵
  generatePageCacheKey(page, year, month, type = 'details') {
    return `${page}_${this.generateCacheKey(year, month, type)}`;
  }

  // 設置當前頁面
  setCurrentPage(page) {
    if (this.currentPage !== page) {
      // 頁面切換時清除內存緩存
      this.memoryCache.clear();
      this.currentPage = page;
      console.log(`頁面切換到: ${page}，已清除內存緩存`);
    }
  }

  // 從localStorage獲取緩存數據
  getFromLocalStorage(key) {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const data = JSON.parse(cached);
      const now = Date.now();

      // 檢查是否過期（24小時）
      if (now - data.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(key);
        return null;
      }

      return data.value;
    } catch (error) {
      console.error('從localStorage讀取緩存失敗:', error);
      return null;
    }
  }

  // 保存到localStorage
  saveToLocalStorage(key, value) {
    try {
      const data = {
        value,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('保存到localStorage失敗:', error);
    }
  }

  // 獲取緩存數據（優先內存，其次localStorage）
  get(page, year, month, type = 'details') {
    const pageCacheKey = this.generatePageCacheKey(page, year, month, type);
    const localStorageKey = this.generateCacheKey(year, month, type);

    // 1. 檢查內存緩存（同一頁面內的重複請求）
    if (this.memoryCache.has(pageCacheKey)) {
      console.log(`從內存緩存獲取數據: ${pageCacheKey}`);
      return this.memoryCache.get(pageCacheKey);
    }

    // 2. 檢查localStorage緩存
    const localData = this.getFromLocalStorage(localStorageKey);
    if (localData) {
      // 將localStorage數據也放入內存緩存
      this.memoryCache.set(pageCacheKey, localData);
      console.log(`從localStorage緩存獲取數據: ${localStorageKey}`);
      return localData;
    }

    return null;
  }

  // 設置緩存數據
  set(page, year, month, data, type = 'details') {
    const pageCacheKey = this.generatePageCacheKey(page, year, month, type);
    const localStorageKey = this.generateCacheKey(year, month, type);

    // 同時保存到內存和localStorage
    this.memoryCache.set(pageCacheKey, data);
    this.saveToLocalStorage(localStorageKey, data);
    
    console.log(`緩存數據已保存: ${pageCacheKey}`);
  }

  // 清除特定緩存
  clear(page, year, month, type = 'details') {
    const pageCacheKey = this.generatePageCacheKey(page, year, month, type);
    const localStorageKey = this.generateCacheKey(year, month, type);

    this.memoryCache.delete(pageCacheKey);
    localStorage.removeItem(localStorageKey);
    
    console.log(`緩存已清除: ${pageCacheKey}`);
  }

  // 清除所有緩存
  clearAll() {
    this.memoryCache.clear();
    
    // 清除localStorage中的所有排班緩存
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('schedule_')) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('所有排班緩存已清除');
  }

  // 清除過期的localStorage緩存
  cleanExpiredCache() {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    
    keys.forEach(key => {
      if (key.startsWith('schedule_')) {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const data = JSON.parse(cached);
            if (now - data.timestamp > 24 * 60 * 60 * 1000) {
              localStorage.removeItem(key);
              console.log(`已清除過期緩存: ${key}`);
            }
          }
        } catch (error) {
          // 如果解析失敗，直接刪除
          localStorage.removeItem(key);
        }
      }
    });
  }
}

// 創建全局實例
const scheduleCache = new ScheduleCache();

// 帶緩存的API請求函數
export const cachedScheduleDetailsRequest = async (apiService, page, year, month) => {
  // 設置當前頁面
  scheduleCache.setCurrentPage(page);

  // 檢查緩存
  const cached = scheduleCache.get(page, year, month);
  if (cached) {
    return { data: cached, fromCache: true };
  }

  try {
    console.log(`發起API請求: schedules/details?year=${year}&month=${month}`);
    const response = await apiService.schedule.getScheduleDetails(year, month);
    
    if (response.data && response.data.success) {
      // 緩存成功的響應
      scheduleCache.set(page, year, month, response.data);
    }
    
    return { data: response.data, fromCache: false };
  } catch (error) {
    console.error('API請求失敗:', error);
    throw error;
  }
};

// 清除緩存的輔助函數
export const clearScheduleCache = (page, year, month) => {
  scheduleCache.clear(page, year, month);
};

export const clearAllScheduleCache = () => {
  scheduleCache.clearAll();
};

// 清除過期緩存
export const cleanExpiredScheduleCache = () => {
  scheduleCache.cleanExpiredCache();
};

export default scheduleCache; 