// 逐步逼近法加班分配演算法測試
// 2025年7月加班分配實驗

const users = [
  { id: 5, name: "蔡秀金", role: "supervise_nurse" },
  { id: 6, name: "張慈珮", role: "supervise_nurse" },
  { id: 7, name: "許舒惠", role: "supervise_nurse" },
  { id: 8, name: "何瑩慧", role: "supervise_nurse" },
  { id: 9, name: "林雪美", role: "supervise_nurse" },
  { id: 10, name: "謝珮陵", role: "supervise_nurse" },
  { id: 11, name: "陳稚平", role: "supervise_nurse" },
  { id: 12, name: "李相君", role: "supervise_nurse" },
  { id: 13, name: "顧心如", role: "supervise_nurse" },
  { id: 14, name: "葉朝菩", role: "supervise_nurse" },
  { id: 15, name: "石育菁", role: "supervise_nurse" },
  { id: 16, name: "王姿惠", role: "supervise_nurse" },
  { id: 17, name: "任雯怡", role: "supervise_nurse" },
  { id: 18, name: "李宥蓁", role: "supervise_nurse" },
  { id: 20, name: "周穎昇", role: "nurse" },
  { id: 21, name: "趙仁傑", role: "nurse" },
  { id: 22, name: "施瑩瑩", role: "supervise_nurse" },
  { id: 23, name: "葉怡彣", role: "nurse" },
  { id: 24, name: "邱卉羚", role: "supervise_nurse" },
  { id: 25, name: "羅雅文", role: "nurse" },
  { id: 26, name: "王釋璞", role: "nurse" },
  { id: 27, name: "游佳蓁", role: "nurse" },
  { id: 28, name: "張育蓉", role: "nurse" },
  { id: 30, name: "李佳欣", role: "nurse" },
  { id: 31, name: "王欣媚", role: "nurse" },
  { id: 32, name: "游芷欣", role: "nurse" },
  { id: 33, name: "林蓁", role: "nurse" }
];

// 2025年7月日期配置
const july2025Days = [
  { date: '2025-07-01', dayOfWeek: 2, isWeekend: false }, // 週二
  { date: '2025-07-02', dayOfWeek: 3, isWeekend: false }, // 週三
  { date: '2025-07-03', dayOfWeek: 4, isWeekend: false }, // 週四
  { date: '2025-07-04', dayOfWeek: 5, isWeekend: false }, // 週五
  { date: '2025-07-05', dayOfWeek: 6, isWeekend: true },  // 週六
  { date: '2025-07-06', dayOfWeek: 0, isWeekend: true },  // 週日
  { date: '2025-07-07', dayOfWeek: 1, isWeekend: false }, // 週一
  { date: '2025-07-08', dayOfWeek: 2, isWeekend: false }, // 週二
  { date: '2025-07-09', dayOfWeek: 3, isWeekend: false }, // 週三
  { date: '2025-07-10', dayOfWeek: 4, isWeekend: false }, // 週四
  { date: '2025-07-11', dayOfWeek: 5, isWeekend: false }, // 週五
  { date: '2025-07-12', dayOfWeek: 6, isWeekend: true },  // 週六
  { date: '2025-07-13', dayOfWeek: 0, isWeekend: true },  // 週日
  { date: '2025-07-14', dayOfWeek: 1, isWeekend: false }, // 週一
  { date: '2025-07-15', dayOfWeek: 2, isWeekend: false }, // 週二
  { date: '2025-07-16', dayOfWeek: 3, isWeekend: false }, // 週三
  { date: '2025-07-17', dayOfWeek: 4, isWeekend: false }, // 週四
  { date: '2025-07-18', dayOfWeek: 5, isWeekend: false }, // 週五
  { date: '2025-07-19', dayOfWeek: 6, isWeekend: true },  // 週六
  { date: '2025-07-20', dayOfWeek: 0, isWeekend: true },  // 週日
  { date: '2025-07-21', dayOfWeek: 1, isWeekend: false }, // 週一
  { date: '2025-07-22', dayOfWeek: 2, isWeekend: false }, // 週二
  { date: '2025-07-23', dayOfWeek: 3, isWeekend: false }, // 週三
  { date: '2025-07-24', dayOfWeek: 4, isWeekend: false }, // 週四
  { date: '2025-07-25', dayOfWeek: 5, isWeekend: false }, // 週五
  { date: '2025-07-26', dayOfWeek: 6, isWeekend: true },  // 週六
  { date: '2025-07-27', dayOfWeek: 0, isWeekend: true },  // 週日
  { date: '2025-07-28', dayOfWeek: 1, isWeekend: false }, // 週一
  { date: '2025-07-29', dayOfWeek: 2, isWeekend: false }, // 週二
  { date: '2025-07-30', dayOfWeek: 3, isWeekend: false }, // 週三
  { date: '2025-07-31', dayOfWeek: 4, isWeekend: false }  // 週四
];

// 計算分數的函數
function calculateOvertimeScore(overtimeShift) {
  switch (overtimeShift) {
    case 'A': return 1.2;
    case 'B': return 0.7;
    case 'C': return 0.6;
    case 'D': return 0.2;
    case 'E': 
    case 'F': return 0.0;
    default: return 0.0;
  }
}

// 模擬每人的白班天數（假設每人平均22天白班，會有-0.3分的基礎）
function getBaseScore(userId) {
  // 模擬不同人有不同的白班天數
  const baseWhiteShifts = 20 + (userId % 5); // 20-24天白班
  return baseWhiteShifts * (-0.3);
}

// 週分組函數
function groupDaysByWeek(days) {
  const weeks = [];
  let currentWeek = [];
  
  days.forEach(day => {
    if (day.dayOfWeek === 1 && currentWeek.length > 0) {
      // 週一開始新的一週
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
    currentWeek.push(day);
  });
  
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }
  
  return weeks;
}

// 第一階段：A班週內平衡分配
function allocateAShifts(days, staff) {
  console.log('=== 第一階段：A班分配 ===');
  const startTime = performance.now();
  
  const weeks = groupDaysByWeek(days);
  const aShiftAllocations = {}; // { date: userId }
  const userWeeklyACount = {}; // { userId: weekCount }
  
  staff.forEach(user => {
    userWeeklyACount[user.id] = 0;
  });
  
  console.log(`總共 ${weeks.length} 週，需要分配A班的日期：`);
  
  weeks.forEach((week, weekIndex) => {
    console.log(`\n--- 第${weekIndex + 1}週 ---`);
    
    // 找出本週需要A班的日期
    const weekAShiftDays = week.filter(day => {
      if (day.dayOfWeek === 0) return false; // 週日不排加班
      if (day.dayOfWeek === 6) return true;  // 週六需要1個A班
      return true; // 平日需要A班
    });
    
    console.log(`本週A班需求：${weekAShiftDays.map(d => d.date).join(', ')}`);
    
    // 找出本週還沒分配過A班的人員
    const availableStaff = staff.filter(user => userWeeklyACount[user.id] === 0);
    
    console.log(`可用人員：${availableStaff.length}人`);
    
    // 為每一天分配A班
    weekAShiftDays.forEach(day => {
      if (availableStaff.length === 0) {
        console.log(`警告：${day.date} 沒有可用人員分配A班`);
        return;
      }
      
      // 隨機選擇一位
      const randomIndex = Math.floor(Math.random() * availableStaff.length);
      const selectedUser = availableStaff[randomIndex];
      
      aShiftAllocations[day.date] = selectedUser.id;
      userWeeklyACount[selectedUser.id]++;
      
      console.log(`${day.date} A班 → ${selectedUser.name} (id: ${selectedUser.id})`);
      
      // 從可用名單中移除（確保週內不重複）
      availableStaff.splice(randomIndex, 1);
    });
    
    // 重置週計數器
    staff.forEach(user => {
      userWeeklyACount[user.id] = 0;
    });
  });
  
  const endTime = performance.now();
  console.log(`\nA班分配完成，耗時：${(endTime - startTime).toFixed(2)}ms`);
  console.log(`總共分配了 ${Object.keys(aShiftAllocations).length} 個A班`);
  
  return aShiftAllocations;
}

// 第二階段：基於分數差距的逐步逼近分配
function allocateOtherShifts(days, staff, aShiftAllocations) {
  console.log('\n=== 第二階段：其他班別分配 ===');
  const startTime = performance.now();
  
  const allAllocations = { ...aShiftAllocations };
  const userScores = {};
  
  // 初始化每人的基礎分數
  staff.forEach(user => {
    userScores[user.id] = {
      userId: user.id,
      name: user.name,
      baseScore: getBaseScore(user.id),
      currentScore: getBaseScore(user.id),
      allocations: []
    };
  });
  
  // 加入A班分數
  Object.entries(aShiftAllocations).forEach(([date, userId]) => {
    userScores[userId].currentScore += calculateOvertimeScore('A');
    userScores[userId].allocations.push({ date, shift: 'A' });
  });
  
  console.log('\n初始分數狀況（含A班）：');
  Object.values(userScores)
    .sort((a, b) => a.currentScore - b.currentScore)
    .forEach(user => {
      console.log(`${user.name}: ${user.currentScore.toFixed(2)}分`);
    });
  
  // 需要分配其他班別的日期
  const otherShiftDays = days.filter(day => {
    if (day.dayOfWeek === 0) return false; // 週日不排加班
    return true;
  });
  
  const shiftsToAllocate = ['B', 'C', 'D', 'E', 'F'];
  let iterationCount = 0;
  
  otherShiftDays.forEach(day => {
    console.log(`\n--- ${day.date} 其他班別分配 ---`);
    
    if (day.dayOfWeek === 6) {
      // 週六只有A班，不需要其他班別
      console.log('週六，僅A班，跳過其他班別');
      return;
    }
    
    shiftsToAllocate.forEach(shiftType => {
      iterationCount++;
      
      // 找出分數最低且當天未分配的人
      const availableUsers = staff.filter(user => {
        // 檢查當天是否已分配
        return !Object.entries(allAllocations).some(([allocDate, allocUserId]) => 
          allocDate === day.date && allocUserId === user.id
        );
      });
      
      if (availableUsers.length === 0) {
        console.log(`${shiftType}班無可用人員`);
        return;
      }
      
      // 按分數排序，選擇最低分的人
      availableUsers.sort((a, b) => userScores[a.id].currentScore - userScores[b.id].currentScore);
      const selectedUser = availableUsers[0];
      
      // 分配班別
      const allocationKey = `${day.date}_${shiftType}`;
      allAllocations[allocationKey] = selectedUser.id;
      
      // 更新分數
      const shiftScore = calculateOvertimeScore(shiftType);
      userScores[selectedUser.id].currentScore += shiftScore;
      userScores[selectedUser.id].allocations.push({ date: day.date, shift: shiftType });
      
      console.log(`${shiftType}班 → ${selectedUser.name} (+${shiftScore}分, 總分: ${userScores[selectedUser.id].currentScore.toFixed(2)})`);
    });
  });
  
  const endTime = performance.now();
  console.log(`\n其他班別分配完成，耗時：${(endTime - startTime).toFixed(2)}ms`);
  console.log(`總迭代次數：${iterationCount}`);
  
  return { allAllocations, userScores };
}

// 分析結果
function analyzeResults(userScores) {
  console.log('\n=== 最終結果分析 ===');
  
  const scores = Object.values(userScores).map(u => u.currentScore);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const scoreRange = maxScore - minScore;
  
  console.log(`\n分數統計：`);
  console.log(`最低分：${minScore.toFixed(2)}`);
  console.log(`最高分：${maxScore.toFixed(2)}`);
  console.log(`平均分：${avgScore.toFixed(2)}`);
  console.log(`分數範圍：${scoreRange.toFixed(2)}`);
  
  console.log('\n最終分數排名：');
  Object.values(userScores)
    .sort((a, b) => a.currentScore - b.currentScore)
    .forEach((user, index) => {
      const aCount = user.allocations.filter(a => a.shift === 'A').length;
      console.log(`${index + 1}. ${user.name}: ${user.currentScore.toFixed(2)}分 (A班:${aCount}次)`);
    });
  
  // 檢查週內A班限制
  console.log('\n=== 週內A班檢查 ===');
  const weeks = groupDaysByWeek(july2025Days);
  let weeklyViolations = 0;
  
  weeks.forEach((week, weekIndex) => {
    console.log(`\n第${weekIndex + 1}週 A班分配：`);
    const weekAAllocations = {};
    
    week.forEach(day => {
      Object.values(userScores).forEach(user => {
        const dayAAllocation = user.allocations.find(a => 
          a.date === day.date && a.shift === 'A'
        );
        if (dayAAllocation) {
          if (!weekAAllocations[user.userId]) weekAAllocations[user.userId] = [];
          weekAAllocations[user.userId].push(day.date);
        }
      });
    });
    
    Object.entries(weekAAllocations).forEach(([userId, dates]) => {
      const user = userScores[userId];
      console.log(`${user.name}: ${dates.join(', ')} (${dates.length}次)`);
      if (dates.length > 1) {
        weeklyViolations++;
        console.log(`⚠️  週內A班超過1次！`);
      }
    });
  });
  
  console.log(`\n週內A班違規次數：${weeklyViolations}`);
  
  return {
    scoreRange,
    weeklyViolations,
    avgScore,
    minScore,
    maxScore
  };
}

// 主函數
function main() {
  console.log('=== 逐步逼近法加班分配測試 ===');
  console.log(`測試月份：2025年7月`);
  console.log(`參與人數：${users.length}人`);
  console.log(`總天數：${july2025Days.length}天`);
  
  const overallStartTime = performance.now();
  
  // 第一階段：A班分配
  const aShiftAllocations = allocateAShifts(july2025Days, users);
  
  // 第二階段：其他班別分配
  const { allAllocations, userScores } = allocateOtherShifts(july2025Days, users, aShiftAllocations);
  
  // 分析結果
  const results = analyzeResults(userScores);
  
  const overallEndTime = performance.now();
  
  console.log('\n=== 性能總結 ===');
  console.log(`總耗時：${(overallEndTime - overallStartTime).toFixed(2)}ms`);
  console.log(`分數範圍：${results.scoreRange.toFixed(2)}分`);
  console.log(`週內違規：${results.weeklyViolations}次`);
  console.log(`平衡度評估：${results.scoreRange < 2.0 ? '✅ 優秀' : results.scoreRange < 4.0 ? '⚠️  可接受' : '❌ 需要調整'}`);
}

// 執行測試
main();