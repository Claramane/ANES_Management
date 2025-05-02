import { useEffect, useState } from 'react';
import { Droppable } from 'react-beautiful-dnd';

// 解決React 18 StrictMode中的react-beautiful-dnd問題
// 這個包裝器解決了React 18的嚴格模式下Droppable可能無法使用的問題
export const StrictModeDroppable = ({ children, ...props }) => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // 使用requestAnimationFrame確保組件在正確的時間啟用
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);

  if (!enabled) {
    return null;
  }

  // 傳遞ignoreContainerClipping=true以優化拖動體驗
  return <Droppable 
    ignoreContainerClipping={true} // 提高拖動準確性的關鍵設置
    {...props}
  >
    {children}
  </Droppable>;
}; 