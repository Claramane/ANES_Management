/**
 * 公式班表數據遷移工具
 * 用於將舊格式的單一pattern數據轉換為新的多pattern結構
 */
import apiService from './api';

/**
 * 將舊格式的公式班表數據遷移到新格式
 * @returns {Promise<Object>} 遷移結果
 */
export async function migrateFormulaPatternsData() {
  try {
    console.log('開始遷移公式班表數據...');
    
    // 獲取所有公式班表
    const formulas = await apiService.formulaSchedule.getAll();
    console.log(`找到 ${formulas.data.length} 個公式班表`);
    
    const results = {
      total: formulas.data.length,
      success: 0,
      skipped: 0,
      failed: 0,
      details: []
    };
    
    // 遍歷每個公式班表
    for (const formula of formulas.data) {
      try {
        console.log(`處理公式班表 "${formula.name}" (ID: ${formula.id})...`);
        
        // 檢查是否有pattern
        if (!formula.pattern) {
          console.log(`公式班表 "${formula.name}" 沒有pattern，跳過`);
          results.skipped++;
          results.details.push({
            id: formula.id,
            name: formula.name,
            status: 'skipped',
            reason: '沒有pattern'
          });
          continue;
        }
        
        // 獲取公式班表詳情
        const formulaDetail = await apiService.formulaSchedule.getById(formula.id);
        const existingPatterns = formulaDetail.data.patterns || [];
        
        // 如果已經有patterns，跳過
        if (existingPatterns.length > 0) {
          console.log(`公式班表 "${formula.name}" 已經有 ${existingPatterns.length} 個patterns，跳過`);
          results.skipped++;
          results.details.push({
            id: formula.id,
            name: formula.name,
            status: 'skipped',
            reason: `已存在 ${existingPatterns.length} 個patterns`
          });
          continue;
        }
        
        // 創建新的pattern
        const newPattern = {
          formula_id: formula.id,
          group_number: 1,
          pattern: formula.pattern
        };
        
        // 保存新pattern
        const savedPattern = await apiService.formulaSchedule.createPattern(newPattern);
        console.log(`成功為公式班表 "${formula.name}" 創建pattern: ${savedPattern.data.pattern}`);
        
        results.success++;
        results.details.push({
          id: formula.id,
          name: formula.name,
          status: 'success',
          patternId: savedPattern.data.id
        });
        
      } catch (error) {
        console.error(`處理公式班表 "${formula.name}" 時發生錯誤:`, error);
        results.failed++;
        results.details.push({
          id: formula.id,
          name: formula.name,
          status: 'failed',
          error: error.message || '未知錯誤'
        });
      }
    }
    
    console.log('公式班表數據遷移完成', results);
    return results;
    
  } catch (error) {
    console.error('遷移公式班表數據時發生錯誤:', error);
    throw error;
  }
}

export default migrateFormulaPatternsData; 