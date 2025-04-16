// 更新設置的臨時腳本

// 分析舊版公式班表數據中的組別數量
function analyzeGroupCounts() {
  const oldFormulaData = [
    {
      "type": "regular",
      "formula_data": [
        { "shifts": ["O", "O", "O", "O", "O", "O", "O"], "nurses": [] },
        { "shifts": ["O", "D", "D", "A", "O", "O", "O"], "nurses": [5] },
        { "shifts": ["O", "O", "O", "O", "O", "O", "O"], "nurses": [6] },
        { "shifts": ["O", "D", "O", "A", "O", "O", "O"], "nurses": [7] },
        { "shifts": ["O", "O", "O", "O", "O", "O", "O"], "nurses": [8] },
        { "shifts": ["O", "O", "O", "O", "O", "O", "O"], "nurses": [] },
        { "shifts": ["O", "A", "O", "O", "O", "O", "O"], "nurses": [] },
        { "shifts": ["O", "O", "D", "O", "O", "O", "O"], "nurses": [] },
        { "shifts": ["D", "O", "O", "O", "O", "O", "O"], "nurses": [] },
        { "shifts": ["O", "O", "O", "O", "O", "O", "O"], "nurses": [] },
        { "shifts": ["O", "O", "O", "O", "O", "O", "O"], "nurses": [] },
        { "shifts": ["O", "O", "O", "O", "O", "O", "O"], "nurses": [] }
      ]
    },
    {
      "type": "por",
      "formula_data": [
        { "shifts": ["A", "F", "C", "K", "K", "O", "O"], "nurses": [33] },
        { "shifts": ["A", "C", "A", "O", "O", "O", "O"], "nurses": [34] },
        { "shifts": ["O", "O", "A", "O", "O", "O", "O"], "nurses": [35] },
        { "shifts": ["O", "O", "O", "O", "O", "O", "O"], "nurses": [] },
        { "shifts": ["O", "O", "O", "O", "O", "O", "O"], "nurses": [] },
        { "shifts": ["O", "A", "O", "A", "A", "O", "O"], "nurses": [] },
        { "shifts": ["O", "O", "O", "O", "O", "O", "O"], "nurses": [] }
      ]
    },
    {
      "type": "leader",
      "formula_data": [
        { "shifts": ["A", "A", "A", "A", "A", "E", "O"], "nurses": [2] },
        { "shifts": ["A", "A", "A", "A", "A", "O", "O"], "nurses": [3] }
      ]
    },
    {
      "type": "secretary",
      "formula_data": [
        { "shifts": ["B", "B", "B", "B", "B", "O", "O"], "nurses": [40] }
      ]
    }
  ];

  // 計算每種類型的組別數量
  const groupCounts = {
    regular: oldFormulaData[0].formula_data.length, // 12
    por: oldFormulaData[1].formula_data.length, // 7
    leader: oldFormulaData[2].formula_data.length, // 2
    secretary: oldFormulaData[3].formula_data.length // 1
  };

  return groupCounts;
}

// 更新設置
function updateSettings() {
  try {
    // 從 localStorage 獲取當前的 settings-storage
    let storageData = localStorage.getItem('settings-storage');
    
    if (!storageData) {
      console.error('找不到設置存儲數據！');
      return;
    }
    
    // 解析當前的存儲數據
    let parsedData = JSON.parse(storageData);
    
    // 如果沒有 state 或 settings，創建它們
    if (!parsedData.state) {
      parsedData.state = {};
    }
    
    if (!parsedData.state.settings) {
      parsedData.state.settings = {};
    }
    
    // 獲取組別數量
    const groupCounts = analyzeGroupCounts();
    
    // 設置映射關係
    const mappings = {
      'regular': 'anesthesia_specialist_groups',
      'por': 'recovery_nurse_groups',
      'leader': 'anesthesia_leader_groups',
      'secretary': 'anesthesia_secretary_groups'
    };
    
    // 更新設置
    Object.entries(groupCounts).forEach(([oldType, count]) => {
      const settingField = mappings[oldType];
      if (settingField) {
        parsedData.state.settings[settingField] = count;
      }
    });
    
    // 將更新後的數據保存回 localStorage
    localStorage.setItem('settings-storage', JSON.stringify(parsedData));
    
    console.log('成功更新設置數據！', parsedData.state.settings);
    return parsedData.state.settings;
  } catch (error) {
    console.error('更新設置數據時發生錯誤：', error);
  }
}

// 執行更新函數
updateSettings(); 