import { create } from 'zustand';
import axios from 'axios';
import { persist } from 'zustand/middleware';

// 默認設置
const defaultSettings = {
  regularGroupCount: 3
};

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      // 狀態
      settings: null,
      isLoading: false,
      error: null,
      initialized: false,

      // 初始化 store
      initialize: () => {
        // 檢查是否已經初始化過了
        if (!get().initialized && !get().settings) {
          // 使用默認設置初始化
          set({ 
            settings: defaultSettings,
            initialized: true
          });
        }
      },

      // 讀取設置
      fetchSettings: async () => {
        // 檢查是否已初始化
        if (!get().initialized) {
          get().initialize();
          return get().settings;
        }

        set({ isLoading: true, error: null });
        try {
          // 在實際環境中取消下面的註釋，使用真實 API
          // const response = await axios.get('/api/settings');
          // set({ settings: response.data, isLoading: false });

          // 獲取存儲的設置或使用默認值
          const storedSettings = get().settings || defaultSettings;
          
          set({ 
            settings: storedSettings,
            isLoading: false,
            initialized: true
          });

          return storedSettings;
        } catch (error) {
          set({ 
            error: error.response?.data?.detail || '載入設置失敗', 
            isLoading: false 
          });
          throw error;
        }
      },

      // 更新設置
      updateSettings: async (newSettings) => {
        set({ isLoading: true, error: null });
        try {
          // 在實際環境中取消下面的註釋，使用真實 API
          // await axios.post('/api/settings', newSettings);
          
          // 獲取當前設置
          const currentSettings = get().settings || defaultSettings;
          
          // 確保所有設置都存在
          const updatedSettings = {
            ...currentSettings,
            ...newSettings
          };
          
          set({ 
            settings: updatedSettings, 
            isLoading: false,
            initialized: true
          });

          console.log('設置已更新:', updatedSettings);
          return updatedSettings;
        } catch (error) {
          set({ 
            error: error.response?.data?.detail || '更新設置失敗', 
            isLoading: false 
          });
          throw error;
        }
      },

      // 獲取常規組別數量
      getRegularGroupCount: () => {
        // 確保已初始化
        if (!get().initialized) {
          get().initialize();
        }
        return get().settings?.regularGroupCount || 3;
      }
    }),
    {
      name: 'settings-storage', // 存儲的名稱
      partialize: (state) => ({ 
        settings: state.settings,
        initialized: state.initialized
      }), // 只存儲這些狀態
    }
  )
); 