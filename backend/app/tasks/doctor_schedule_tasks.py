import asyncio
import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from ..services.doctor_schedule_service import DoctorScheduleService

logger = logging.getLogger(__name__)

class DoctorScheduleTaskManager:
    """醫師班表定時任務管理器"""
    
    def __init__(self):
        self.scheduler = None
        
    def start_scheduler(self):
        """啟動排程器"""
        if self.scheduler is None:
            self.scheduler = AsyncIOScheduler()
            
            # 每5分鐘更新一次當月的醫師班表
            self.scheduler.add_job(
                func=self.update_current_month_schedules,
                trigger=IntervalTrigger(minutes=5),
                id='update_doctor_schedules',
                name='更新當月醫師班表',
                replace_existing=True,
                max_instances=1  # 確保同時只有一個實例在運行
            )
            
            # 每天凌晨1點更新未來四個月的班表
            self.scheduler.add_job(
                func=self.update_future_four_months_schedules,
                trigger='cron',
                hour=1,
                minute=0,
                id='update_future_doctor_schedules',
                name='更新未來四個月醫師班表',
                replace_existing=True,
                max_instances=1
            )
            
            self.scheduler.start()
            logger.info("醫師班表定時任務已啟動")
    
    def stop_scheduler(self):
        """停止排程器"""
        if self.scheduler:
            self.scheduler.shutdown()
            self.scheduler = None
            logger.info("醫師班表定時任務已停止")
    
    async def update_current_month_schedules(self):
        """更新當月醫師班表"""
        try:
            now = datetime.now()
            start_date = now.strftime('%Y%m01')  # 當月第一天
            
            # 計算當月最後一天
            if now.month == 12:
                next_month = now.replace(year=now.year + 1, month=1, day=1)
            else:
                next_month = now.replace(month=now.month + 1, day=1)
            
            last_day = (next_month - timedelta(days=1)).day
            end_date = now.strftime(f'%Y%m{last_day:02d}')
            
            logger.info(f"開始更新當月醫師班表: {start_date} 到 {end_date}")
            
            result = DoctorScheduleService.update_schedules_from_external_api(start_date, end_date)
            
            if result['success']:
                logger.info(f"當月醫師班表更新成功: {result['message']}")
            else:
                logger.error(f"當月醫師班表更新失敗: {result.get('message', '未知錯誤')}")
                
        except Exception as e:
            logger.error(f"更新當月醫師班表時發生錯誤: {str(e)}")
    
    async def update_future_four_months_schedules(self):
        """更新未來四個月醫師班表"""
        try:
            now = datetime.now()
            
            # 計算未來四個月的範圍
            # 從下個月開始，到第四個月結束
            if now.month == 12:
                start_month = now.replace(year=now.year + 1, month=1)
            else:
                start_month = now.replace(month=now.month + 1)
            
            start_date = start_month.strftime('%Y%m01')  # 下月第一天
            
            # 計算第四個月的最後一天
            current_year = start_month.year
            current_month = start_month.month
            
            # 加4個月
            end_year = current_year
            end_month = current_month + 3  # 因為start_month已經是下個月，所以再加3個月就是4個月
            
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
            
            logger.info(f"開始更新未來四個月醫師班表: {start_date} 到 {end_date}")
            
            result = DoctorScheduleService.update_schedules_from_external_api(start_date, end_date)
            
            if result['success']:
                logger.info(f"未來四個月醫師班表更新成功: {result['message']}")
            else:
                logger.error(f"未來四個月醫師班表更新失敗: {result.get('message', '未知錯誤')}")
                
        except Exception as e:
            logger.error(f"更新未來四個月醫師班表時發生錯誤: {str(e)}")

    async def update_next_month_schedules(self):
        """更新下個月醫師班表 (已棄用，保留向後兼容性)"""
        logger.warning("update_next_month_schedules已棄用，請使用update_future_four_months_schedules")
        # 為了向後兼容性保留，但實際不再使用

# 全局任務管理器實例
doctor_schedule_task_manager = DoctorScheduleTaskManager() 