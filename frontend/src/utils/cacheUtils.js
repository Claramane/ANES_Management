import { apiForCachedData } from './api';

/**
 * 緩存資料管理工具
 * 用於處理登入過期時的優雅降級
 */

// 緩存鍵前綴
const CACHE_PREFIX = 'anes_cache_';

/**
 * 設置緩存資料
 * @param {string} key - 緩存鍵
 * @param {any} data - 要緩存的資料
 * @param {number} ttl - 過期時間（毫秒），預設24小時
 */
export const setCacheData = (key, data, ttl = 24 * 60 * 60 * 1000) => {
  const cacheItem = {
    data,
    timestamp: Date.now(),
    ttl
  };
  localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheItem));
};

/**
 * 獲取緩存資料
 * @param {string} key - 緩存鍵
 * @returns {any|null} - 緩存的資料或null
 */
export const getCacheData = (key) => {
  try {
    const cacheItem = localStorage.getItem(CACHE_PREFIX + key);
    if (!cacheItem) return null;
    
    const { data, timestamp, ttl } = JSON.parse(cacheItem);
    
    // 檢查是否過期
    if (Date.now() - timestamp > ttl) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('獲取緩存資料失敗:', error);
    return null;
  }
};

/**
 * 清除特定緩存
 * @param {string} key - 緩存鍵
 */
export const clearCacheData = (key) => {
  localStorage.removeItem(CACHE_PREFIX + key);
};

/**
 * 清除所有緩存
 */
export const clearAllCache = () => {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(CACHE_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
};

/**
 * 帶緩存的API請求
 * 如果token過期，會嘗試使用緩存資料
 * @param {Function} apiCall - API調用函數
 * @param {string} cacheKey - 緩存鍵
 * @param {Object} options - 選項
 * @param {boolean} options.useCache - 是否使用緩存，預設true
 * @param {number} options.cacheTtl - 緩存過期時間，預設24小時
 * @param {boolean} options.fallbackToCache - token過期時是否回退到緩存，預設true
 * @returns {Promise} - API響應或緩存資料
 */
export const cachedApiCall = async (apiCall, cacheKey, options = {}) => {
  const {
    useCache = true,
    cacheTtl = 24 * 60 * 60 * 1000, // 24小時
    fallbackToCache = true
  } = options;

  try {
    // 嘗試進行API調用
    const response = await apiCall();
    
    // 如果成功，更新緩存
    if (useCache && response.data) {
      setCacheData(cacheKey, response.data, cacheTtl);
    }
    
    return response;
  } catch (error) {
    // 如果是token過期錯誤且允許回退到緩存
    if (error.message === 'TOKEN_EXPIRED' && fallbackToCache) {
      const cachedData = getCacheData(cacheKey);
      if (cachedData) {
        console.log(`使用緩存資料: ${cacheKey}`);
        return { data: cachedData, fromCache: true };
      }
    }
    
    // 其他錯誤或沒有緩存資料時，重新拋出錯誤
    throw error;
  }
};

/**
 * 帶緩存的API請求（僅查看資料）
 * 專門用於查看類操作，token過期時優雅降級到緩存
 * @param {Function} apiCall - API調用函數
 * @param {string} cacheKey - 緩存鍵
 * @returns {Promise} - API響應或緩存資料
 */
export const viewDataWithCache = async (apiCall, cacheKey) => {
  return cachedApiCall(
    () => apiForCachedData.get(apiCall.url || apiCall),
    cacheKey,
    {
      useCache: true,
      fallbackToCache: true,
      cacheTtl: 24 * 60 * 60 * 1000 // 24小時
    }
  );
};

/**
 * 檢查是否需要強制重新登入的操作
 * 這些操作需要有效的token，不能使用緩存
 * @param {string} operation - 操作類型
 * @returns {boolean} - 是否需要強制重新登入
 */
export const requiresValidToken = (operation) => {
  const writeOperations = [
    'create', 'update', 'delete', 'post', 'put', 'patch',
    'save', 'modify', 'change', 'edit', 'remove', 'add'
  ];
  
  return writeOperations.some(op => 
    operation.toLowerCase().includes(op)
  );
}; 