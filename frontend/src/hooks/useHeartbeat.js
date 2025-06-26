import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import apiService from '../utils/api';

const useHeartbeat = () => {
  const { user } = useAuthStore();
  const heartbeatIntervalRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const isVisibleRef = useRef(true);

  // 發送心跳
  const sendHeartbeat = useCallback(async () => {
    if (!user) return;
    
    try {
      await apiService.user.heartbeat();
      console.log('心跳發送成功');
    } catch (error) {
      console.error('心跳發送失敗:', error);
      // 靜默失敗，不影響用戶體驗
    }
  }, [user]);

  // 記錄用戶活動
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // 檢查頁面可見性
  const handleVisibilityChange = useCallback(() => {
    isVisibleRef.current = !document.hidden;
    
    if (isVisibleRef.current) {
      // 頁面變為可見時，立即發送心跳
      sendHeartbeat();
    }
  }, [sendHeartbeat]);

  // 監聽用戶活動事件
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // 添加事件監聽器
    events.forEach(event => {
      document.addEventListener(event, recordActivity, true);
    });

    // 添加頁面可見性監聽器
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // 清理事件監聽器
      events.forEach(event => {
        document.removeEventListener(event, recordActivity, true);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [recordActivity, handleVisibilityChange]);

  // 心跳定時器
  useEffect(() => {
    if (!user) {
      // 如果用戶未登錄，清除定時器
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      return;
    }

    // 設置心跳定時器 - 每2分鐘檢查一次
    heartbeatIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      
      // 只有在頁面可見且用戶在過去5分鐘內有活動時才發送心跳
      if (isVisibleRef.current && timeSinceLastActivity < 5 * 60 * 1000) {
        sendHeartbeat();
      }
    }, 2 * 60 * 1000); // 每2分鐘

    // 立即發送一次心跳
    sendHeartbeat();

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [user, sendHeartbeat]);

  // 頁面卸載時發送最後一次心跳
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user && navigator.sendBeacon) {
        // 使用 sendBeacon 確保在頁面卸載時能發送請求
        const data = JSON.stringify({});
        navigator.sendBeacon('/api/heartbeat', data);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  return {
    sendHeartbeat,
    recordActivity
  };
};

export default useHeartbeat; 