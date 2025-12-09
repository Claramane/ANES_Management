#!/usr/bin/env python3

"""
清除資料庫中的所有日誌記錄
用法：python3 reset_logs.py
"""

import sys
import os
import logging

# 設置logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)

# 將項目根目錄添加到路徑，確保可以導入應用模塊
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import SessionLocal
from app.models.log import Log
from sqlalchemy import func

def reset_logs():
    """清除資料庫中的所有日誌記錄"""
    db = SessionLocal()
    try:
        # 獲取日誌數量
        log_count = db.query(func.count(Log.id)).scalar()
        logger.info(f"資料庫中共有 {log_count} 條日誌記錄")
        
        # 刪除所有日誌
        deleted = db.query(Log).delete()
        db.commit()
        
        logger.info(f"成功刪除 {deleted} 條日誌記錄")
    except Exception as e:
        db.rollback()
        logger.error(f"刪除日誌時發生錯誤: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    # 確認用戶操作
    confirm = input("確定要刪除資料庫中的所有日誌嗎？此操作不可恢復。(y/n): ")
    if confirm.lower() in ['y', 'yes']:
        reset_logs()
    else:
        logger.info("操作已取消") 
