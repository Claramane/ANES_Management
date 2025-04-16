// 更新公式班表數據的臨時腳本

// 舊版的公式班班表數據
const oldFormulaData = [
  {
    "type": "regular",
    "formula_data": [
      {
        "shifts": [
          "O",
          "O",
          "O",
          "O",
          "O",
          "O",
          "O"
        ],
        "nurses": []
      },
      {
        "shifts": [
          "O",
          "D",
          "D",
          "A",
          "O",
          "O",
          "O"
        ],
        "nurses": [
          5
        ]
      },
      {
        "shifts": [
          "O",
          "O",
          "O",
          "O",
          "O",
          "O",
          "O"
        ],
        "nurses": [
          6
        ]
      },
      {
        "shifts": [
          "O",
          "D",
          "O",
          "A",
          "O",
          "O",
          "O"
        ],
        "nurses": [
          7
        ]
      },
      {
        "shifts": [
          "O",
          "O",
          "O",
          "O",
          "O",
          "O",
          "O"
        ],
        "nurses": [
          8
        ]
      },
      {
        "shifts": [
          "O",
          "O",
          "O",
          "O",
          "O",
          "O",
          "O"
        ],
        "nurses": []
      },
      {
        "shifts": [
          "O",
          "A",
          "O",
          "O",
          "O",
          "O",
          "O"
        ],
        "nurses": []
      },
      {
        "shifts": [
          "O",
          "O",
          "D",
          "O",
          "O",
          "O",
          "O"
        ],
        "nurses": []
      },
      {
        "shifts": [
          "D",
          "O",
          "O",
          "O",
          "O",
          "O",
          "O"
        ],
        "nurses": []
      },
      {
        "shifts": [
          "O",
          "O",
          "O",
          "O",
          "O",
          "O",
          "O"
        ],
        "nurses": []
      },
      {
        "shifts": [
          "O",
          "O",
          "O",
          "O",
          "O",
          "O",
          "O"
        ],
        "nurses": []
      },
      {
        "shifts": [
          "O",
          "O",
          "O",
          "O",
          "O",
          "O",
          "O"
        ],
        "nurses": []
      }
    ]
  },
  {
    "type": "por",
    "formula_data": [
      {
        "shifts": [
          "A",
          "F",
          "C",
          "K",
          "K",
          "O",
          "O"
        ],
        "nurses": [
          33
        ]
      },
      {
        "shifts": [
          "A",
          "C",
          "A",
          "O",
          "O",
          "O",
          "O"
        ],
        "nurses": [
          34
        ]
      },
      {
        "shifts": [
          "O",
          "O",
          "A",
          "O",
          "O",
          "O",
          "O"
        ],
        "nurses": [
          35
        ]
      },
      {
        "shifts": [
          "O",
          "O",
          "O",
          "O",
          "O",
          "O",
          "O"
        ],
        "nurses": []
      },
      {
        "shifts": [
          "O",
          "O",
          "O",
          "O",
          "O",
          "O",
          "O"
        ],
        "nurses": []
      },
      {
        "shifts": [
          "O",
          "A",
          "O",
          "A",
          "A",
          "O",
          "O"
        ],
        "nurses": []
      },
      {
        "shifts": [
          "O",
          "O",
          "O",
          "O",
          "O",
          "O",
          "O"
        ],
        "nurses": []
      }
    ]
  },
  {
    "type": "leader",
    "formula_data": [
      {
        "shifts": [
          "A",
          "A",
          "A",
          "A",
          "A",
          "E",
          "O"
        ],
        "nurses": [
          2
        ]
      },
      {
        "shifts": [
          "A",
          "A",
          "A",
          "A",
          "A",
          "O",
          "O"
        ],
        "nurses": [
          3
        ]
      }
    ]
  },
  {
    "type": "secretary",
    "formula_data": [
      {
        "shifts": [
          "B",
          "B",
          "B",
          "B",
          "B",
          "O",
          "O"
        ],
        "nurses": [
          40
        ]
      }
    ]
  }
];

// 類型映射關係
const typeMapping = {
  'regular': 'anesthesia_specialist',
  'por': 'recovery_nurse',
  'leader': 'anesthesia_leader',
  'secretary': 'anesthesia_secretary'
};

// 將舊版數據轉換為新版格式並保存到 localStorage
function updateFormulaSchedules() {
  try {
    // 從 localStorage 獲取當前的 schedule-storage
    let storageData = localStorage.getItem('schedule-storage');
    
    if (!storageData) {
      console.error('找不到排班存儲數據！');
      return;
    }
    
    // 解析當前的存儲數據
    let parsedData = JSON.parse(storageData);
    
    // 如果沒有 state 或 formulaSchedules，創建它們
    if (!parsedData.state) {
      parsedData.state = {};
    }
    
    if (!parsedData.state.formulaSchedules) {
      parsedData.state.formulaSchedules = {};
    }
    
    // 使用舊版數據更新 formulaSchedules
    oldFormulaData.forEach(formulaItem => {
      const newType = typeMapping[formulaItem.type];
      if (newType) {
        parsedData.state.formulaSchedules[newType] = {
          type: newType,
          formula_data: formulaItem.formula_data
        };
      }
    });
    
    // 將更新後的數據保存回 localStorage
    localStorage.setItem('schedule-storage', JSON.stringify(parsedData));
    
    console.log('成功更新公式班表數據！', parsedData.state.formulaSchedules);
    return parsedData.state.formulaSchedules;
  } catch (error) {
    console.error('更新公式班表數據時發生錯誤：', error);
  }
}

// 執行更新函數
updateFormulaSchedules(); 