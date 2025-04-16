import { create } from 'zustand';
import axios from 'axios';
import { persist } from 'zustand/middleware';
import apiService from '../utils/api';

// 默認設置
const defaultSettings = {
  regularGroupCount: 3,
  anesthesia_specialist_groups: 3,
  recovery_nurse_groups: 3,
  anesthesia_leader_groups: 3,
  anesthesia_secretary_groups: 3
};

// 公式班類型對應的 ID 和名稱
const FORMULA_TYPES = {
  'anesthesia_specialist': { id: 1, name: '麻醉專科護理師' },
  'recovery_nurse': { id: 2, name: '恢復室護理師' },
  'anesthesia_leader': { id: 3, name: '麻醉科Leader' },
  'anesthesia_secretary': { id: 4, name: '麻醉科書記' }
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
          
          // 更新 pattern 數量
          await updateFormulaPatterns(currentSettings, updatedSettings);
          
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
      },
      
      // 獲取特定類型的組別數量
      getGroupCountByType: (type) => {
        // 確保已初始化
        if (!get().initialized) {
          get().initialize();
        }
        
        const settings = get().settings;
        if (!settings) return 3;
        
        const fieldMap = {
          'anesthesia_specialist': 'anesthesia_specialist_groups',
          'recovery_nurse': 'recovery_nurse_groups',
          'anesthesia_leader': 'anesthesia_leader_groups',
          'anesthesia_secretary': 'anesthesia_secretary_groups'
        };
        
        const field = fieldMap[type];
        return field ? (settings[field] || 3) : settings.regularGroupCount || 3;
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

// 更新公式班 pattern 數量
async function updateFormulaPatterns(oldSettings, newSettings) {
  try {
    console.log('更新公式班 pattern 數量');
    
    // 獲取所有公式班表
    const response = await apiService.formulaSchedule.getAllWithPatterns();
    const formulas = response.data || [];
    
    // 獲取所有護理師
    const usersResponse = await apiService.user.getAll();
    const users = usersResponse.data || [];
    
    // 處理每種公式班類型
    for (const [typeKey, typeInfo] of Object.entries(FORMULA_TYPES)) {
      const settingKey = `${typeKey}_groups`;
      const oldCount = oldSettings[settingKey] || 3;
      const newCount = newSettings[settingKey] || 3;
      
      // 如果數量沒變，跳過
      if (oldCount === newCount) {
        console.log(`${typeInfo.name} 組別數量未變更，保持 ${newCount} 組`);
        continue;
      }
      
      // 找到對應的公式班表
      const formula = formulas.find(f => f.name === typeInfo.name);
      if (!formula) {
        console.log(`找不到 ${typeInfo.name} 的公式班表，跳過更新 pattern`);
        continue;
      }
      
      console.log(`更新 ${typeInfo.name} 公式班表，從 ${oldCount} 組變更為 ${newCount} 組`);
      
      // 獲取現有 patterns
      let patterns = formula.patterns || [];
      
      // 按 group_number 排序
      patterns = patterns.sort((a, b) => a.group_number - b.group_number);
      
      if (newCount > oldCount) {
        // 需要增加 pattern
        console.log(`需要為 ${typeInfo.name} 增加 ${newCount - oldCount} 個 pattern`);
        
        const defaultPattern = 'O'.repeat(7); // 始終使用全休為默認值
        
        // 從當前最大 group_number 開始新增
        const startGroup = patterns.length > 0 
          ? Math.max(...patterns.map(p => p.group_number)) + 1 
          : 1;
        
        for (let i = startGroup; i <= newCount; i++) {
          await apiService.formulaSchedule.createPattern({
            formula_id: formula.id,
            group_number: i,
            pattern: defaultPattern
          });
          console.log(`為 ${typeInfo.name} 創建了第 ${i} 組 pattern`);
        }
      } else if (newCount < oldCount) {
        // 需要減少 pattern
        console.log(`需要從 ${typeInfo.name} 刪除 ${oldCount - newCount} 個 pattern`);
        
        // 獲取要刪除的 pattern (從後面開始)
        const patternsToDelete = [...patterns]
          .sort((a, b) => b.group_number - a.group_number) // 按組號倒序排列
          .slice(0, oldCount - newCount);
          
        // 找出需要重置的組別
        const groupNumbersToDelete = patternsToDelete.map(p => p.group_number);
        console.log(`需要重置的組別: ${groupNumbersToDelete.join(', ')}`);
        
        // 找出這些組別中的護理師並重置他們的組別
        for (const user of users) {
          // 嘗試解析 group_data
          let groupData = {};
          if (user.group_data) {
            try {
              groupData = JSON.parse(user.group_data);
            } catch (error) {
              console.warn(`解析用戶 ${user.id} 的 group_data 失敗:`, error);
            }
          }
          
          // 檢查並重置當前公式類型的組別
          if (groupData[typeKey] && groupNumbersToDelete.includes(groupData[typeKey])) {
            console.log(`重置用戶 ${user.id} (${user.full_name}) 的 ${typeKey} 組別`);
            
            // 移除此類型的組別
            delete groupData[typeKey];
            
            // 更新用戶
            try {
              await apiService.user.update(user.id, {
                group_data: JSON.stringify(groupData)
              });
            } catch (error) {
              console.error(`更新用戶 ${user.id} 失敗:`, error);
            }
          }
        }
        
        // 刪除 pattern
        for (const pattern of patternsToDelete) {
          try {
            await apiService.formulaSchedule.deletePattern(pattern.id);
            console.log(`刪除了 ${typeInfo.name} 的 pattern ID=${pattern.id}, group=${pattern.group_number}`);
          } catch (error) {
            console.error(`刪除 pattern ID=${pattern.id} 失敗:`, error);
          }
        }
      }
    }
    
    console.log('所有公式班 pattern 數量已更新完成');
  } catch (error) {
    console.error('更新公式班 pattern 數量時出錯:', error);
    throw error;
  }
} 