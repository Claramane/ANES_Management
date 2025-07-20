// 逐步逼近法加班分配演算法測試 v2
// 修正分數基準，目標零分附近分布

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

// 計算7月的工作日和白班需求
function calculateJulyWorkload() {
  const workDays = july2025Days.filter(day => day.dayOfWeek !== 0); // 排除週日
  const weekdayShifts = july2025Days.filter(day => day.dayOfWeek >= 1 && day.dayOfWeek <= 5); // 週一至週五
  const saturdayShifts = july2025Days.filter(day => day.dayOfWeek === 6); // 週六
  
  console.log('7月工作負荷分析：');
  console.log(`總工作日：${workDays.length}天`);
  console.log(`平日：${weekdayShifts.length}天`);
  console.log(`週六：${saturdayShifts.length}天`);
  
  // 平日需要6人加班，週六需要1人加班
  const totalOvertimeSlots = weekdayShifts.length * 6 + saturdayShifts.length * 1;
  const totalAShifts = weekdayShifts.length + saturdayShifts.length;
  
  console.log(`總加班人次：${totalOvertimeSlots}`);
  console.log(`總A班需求：${totalAShifts}`);
  
  return {
    workDays: workDays.length,
    weekdayShifts: weekdayShifts.length,
    saturdayShifts: saturdayShifts.length,
    totalOvertimeSlots,
    totalAShifts
  };
}

// 計算目標分數基準
function calculateTargetScoreBaseline() {
  const workload = calculateJulyWorkload();
  const numStaff = users.length;
  
  // 假設每人平均白班天數約等於工作日數
  const avgWhiteShifts = workload.workDays;
  const baseNegativeScore = avgWhiteShifts * (-0.3);
  
  // 計算總加班正分
  const totalOvertimeSlots = workload.totalOvertimeSlots;
  const avgOvertimeSlotsPerPerson = totalOvertimeSlots / numStaff;
  
  // 估算平均加班正分（假設平均分配）
  const avgAShifts = workload.totalAShifts / numStaff;
  const avgBShifts = (workload.weekdayShifts * 1) / numStaff; // 假設每天1個B班
  const avgCShifts = (workload.weekdayShifts * 1) / numStaff; // 假設每天1個C班
  const avgDShifts = (workload.weekdayShifts * 1) / numStaff; // 假設每天1個D班
  
  const avgPositiveScore = 
    avgAShifts * 1.2 + 
    avgBShifts * 0.7 + 
    avgCShifts * 0.6 + 
    avgDShifts * 0.2;
  
  const avgTotalScore = baseNegativeScore + avgPositiveScore;
  
  console.log('\n分數基準分析：');
  console.log(`平均白班天數：${avgWhiteShifts}天`);
  console.log(`平均白班負分：${baseNegativeScore.toFixed(2)}分`);
  console.log(`平均A班數：${avgAShifts.toFixed(2)}次`);
  console.log(`平均加班正分：${avgPositiveScore.toFixed(2)}分`);
  console.log(`理論平均總分：${avgTotalScore.toFixed(2)}分`);
  
  return {
    avgWhiteShifts,
    baseNegativeScore,
    avgPositiveScore,
    avgTotalScore
  };
}

// 更真實的基礎分數計算（基於實際需要達到零分附近）
function getRealisticBaseScore(userId) {
  const baseline = calculateTargetScoreBaseline();
  
  // 每人白班天數稍有差異（22-26天）
  const whiteShiftVariation = (userId % 5) - 2; // -2 to +2
  const actualWhiteShifts = baseline.avgWhiteShifts + whiteShiftVariation;
  
  return actualWhiteShifts * (-0.3);
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
  console.log('\n=== 第一階段：A班分配 ===');
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

// 第二階段：基於分數差距的逐步逼近分配（目標零分）
function allocateOtherShifts(days, staff, aShiftAllocations) {
  console.log('\n=== 第二階段：其他班別分配（目標零分） ===');
  const startTime = performance.now();
  
  const allAllocations = { ...aShiftAllocations };
  const userScores = {};
  
  // 初始化每人的基礎分數
  staff.forEach(user => {
    userScores[user.id] = {
      userId: user.id,
      name: user.name,
      baseScore: getRealisticBaseScore(user.id),
      currentScore: getRealisticBaseScore(user.id),
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
      
      // 找出分數最低且當天未分配的人（目標零分）
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
      
      // 按分數排序，選擇最低分的人（最需要正分的人）
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
  
  // 計算距離零分的偏差
  const deviationFromZero = scores.map(s => Math.abs(s));
  const avgDeviationFromZero = deviationFromZero.reduce((a, b) => a + b, 0) / deviationFromZero.length;
  const maxDeviationFromZero = Math.max(...deviationFromZero);
  
  console.log(`\n分數統計：`);
  console.log(`最低分：${minScore.toFixed(2)}`);
  console.log(`最高分：${maxScore.toFixed(2)}`);
  console.log(`平均分：${avgScore.toFixed(2)}`);
  console.log(`分數範圍：${scoreRange.toFixed(2)}`);
  console.log(`平均偏離零分：${avgDeviationFromZero.toFixed(2)}`);
  console.log(`最大偏離零分：${maxDeviationFromZero.toFixed(2)}`);
  
  console.log('\n最終分數排名：');
  Object.values(userScores)
    .sort((a, b) => a.currentScore - b.currentScore)
    .forEach((user, index) => {
      const aCount = user.allocations.filter(a => a.shift === 'A').length;
      const deviation = Math.abs(user.currentScore);
      console.log(`${index + 1}. ${user.name}: ${user.currentScore.toFixed(2)}分 (A班:${aCount}次, 偏離:${deviation.toFixed(2)})`);
    });
  
  // 檢查是否在±2分範圍內
  const withinRange = scores.filter(s => Math.abs(s) <= 2.0).length;
  const withinRangePercentage = (withinRange / scores.length * 100).toFixed(1);
  
  console.log(`\n±2分範圍內：${withinRange}/${scores.length}人 (${withinRangePercentage}%)`);
  
  return {
    scoreRange,
    avgDeviationFromZero,
    maxDeviationFromZero,
    withinRangePercentage: parseFloat(withinRangePercentage),
    avgScore,
    minScore,
    maxScore
  };
}

// 主函數
function main() {
  console.log('=== 逐步逼近法加班分配測試 v2 ===');
  console.log('目標：分數分布在零分附近');
  
  // 分析工作負荷
  calculateTargetScoreBaseline();
  
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
  console.log(`平均偏離零分：${results.avgDeviationFromZero.toFixed(2)}分`);
  console.log(`±2分範圍內：${results.withinRangePercentage}%`);
  console.log(`零分中心度評估：${results.avgDeviationFromZero < 1.0 ? '✅ 優秀' : results.avgDeviationFromZero < 2.0 ? '⚠️ 可接受' : '❌ 需要調整'}`);
}

// 執行測試
main();