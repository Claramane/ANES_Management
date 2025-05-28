import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../utils/api';

export const useUserStore = create(
  persist(
    (set, get) => ({
      // 狀態
      users: [],
      nurseUsers: [],
      isLoading: false,
      error: null,
      initialized: false, // 是否已初始化
      userOrder: {}, // 保存每種身份用戶的排序

      // 初始化 store
      initialize: () => {
        // 檢查是否已經初始化過了
        if (!get().initialized && get().users.length === 0) {
          // 設置為已初始化但不填充模擬數據
          set({ 
            initialized: true
          });
        }
      },

      // 獲取所有用戶
      fetchUsers: async () => {
        // 檢查是否已初始化
        if (!get().initialized) {
          get().initialize();
        }

        set({ isLoading: true, error: null });
        try {
          // 使用真實 API
          const response = await api.get('/users');
          const users = response.data;
          
          // 映射身份到表格類型
          const identityToTableType = {
            '麻醉專科護理師': 1,
            '恢復室護理師': 2,
            '麻醉科Leader': 3,
            '麻醉科書記': 4
          };
          
          // 轉換組別數據
          const processedUsers = users.map(user => {
            let groupValue = 0;
            let tableType = identityToTableType[user.identity] || 0;
            
            // 從 group_data 讀取組別資訊
            if (user.group_data) {
              try {
                // 嘗試解析現有格式
                if (user.group_data.startsWith('[') && user.group_data.includes(',')) {
                  // 新格式 [tableType, groupNumber]
                  const groupData = JSON.parse(user.group_data);
                  if (Array.isArray(groupData) && groupData.length >= 2) {
                    tableType = groupData[0];
                    groupValue = groupData[1];
                  }
                } else {
                  // 舊格式 {"group": number}
                  const groupData = JSON.parse(user.group_data);
                  if (groupData.group) {
                    groupValue = groupData.group;
                  }
                }
              } catch (e) {
                console.warn('無法解析 group_data:', user.group_data);
              }
            }
            
            return {
              ...user,
              tableType,
              group: groupValue
            };
          });
          
          // 過濾護理相關人員 (nurse, leader, secretary, supervise_nurse, head_nurse)
          const nurseRoles = ['nurse', 'leader', 'secretary', 'supervise_nurse', 'head_nurse'];
          
          set({ 
            users: processedUsers,
            nurseUsers: processedUsers.filter(user => nurseRoles.includes(user.role)) || [],
            isLoading: false,
            initialized: true
          });
          
          return processedUsers;
        } catch (error) {
          set({ 
            error: error.response?.data?.detail || '獲取用戶列表失敗', 
            isLoading: false
          });
          
          console.error('API調用失敗：', error);
          throw error;
        }
      },

      // 添加用戶
      addUser: async (userData) => {
        set({ isLoading: true, error: null });
        try {
          // 處理 group 數據，將其存入 group_data 字段
          const apiData = { ...userData };
          
          // 映射身份到表格類型
          const identityToTableType = {
            '麻醉專科護理師': 1,
            '恢復室護理師': 2,
            '麻醉科Leader': 3,
            '麻醉科書記': 4
          };
          
          // 如果有 group 屬性，則轉換為 group_data
          if (apiData.group !== undefined) {
            const tableType = apiData.identity ? identityToTableType[apiData.identity] || 1 : 1;
            apiData.group_data = JSON.stringify([tableType, apiData.group]);
            delete apiData.group; // 移除 group 屬性，僅提交 group_data
          }
          
          // 使用真實 API
          const response = await api.post('/users', apiData);
          const newUser = response.data;
          
          // 添加 group 屬性
          let groupValue = 0;
          let tableType = newUser.identity ? identityToTableType[newUser.identity] || 1 : 1;
          
          if (newUser.group_data) {
            try {
              // 解析 group_data
              if (newUser.group_data.startsWith('[') && newUser.group_data.includes(',')) {
                // 新格式 [tableType, groupNumber]
                const groupData = JSON.parse(newUser.group_data);
                if (Array.isArray(groupData) && groupData.length >= 2) {
                  tableType = groupData[0];
                  groupValue = groupData[1];
                }
              } else {
                // 舊格式 {"group": number}
                const groupData = JSON.parse(newUser.group_data);
                if (groupData.group) {
                  groupValue = groupData.group;
                }
              }
            } catch (e) {
              console.warn('無法解析 group_data:', newUser.group_data);
            }
          }
          
          const processedUser = {
            ...newUser,
            tableType,
            group: groupValue
          };
          
          // 是否為護理人員
          const nurseRoles = ['nurse', 'leader', 'secretary', 'supervise_nurse', 'head_nurse'];
          const isNurseRole = nurseRoles.includes(processedUser.role);
          
          set(state => ({ 
            users: [...state.users, processedUser],
            nurseUsers: isNurseRole 
              ? [...state.nurseUsers, processedUser] 
              : state.nurseUsers,
            isLoading: false 
          }));
          
          return processedUser;
        } catch (error) {
          set({ 
            error: error.response?.data?.detail || '添加用戶失敗', 
            isLoading: false 
          });
          
          console.error('API添加用戶失敗：', error);
          throw error;
        }
      },

      // 更新用戶
      updateUser: async (userId, userData) => {
        set({ isLoading: true, error: null });
        try {
          // 映射身份到表格類型
          const identityToTableType = {
            '麻醉專科護理師': 1,
            '恢復室護理師': 2,
            '麻醉科Leader': 3,
            '麻醉科書記': 4
          };
          
          // 處理 group 數據，將其存入 group_data 字段
          const apiData = { ...userData };
          const currentUser = get().users.find(user => user.id === userId);
          
          // 如果有 group 屬性，則轉換為 group_data
          if (apiData.group !== undefined) {
            // 獲取用戶當前的身份或使用新提供的身份
            const identity = apiData.identity || (currentUser ? currentUser.identity : null);
            const tableType = identity ? identityToTableType[identity] || 1 : 1;
            
            apiData.group_data = JSON.stringify([tableType, apiData.group]);
            delete apiData.group; // 移除 group 屬性，僅提交 group_data
          }
          
          // 使用真實 API
          await api.put(`/users/${userId}`, apiData);
          
          // 本地狀態更新仍保留 group 屬性以便於前端使用
          set(state => {
            const updatedUsers = state.users.map(user => {
              if (user.id === userId) {
                const updatedUser = { ...user, ...userData };
                // 更新 tableType
                if (userData.identity) {
                  updatedUser.tableType = identityToTableType[userData.identity] || updatedUser.tableType || 1;
                }
                
                // 同時更新 group_data 字段（用於後續讀取）
                if (userData.group !== undefined) {
                  updatedUser.group_data = apiData.group_data;
                }
                return updatedUser;
              }
              return user;
            });
            
            // 護理相關角色
            const nurseRoles = ['nurse', 'leader', 'secretary', 'supervise_nurse', 'head_nurse'];
            
            return { 
              users: updatedUsers,
              nurseUsers: updatedUsers.filter(user => nurseRoles.includes(user.role)),
              isLoading: false 
            };
          });
          
          return get().users.find(user => user.id === userId);
        } catch (error) {
          console.error('API更新用戶失敗：', error);
          
          set({ 
            error: error.response?.data?.detail || '更新用戶失敗', 
            isLoading: false 
          });
          
          throw error;
        }
      },

      // 停權用戶
      deactivateUser: async (userId) => {
        set({ isLoading: true, error: null });
        try {
          // 使用真實 API
          await api.delete(`/users/${userId}`);
          
          // 重新獲取用戶列表以更新狀態
          await get().fetchUsers();
          
          return true;
        } catch (error) {
          console.error('API停權用戶失敗：', error);
                    
          set({ 
            error: error.response?.data?.detail || '停權用戶失敗', 
            isLoading: false 
          });
          
          throw error;
        }
      },

      // 啟用用戶
      activateUser: async (userId) => {
        set({ isLoading: true, error: null });
        try {
          // 使用真實 API
          await api.post(`/users/${userId}/activate`);
          
          // 重新獲取用戶列表以更新狀態
          await get().fetchUsers();
          
          return true;
        } catch (error) {
          console.error('API啟用用戶失敗：', error);
                    
          set({ 
            error: error.response?.data?.detail || '啟用用戶失敗', 
            isLoading: false 
          });
          
          throw error;
        }
      },
      
      // 更新用戶排序
      updateUserOrder: (identity, orderedUserIds) => {
        set(state => ({
          userOrder: {
            ...state.userOrder,
            [identity]: orderedUserIds
          }
        }));
      },
      
      // 獲取特定身份的有序用戶列表
      getOrderedUsersByIdentity: (identity) => {
        // 這裡使用 nurseUsers，包含所有護理相關角色
        const allUsers = get().nurseUsers.filter(nurse => nurse.identity === identity);
        const orderIds = get().userOrder[identity];
        
        if (!orderIds || orderIds.length === 0) {
          return allUsers;
        }
        
        // 根據保存的順序排序
        return [...allUsers].sort((a, b) => {
          const indexA = orderIds.indexOf(a.id);
          const indexB = orderIds.indexOf(b.id);
          
          // 如果ID不在排序列表中，放到最後
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          
          return indexA - indexB;
        });
      },
      
      // 獲取特定組別的護理師
      getNursesByGroup: (groupId) => {
        // 這裡使用 nurseUsers，包含所有護理相關角色
        return get().nurseUsers.filter(nurse => nurse.group === groupId);
      },
      
      // 獲取特定組別護理師的名字
      getNurseNamesByGroup: (groupId) => {
        // 這裡使用 nurseUsers，包含所有護理相關角色
        return get().nurseUsers
          .filter(nurse => nurse.group === groupId)
          .map(nurse => nurse.full_name)
          .join(', ');
      },
      
      // 獲取特定身份的護理師
      getNursesByIdentity: (identity) => {
        // 這裡使用 nurseUsers，包含所有護理相關角色
        return get().nurseUsers.filter(nurse => nurse.identity === identity);
      },
      
      // 獲取特定身份的護理師名字
      getNurseNamesByIdentity: (identity) => {
        // 這裡使用 nurseUsers，包含所有護理相關角色
        return get().nurseUsers
          .filter(nurse => nurse.identity === identity)
          .map(nurse => nurse.full_name)
          .join(', ');
      }
    }),
    {
      name: 'user-storage', // 存儲的名稱
      partialize: (state) => ({ 
        users: state.users,
        nurseUsers: state.nurseUsers,
        initialized: state.initialized,
        userOrder: state.userOrder
      }), // 只存儲這些狀態
    }
  )
); 