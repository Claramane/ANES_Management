import requests
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..models.doctor_schedule import DoctorSchedule, DayShiftDoctor, DoctorScheduleUpdateLog
from ..core.database import get_db
from ..core.config import settings

logger = logging.getLogger(__name__)

class DoctorScheduleService:
    """醫師班表服務"""
    
    # 位置代碼對應到區域代碼的映射
    POSITION_TO_AREA_MAPPING = {
        'A': '控台醫師',
        'B': '手術室',
        'C': '外圍(3F)',
        'D': '外圍(高階)',
        'E': '手術室',
        'F': '外圍(TAE)',
    }
    
    @classmethod
    def parse_work_time(cls, time_str: str) -> tuple:
        """解析工作時間字串，返回開始和結束時間"""
        try:
            if not time_str or '-' not in time_str:
                return None, None
            
            start_str, end_str = time_str.split('-')
            start_time = datetime.strptime(start_str.strip(), '%H:%M').time()
            end_time = datetime.strptime(end_str.strip(), '%H:%M').time()
            
            return start_time, end_time
        except Exception as e:
            logger.error(f"解析工作時間失敗: {time_str}, 錯誤: {str(e)}")
            return None, None
    
    @classmethod
    def is_doctor_in_working_hours(cls, work_time: str) -> bool:
        """檢查醫師是否在工作時間內"""
        try:
            start_time, end_time = cls.parse_work_time(work_time)
            if not start_time or not end_time:
                return True  # 如果無法解析時間，預設為在工作時間內
            
            current_time = datetime.now().time()
            
            # 處理跨午夜的情況（如夜班）
            if start_time <= end_time:
                # 正常情況：08:00-18:00
                return start_time <= current_time <= end_time
            else:
                # 跨午夜情況：22:00-06:00
                return current_time >= start_time or current_time <= end_time
                
        except Exception as e:
            logger.error(f"檢查工作時間失敗: {work_time}, 錯誤: {str(e)}")
            return True  # 發生錯誤時預設為在工作時間內
    
    @classmethod
    def is_doctor_in_meeting(cls, meeting_time: str) -> bool:
        """檢查醫師是否在開會時間內"""
        try:
            if not meeting_time:
                return False
                
            start_time, end_time = cls.parse_work_time(meeting_time)
            if not start_time or not end_time:
                return False
            
            current_time = datetime.now().time()
            
            # 處理跨午夜的情況（開會時間不太可能跨午夜，但為了完整性）
            if start_time <= end_time:
                # 正常情況：09:00-11:00
                return start_time <= current_time <= end_time
            else:
                # 跨午夜情況：22:00-02:00
                return current_time >= start_time or current_time <= end_time
                
        except Exception as e:
            logger.error(f"檢查開會時間失敗: {meeting_time}, 錯誤: {str(e)}")
            return False
    
    @classmethod
    def set_doctor_meeting_time(cls, db: Session, doctor_id: int, meeting_time: str) -> bool:
        """設定醫師的開會時間"""
        try:
            doctor = db.query(DayShiftDoctor).filter(DayShiftDoctor.id == doctor_id).first()
            if doctor:
                doctor.meeting_time = meeting_time
                doctor.updated_at = datetime.now()
                
                # 如果目前在開會時間內且是上班狀態，設定為下班狀態
                if meeting_time and cls.is_doctor_in_meeting(meeting_time) and doctor.status == 'on_duty':
                    doctor.status = 'off_duty'
                
                db.commit()
                logger.info(f"醫師 {doctor.name} 的開會時間已設定為: {meeting_time}")
                return True
            return False
        except Exception as e:
            logger.error(f"設定醫師開會時間失敗: {str(e)}")
            db.rollback()
            return False
    
    @classmethod
    def delete_doctor_meeting_time(cls, db: Session, doctor_id: int) -> bool:
        """刪除醫師的開會時間"""
        try:
            doctor = db.query(DayShiftDoctor).filter(DayShiftDoctor.id == doctor_id).first()
            if doctor:
                old_meeting_time = doctor.meeting_time
                doctor.meeting_time = None
                doctor.updated_at = datetime.now()
                
                # 刪除開會時間後，如果在工作時間內且不是請假狀態，恢復上班狀態
                if old_meeting_time and cls.is_doctor_in_working_hours(doctor.time) and doctor.status != 'off':
                    doctor.status = 'on_duty'
                
                db.commit()
                logger.info(f"醫師 {doctor.name} 的開會時間已刪除，原時間為: {old_meeting_time}")
                return True
            return False
        except Exception as e:
            logger.error(f"刪除醫師開會時間失敗: {str(e)}")
            db.rollback()
            return False
    
    @classmethod
    def update_doctors_active_status_by_time(cls, db: Session):
        """根據工作時間和開會時間在關鍵時刻更新醫師的狀態"""
        try:
            # 獲取今天的所有白班醫師
            today = datetime.now().strftime('%Y%m%d')
            today_schedule = db.query(DoctorSchedule).filter(
                DoctorSchedule.date == today
            ).first()
            
            if not today_schedule:
                return
            
            current_time = datetime.now().time()
            updated_count = 0
            
            # 檢查每個醫師的狀態轉換
            for doctor in today_schedule.day_shift_doctors:
                start_time, end_time = cls.parse_work_time(doctor.time)
                if not start_time or not end_time:
                    continue
                
                # 檢查是否為時間點（容許1分鐘誤差）
                current_minutes = current_time.hour * 60 + current_time.minute
                
                # 檢查是否在開會中
                is_in_meeting = cls.is_doctor_in_meeting(doctor.meeting_time) if doctor.meeting_time else False
                
                # 下班時間到了：如果醫師還在上班，自動設為下班
                end_minutes = end_time.hour * 60 + end_time.minute
                if abs(current_minutes - end_minutes) <= 1 and doctor.status == 'on_duty':
                    doctor.status = 'off_duty'
                    doctor.updated_at = datetime.now()
                    updated_count += 1
                    logger.info(f"醫師 {doctor.name} 已自動設為下班狀態（下班時間到）")
                
                # 開會時間檢查：開會時設為下班，開會結束時恢復上班（如果在工作時間內且原本就是上班狀態）
                if doctor.meeting_time:
                    meeting_start, meeting_end = cls.parse_work_time(doctor.meeting_time)
                    if meeting_start and meeting_end:
                        meeting_start_minutes = meeting_start.hour * 60 + meeting_start.minute
                        meeting_end_minutes = meeting_end.hour * 60 + meeting_end.minute
                        
                        # 開會開始時間到了：設為下班
                        if abs(current_minutes - meeting_start_minutes) <= 1 and doctor.status == 'on_duty':
                            doctor.status = 'off_duty'
                            doctor.updated_at = datetime.now()
                            updated_count += 1
                            logger.info(f"醫師 {doctor.name} 已自動設為下班狀態（開會開始）")
                        
                        # 開會結束時間到了：如果在工作時間內且開會前是上班狀態，恢復上班
                        # 注意：我們不會自動恢復上班狀態，因為可能醫師已經請假或下班
                        if abs(current_minutes - meeting_end_minutes) <= 1 and doctor.status == 'off_duty' and not is_in_meeting:
                            # 檢查是否仍在工作時間內
                            start_minutes = start_time.hour * 60 + start_time.minute
                            if start_minutes <= current_minutes <= end_minutes:
                                # 只有在確實因為開會而設為下班時才自動恢復
                                # 這裡可以檢查是否有開會記錄，但為了簡化，我們不自動恢復
                                pass  # 不自動恢復，讓管理員手動處理
            
            if updated_count > 0:
                db.commit()
                logger.info(f"已更新 {updated_count} 位醫師的狀態")
            
        except Exception as e:
            logger.error(f"自動更新醫師狀態失敗: {str(e)}")
            db.rollback()
    
    @classmethod
    def extract_name_and_area_from_summary(cls, summary: str) -> tuple:
        """從summary中提取醫師姓名和區域代碼"""
        try:
            if '/' in summary:
                name = summary.split('/')[0].strip()
                area_letter = summary.split('/')[1].strip()
                # 移除括號內容，只保留字母
                area_letter = area_letter.split('(')[0].strip()
                area_code = cls.POSITION_TO_AREA_MAPPING.get(area_letter, area_letter)
                return name, area_code
            else:
                return summary.strip(), '未分類'
        except Exception as e:
            logger.error(f"解析summary失敗: {summary}, 錯誤: {str(e)}")
            return summary.strip(), '未分類'
    
    @classmethod
    def is_weekday_tuesday_to_friday(cls, date_str: str) -> bool:
        """判斷是否為週二到週五"""
        try:
            # 將YYYYMMDD格式轉換為datetime對象
            date_obj = datetime.strptime(date_str, '%Y%m%d')
            # weekday(): 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday
            weekday = date_obj.weekday()
            # 週二到週五對應1到4
            return 1 <= weekday <= 4
        except Exception as e:
            logger.error(f"判斷日期 {date_str} 星期幾時發生錯誤: {str(e)}")
            return False
    
    @classmethod
    def add_fan_shouwen_to_or(cls, db: Session, schedule_id: int):
        """為手術室新增范守仁醫師"""
        try:
            # 檢查是否已經有范守仁在手術室了
            existing_doctor = db.query(DayShiftDoctor).filter_by(
                schedule_id=schedule_id,
                name='范守仁'
            ).filter(
                DayShiftDoctor.area_code == '手術室'
            ).first()
            
            if existing_doctor:
                return
            
            # 新增范守仁醫師到手術室
            new_doctor = DayShiftDoctor(
                schedule_id=schedule_id,
                name='范守仁',
                summary='范守仁/B',  # B代表手術室
                time='08:00-18:00',
                area_code='手術室',
                status='on_duty'
            )
            db.add(new_doctor)
            logger.info(f"已自動新增范守仁醫師到班表ID {schedule_id} 的手術室")
            
        except Exception as e:
            logger.error(f"新增范守仁醫師到手術室失敗: {e}")
    
    @classmethod
    def fetch_external_schedule_data(cls, start_date: str, end_date: str) -> Dict:
        """從外部API獲取班表資料"""
        try:
            url = f"{settings.EXTERNAL_API_BASE}/schedule/{start_date}/{end_date}"
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
        """將班表資料儲存到資料庫，保護手動設置的area_code"""
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
                
                # 如果是今天的資料，跳過更新以保護手動管理
                today = datetime.now().strftime('%Y%m%d')
                if date == today:
                    logger.info(f"跳過今天({date})的班表更新，保護手動管理的資料")
                    continue
                
                if existing_schedule:
                    # 更新現有資料
                    existing_schedule.duty_doctor = schedule_item.get('值班')
                    existing_schedule.schedule_notes = schedule_item.get('排班注記', [])
                    existing_schedule.updated_at = datetime.now()
                    
                    # 保存現有醫師的手動設置資料
                    existing_doctors = {}
                    for doctor in existing_schedule.day_shift_doctors:
                        # 用醫師姓名做為key保存手動設置的資料
                        existing_doctors[doctor.name] = {
                            'area_code': doctor.area_code,
                            'status': doctor.status,
                            'meeting_time': doctor.meeting_time
                        }
                    
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
                    existing_doctors = {}  # 新記錄沒有現有醫師資料
                
                # 處理白班醫師
                white_shifts = schedule_item.get('白班', [])
                for shift in white_shifts:
                    summary = shift.get('summary', '')
                    time = shift.get('time', '')
                    
                    if summary:
                        name, area_code_from_api = cls.extract_name_and_area_from_summary(summary)
                        
                        # 檢查是否有手動設置的資料
                        if name in existing_doctors:
                            # 使用手動設置的資料，保護不被覆蓋
                            preserved_data = existing_doctors[name]
                            area_code = preserved_data['area_code']
                            status = preserved_data['status']
                            meeting_time = preserved_data['meeting_time']
                            logger.debug(f"保護醫師 {name} 的手動設置：area_code={area_code}, status={status}")
                        else:
                            # 使用API資料
                            area_code = area_code_from_api
                            status = 'on_duty'  # 新醫師預設狀態
                            meeting_time = None
                        
                        day_shift_doctor = DayShiftDoctor(
                            schedule_id=schedule.id,
                            name=name,
                            summary=summary,
                            time=time,
                            area_code=area_code,
                            status=status,
                            meeting_time=meeting_time
                        )
                        db.add(day_shift_doctor)
                
                # 新增邏輯：如果是週二到週五，自動新增范守仁醫師到手術室
                if cls.is_weekday_tuesday_to_friday(date):
                    cls.add_fan_shouwen_to_or(db, schedule.id)
                
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
            # 移除自動更新調用，避免覆蓋前端手動設置的狀態
            # cls.update_doctors_active_status_by_time(db)
            
            schedules = db.query(DoctorSchedule).filter(
                and_(
                    DoctorSchedule.date >= start_date,
                    DoctorSchedule.date <= end_date
                )
            ).order_by(DoctorSchedule.date).all()
            
            result = []
            for schedule in schedules:
                # 獲取白班醫師資料 - 返回所有醫師（包括active=false的）
                day_shifts = []
                for doctor in schedule.day_shift_doctors:
                    # 檢查是否在開會中
                    is_in_meeting = cls.is_doctor_in_meeting(doctor.meeting_time) if doctor.meeting_time else False
                    
                    day_shifts.append({
                        'id': doctor.id,
                        'name': doctor.name,
                        'summary': doctor.summary,
                        'time': doctor.time,
                        'area_code': doctor.area_code,
                        'status': doctor.status,  # 使用新的status字段
                        'meeting_time': doctor.meeting_time,
                        'is_in_meeting': is_in_meeting
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
    def toggle_doctor_active_status(cls, db: Session, doctor_id: int):
        """切換醫師的狀態"""
        # 根據ID查找醫師
        doctor = db.query(DayShiftDoctor).filter(DayShiftDoctor.id == doctor_id).first()
        if not doctor:
            return None
        
        # 記錄舊狀態
        old_status = doctor.status
        
        # 切換狀態邏輯：
        # on_duty -> off_duty
        # off_duty -> on_duty  
        # off -> on_duty
        if doctor.status == 'on_duty':
            doctor.status = 'off_duty'
        elif doctor.status == 'off_duty':
            doctor.status = 'on_duty'
        elif doctor.status == 'off':
            doctor.status = 'on_duty'
        else:
            # 如果是未知狀態，設為on_duty
            doctor.status = 'on_duty'
        
        # 更新時間戳
        doctor.updated_at = datetime.utcnow()
        
        try:
            db.commit()
            db.refresh(doctor)
            
            logger.info(f"醫師 {doctor.name} 狀態已從 {old_status} 切換為 {doctor.status}")
            return doctor
            
        except Exception as e:
            db.rollback()
            logger.error(f"更新醫師狀態失敗: {str(e)}")
            raise e
    
    @classmethod
    def toggle_doctor_leave_status(cls, db: Session, doctor_id: int):
        """切換醫師的請假狀態"""
        # 根據ID查找醫師
        doctor = db.query(DayShiftDoctor).filter(DayShiftDoctor.id == doctor_id).first()
        if not doctor:
            return None
        
        # 記錄舊狀態
        old_status = doctor.status
        
        # 請假狀態切換邏輯：
        # 如果目前是請假(off)，則恢復為上班(on_duty)
        # 如果目前不是請假，則設定為請假(off)
        if doctor.status == 'off':
            doctor.status = 'on_duty'  # 取消請假，恢復上班
        else:
            doctor.status = 'off'      # 請假
        
        # 更新時間戳
        doctor.updated_at = datetime.utcnow()
        
        try:
            db.commit()
            db.refresh(doctor)
            
            action = "取消請假" if old_status == 'off' else "請假"
            logger.info(f"醫師 {doctor.name} {action}成功，狀態從 {old_status} 變更為 {doctor.status}")
            return doctor
            
        except Exception as e:
            db.rollback()
            logger.error(f"更新醫師請假狀態失敗: {str(e)}")
            raise e 