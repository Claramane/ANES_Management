import requests
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..models.doctor_schedule import DoctorSchedule, DayShiftDoctor, DoctorScheduleUpdateLog
from ..core.database import get_db

logger = logging.getLogger(__name__)

class DoctorScheduleService:
    """醫師班表服務"""
    
    EXTERNAL_API_BASE = "https://docdutyapi.zeabur.app"
    
    # 區域代碼轉換映射
    AREA_CODE_MAPPING = {
        'A': '控台醫師',
        'B': '刀房',
        'C': '外圍(3F)',
        'D': '外圍(高階)',
        'E': '刀房'
    }
    
    @classmethod
    def extract_name_and_area_from_summary(cls, summary: str) -> tuple:
        """從summary中提取醫師姓名和區域代碼"""
        try:
            if '/' in summary:
                name = summary.split('/')[0].strip()
                area_letter = summary.split('/')[1].strip()
                # 移除括號內容，只保留字母
                area_letter = area_letter.split('(')[0].strip()
                area_code = cls.AREA_CODE_MAPPING.get(area_letter, area_letter)
                return name, area_code
            else:
                return summary.strip(), '未分類'
        except Exception as e:
            logger.error(f"解析summary失敗: {summary}, 錯誤: {str(e)}")
            return summary.strip(), '未分類'
    
    @classmethod
    def fetch_external_schedule_data(cls, start_date: str, end_date: str) -> Dict:
        """從外部API獲取班表資料"""
        try:
            url = f"{cls.EXTERNAL_API_BASE}/schedule/{start_date}/{end_date}"
            logger.info(f"正在請求外部API: {url}")
            
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            logger.info(f"外部API請求成功，獲得 {len(data.get('schedules', []))} 天的資料")
            return data
        
        except requests.exceptions.RequestException as e:
            logger.error(f"外部API請求失敗: {str(e)}")
            raise Exception(f"無法獲取外部班表資料: {str(e)}")
        except Exception as e:
            logger.error(f"處理外部資料時發生錯誤: {str(e)}")
            raise Exception(f"處理外部資料失敗: {str(e)}")
    
    @classmethod
    def save_schedule_data(cls, db: Session, schedules_data: List[Dict]) -> int:
        """將班表資料儲存到資料庫"""
        saved_count = 0
        
        for schedule_item in schedules_data:
            try:
                date = schedule_item.get('date')
                if not date:
                    continue
                
                # 檢查是否已存在該日期的資料
                existing_schedule = db.query(DoctorSchedule).filter(
                    DoctorSchedule.date == date
                ).first()
                
                if existing_schedule:
                    # 更新現有資料
                    existing_schedule.duty_doctor = schedule_item.get('值班')
                    existing_schedule.schedule_notes = schedule_item.get('排班注記', [])
                    existing_schedule.updated_at = datetime.now()
                    
                    # 刪除舊的白班醫師資料
                    db.query(DayShiftDoctor).filter(
                        DayShiftDoctor.schedule_id == existing_schedule.id
                    ).delete()
                    
                    schedule = existing_schedule
                else:
                    # 創建新的班表記錄
                    schedule = DoctorSchedule(
                        date=date,
                        duty_doctor=schedule_item.get('值班'),
                        schedule_notes=schedule_item.get('排班注記', [])
                    )
                    db.add(schedule)
                    db.flush()  # 確保獲得ID
                
                # 處理白班醫師
                white_shifts = schedule_item.get('白班', [])
                for shift in white_shifts:
                    summary = shift.get('summary', '')
                    time = shift.get('time', '')
                    
                    if summary:
                        name, area_code = cls.extract_name_and_area_from_summary(summary)
                        
                        day_shift_doctor = DayShiftDoctor(
                            schedule_id=schedule.id,
                            name=name,
                            summary=summary,
                            time=time,
                            area_code=area_code,
                            active=True
                        )
                        db.add(day_shift_doctor)
                
                saved_count += 1
                
            except Exception as e:
                logger.error(f"儲存日期 {schedule_item.get('date')} 的班表時發生錯誤: {str(e)}")
                continue
        
        db.commit()
        logger.info(f"成功儲存 {saved_count} 天的班表資料")
        return saved_count
    
    @classmethod
    def update_schedules_from_external_api(cls, start_date: str, end_date: str) -> Dict:
        """從外部API更新班表資料"""
        db = next(get_db())
        
        try:
            # 獲取外部資料
            external_data = cls.fetch_external_schedule_data(start_date, end_date)
            
            # 儲存到資料庫
            schedules = external_data.get('schedules', [])
            saved_count = cls.save_schedule_data(db, schedules)
            
            # 記錄更新日誌
            log_entry = DoctorScheduleUpdateLog(
                start_date=start_date,
                end_date=end_date,
                success=True,
                total_days=saved_count,
                processing_time=external_data.get('summary', {}).get('processing_time_seconds')
            )
            db.add(log_entry)
            db.commit()
            
            return {
                'success': True,
                'saved_count': saved_count,
                'message': f'成功更新 {saved_count} 天的班表資料'
            }
            
        except Exception as e:
            # 記錄失敗日誌
            log_entry = DoctorScheduleUpdateLog(
                start_date=start_date,
                end_date=end_date,
                success=False,
                total_days=0,
                error_message=str(e)
            )
            db.add(log_entry)
            db.commit()
            
            logger.error(f"更新班表失敗: {str(e)}")
            raise Exception(f"更新班表失敗: {str(e)}")
        
        finally:
            db.close()
    
    @classmethod
    def get_schedules_by_date_range(cls, db: Session, start_date: str, end_date: str) -> List[Dict]:
        """根據日期範圍獲取班表資料"""
        try:
            schedules = db.query(DoctorSchedule).filter(
                and_(
                    DoctorSchedule.date >= start_date,
                    DoctorSchedule.date <= end_date
                )
            ).order_by(DoctorSchedule.date).all()
            
            result = []
            for schedule in schedules:
                # 獲取白班醫師資料
                day_shifts = []
                for doctor in schedule.day_shift_doctors:
                    if doctor.active:  # 只返回啟用的醫師
                        day_shifts.append({
                            'id': doctor.id,
                            'name': doctor.name,
                            'summary': doctor.summary,
                            'time': doctor.time,
                            'area_code': doctor.area_code,
                            'active': doctor.active
                        })
                
                result.append({
                    'date': schedule.date,
                    '值班': schedule.duty_doctor,
                    '白班': day_shifts,
                    '排班注記': schedule.schedule_notes or [],
                    'updated_at': schedule.updated_at.isoformat() if schedule.updated_at else None
                })
            
            return result
            
        except Exception as e:
            logger.error(f"獲取班表資料失敗: {str(e)}")
            raise Exception(f"獲取班表資料失敗: {str(e)}")
    
    @classmethod
    def get_today_schedule(cls, db: Session) -> Optional[Dict]:
        """獲取今日班表資料"""
        today = datetime.now().strftime('%Y%m%d')
        schedules = cls.get_schedules_by_date_range(db, today, today)
        return schedules[0] if schedules else None
    
    @classmethod
    def update_doctor_area_code(cls, db: Session, doctor_id: int, new_area_code: str) -> bool:
        """更新醫師的區域代碼"""
        try:
            doctor = db.query(DayShiftDoctor).filter(DayShiftDoctor.id == doctor_id).first()
            if doctor:
                doctor.area_code = new_area_code
                doctor.updated_at = datetime.now()
                db.commit()
                return True
            return False
        except Exception as e:
            logger.error(f"更新醫師區域代碼失敗: {str(e)}")
            db.rollback()
            return False
    
    @classmethod
    def toggle_doctor_active_status(cls, db: Session, doctor_id: int) -> bool:
        """切換醫師的啟用狀態"""
        try:
            doctor = db.query(DayShiftDoctor).filter(DayShiftDoctor.id == doctor_id).first()
            if doctor:
                doctor.active = not doctor.active
                doctor.updated_at = datetime.now()
                db.commit()
                return True
            return False
        except Exception as e:
            logger.error(f"切換醫師狀態失敗: {str(e)}")
            db.rollback()
            return False 