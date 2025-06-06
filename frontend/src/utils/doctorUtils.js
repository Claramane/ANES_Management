// 醫師資料工具函數

/**
 * 從環境變數獲取醫師資料映射
 * @returns {Object} 醫師姓名到employee_id的映射
 */
export const getDoctorMapping = () => {
  // 讀取環境變數並解析醫師資料
  const doctorDataEnv = process.env.REACT_APP_DOCTOR_EMPLOYEE_MAPPING;

  if (!doctorDataEnv) {
    console.warn('未設置 REACT_APP_DOCTOR_EMPLOYEE_MAPPING 環境變數');
    return {};
  }

  try {
    // 添加調試信息
    console.log('原始環境變數長度:', doctorDataEnv.length);
    console.log('環境變數前100字符:', doctorDataEnv.substring(0, 100));
    console.log('環境變數後100字符:', doctorDataEnv.substring(Math.max(0, doctorDataEnv.length - 100)));
    
    // 清理可能的問題字符
    let cleanedJson = doctorDataEnv
      .trim() // 移除首尾空白
      .replace(/\n/g, '') // 移除換行符
      .replace(/\r/g, '') // 移除回車符
      .replace(/\t/g, ''); // 移除製表符
    
    console.log('清理後的JSON前100字符:', cleanedJson.substring(0, 100));
    
    const doctorArray = JSON.parse(cleanedJson);
    
    if (!Array.isArray(doctorArray)) {
      console.error('醫師資料不是陣列格式:', typeof doctorArray);
      return {};
    }
    
    // 將陣列轉換為對象映射
    const doctorMapping = {};
    doctorArray.forEach(doctor => {
      if (doctor && doctor.name && doctor.employee_id) {
        doctorMapping[doctor.name] = doctor.employee_id;
      } else {
        console.warn('無效的醫師資料項目:', doctor);
      }
    });
    
    console.log('成功解析醫師映射:', Object.keys(doctorMapping).length, '位醫師');
    return doctorMapping;
  } catch (error) {
    console.error('解析醫師資料失敗:', error);
    console.error('錯誤位置附近的文字:', 
      doctorDataEnv.substring(Math.max(0, 330 - 50), 330 + 50)
    );
    
    // 返回空對象而不是null，避免後續的null讀取錯誤
    return {};
  }
};

/**
 * 格式化醫師顯示名稱，如果有employee_id則顯示
 * @param {string} doctorName - 醫師姓名
 * @param {Object} doctorMapping - 醫師資料映射 (可選)
 * @returns {string} 格式化後的醫師名稱
 */
export const formatDoctorName = (doctorName, doctorMapping = null) => {
  if (!doctorName || doctorName === '無' || doctorName === '無資料') {
    return doctorName;
  }
  
  // 如果沒有提供映射，則獲取預設映射
  const mapping = doctorMapping || getDoctorMapping();
  
  // 確保mapping是對象而不是null
  if (!mapping || typeof mapping !== 'object') {
    return doctorName;
  }
  
  // 查找對應的employee_id
  const employeeId = mapping[doctorName];
  
  if (employeeId) {
    return `${doctorName} (${employeeId})`;
  }
  
  return doctorName;
};

/**
 * 檢查是否啟用醫師employee_id顯示功能
 * @returns {boolean} 是否啟用
 */
export const isEmployeeIdDisplayEnabled = () => {
  const doctorDataEnv = process.env.REACT_APP_DOCTOR_EMPLOYEE_MAPPING;
  return !!doctorDataEnv;
}; 