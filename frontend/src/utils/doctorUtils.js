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
    return null;
  }

  try {
    const doctorArray = JSON.parse(doctorDataEnv);
    
    // 將陣列轉換為對象映射
    const doctorMapping = {};
    doctorArray.forEach(doctor => {
        doctorMapping[doctor.name] = doctor.employee_id;
    });
    
    return doctorMapping;
  } catch (error) {
    console.error('解析醫師資料失敗:', error);
    return null;
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