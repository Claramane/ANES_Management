#!/usr/bin/env node
/**
 * 測試前端統一分數導向算法
 */

// 模擬前端算法的核心部分
const NO_OVERTIME_PENALTY = -0.196;

const calculateOvertimeScore = (overtimeShift) => {
  switch (overtimeShift) {
    case 'A': return 2.0;
    case 'B': return 1.0;
    case 'C': return 0.8;
    case 'D': return 0.3;
    case 'E': 
    case 'F': return 0.0;
    default: return 0.0;
  }
};

const calculateUserBaseScore = (user, workDays) => {
  const userType = user.id % 4;
  let attendanceRate;
  
  if (userType === 0) {
    attendanceRate = 0.9;
  } else if (userType === 1) {
    attendanceRate = 0.95;
  } else if (userType === 2) {
    attendanceRate = 0.7;
  } else {
    attendanceRate = 0.85;
  }
  
  const actualWhiteShifts = Math.floor(workDays * attendanceRate);
  return actualWhiteShifts * NO_OVERTIME_PENALTY;
};

// 測試數據
const testUsers = [
  { id: 5, name: "蔡秀金", identity: "麻醉專科護理師" },
  { id: 6, name: "張慈珮", identity: "麻醉專科護理師" },
  { id: 7, name: "許舒惠", identity: "麻醉專科護理師" },
  { id: 8, name: "何瑩慧", identity: "麻醉專科護理師" },
  { id: 9, name: "林雪美", identity: "麻醉專科護理師" }
];

// 模擬一個月的工作天數（27天，不含週日）
const workDays = 27;

console.log('=== 測試前端統一分數導向算法 ===');
console.log(`工作天數：${workDays}天`);
console.log('分數系統: A=2.0, B=1.0, C=0.8, D=0.3, E=0.0, F=0.0, 未加班=-0.196');
console.log('');

// 測試基礎分數計算
console.log('=== 基礎分數計算測試 ===');
testUsers.forEach(user => {
  const baseScore = calculateUserBaseScore(user, workDays);
  const userType = user.id % 4;
  const attendanceRates = [0.9, 0.95, 0.7, 0.85];
  const attendanceRate = attendanceRates[userType];
  const whiteShifts = Math.floor(workDays * attendanceRate);
  
  console.log(`${user.name} (ID:${user.id}): 基礎分數 ${baseScore.toFixed(2)}分 (白班${whiteShifts}天, 出勤率${(attendanceRate*100).toFixed(0)}%)`);
});

console.log('');

// 測試分配邏輯
console.log('=== 分配邏輯測試 ===');
const userScores = {};

// 初始化分數
testUsers.forEach(user => {
  const baseScore = calculateUserBaseScore(user, workDays);
  userScores[user.id] = {
    user: user,
    baseScore: baseScore,
    currentScore: baseScore,
    allocations: []
  };
});

// 模擬分配幾個班別
const allocations = [
  { userId: 5, shift: 'A' },
  { userId: 6, shift: 'B' },
  { userId: 7, shift: 'C' },
  { userId: 8, shift: 'D' },
  { userId: 9, shift: 'E' }
];

allocations.forEach(allocation => {
  const shiftScore = calculateOvertimeScore(allocation.shift);
  userScores[allocation.userId].currentScore += shiftScore;
  userScores[allocation.userId].allocations.push(allocation);
  
  console.log(`${userScores[allocation.userId].user.name} 分配 ${allocation.shift}班: +${shiftScore}分, 總分: ${userScores[allocation.userId].currentScore.toFixed(2)}分`);
});

console.log('');

// 分析結果
console.log('=== 結果分析 ===');
const scores = Object.values(userScores).map(data => data.currentScore);
const minScore = Math.min(...scores);
const maxScore = Math.max(...scores);
const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
const scoreRange = maxScore - minScore;
const avgDeviationFromZero = scores.reduce((sum, score) => sum + Math.abs(score), 0) / scores.length;

console.log(`分數範圍：${scoreRange.toFixed(2)}分 (${minScore.toFixed(2)} 到 ${maxScore.toFixed(2)})`);
console.log(`平均分數：${avgScore.toFixed(2)}分`);
console.log(`平均偏離零分：${avgDeviationFromZero.toFixed(2)}分`);

// 檢查按分數排序的選擇邏輯
console.log('');
console.log('=== 選擇邏輯測試（按分數排序） ===');
const sortedUsers = Object.values(userScores).sort((a, b) => a.currentScore - b.currentScore);
sortedUsers.forEach((userData, index) => {
  console.log(`${index + 1}. ${userData.user.name}: ${userData.currentScore.toFixed(2)}分`);
});

console.log('');
console.log('✅ 前端算法測試完成！');
console.log('算法重點：');
console.log('1. 分數最低的人優先獲得高分班別');
console.log('2. A、B班考慮間隔時間（≥7天）');
console.log('3. 目標：所有人分數接近零分');