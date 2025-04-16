import { create } from 'zustand';
import axios from 'axios';
import { persist } from 'zustand/middleware';
import apiService from '../utils/api';

// 默認空排班數據
const defaultSchedules = {
  anesthesia_specialist: {
    type: 'anesthesia_specialist',
    formula_data: []
  },
  recovery_nurse: {
    type: 'recovery_nurse',
    formula_data: []
  },
  anesthesia_leader: {
    type: 'anesthesia_leader',
    formula_data: []
  },
  anesthesia_secretary: {
    type: 'anesthesia_secretary',
    formula_data: []
  }
};

// 公式 ID 與類型的對應關係
const FORMULA_ID_TO_TYPE = {
  1: 'anesthesia_specialist',
  2: 'recovery_nurse',
  3: 'anesthesia_leader',
  4: 'anesthesia_secretary'
};

// 公式類型與名稱的對應關係
const FORMULA_TYPE_TO_NAME = {
  'anesthesia_specialist': '麻醉專科護理師',
  'recovery_nurse': '恢復室護理師',
  'anesthesia_leader': '麻醉科Leader',
  'anesthesia_secretary': '麻醉科書記'
};

// 確保日期有效性的工具函數
const ensureValidDate = (date) => {
  if (date && date instanceof Date && !isNaN(date.getTime())) {
    return date;
  }
  console.warn('發現無效日期，使用當前日期替代:', date);
  return new Date();
};

export const useScheduleStore = create(
  persist(
    (set, get) => ({
      // 狀態
      formulaSchedules: {},
      monthlySchedule: [],
      selectedDate: new Date(),
      isLoading: false,
      error: null,
      initialized: false,

      // 初始化 store
      initialize: () => {
        console.log('正在初始化 scheduleStore...');
        // 檢查是否已經初始化過了
        if (!get().initialized && Object.keys(get().formulaSchedules).length === 0) {
          // 使用默認空排班初始化
          set({ 
            formulaSchedules: defaultSchedules,
            initialized: true
          });
          console.log('初始化 formulaSchedules 完成');
        }
        
        // 確保selectedDate是有效的Date對象
        const { selectedDate } = get();
        console.log('初始化檢查 selectedDate:', selectedDate, 
                   'instanceof Date:', selectedDate instanceof Date,
                   'isValid:', selectedDate instanceof Date && !isNaN(selectedDate.getTime()));
        
        if (!selectedDate || !(selectedDate instanceof Date) || isNaN(selectedDate.getTime())) {
          console.log('selectedDate 無效，重置為當前日期');
          set({ selectedDate: new Date() });
        } else {
          console.log('selectedDate 有效:', selectedDate);
        }
      },

      // 更新選擇的日期
      updateSelectedDate: (date) => {
        // 確保date是有效的Date對象
        if (date && date instanceof Date && !isNaN(date.getTime())) {
          set({ selectedDate: date });
        } else {
          console.error('嘗試設置無效的日期值:', date);
          set({ selectedDate: new Date() });
        }
      },

      // 獲取公式排班表
      fetchFormulaSchedules: async () => {
        // 檢查是否已初始化
        if (!get().initialized) {
          get().initialize();
        }

        set({ isLoading: true, error: null });
        try {
          console.log('正在從後端獲取公式班表數據...');
          // 使用include_patterns和include_assignments參數一次性獲取所有數據
          const response = await apiService.formulaSchedule.getAllWithPatterns();
          console.log('API返回的公式班表數據:', response.data);
          
          // 將後端數據轉換為前端格式
          const formattedSchedules = { ...defaultSchedules };  // 使用預設結構確保所有類型都存在
          
          if (response && response.data) {
            // 主動記錄每個公式班的ID和名稱，方便診斷
            console.log('API返回的所有公式班表:');
            response.data.forEach(formula => {
              console.log(`ID: ${formula.id}, 名稱: ${formula.name}`);
            });
            
            // 處理API返回的每個公式排班
            for (const formula of response.data) {
              // 找到對應的公式類型
              let formulaType = null;
              
              // 根據名稱判斷類型（更可靠）
              if (formula.name === '麻醉專科護理師') formulaType = 'anesthesia_specialist';
              else if (formula.name === '恢復室護理師') formulaType = 'recovery_nurse';
              else if (formula.name === '麻醉科Leader') formulaType = 'anesthesia_leader';
              else if (formula.name === '麻醉科書記') formulaType = 'anesthesia_secretary';
              else {
                // 備用方法：使用ID映射
                formulaType = FORMULA_ID_TO_TYPE[formula.id];
              }
              
              if (!formulaType) {
                console.warn(`未知公式: ID=${formula.id}, 名稱=${formula.name}，跳過處理`);
                continue;
              }
              
              console.log(`處理公式: ${formula.name} (${formulaType}), ID=${formula.id}`);
              
              // 從公式獲取patterns和assignments
              const patterns = formula.patterns || [];
              const assignments = formula.nurse_assignments || [];
              
              console.log(`公式 ${formula.name} 有 ${patterns.length} 個patterns`);
              
              // 先去重複patterns
              const uniquePatterns = [];
              const seenGroups = new Set();
              
              for (const pattern of patterns) {
                const groupNumber = pattern.group_number || 1;
                if (!seenGroups.has(groupNumber)) {
                  seenGroups.add(groupNumber);
                  uniquePatterns.push(pattern);
                }
              }
              
              console.log(`去重後 ${formula.name} 有 ${uniquePatterns.length} 個patterns`);
              
              // 找出最大組別數
              const maxGroup = uniquePatterns.length > 0 ? 
                Math.max(...uniquePatterns.map(p => p.group_number || 0), 0) : 
                assignments.length > 0 ? 
                  Math.max(...assignments.map(a => a.sort_order || 0), 0) : 
                  3; // 默認至少3個組
              
              // 創建指定組數的數據結構
              const formulaData = Array(maxGroup).fill(null).map(() => ({
                shifts: Array(7).fill('O'), // 默認全部為休假
                nurses: []
              }));
              
              // 填充班次數據 (patterns)
              if (uniquePatterns.length > 0) {
                // 按照group_number排序
                uniquePatterns.sort((a, b) => (a.group_number || 0) - (b.group_number || 0));
                
                // 診斷用：打印所有patterns
                console.log(`公式 ${formula.name} 的patterns詳情:`);
                uniquePatterns.forEach(pattern => {
                  console.log(`  組別: ${pattern.group_number}, pattern: ${pattern.pattern}`);
                });
                
                for (const pattern of uniquePatterns) {
                  const groupIndex = (pattern.group_number || 1) - 1;
                  if (groupIndex >= 0 && groupIndex < formulaData.length) {
                    // 分解pattern字串為陣列
                    const shifts = pattern.pattern ? 
                      pattern.pattern.split('').slice(0, 7) : 
                      Array(7).fill('O');
                      
                    // 確保長度為7
                    while (shifts.length < 7) shifts.push('O');
                    formulaData[groupIndex].shifts = shifts;
                  }
                }
              }
              
              // 填充護理師分配
              if (assignments.length > 0) {
                for (const assignment of assignments) {
                  const groupIndex = (assignment.sort_order || 1) - 1;
                  if (groupIndex >= 0 && groupIndex < formulaData.length) {
                    formulaData[groupIndex].nurses.push(assignment.user_id);
                  }
                }
              }
              
              // 更新指定類型的資料
              formattedSchedules[formulaType] = {
                type: formulaType,
                formula_data: formulaData,
                formula_id: formula.id
              };
              
              console.log(`已處理 ${formulaType} 公式班表，共 ${formulaData.length} 組`);
            }
          }
          
          console.log('成功從後端獲取並格式化公式班表數據:', formattedSchedules);
          set({ 
            formulaSchedules: formattedSchedules, 
            isLoading: false,
            initialized: true
          });
          
          return formattedSchedules;
        } catch (error) {
          console.error('載入排班表失敗，完整錯誤:', error);
          set({ 
            error: error.response?.data?.detail || '載入排班表失敗', 
            isLoading: false 
          });
          throw error;
        }
      },

      // 保存公式排班表
      saveFormulaSchedule: async (type, formulaData) => {
        set({ isLoading: true, error: null });
        try {
          console.log('正在嘗試通過API保存公式班表...類型:', type);
          // 首先獲取此類型的公式班表ID
          const allFormulas = await apiService.formulaSchedule.getAll();
          let formulaId = null;
          let formulaName = '';
          
          // 根據類型找到對應的公式名稱和ID
          if (type === 'anesthesia_specialist') formulaName = '麻醉專科護理師';
          else if (type === 'recovery_nurse') formulaName = '恢復室護理師';
          else if (type === 'anesthesia_leader') formulaName = '麻醉科Leader';
          else if (type === 'anesthesia_secretary') formulaName = '麻醉科書記';
          
          console.log(`尋找公式班表: ${formulaName}`);
          const existingFormula = allFormulas.data.find(f => f.name === formulaName);
          
          if (existingFormula) {
            formulaId = existingFormula.id;
            console.log(`找到公式班表ID: ${formulaId}`);
            
            // 準備patterns數據
            const patternsData = formulaData.map((group, index) => ({
              formula_id: formulaId,
              group_number: index + 1,
              pattern: group.shifts.join('')
            }));
            
            // 直接更新公式班表和patterns
            console.log(`更新公式班表ID ${formulaId} 的patterns:`, patternsData);
            await apiService.formulaSchedule.update(formulaId, {
              patterns: patternsData
            });
            
            // 不再嘗試獲取patterns，直接創建或更新
            for (let i = 0; i < patternsData.length; i++) {
              const patternData = patternsData[i];
              try {
                // 不確定是否存在，直接嘗試創建新pattern
                await apiService.formulaSchedule.createPattern(patternData);
                console.log(`創建pattern成功: 組別 ${patternData.group_number}`);
              } catch (error) {
                console.warn(`創建pattern失敗, 可能已存在:`, error);
                // 如果創建失敗（可能已存在），嘗試查找pattern ID並更新
                try {
                  const patternsResponse = await apiService.formulaSchedule.getAll();
                  const existingPattern = patternsResponse.data?.find(p => 
                    p.formula_id === formulaId && p.group_number === patternData.group_number
                  );
                  
                  if (existingPattern) {
                    await apiService.formulaSchedule.updatePattern(existingPattern.id, {
                      pattern: patternData.pattern
                    });
                    console.log(`更新pattern成功: ID ${existingPattern.id}, 組別 ${patternData.group_number}`);
                  }
                } catch (e) {
                  console.error(`無法更新pattern:`, e);
                }
              }
            }
          } else {
            // 創建新公式班表
            const patternsData = formulaData.map((group, index) => ({
              group_number: index + 1,
              pattern: group.shifts.join('')
            }));
            
            const newFormula = await apiService.formulaSchedule.create({
              name: formulaName,
              description: `${formulaName}的公式班表`,
              patterns: patternsData
            });
            
            formulaId = newFormula.data.id;
          }
          
          console.log('成功通過API保存公式班表');
          
          // 更新本地存儲 - 重要：使用API返回的formulaId確保一致性
          set(state => {
            // 創建新的formulaSchedules對象
            const updatedFormula = {
              type: type,
              formula_data: formulaData,
              formula_id: formulaId
            };
            
            // 更新指定類型的公式班表
            return {
              formulaSchedules: {
                ...state.formulaSchedules,
                [type]: updatedFormula
              },
              isLoading: false
            };
          });
          
          // 強制重新從API獲取最新數據
          await get().fetchFormulaSchedules();
          
          return get().formulaSchedules[type];
        } catch (error) {
          console.error('保存排班表失敗:', error);
          set({ 
            error: error.response?.data?.detail || '保存排班表失敗', 
            isLoading: false 
          });
          throw error;
        }
      },
      
      // 重置公式排班表
      resetFormulaSchedule: async (type, groupCount) => {
        set({ isLoading: true, error: null });
        try {
          console.log('正在嘗試通過API重置公式班表...');
          // 首先獲取此類型的公式班表ID
          const allFormulas = await apiService.formulaSchedule.getAll();
          let formulaName = '';
          
          // 根據類型找到對應的公式名稱
          if (type === 'anesthesia_specialist') formulaName = '麻醉專科護理師';
          else if (type === 'recovery_nurse') formulaName = '恢復室護理師';
          else if (type === 'anesthesia_leader') formulaName = '麻醉科Leader';
          else if (type === 'anesthesia_secretary') formulaName = '麻醉科書記';
          
          const existingFormula = allFormulas.data.find(f => f.name === formulaName);
          
          if (existingFormula) {
            const formulaId = existingFormula.id;
            
            // 準備新的空白patterns數據
            const emptyPatterns = Array(groupCount).fill(null).map((_, index) => ({
              formula_id: formulaId,
              group_number: index + 1,
              pattern: 'OOOOOOO'
            }));
            
            // 更新為空白模式
            await apiService.formulaSchedule.update(existingFormula.id, {
              patterns: emptyPatterns
            });
            
            // 獲取現有的patterns
            const existingPatterns = await apiService.formulaSchedule.getPatterns(formulaId);
            
            // 刪除所有現有patterns
            if (existingPatterns && existingPatterns.data) {
              for (const pattern of existingPatterns.data) {
                try {
                  await apiService.formulaSchedule.deletePattern(pattern.id);
                } catch (deleteError) {
                  console.error(`刪除pattern ID=${pattern.id}時出錯:`, deleteError);
                }
              }
            }
            
            // 創建新的空白patterns
            for (let i = 0; i < groupCount; i++) {
              await apiService.formulaSchedule.createPattern({
                formula_id: formulaId,
                group_number: i + 1,
                pattern: 'OOOOOOO'
              });
            }
          }
          
          console.log('成功通過API重置公式班表');

          // 創建新的空白排班表
          const newFormulaData = Array(groupCount).fill(null).map(() => ({
            shifts: Array(7).fill('O'),
            nurses: []
          }));
          
          set(state => ({
            formulaSchedules: {
              ...state.formulaSchedules,
              [type]: {
                type,
                formula_data: newFormulaData
              }
            },
            isLoading: false,
            initialized: true
          }));

          console.log(`已重置 ${type} 排班數據`);
          return get().formulaSchedules[type];
        } catch (error) {
          console.error('重置排班表失敗:', error);
          set({ 
            error: error.response?.data?.detail || '重置排班表失敗', 
            isLoading: false 
          });
          throw error;
        }
      },
      
      // 獲取特定類型的公式排班表
      getFormulaSchedule: (type) => {
        // 確保已初始化
        if (!get().initialized) {
          get().initialize();
        }
        return get().formulaSchedules[type] || defaultSchedules[type] || null;
      },

      // 生成月班表
      generateMonthlySchedule: async () => {
        set({ isLoading: true, error: null });
        try {
          const { selectedDate } = get();
          // 確保selectedDate是有效的Date對象
          const validDate = ensureValidDate(selectedDate);
          const year = validDate.getFullYear();
          const month = validDate.getMonth() + 1;
          
          console.log(`正在請求生成 ${year}年${month}月排班表...`);
          
          // 調用後端API生成月班表
          const response = await apiService.schedule.generateMonth(year, month);
          
          if (response && response.data && response.data.success) {
            console.log('後端成功生成月班表:', response.data);
            
            // 生成完成後立即獲取生成的排班表
            const scheduleResponse = await get().fetchMonthlySchedule();
            
            return {
              success: true,
              message: response.data.message || '成功生成月班表',
              entries_count: response.data.entries_count || 0
            };
          } else {
            throw new Error(response?.data?.message || '生成月班表失敗');
          }
        } catch (error) {
          console.error('生成月班表時發生錯誤:', error);
          set({ 
            error: error.message || '生成月班表失敗', 
            isLoading: false 
          });
          throw error;
        }
      },
      
      // 保存月班表 (單一班次更新)
      saveMonthlySchedule: async (scheduleId, updateData) => {
        set({ isLoading: true, error: null });
        try {
          // 更新單一班次
          console.log('正在通過API更新班次...', scheduleId, updateData);
          const response = await apiService.schedule.updateSchedule(scheduleId, updateData);
          
          // 在本地更新班次
          const updatedSchedule = response.data;
          set(state => {
            const newSchedule = [...state.monthlySchedule];
            // 尋找對應的班次並更新
            const scheduleIndex = newSchedule.findIndex(s => s.id === scheduleId);
            if (scheduleIndex >= 0) {
              newSchedule[scheduleIndex] = updatedSchedule;
            }
            return { monthlySchedule: newSchedule, isLoading: false };
          });
          
          console.log('成功更新班次:', updatedSchedule);
          return updatedSchedule;
        } catch (error) {
          console.error('更新班次時發生錯誤:', error);
          set({ 
            error: error.response?.data?.detail || error.message || '更新班次失敗', 
            isLoading: false 
          });
          throw error;
        }
      },
      
      // 獲取月班表
      fetchMonthlySchedule: async () => {
        set({ isLoading: true, error: null });
        try {
          const { selectedDate } = get();
          // 確保selectedDate是有效的Date對象
          const validDate = ensureValidDate(selectedDate);
          const year = validDate.getFullYear();
          const month = validDate.getMonth() + 1;
          
          // 使用API獲取月班表
          console.log('正在通過API獲取月班表...');
          
          try {
            const response = await apiService.schedule.getMonthlySchedule(year, month);
            
            if (response.data && response.data.success) {
              console.log('成功獲取月班表:', response.data);
              
              // 解析嵌套結構獲取schedule數組
              const data = response.data.data || {};
              const yearData = data[year] || data[String(year)] || {};
              const monthData = yearData[month] || yearData[String(month)] || {};
              const scheduleList = monthData.schedule || [];
              
              console.log(`解析出schedule數組，包含 ${scheduleList.length} 條記錄`);
              
              // 獲取所有護理師的排班詳情以獲取area_code
              console.log('正在獲取排班詳情以獲取area_code...');
              const detailsResponse = await apiService.schedule.getScheduleDetails(year, month);
              
              // area_code映射: { "用戶ID-日期": area_code }
              const areaCodeMap = {};
              
              if (detailsResponse.data && detailsResponse.data.success) {
                const details = detailsResponse.data.data || [];
                console.log(`解析排班詳情，包含 ${details.length} 條記錄`);
                
                // 構建area_code映射
                details.forEach(item => {
                  const dateObj = new Date(item.date);
                  const day = dateObj.getDate() - 1; // 轉為0-based索引
                  const key = `${item.user_id}-${day}`;
                  areaCodeMap[key] = item.area_code;
                });
              }
              
              // 直接使用API返回的格式，確保shifts是字符串數組而非對象數組
              const formattedSchedule = scheduleList.map(nurse => {
                const nurseId = nurse.id;
                // 為每個護理師創建area_codes數組
                const area_codes = nurse.shifts.map((shift, dayIndex) => {
                  const key = `${nurseId}-${dayIndex}`;
                  return areaCodeMap[key] || null;
                });
                
                return {
                  ...nurse,
                  shifts: Array.isArray(nurse.shifts) ? nurse.shifts : [], // 確保shifts是數組
                  area_codes: area_codes // 添加area_codes到每個護理師數據中
                };
              });
              
              set({ 
                monthlySchedule: formattedSchedule, 
                isLoading: false 
              });
              
              // 返回格式化的結果
              return {
                [year]: {
                  [month]: {
                    year,
                    month,
                    schedule: formattedSchedule
                  }
                }
              };
            }
            
            console.log('未找到月班表:', response.data);
            
            // 返回空結構但保持同樣格式
            const emptyResult = {
              [year]: {
                [month]: {
                  year: year,
                  month: month,
                  schedule: []
                }
              }
            };
            
            set({ monthlySchedule: [], isLoading: false });
            return emptyResult;
          } catch (apiError) {
            console.error('API錯誤，可能是資料庫結構問題:', apiError);
            // 設置一個更友好的錯誤訊息，但仍然返回空數據以便前端可以正常顯示
            set({ 
              error: '排班表數據暫時無法獲取，請稍後再試或聯繫管理員',
              isLoading: false,
              monthlySchedule: []
            });
            
            // 返回空結構但保持同樣格式
            return {
              [year]: {
                [month]: {
                  year: year,
                  month: month,
                  schedule: []
                }
              }
            };
          }
        } catch (error) {
          console.error('獲取月班表時發生錯誤:', error);
          set({ 
            error: '無法獲取班表數據，但您仍可以查看界面', 
            isLoading: false,
            monthlySchedule: []
          });
          
          // 依然保持格式一致性
          const { selectedDate } = get();
          const validDate = ensureValidDate(selectedDate);
          const year = validDate.getFullYear();
          const month = validDate.getMonth() + 1;
          
          return {
            [year]: {
              [month]: {
                year: year,
                month: month,
                schedule: []
              }
            }
          };
        }
      },
      
      // 獲取月班表數據
      getMonthlySchedule: () => get().monthlySchedule,
      
      // 獲取所選日期
      getSelectedDate: () => get().selectedDate,
      
      // 更新單個班次
      updateShift: async ({ nurseIndex, dayIndex, newShift }) => {
        try {
          const { monthlySchedule } = get();
          console.log('updateShift - 當前班表數據:', monthlySchedule);
          console.log(`嘗試更新: nurseIndex=${nurseIndex}, dayIndex=${dayIndex}, newShift=${newShift}`);
          
          // 檢查索引是否有效
          if (nurseIndex < 0 || nurseIndex >= monthlySchedule.length) {
            throw new Error('護士索引無效');
          }
          
          const nurse = monthlySchedule[nurseIndex];
          if (dayIndex < 0 || dayIndex >= nurse.shifts.length) {
            throw new Error('日期索引無效');
          }
          
          // 在本地立即更新班次顯示 (不論後端API是否成功)
          set(state => {
            const newSchedule = [...state.monthlySchedule];
            // 更新特定班次
            if (nurseIndex >= 0 && nurseIndex < newSchedule.length) {
              if (dayIndex >= 0 && dayIndex < newSchedule[nurseIndex].shifts.length) {
                // 直接更新字符串数组
                newSchedule[nurseIndex].shifts[dayIndex] = newShift;
              }
            }
            return { monthlySchedule: newSchedule };
          });
          
          // 獲取當前日期年月
          const { selectedDate } = get();
          const year = selectedDate.getFullYear();
          const month = selectedDate.getMonth() + 1;
          const day = dayIndex + 1; // 轉為1-based天數
          
          // 準備日期字符串 (YYYY-MM-DD)
          const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          
          console.log(`將更新日期 ${dateStr} 的班次為 ${newShift}`);
          
          // 這裡應該調用實際的API來更新資料庫中的班次
          // TODO: 實現實際的API調用來保存更改
          
          return true;
        } catch (error) {
          console.error('更新班次時發生錯誤:', error);
          set({ error: error.message || '更新班次失敗' });
          return false;
        }
      },
      
      // 獲取加載狀態
      getIsLoading: () => get().isLoading,
      
      // 設置錯誤訊息
      setError: (errorMsg) => set({ error: errorMsg })
    }),
    {
      name: 'schedule-storage', // 存儲的名稱
      partialize: (state) => ({ 
        formulaSchedules: state.formulaSchedules,
        initialized: state.initialized,
        monthlySchedule: state.monthlySchedule,
        selectedDate: state.selectedDate
      }), // 只存儲這些狀態
      serialize: (state) => {
        // 序列化前特殊處理Date對象
        return JSON.stringify({
          ...state,
          state: {
            ...state.state,
            selectedDate: state.state.selectedDate instanceof Date 
              ? state.state.selectedDate.toISOString() 
              : new Date().toISOString()
          }
        });
      },
      deserialize: (str) => {
        const parsed = JSON.parse(str);
        // 反序列化後特殊處理Date對象
        return {
          ...parsed,
          state: {
            ...parsed.state,
            selectedDate: parsed.state.selectedDate ? new Date(parsed.state.selectedDate) : new Date()
          }
        };
      },
      onRehydrateStorage: () => (state) => {
        // 當從存儲中恢復數據時，確保selectedDate是有效的Date對象
        if (state) {
          if (typeof state.selectedDate === 'string') {
            state.selectedDate = new Date(state.selectedDate);
          } else if (!state.selectedDate || !(state.selectedDate instanceof Date) || isNaN(state.selectedDate.getTime())) {
            state.selectedDate = new Date();
          }
          
          // 初始化 store
          if (state.initialize) {
            state.initialize();
          }
        }
      }
    }
  )
); 