from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import logging
from pydantic import BaseModel

from ..core.database import get_db
from ..services.doctor_schedule_service import DoctorScheduleService
from ..core.security import get_current_user
from ..models.user import User
from ..core.config import settings
from ..utils.timezone import now, get_timezone_info

logger = logging.getLogger(__name__)

class AreaCodeUpdateRequest(BaseModel):
    area_code: str

router = APIRouter(prefix="/doctor-schedules", tags=["醫師班表"])

@router.get("/schedules/{start_date}/{end_date}")
async def get_doctor_schedules(
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取指定日期範圍的醫師班表
    日期格式: YYYYMMDD
    """
    try:
        # 驗證日期格式
        if len(start_date) != 8 or len(end_date) != 8:
            raise HTTPException(status_code=400, detail="日期格式錯誤，請使用YYYYMMDD格式")
        
        # 獲取班表資料
        schedules = DoctorScheduleService.get_schedules_by_date_range(db, start_date, end_date)
        
        return {
            "success": True,
            "query_period": {
                "start_date": start_date,
                "end_date": end_date,
                "start_date_iso": f"{start_date[:4]}-{start_date[4:6]}-{start_date[6:8]}T00:00:00Z",
                "end_date_iso": f"{end_date[:4]}-{end_date[4:6]}-{end_date[6:8]}T23:59:59.999999Z"
            },
            "schedules": schedules,
            "summary": {
                "total_days_with_data": len(schedules),
                "data_source": "local_database"
            }
        }
        
    except Exception as e:
        logger.error(f"獲取醫師班表失敗: {str(e)}")
        raise HTTPException(status_code=500, detail=f"獲取醫師班表失敗: {str(e)}")

@router.get("/today", response_model=Dict)
async def get_today_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """獲取今日班表"""
    try:
        # 記錄當前時間用於調試
        current_time = now()
        logger.info(f"獲取今日班表請求，當前時間: {current_time}")
        
        schedule = DoctorScheduleService.get_today_schedule(db)
        if not schedule:
            return {"message": "今日無班表資料", "data": None}
        
        return {"message": "獲取成功", "data": schedule}
    except Exception as e:
        logger.error(f"獲取今日班表失敗: {str(e)}")
        raise HTTPException(status_code=500, detail="獲取今日班表失敗")

@router.get("/public/today", response_model=Dict)
async def get_public_today_schedule(
    db: Session = Depends(get_db)
):
    """獲取今日班表 - 公開端點，不需要授權"""
    try:
        # 記錄當前時間用於調試
        current_time = now()
        logger.info(f"獲取今日班表請求（公開端點），當前時間: {current_time}")
        
        schedule = DoctorScheduleService.get_today_schedule(db)
        if not schedule:
            return {"message": "今日無班表資料", "data": None}
        
        return {"message": "獲取成功", "data": schedule}
    except Exception as e:
        logger.error(f"獲取今日班表失敗（公開端點）: {str(e)}")
        raise HTTPException(status_code=500, detail="獲取今日班表失敗")

@router.get("/public/date/{date}", response_model=Dict)
async def get_public_date_schedule(
    date: str,
    db: Session = Depends(get_db)
):
    """獲取指定日期的班表 - 公開端點，不需要授權"""
    try:
        # 驗證日期格式
        if len(date) != 8:
            raise HTTPException(status_code=400, detail="日期格式錯誤，請使用YYYYMMDD格式")
        
        # 驗證日期是否為有效日期
        try:
            from datetime import datetime
            datetime.strptime(date, '%Y%m%d')
        except ValueError:
            raise HTTPException(status_code=400, detail="無效的日期，請使用YYYYMMDD格式")
        
        # 記錄請求日期用於調試
        current_time = now()
        logger.info(f"獲取指定日期班表請求（公開端點），請求日期: {date}，當前時間: {current_time}")
        
        schedule = DoctorScheduleService.get_schedule_by_date(db, date)
        if not schedule:
            return {"message": f"指定日期({date})無班表資料", "data": None}
        
        return {"message": "獲取成功", "data": schedule}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"獲取指定日期班表失敗（公開端點）: {str(e)}")
        raise HTTPException(status_code=500, detail="獲取指定日期班表失敗")

@router.post("/update-from-external")
async def update_schedules_from_external(
    start_date: str = Query(..., description="開始日期 YYYYMMDD"),
    end_date: str = Query(..., description="結束日期 YYYYMMDD"),
    current_user: User = Depends(get_current_user)
):
    """
    從外部API更新醫師班表資料
    只有管理員可以手動觸發更新
    """
    try:
        # 檢查權限（只有護理長或管理員可以更新）
        if current_user.role not in ['head_nurse', 'admin']:
            raise HTTPException(status_code=403, detail="權限不足，只有護理長或管理員可以更新班表")
        
        # 驗證日期格式
        if len(start_date) != 8 or len(end_date) != 8:
            raise HTTPException(status_code=400, detail="日期格式錯誤，請使用YYYYMMDD格式")
        
        # 更新班表
        result = DoctorScheduleService.update_schedules_from_external_api(start_date, end_date)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新醫師班表失敗: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新醫師班表失敗: {str(e)}")

@router.post("/update-future-four-months")
async def update_future_four_months_schedules(
    current_user: User = Depends(get_current_user)
):
    """
    手動觸發更新未來四個月醫師班表資料（從明天開始）
    只有管理員可以手動觸發更新
    """
    try:
        # 檢查權限（只有護理長或管理員可以更新）
        if current_user.role not in ['head_nurse', 'admin']:
            raise HTTPException(status_code=403, detail="權限不足，只有護理長或管理員可以更新班表")
        
        # 計算未來四個月的日期範圍（從明天開始）
        from datetime import datetime, timedelta
        
        current_now = now()
        # 從明天開始，避免覆蓋今天手動管理的資料
        tomorrow = current_now + timedelta(days=1)
        start_date = tomorrow.strftime('%Y%m%d')  # 明天開始
        
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
        
        logger.info(f"手動觸發更新未來四個月醫師班表(從明天開始): {start_date} 到 {end_date}")
        
        # 更新班表
        result = DoctorScheduleService.update_schedules_from_external_api(start_date, end_date)
        
        return {
            "success": True,
            "message": f"成功更新未來四個月班表資料 (從明天開始: {start_date} 到 {end_date})",
            "date_range": {
                "start_date": start_date,
                "end_date": end_date,
                "start_date_formatted": f"{start_date[:4]}-{start_date[4:6]}-{start_date[6:8]}",
                "end_date_formatted": f"{end_date[:4]}-{end_date[4:6]}-{end_date[6:8]}"
            },
            "saved_count": result.get('saved_count', 0)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"手動更新未來四個月醫師班表失敗: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新失敗: {str(e)}")

@router.get("/scheduler-status")
async def get_scheduler_status(
    current_user: User = Depends(get_current_user)
):
    """
    獲取定時任務狀態
    只有管理員可以查看
    """
    try:
        # 檢查權限
        if current_user.role not in ['head_nurse', 'admin']:
            raise HTTPException(status_code=403, detail="權限不足，只有護理長或管理員可以查看")
        
        from ..tasks.doctor_schedule_tasks import doctor_schedule_task_manager
        
        if doctor_schedule_task_manager.scheduler is None:
            return {
                "success": True,
                "scheduler_running": False,
                "message": "定時任務尚未啟動"
            }
        
        jobs = []
        for job in doctor_schedule_task_manager.scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger)
            })
        
        return {
            "success": True,
            "scheduler_running": doctor_schedule_task_manager.scheduler.running,
            "jobs": jobs,
            "message": "定時任務運行正常"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"獲取定時任務狀態失敗: {str(e)}")
        raise HTTPException(status_code=500, detail=f"獲取狀態失敗: {str(e)}")

@router.post("/doctor/{doctor_id}/area-code")
async def update_doctor_area_code(
    doctor_id: int,
    new_area_code: AreaCodeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    更新醫師的工作區域代碼
    只有控台醫師(role=head_nurse)可以修改
    """
    try:
        # 檢查權限
        if current_user.role not in ['head_nurse', 'admin']:
            raise HTTPException(status_code=403, detail="權限不足，只有控台醫師可以修改區域代碼")
        
        success = DoctorScheduleService.update_doctor_area_code(db, doctor_id, new_area_code.area_code)
        
        if not success:
            raise HTTPException(status_code=404, detail="找不到指定的醫師資料")
        
        return {
            "success": True,
            "message": "區域代碼更新成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新區域代碼失敗: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新區域代碼失敗: {str(e)}")

@router.post("/doctor/{doctor_id}/toggle-active")
async def toggle_doctor_active_status(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """切換醫師的上下班狀態"""
    try:
        result = DoctorScheduleService.toggle_doctor_active_status(db, doctor_id)
        if result:
            return {
                "success": True,
                "message": f"醫師狀態已更新為 {result.status}",
                "data": {
                    "id": result.id,
                    "name": result.name,
                    "status": result.status,
                    "updated_at": result.updated_at.isoformat()
                }
            }
        else:
            raise HTTPException(status_code=404, detail="找不到指定的醫師")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新醫師狀態失敗: {str(e)}")

@router.post("/doctor/{doctor_id}/toggle-leave")
async def toggle_doctor_leave_status(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """切換醫師的請假狀態"""
    try:
        result = DoctorScheduleService.toggle_doctor_leave_status(db, doctor_id)
        if result:
            action = "取消請假" if result.status == 'on_duty' else "請假"
            return {
                "success": True,
                "message": f"醫師{action}成功",
                "data": {
                    "id": result.id,
                    "name": result.name,
                    "status": result.status,
                    "updated_at": result.updated_at.isoformat()
                }
            }
        else:
            raise HTTPException(status_code=404, detail="找不到指定的醫師")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新醫師請假狀態失敗: {str(e)}")

@router.get("/update-logs")
async def get_update_logs(
    limit: int = Query(50, description="返回記錄數量限制"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """獲取班表更新日誌"""
    try:
        from ..models.doctor_schedule import DoctorScheduleUpdateLog
        
        logs = db.query(DoctorScheduleUpdateLog).order_by(
            DoctorScheduleUpdateLog.update_time.desc()
        ).limit(limit).all()
        
        log_data = []
        for log in logs:
            log_data.append({
                "id": log.id,
                "update_time": log.update_time.isoformat() if log.update_time else None,
                "start_date": log.start_date,
                "end_date": log.end_date,
                "success": log.success,
                "total_days": log.total_days,
                "error_message": log.error_message,
                "processing_time": log.processing_time
            })
        
        return {
            "success": True,
            "logs": log_data
        }
        
    except Exception as e:
        logger.error(f"獲取更新日誌失敗: {str(e)}")
        raise HTTPException(status_code=500, detail=f"獲取更新日誌失敗: {str(e)}")

@router.get("/health")
async def health_check():
    """健康檢查端點"""
    timezone_info = get_timezone_info()
    
    return {
        "success": True, 
        "message": "路由正常工作", 
        "timestamp": now().isoformat(),
        "timezone_info": {
            "timezone": timezone_info["timezone"],
            "offset": timezone_info["offset"],
            "taiwan_time": timezone_info["taiwan_time"].strftime("%Y-%m-%d %H:%M:%S"),
            "utc_time": timezone_info["utc_time"].strftime("%Y-%m-%d %H:%M:%S")
        }
    }

@router.post("/doctor/{doctor_id}/meeting-time")
async def set_doctor_meeting_time(
    doctor_id: int,
    meeting_time_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    設定醫師開會時間
    只有控台醫師可以修改
    """
    try:
        # 檢查權限
        if current_user.role not in ['head_nurse', 'admin']:
            raise HTTPException(status_code=403, detail="權限不足，只有控台醫師可以設定開會時間")
        
        meeting_time = meeting_time_data.get('meeting_time', '')
        
        success = DoctorScheduleService.set_doctor_meeting_time(db, doctor_id, meeting_time)
        
        if not success:
            raise HTTPException(status_code=404, detail="找不到指定的醫師資料")
        
        return {
            "success": True,
            "message": "開會時間設定成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"設定醫師開會時間失敗: {str(e)}")
        raise HTTPException(status_code=500, detail=f"設定開會時間失敗: {str(e)}")

@router.post("/doctor/{doctor_id}/meeting-time/remove")
async def delete_doctor_meeting_time(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    刪除醫師開會時間
    只有控台醫師可以修改
    """
    try:
        # 檢查權限
        if current_user.role not in ['head_nurse', 'admin']:
            raise HTTPException(status_code=403, detail="權限不足，只有控台醫師可以刪除開會時間")
        
        success = DoctorScheduleService.delete_doctor_meeting_time(db, doctor_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="找不到指定的醫師資料")
        
        return {
            "success": True,
            "message": "開會時間刪除成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"刪除醫師開會時間失敗: {str(e)}")
        raise HTTPException(status_code=500, detail=f"刪除開會時間失敗: {str(e)}")

@router.post("/doctor/{doctor_id}/set-status")
async def update_doctor_status_backup(
    doctor_id: int,
    status_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    更新醫師狀態的備用端點
    用於解決部署同步問題
    """
    try:
        action = status_data.get('action', '')  # 'toggle-active' or 'toggle-leave'
        
        if action == 'toggle-active':
            result = DoctorScheduleService.toggle_doctor_active_status(db, doctor_id)
        elif action == 'toggle-leave':
            result = DoctorScheduleService.toggle_doctor_leave_status(db, doctor_id)
        else:
            raise HTTPException(status_code=400, detail="無效的動作類型")
            
        if result:
            action_msg = "取消請假" if (action == 'toggle-leave' and result.status == 'on_duty') else \
                        "請假" if (action == 'toggle-leave' and result.status == 'off') else \
                        f"狀態更新為 {result.status}"
            
            return {
                "success": True,
                "message": f"醫師{action_msg}成功",
                "data": {
                    "id": result.id,
                    "name": result.name,
                    "status": result.status,
                    "updated_at": result.updated_at.isoformat()
                }
            }
        else:
            raise HTTPException(status_code=404, detail="找不到指定的醫師")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新醫師狀態失敗: {str(e)}")

# 備用路由，使用不同的路徑模式
@router.post("/update-doctor-status/{doctor_id}")
async def update_doctor_status_alternative(
    doctor_id: int,
    status_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    備用的醫師狀態更新端點
    使用不同的路徑模式以避免平台代理問題
    """
    try:
        action = status_data.get('action', '')  # 'toggle-active' or 'toggle-leave'
        
        if action == 'toggle-active':
            result = DoctorScheduleService.toggle_doctor_active_status(db, doctor_id)
        elif action == 'toggle-leave':
            result = DoctorScheduleService.toggle_doctor_leave_status(db, doctor_id)
        else:
            raise HTTPException(status_code=400, detail="無效的動作類型")
            
        if result:
            action_msg = "取消請假" if (action == 'toggle-leave' and result.status == 'on_duty') else \
                        "請假" if (action == 'toggle-leave' and result.status == 'off') else \
                        f"狀態更新為 {result.status}"
            
            return {
                "success": True,
                "message": f"醫師{action_msg}成功",
                "data": {
                    "id": result.id,
                    "name": result.name,
                    "status": result.status,
                    "updated_at": result.updated_at.isoformat()
                }
            }
        else:
            raise HTTPException(status_code=404, detail="找不到指定的醫師")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新醫師狀態失敗: {str(e)}")

@router.post("/check-auto-off-duty")
async def check_auto_off_duty(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    手動觸發醫師自動下班檢測
    只有管理員可以手動觸發
    """
    try:
        # 檢查權限（只有護理長或管理員可以觸發）
        if current_user.role not in ['head_nurse', 'admin']:
            raise HTTPException(status_code=403, detail="權限不足，只有護理長或管理員可以觸發自動下班檢測")
        
        # 執行自動下班檢測
        DoctorScheduleService.update_doctors_active_status_by_time(db)
        
        return {
            "success": True,
            "message": "自動下班檢測已執行完成",
            "timestamp": now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"手動觸發自動下班檢測失敗: {str(e)}")
        raise HTTPException(status_code=500, detail=f"執行失敗: {str(e)}")

# 添加測試端點
@router.post("/test-endpoint")
async def test_endpoint():
    """
    測試端點，用於驗證路由是否正常工作
    """
    return {"success": True, "message": "路由正常工作", "timestamp": now().isoformat()}

@router.get("/debug/routes")
async def debug_routes():
    """調試路由，返回當前時間和路由資訊"""
    return {
        "message": "醫師班表路由調試資訊",
        "current_time": now(),
        "timezone": "Asia/Taipei",
        "routes": [
            "GET /api/doctor-schedules/today - 獲取今日班表",
            "GET /api/doctor-schedules/date-range - 獲取日期範圍班表",
            "POST /api/doctor-schedules/doctor/{doctor_id}/set-status - 設定醫師狀態",
            "POST /api/doctor-schedules/doctor/{doctor_id}/set-meeting-time - 設定開會時間",
            "DELETE /api/doctor-schedules/doctor/{doctor_id}/meeting-time - 刪除開會時間"
        ],
        "timestamp": now().isoformat()
    } 