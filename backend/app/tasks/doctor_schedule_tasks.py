import asyncio
import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from ..services.doctor_schedule_service import DoctorScheduleService
from ..core.database import get_db
from ..utils.timezone import now

logger = logging.getLogger(__name__)

class DoctorScheduleTaskManager:
    """醫師班表定時任務管理器"""
    
    def __init__(self):
        self.scheduler = None
        
    def start_scheduler(self):
        """啟動排程器"""
        if self.scheduler is None:
            self.scheduler = AsyncIOScheduler()
            
            # 每10分鐘更新一次未來四個月的醫師班表
            self.scheduler.add_job(
                func=self.update_future_four_months_schedules,
                trigger=IntervalTrigger(minutes=10),
                id='update_future_doctor_schedules_regular',
                name='定期更新未來四個月醫師班表',
                replace_existing=True,
                max_instances=1  # 確保同時只有一個實例在運行
            )
            
            # 每5分鐘檢查一次醫師自動下班狀態
            self.scheduler.add_job(
                func=self.check_doctors_auto_off_duty,
                trigger=IntervalTrigger(minutes=5),
                id='check_doctors_auto_off_duty',
                name='檢查醫師自動下班狀態',
                replace_existing=True,
                max_instances=1  # 確保同時只有一個實例在運行
            )
            
            # 系統啟動時立即執行一次更新（可選）
            self.scheduler.add_job(
                func=self.update_future_four_months_schedules,
                trigger='date',  # 一次性任務
                run_date=now() + timedelta(seconds=30),  # 30秒後執行
                id='initial_update_future_schedules',
                name='初始更新未來四個月醫師班表',
                replace_existing=True
            )
            
            # 系統啟動時立即執行一次自動下班檢測
            self.scheduler.add_job(
                func=self.check_doctors_auto_off_duty,
                trigger='date',  # 一次性任務
                run_date=now() + timedelta(seconds=10),  # 10秒後執行
                id='initial_check_auto_off_duty',
                name='初始檢查醫師自動下班狀態',
                replace_existing=True
            )
            
            self.scheduler.start()
            logger.info("醫師班表定時任務已啟動 - 每10分鐘更新未來四個月班表，每5分鐘檢查自動下班狀態")
    
    def stop_scheduler(self):
        """停止排程器"""
        if self.scheduler:
            self.scheduler.shutdown()
            self.scheduler = None
            logger.info("醫師班表定時任務已停止")
    
    async def check_doctors_auto_off_duty(self):
        """檢查醫師自動下班狀態"""
        try:
            logger.debug("開始執行醫師自動下班檢測")
            
            # 獲取資料庫連接
            db = next(get_db())
            try:
                # 執行自動下班檢測
                DoctorScheduleService.update_doctors_active_status_by_time(db)
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"執行醫師自動下班檢測時發生錯誤: {str(e)}")
    
    async def update_future_four_months_schedules(self):
        """更新未來四個月醫師班表（從明天開始）"""
        try:
            current_now = now()
            
            # 從明天開始，避免覆蓋今天手動管理的資料
            tomorrow = current_now + timedelta(days=1)
            start_date = tomorrow.strftime('%Y%m%d')  # 明天開始
            
            # 計算四個月後的日期
            future_date = current_now + timedelta(days=120)  # 約四個月 (4 * 30天)
            
            # 更精確的計算：加4個月
            current_year = current_now.year
            current_month = current_now.month
            
            end_year = current_year
            end_month = current_month + 4
            
            if end_month > 12:
                end_year += end_month // 12
                end_month = end_month % 12
                if end_month == 0:
                    end_month = 12
                    end_year -= 1
            
            # 計算該月的最後一天
            if end_month == 12:
                next_month_for_calc = datetime(end_year + 1, 1, 1)
            else:
                next_month_for_calc = datetime(end_year, end_month + 1, 1)
            
            last_day = (next_month_for_calc - timedelta(days=1)).day
            end_date = f"{end_year}{end_month:02d}{last_day:02d}"
            
            logger.info(f"開始更新未來四個月醫師班表(從明天開始): {start_date} 到 {end_date}")
            
            result = DoctorScheduleService.update_schedules_from_external_api(start_date, end_date)
            
            if result['success']:
                logger.info(f"未來四個月醫師班表更新成功: {result['message']}")
            else:
                logger.error(f"未來四個月醫師班表更新失敗: {result.get('message', '未知錯誤')}")
                
        except Exception as e:
            logger.error(f"更新未來四個月醫師班表時發生錯誤: {str(e)}")
    
    async def update_current_month_schedules(self):
        """更新當月醫師班表 (保留方法以供手動調用)"""
        try:
            current_now = now()
            start_date = current_now.strftime('%Y%m01')  # 當月第一天
            
            # 計算當月最後一天
            if current_now.month == 12:
                next_month = current_now.replace(year=current_now.year + 1, month=1, day=1)
            else:
                next_month = current_now.replace(month=current_now.month + 1, day=1)
            
            last_day = (next_month - timedelta(days=1)).day
            end_date = current_now.strftime(f'%Y%m{last_day:02d}')
            
            logger.info(f"開始更新當月醫師班表: {start_date} 到 {end_date}")
            
            result = DoctorScheduleService.update_schedules_from_external_api(start_date, end_date)
            
            if result['success']:
                logger.info(f"當月醫師班表更新成功: {result['message']}")
            else:
                logger.error(f"當月醫師班表更新失敗: {result.get('message', '未知錯誤')}")
                
        except Exception as e:
            logger.error(f"更新當月醫師班表時發生錯誤: {str(e)}")

    async def update_next_month_schedules(self):
        """更新下個月醫師班表 (已棄用，保留向後兼容性)"""
        logger.warning("update_next_month_schedules已棄用，請使用update_future_four_months_schedules")
        # 為了向後兼容性保留，但實際不再使用

# 全局任務管理器實例
doctor_schedule_task_manager = DoctorScheduleTaskManager() 