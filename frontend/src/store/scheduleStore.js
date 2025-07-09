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
      isTemporarySchedule: false, // 新增: 標記當前排班表是否為臨時生成（未儲存到資料庫）

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
            error: error.response?.data?.detail || 
                  (typeof error === 'string' ? error : 
                   (error?.message || '載入排班表失敗')), 
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
            error: error.response?.data?.detail || 
                  (typeof error === 'string' ? error : 
                   (error?.message || '保存排班表失敗')), 
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

      // 生成月度排班表
      generateMonthlySchedule: async () => {
        set({ isLoading: true, error: null });
        try {
          const { selectedDate } = get();
          const validDate = ensureValidDate(selectedDate);
          const year = validDate.getFullYear();
          const month = validDate.getMonth() + 1; // 月份需要+1，因為JS的月份是0-11
          
          console.log(`正在生成 ${year}年${month}月 的臨時排班表...`);
          
          // 呼叫API生成排班表，添加參數表示這是臨時的
          const response = await apiService.schedule.generateMonth(year, month, { temporary: true });
          
          // 檢查API回應
          if (!response || !response.data) {
            throw new Error('API回應中缺少數據');
          }
          
          console.log('生成臨時排班表API回應:', response);
          
          // 獲取新生成的班表數據
          const scheduleData = response.data;
          
          let formattedSchedule = [];
          if (scheduleData && Array.isArray(scheduleData.schedule)) {
            formattedSchedule = scheduleData.schedule.map(nurse => {
              // 確保 shifts 是一個有效的陣列
              let shifts = [];
              if (Array.isArray(nurse.shifts)) {
                shifts = [...nurse.shifts]; // 淺拷貝shifts數組
              } else if (nurse.shifts) {
                try {
                  shifts = JSON.parse(nurse.shifts);
                  if (!Array.isArray(shifts)) {
                    shifts = Array(31).fill('O');
                  }
                } catch (e) {
                  shifts = Array(31).fill('O');
                }
              } else {
                shifts = Array(31).fill('O');
              }
              
              // 為每個護理師創建area_codes數組
              const area_codes = Array(shifts.length).fill(null);
              
              return {
                ...nurse,
                shifts,
                area_codes
              };
            });
          }
          
          // 將生成的排班表存入store，並標記為臨時的（未儲存）
          set({ 
            monthlySchedule: formattedSchedule,
            isTemporarySchedule: true, // 標記為臨時生成的班表
            isLoading: false
          });
          
          // 返回格式化後的結果用於前端展示
          return formattedSchedule;
        } catch (error) {
          console.error('生成月班表失敗:', error);
          set({ 
            error: typeof error === 'string' ? error : 
                  (error?.message || '生成月班表失敗'),
            isLoading: false
          });
          throw error;
        }
      },
      
      // 保存月度排班表
      saveMonthlySchedule: async () => {
        set({ isLoading: true, error: null });
        try {
          const { monthlySchedule, selectedDate } = get();
          
          if (!monthlySchedule || monthlySchedule.length === 0) {
            throw new Error('沒有排班數據可保存');
          }
          
          // 檢查當前用戶角色，只有護理長和管理員可以保存
          const authStorage = localStorage.getItem('auth-storage');
          let userId = null;
          let userName = null;
          let canSave = false;
          
          if (authStorage) {
            const { state } = JSON.parse(authStorage);
            if (state.user) {
              const userRole = state.user.role;
              userId = state.user.id;
              userName = state.user.full_name || state.user.username;
              canSave = userRole === 'head_nurse' || userRole === 'admin';
            }
          }
          
          if (!canSave) {
            throw new Error('只有護理長和管理員可以保存班表');
          }
          
          const year = selectedDate.getFullYear();
          const month = selectedDate.getMonth() + 1;
          
          console.log(`正在保存 ${year}年${month}月 的排班表...`);
          
          // 創建時間戳記
          const timestamp = new Date().toISOString();
          
          // 轉換為API需要的格式
          const scheduleData = {
            year,
            month,
            created_by: userId,
            creator_name: userName,
            timestamp: timestamp,
            version_note: `${userName} 於 ${new Date().toLocaleString('zh-TW')} 儲存的版本`,
            schedule_data: monthlySchedule.map(nurse => ({
              user_id: nurse.id,
              shifts: nurse.shifts,
              area_codes: nurse.area_codes || Array(nurse.shifts.length).fill(null),
              special_type: nurse.special_type || null  // 加入 special_type 欄位
            })),
            create_version: true // 創建新版本
          };
          
          // 呼叫API保存排班表
          const response = await apiService.schedule.saveMonth(scheduleData);
          
          console.log('保存排班表成功:', response);
          
          // 保存成功後，清除臨時標記
          set({ 
            isLoading: false,
            error: null,
            isTemporarySchedule: false // 清除臨時標記
          });
          
          return response.data;
        } catch (error) {
          console.error('保存排班表失敗:', error);
          set({ 
            isLoading: false, 
            error: typeof error === 'string' ? error : 
                  (error.response?.data?.detail || error?.message || '保存排班表失敗')
          });
          throw error;
        }
      },
      
      // 獲取月班表
      fetchMonthlySchedule: async (forceRefresh = false) => {
        set({ isLoading: true, error: null });
        try {
          const { selectedDate } = get();
          // 確保selectedDate是有效的Date對象
          const validDate = ensureValidDate(selectedDate);
          const year = validDate.getFullYear();
          const month = validDate.getMonth() + 1;
          
          // 使用API獲取月班表
          console.log(`正在通過API獲取月班表... ${forceRefresh ? '(強制刷新)' : ''}`);
          
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
              
              // 確保每個護理師的數據結構正確
              const formattedSchedule = scheduleList.map(nurse => {
                // 確保 shifts 是一個有效的陣列
                let shifts = [];
                if (Array.isArray(nurse.shifts)) {
                  shifts = [...nurse.shifts]; // 淺拷貝shifts數組
                } else if (nurse.shifts) {
                  // 如果不是陣列但有值，嘗試轉換
                  console.warn(`護理師 ${nurse.name} (ID: ${nurse.id}) 的 shifts 不是陣列:`, nurse.shifts);
                  try {
                    shifts = JSON.parse(nurse.shifts);
                    if (!Array.isArray(shifts)) {
                      shifts = Array(31).fill(''); // 填充默認空值
                    }
                  } catch (e) {
                    console.error(`解析護理師 ${nurse.name} 的 shifts 失敗:`, e);
                    shifts = Array(31).fill('');
                  }
                } else {
                  // 如果沒有 shifts，創建默認空陣列
                  shifts = Array(31).fill('');
                }
                
                // 🔥 關鍵修改：保留已有的 area_codes，避免覆蓋工作分配數據
                const currentSchedule = get().monthlySchedule;
                const existingNurse = currentSchedule.find(n => n.id === nurse.id);
                const area_codes = existingNurse?.area_codes || Array(shifts.length).fill(null);
                
                console.log(`護理師 ${nurse.name} (ID: ${nurse.id}) - 保留已有的工作分配數據:`, 
                          existingNurse?.area_codes ? '是' : '否');
                
                return {
                  ...nurse,
                  shifts: shifts,
                  area_codes: area_codes, // 保留已有的 area_codes，避免覆蓋
                  special_type: nurse.special_type || null // 確保 special_type 字段存在
                };
              });
              
              // 當從API加載班表時，標記為非臨時班表（已儲存）
              set({ 
                monthlySchedule: formattedSchedule, 
                isLoading: false,
                isTemporarySchedule: false // 標記為已儲存的班表
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
          // 先更新本地狀態
          const { monthlySchedule, selectedDate } = get();
          const updatedSchedule = [...monthlySchedule];
          
          if (updatedSchedule[nurseIndex]) {
            updatedSchedule[nurseIndex].shifts[dayIndex] = newShift;
          } else {
            console.error(`找不到索引為 ${nurseIndex} 的護理師`);
          }
          
          set({ monthlySchedule: updatedSchedule });
          
          // 檢查當前用戶角色，決定是否實時更新數據庫
          // 從localStorage取得權限資訊
          const authStorage = localStorage.getItem('auth-storage');
          let canUpdateDB = false;
          let userId = null;
          
          if (authStorage) {
            const { state } = JSON.parse(authStorage);
            if (state.user) {
              const userRole = state.user.role;
              userId = state.user.id;
              // 只有護理長和管理員可以實時更新數據庫
              canUpdateDB = userRole === 'head_nurse' || userRole === 'admin';
            }
          }
          
          if (canUpdateDB) {
            // 透過API保存更新
            const nurse = monthlySchedule[nurseIndex];
            if (!nurse || !nurse.id) {
              console.error('護理師數據無效:', nurse);
              throw new Error('護理師數據無效');
            }
            
            const year = selectedDate.getFullYear();
            const month = selectedDate.getMonth() + 1; // JavaScript 月份從 0 開始
            const day = dayIndex + 1; // 日期從 1 開始
            
            // 確保正確建立日期對象
            // 注意 JavaScript 的 Date 構造函數中月份是 0-indexed (0-11)
            const date = new Date(Date.UTC(year, selectedDate.getMonth(), day));
            
            // 格式化為 YYYY-MM-DD，確保使用 UTC 時間避免時區問題
            const formattedDate = date.toISOString().split('T')[0];
            
            console.log(`updateShift - 選擇年: ${year}, 選擇月: ${selectedDate.getMonth()}, 日索引: ${dayIndex}, 計算日: ${day}, 最終日期: ${formattedDate}`);
            
            // 構建完整的更新請求
            const requestData = {
              user_id: nurse.id,
              updated_by: userId,
              date: formattedDate,
              shift_type: newShift,
              create_version: true // 啟用版本控制
            };
            
            // 發送更新請求到API
            await apiService.schedule.updateShift(requestData);
            console.log(`實時更新數據庫: ${nurse.name} 在 ${formattedDate} 的班次更新為 ${newShift}`);
          } else {
            console.log('班表變更已保存在本地，但未同步到數據庫，因為當前用戶不是護理長或管理員');
          }
          
        } catch (error) {
          console.error('更新班次失敗:', error);
          set({ 
            error: error.response?.data?.detail || 
                  (typeof error === 'string' ? error : 
                   (error?.message || '更新班次失敗')),
          });
          throw error;
        }
      },
      
      // 獲取加載狀態
      getIsLoading: () => get().isLoading,
      
      // 設置錯誤訊息
      setError: (errorMsg) => set({ error: errorMsg }),

      // 重置排班表
      resetSchedule: async (date) => {
        set({ isLoading: true, error: null });
        try {
          if (!date) throw new Error('Date is required');
          // 從選擇的日期獲取年和月
          const year = date.getFullYear();
          const month = date.getMonth() + 1; // 0-indexed，需 +1
          
          console.log(`正在重置 ${year}年${month}月的排班表...`);
          
          // 從API請求重置
          await apiService.schedule.resetMonthlySchedule(year, month);
          
          // 重新從API獲取排班表
          const updatedSchedule = await apiService.schedule.getMonthlySchedule(year, month);
          
          // 更新Store中的排班表
          set({
            monthlySchedule: updatedSchedule.data || [],
            isLoading: false
          });
          
          return updatedSchedule.data || [];
        } catch (error) {
          console.error('重置排班表失敗:', error);
          set({ 
            error: error.response?.data?.detail || 
                  (typeof error === 'string' ? error : 
                   (error?.message || '重置排班表失敗')),
            isLoading: false 
          });
          throw error;
        }
      }
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