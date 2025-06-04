from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import logging

from ..core.database import get_db
from ..services.doctor_schedule_service import DoctorScheduleService
from ..core.security import get_current_user
from ..models.user import User

logger = logging.getLogger(__name__)

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

@router.get("/today")
async def get_today_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """獲取今日醫師班表"""
    try:
        schedule = DoctorScheduleService.get_today_schedule(db)
        
        if not schedule:
            return {
                "success": True,
                "message": "今日無班表資料",
                "schedule": None
            }
        
        return {
            "success": True,
            "schedule": schedule
        }
        
    except Exception as e:
        logger.error(f"獲取今日班表失敗: {str(e)}")
        raise HTTPException(status_code=500, detail=f"獲取今日班表失敗: {str(e)}")

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

@router.put("/doctor/{doctor_id}/area-code")
async def update_doctor_area_code(
    doctor_id: int,
    new_area_code: str = Query(..., description="新的區域代碼"),
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
        
        success = DoctorScheduleService.update_doctor_area_code(db, doctor_id, new_area_code)
        
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

@router.put("/doctor/{doctor_id}/toggle-active")
async def toggle_doctor_active_status(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    切換醫師的啟用狀態
    只有控台醫師可以修改
    """
    try:
        # 檢查權限
        if current_user.role not in ['head_nurse', 'admin']:
            raise HTTPException(status_code=403, detail="權限不足，只有控台醫師可以修改醫師狀態")
        
        success = DoctorScheduleService.toggle_doctor_active_status(db, doctor_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="找不到指定的醫師資料")
        
        return {
            "success": True,
            "message": "醫師狀態切換成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"切換醫師狀態失敗: {str(e)}")
        raise HTTPException(status_code=500, detail=f"切換醫師狀態失敗: {str(e)}")

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
async def check_api_health():
    """檢查外部API健康狀態"""
    try:
        import requests
        response = requests.get(f"{DoctorScheduleService.EXTERNAL_API_BASE}/health", timeout=10)
        response.raise_for_status()
        
        return {
            "success": True,
            "external_api_status": "healthy",
            "message": "外部API連接正常"
        }
        
    except Exception as e:
        logger.error(f"外部API健康檢查失敗: {str(e)}")
        return {
            "success": False,
            "external_api_status": "error",
            "message": f"外部API連接失敗: {str(e)}"
        } 