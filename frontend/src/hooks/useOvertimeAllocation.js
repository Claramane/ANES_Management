import { useState, useRef, useCallback } from 'react';
import { 
  allocateFullOvertime, 
  allocatePartialOvertime 
} from '../utils/overtimeAllocation';

/**
 * 加班分配自定義Hook
 * 管理分配狀態和邏輯
 */
export const useOvertimeAllocation = (logger = console) => {
  const [isAllocating, setIsAllocating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const shouldCancelRef = useRef(false);

  /**
   * 執行完整分配
   */
  const performFullAllocation = useCallback(async (overtimeData, options = {}) => {
    setIsAllocating(true);
    shouldCancelRef.current = false;

    try {
      logger.info('開始統一分數導向全部重新分配...');
      
      // 檢查是否被取消
      if (shouldCancelRef.current) {
        logger.info('分配已被用戶取消');
        return { success: false, message: '已成功取消分配生成' };
      }

      // 使用統一分數導向分配算法
      const newMarkings = allocateFullOvertime(overtimeData, logger, options);
      
      // 檢查是否被取消
      if (shouldCancelRef.current) {
        logger.info('分配已被用戶取消');
        return { success: false, message: '已成功取消分配生成' };
      }

      return { 
        success: true, 
        markings: newMarkings,
        message: '統一分數導向自動分配完成！所有班別都按分數最低優先原則分配，已達到最佳平衡。請記得保存變更'
      };
      
    } catch (error) {
      logger.error('統一分數導向自動分配失敗:', error);
      return { 
        success: false, 
        message: `統一分數導向自動分配時發生錯誤: ${error.message || '未知錯誤'}` 
      };
    } finally {
      setIsAllocating(false);
      shouldCancelRef.current = false;
    }
  }, [logger]);

  /**
   * 執行部分分配（保留現有）
   */
  const performPartialAllocation = useCallback(async (overtimeData, existingMarkings, options = {}) => {
    setIsAllocating(true);
    shouldCancelRef.current = false;

    try {
      logger.info('開始統一分數導向部分分配...');
      
      // 檢查是否被取消
      if (shouldCancelRef.current) {
        logger.info('分配已被用戶取消');
        return { success: false, message: '已成功取消分配生成' };
      }

      // 使用統一分數導向分配算法，但保留現有標記
      const newMarkings = allocatePartialOvertime(overtimeData, existingMarkings, logger, options);
      
      // 檢查是否被取消
      if (shouldCancelRef.current) {
        logger.info('分配已被用戶取消');
        return { success: false, message: '已成功取消分配生成' };
      }

      return { 
        success: true, 
        markings: newMarkings,
        message: '統一分數導向自動部分分配完成！未分配的班別已按分數最低優先原則補齊。請記得保存變更'
      };
      
    } catch (error) {
      logger.error('統一分數導向自動部分分配失敗:', error);
      return { 
        success: false, 
        message: `統一分數導向自動部分分配時發生錯誤: ${error.message || '未知錯誤'}` 
      };
    } finally {
      setIsAllocating(false);
      shouldCancelRef.current = false;
    }
  }, [logger]);

  /**
   * 取消分配
   */
  const cancelAllocation = useCallback(() => {
    shouldCancelRef.current = true;
    logger.info('用戶請求取消自動分配');
  }, [logger]);

  /**
   * 顯示確認對話框
   */
  const showAllocationDialog = useCallback(() => {
    setShowConfirmDialog(true);
  }, []);

  /**
   * 隱藏確認對話框
   */
  const hideAllocationDialog = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  return {
    // 狀態
    isAllocating,
    showConfirmDialog,
    
    // 操作函數
    performFullAllocation,
    performPartialAllocation,
    cancelAllocation,
    showAllocationDialog,
    hideAllocationDialog
  };
};
