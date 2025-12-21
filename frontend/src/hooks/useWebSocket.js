/**
 * WebSocket Hook
 * 管理 WebSocket 連接、自動重連、心跳保活、訊息處理
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore } from '../store/authStore';

const WS_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'wss://anesmanagementbackend.zeabur.app/api/ws'
  : 'ws://localhost:8000/api/ws';

// 重連配置
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]; // 重連延遲（毫秒）
const MAX_RECONNECT_ATTEMPTS = 5; // 最大重連次數
const HEARTBEAT_INTERVAL = 20000; // 心跳間隔（20秒）

const useWebSocket = (options = {}) => {
  const { user, token } = useAuthStore();
  const userId = user?.id; // 提取穩定的 ID 值，避免 user 對象引用變化導致重連

  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);

  // WebSocket 實例
  const wsRef = useRef(null);

  // 重連相關
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);

  // 心跳相關
  const heartbeatIntervalRef = useRef(null);
  const lastPongTimeRef = useRef(Date.now());

  // 訊息處理器
  const messageHandlersRef = useRef({});

  // 手動關閉標記（防止自動重連）
  const manualCloseRef = useRef(false);

  /**
   * 連接 WebSocket
   */
  const connect = useCallback(() => {
    if (!userId || !token) {
      console.log('[WebSocket] 未登入，跳過連接');
      return;
    }

    // 🔒 如果已經有活躍連接或正在連接，直接返回，避免重複連接
    if (wsRef.current) {
      const currentState = wsRef.current.readyState;
      if (currentState === WebSocket.CONNECTING || currentState === WebSocket.OPEN) {
        console.log('[WebSocket] 已有活躍連接，跳過重複連接');
        return;
      }

      // 只有在 CLOSING 或 CLOSED 狀態時才關閉舊連接
      if (currentState === WebSocket.CLOSING) {
        console.log('[WebSocket] 連接正在關閉中，等待完成');
        return;
      }
    }

    try {
      // 建立 WebSocket 連接（帶 token）
      const wsUrl = `${WS_BASE_URL}?token=${encodeURIComponent(token)}`;
      console.log('[WebSocket] 正在連接...', wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // 連接成功
      ws.onopen = () => {
        console.log('[WebSocket] 連接成功');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
        lastPongTimeRef.current = Date.now();

        // 啟動心跳
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }

        heartbeatIntervalRef.current = setInterval(() => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return;
          }

          // 檢查心跳超時
          const timeSinceLastPong = Date.now() - lastPongTimeRef.current;
          if (timeSinceLastPong > 60000) {
            console.error('[WebSocket] 心跳超時，重新連接');
            wsRef.current.close();
            return;
          }

          // 發送 ping
          try {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
            console.log('[WebSocket] 發送心跳');
          } catch (error) {
            console.error('[WebSocket] 發送心跳失敗:', error);
          }
        }, HEARTBEAT_INTERVAL);
      };

      // 接收訊息
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[WebSocket] 收到訊息:', message);

          const { type, data } = message;

          switch (type) {
            case 'connection_established':
              console.log('[WebSocket] 連接已建立:', data);
              break;

            case 'pong':
              lastPongTimeRef.current = Date.now();
              console.log('[WebSocket] 收到心跳回應');
              break;

            case 'online_users_update':
              console.log('[WebSocket] 在線用戶更新:', data);
              setOnlineUsers(data.users || []);

              if (messageHandlersRef.current.onlineUsersUpdate) {
                messageHandlersRef.current.onlineUsersUpdate(data.users || []);
              }
              break;

            case 'user_status_change':
              console.log('[WebSocket] 用戶狀態變更:', data);

              if (messageHandlersRef.current.userStatusChange) {
                messageHandlersRef.current.userStatusChange(data);
              }
              break;

            default:
              console.log('[WebSocket] 未處理的訊息類型:', type, data);

              if (messageHandlersRef.current.message) {
                messageHandlersRef.current.message(message);
              }
              break;
          }
        } catch (error) {
          console.error('[WebSocket] 解析訊息失敗:', error);
        }
      };

      // 連接關閉
      ws.onclose = (event) => {
        console.log('[WebSocket] 連接關閉', event.code, event.reason);
        setIsConnected(false);

        // 停止心跳
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // 如果不是手動關閉，嘗試重連
        if (!manualCloseRef.current) {
          if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.error('[WebSocket] 達到最大重連次數，停止重連');
            setConnectionError('WebSocket 重連失敗，請刷新頁面');
            return;
          }

          const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptsRef.current, RECONNECT_DELAYS.length - 1)];
          console.log(`[WebSocket] 將在 ${delay}ms 後重連（第 ${reconnectAttemptsRef.current + 1} 次）`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            manualCloseRef.current = false;
            connect();
          }, delay);
        }
      };

      // 連接錯誤
      ws.onerror = (error) => {
        console.error('[WebSocket] 連接錯誤:', error);
        setConnectionError('WebSocket 連接錯誤');
      };

    } catch (error) {
      console.error('[WebSocket] 建立連接失敗:', error);
      setConnectionError(error.message);

      // 重連
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptsRef.current, RECONNECT_DELAYS.length - 1)];
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connect();
        }, delay);
      }
    }
  }, [userId, token]);

  /**
   * 斷開連接
   */
  const disconnect = useCallback(() => {
    console.log('[WebSocket] 手動斷開連接');
    manualCloseRef.current = true;

    // 停止心跳
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    // 清除重連定時器
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  /**
   * 處理訊息
   */
  const handleMessage = useCallback((message) => {
    const { type, data } = message;

    switch (type) {
      case 'connection_established':
        console.log('[WebSocket] 連接已建立:', data);
        break;

      case 'pong':
        // 收到心跳回應
        lastPongTimeRef.current = Date.now();
        console.log('[WebSocket] 收到心跳回應');
        break;

      case 'online_users_update':
        // 更新在線用戶列表
        console.log('[WebSocket] 在線用戶更新:', data);
        setOnlineUsers(data.users || []);

        // 觸發自定義處理器
        if (messageHandlersRef.current.onlineUsersUpdate) {
          messageHandlersRef.current.onlineUsersUpdate(data.users || []);
        }
        break;

      case 'user_status_change':
        // 用戶狀態變更
        console.log('[WebSocket] 用戶狀態變更:', data);

        // 觸發自定義處理器
        if (messageHandlersRef.current.userStatusChange) {
          messageHandlersRef.current.userStatusChange(data);
        }
        break;

      default:
        console.log('[WebSocket] 未處理的訊息類型:', type, data);

        // 觸發通用訊息處理器
        if (messageHandlersRef.current.message) {
          messageHandlersRef.current.message(message);
        }
        break;
    }
  }, []);

  /**
   * 發送訊息
   */
  const sendMessage = useCallback((message) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('[WebSocket] 無法發送訊息：連接未就緒');
      return false;
    }

    try {
      wsRef.current.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('[WebSocket] 發送訊息失敗:', error);
      return false;
    }
  }, []);

  /**
   * 啟動心跳
   */
  const startHeartbeat = useCallback(() => {
    // 清除舊的心跳定時器
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    // 設置新的心跳定時器
    heartbeatIntervalRef.current = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.warn('[WebSocket] 心跳跳過：連接未就緒');
        return;
      }

      // 檢查上次 pong 時間（超過 60 秒未收到回應，視為連接異常）
      const timeSinceLastPong = Date.now() - lastPongTimeRef.current;
      if (timeSinceLastPong > 60000) {
        console.error('[WebSocket] 心跳超時，重新連接');
        wsRef.current.close();
        return;
      }

      // 發送 ping
      sendMessage({ type: 'ping' });
      console.log('[WebSocket] 發送心跳');
    }, HEARTBEAT_INTERVAL);

    console.log('[WebSocket] 心跳已啟動');
  }, [sendMessage]);

  /**
   * 停止心跳
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
      console.log('[WebSocket] 心跳已停止');
    }
  }, []);

  /**
   * 排程重連
   */
  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[WebSocket] 達到最大重連次數，停止重連');
      setConnectionError('WebSocket 重連失敗，請刷新頁面');
      return;
    }

    const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptsRef.current, RECONNECT_DELAYS.length - 1)];
    console.log(`[WebSocket] 將在 ${delay}ms 後重連（第 ${reconnectAttemptsRef.current + 1} 次）`);

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current += 1;
      manualCloseRef.current = false;
      connect();
    }, delay);
  }, [connect]);

  /**
   * 清除重連定時器
   */
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  /**
   * 請求在線用戶列表
   */
  const requestOnlineUsers = useCallback(() => {
    sendMessage({ type: 'get_online_users' });
  }, [sendMessage]);

  /**
   * 註冊訊息處理器
   */
  const on = useCallback((event, handler) => {
    messageHandlersRef.current[event] = handler;
  }, []);

  /**
   * 移除訊息處理器
   */
  const off = useCallback((event) => {
    delete messageHandlersRef.current[event];
  }, []);

  // 用戶登入/登出時自動連接/斷開
  useEffect(() => {
    if (userId && token) {
      manualCloseRef.current = false;
      connect();
    } else {
      disconnect();
    }

    // 清理函數：組件卸載時斷開
    return () => {
      console.log('[useWebSocket] useEffect cleanup 執行');
      if (wsRef.current) {
        manualCloseRef.current = true;

        // 停止心跳
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // 清除重連定時器
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        console.log('[useWebSocket] cleanup 關閉 WebSocket');
        wsRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, token]); // 只依賴 userId 和 token，不依賴函數避免無限循環

  return {
    isConnected,
    connectionError,
    onlineUsers,
    sendMessage,
    requestOnlineUsers,
    on,
    off,
    connect,
    disconnect
  };
};

export default useWebSocket;
