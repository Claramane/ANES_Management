#!/usr/bin/env python3
"""
醫師班表資料庫遷移腳本
添加 doctor_schedules, day_shift_doctors, doctor_schedule_update_logs 表
"""

import sys
import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# 添加專案根目錄到路徑
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_database_url, Base
from app.models.doctor_schedule import DoctorSchedule, DayShiftDoctor, DoctorScheduleUpdateLog

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_doctor_schedule_tables():
    """創建醫師班表相關的資料表"""
    try:
        # 獲取資料庫URL
        database_url = get_database_url()
        logger.info(f"連接資料庫: {database_url.split('@')[1] if '@' in database_url else 'local'}")
        
        # 創建引擎
        engine = create_engine(database_url)
        
        # 測試連接
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            logger.info("資料庫連接成功")
        
        # 只創建醫師班表相關的表
        DoctorSchedule.metadata.create_all(bind=engine)
        DayShiftDoctor.metadata.create_all(bind=engine)
        DoctorScheduleUpdateLog.metadata.create_all(bind=engine)
        
        logger.info("醫師班表相關資料表創建完成:")
        logger.info("- doctor_schedules (醫師每日班表)")
        logger.info("- day_shift_doctors (白班醫師資料)")
        logger.info("- doctor_schedule_update_logs (更新日誌)")
        
        # 驗證表是否創建成功
        inspector = engine.inspect(engine)
        existing_tables = inspector.get_table_names()
        
        required_tables = ['doctor_schedules', 'day_shift_doctors', 'doctor_schedule_update_logs']
        missing_tables = [table for table in required_tables if table not in existing_tables]
        
        if missing_tables:
            logger.error(f"以下表創建失敗: {missing_tables}")
            return False
        else:
            logger.info("所有必要的資料表都已成功創建")
            return True
            
    except Exception as e:
        logger.error(f"創建資料表時發生錯誤: {str(e)}")
        return False

def main():
    """主函數"""
    logger.info("開始執行醫師班表資料庫遷移...")
    
    success = create_doctor_schedule_tables()
    
    if success:
        logger.info("🎉 醫師班表資料庫遷移完成！")
        logger.info("現在可以啟動應用程序，定時任務將自動開始更新醫師班表資料")
    else:
        logger.error("❌ 醫師班表資料庫遷移失敗！")
        sys.exit(1)

if __name__ == "__main__":
    main() 