import asyncio
import logging
from datetime import datetime, timedelta, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from ..services.doctor_schedule_service import DoctorScheduleService
from ..core.database import get_db

# 定義台灣時區
TAIWAN_TZ = timezone(timedelta(hours=8))

def get_taiwan_now():
    """獲取台灣當前時間"""
    return datetime.now(TAIWAN_TZ)

logger = logging.getLogger(__name__)

class DoctorScheduleTaskManager:
    """醫師班表定時任務管理器"""
    
    def __init__(self):
        self.scheduler = BackgroundScheduler(timezone=TAIWAN_TZ)  # 設定排程器使用台灣時區
        self.is_running = False
        
    def start_scheduler(self):
        """啟動排程器"""
        if not self.is_running:
            try:
                # 添加定時任務：每分鐘檢查一次醫師狀態
                self.scheduler.add_job(
                    func=self.auto_update_doctor_status,
                    trigger=CronTrigger(
                        minute='*',  # 每分鐘執行
                        timezone=TAIWAN_TZ  # 使用台灣時區
                    ),
                    id='auto_update_doctor_status',
                    name='自動更新醫師狀態',
                    replace_existing=True
                )
                
                # 立即執行一次（延遲30秒以確保系統完全啟動）
                self.scheduler.add_job(
                    func=self.auto_update_doctor_status,
                    trigger='date',
                    run_date=get_taiwan_now() + timedelta(seconds=30),  # 30秒後執行
                    id='initial_doctor_status_update',
                    name='初始醫師狀態更新'
                )
                
                # 測試任務（延遲10秒執行）
                self.scheduler.add_job(
                    func=self.test_scheduler,
                    trigger='date',
                    run_date=get_taiwan_now() + timedelta(seconds=10),  # 10秒後執行
                    id='test_scheduler',
                    name='測試排程器'
                )
                
                self.scheduler.start()
                self.is_running = True
                logger.info("醫師班表定時任務排程器已啟動（使用台灣時區）")
                
            except Exception as e:
                logger.error(f"啟動醫師班表定時任務排程器失敗: {str(e)}")
                raise
    
    def stop_scheduler(self):
        """停止排程器"""
        if self.is_running and self.scheduler.running:
            try:
                self.scheduler.shutdown()
                self.is_running = False
                logger.info("醫師班表定時任務排程器已停止")
            except Exception as e:
                logger.error(f"停止醫師班表定時任務排程器失敗: {str(e)}")
    
    def test_scheduler(self):
        """測試排程器是否正常工作"""
        try:
            now = get_taiwan_now()
            logger.info(f"排程器測試成功，台灣當前時間: {now}")
        except Exception as e:
            logger.error(f"排程器測試失敗: {str(e)}")
    
    def auto_update_doctor_status(self):
        """自動更新醫師狀態的定時任務"""
        try:
            now = get_taiwan_now()
            logger.info(f"開始執行自動更新醫師狀態任務，台灣當前時間: {now}")
            
            # 獲取資料庫連接
            db = next(get_db())
            try:
                # 執行自動狀態更新
                DoctorScheduleService.update_doctors_active_status_by_time(db)
                logger.info("自動更新醫師狀態任務執行完成")
            except Exception as e:
                logger.error(f"自動更新醫師狀態任務執行失敗: {str(e)}")
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"自動更新醫師狀態任務發生錯誤: {str(e)}")
    
    def manual_update_doctor_status(self):
        """手動觸發醫師狀態更新"""
        try:
            now = get_taiwan_now()
            logger.info(f"手動觸發醫師狀態更新，台灣當前時間: {now}")
            
            db = next(get_db())
            try:
                DoctorScheduleService.update_doctors_active_status_by_time(db)
                logger.info("手動醫師狀態更新完成")
                return True
            except Exception as e:
                logger.error(f"手動醫師狀態更新失敗: {str(e)}")
                return False
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"手動醫師狀態更新發生錯誤: {str(e)}")
            return False

# 創建全局任務管理器實例
doctor_schedule_task_manager = DoctorScheduleTaskManager() 