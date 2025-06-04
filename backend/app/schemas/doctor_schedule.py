from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, validator

class DayShiftDoctorBase(BaseModel):
    """白班醫師基礎模型"""
    name: str = Field(..., description="醫師姓名")
    summary: str = Field(..., description="原始排班資訊，如：陳柏羽/A")
    time: str = Field(..., description="班次時間，如：08:00-18:00")
    area_code: str = Field(..., description="工作區域代碼")
    active: bool = Field(True, description="是否啟用")

class DayShiftDoctorCreate(DayShiftDoctorBase):
    """創建白班醫師"""
    pass

class DayShiftDoctorUpdate(BaseModel):
    """更新白班醫師"""
    area_code: Optional[str] = Field(None, description="工作區域代碼")
    active: Optional[bool] = Field(None, description="是否啟用")

class DayShiftDoctorResponse(DayShiftDoctorBase):
    """白班醫師回應模型"""
    id: int = Field(..., description="醫師記錄ID")

    class Config:
        from_attributes = True

class DoctorScheduleBase(BaseModel):
    """醫師班表基礎模型"""
    date: str = Field(..., description="日期，格式：YYYYMMDD")
    duty_doctor: Optional[str] = Field(None, description="值班醫師")
    schedule_notes: Optional[List[Dict[str, Any]]] = Field(default=[], description="排班注記")

class DoctorScheduleCreate(DoctorScheduleBase):
    """創建醫師班表"""
    day_shifts: List[DayShiftDoctorCreate] = Field(default=[], description="白班醫師列表")

class DoctorScheduleResponse(DoctorScheduleBase):
    """醫師班表回應模型"""
    id: int = Field(..., description="班表ID")
    值班: Optional[str] = Field(None, description="值班醫師（API相容性）")
    白班: List[DayShiftDoctorResponse] = Field(default=[], description="白班醫師列表")
    排班注記: List[Dict[str, Any]] = Field(default=[], description="排班注記")
    updated_at: Optional[str] = Field(None, description="最後更新時間")

    @validator('值班', pre=True, always=True)
    def set_duty_doctor_alias(cls, v, values):
        """設置值班醫師的別名"""
        return values.get('duty_doctor', v)

    @validator('白班', pre=True, always=True)
    def set_day_shifts_alias(cls, v, values):
        """設置白班的別名"""
        return v

    @validator('排班注記', pre=True, always=True) 
    def set_schedule_notes_alias(cls, v, values):
        """設置排班注記的別名"""
        return values.get('schedule_notes', v)

    class Config:
        from_attributes = True

class DoctorScheduleListResponse(BaseModel):
    """醫師班表列表回應"""
    success: bool = Field(True, description="請求是否成功")
    query_period: Dict[str, str] = Field(..., description="查詢期間")
    schedules: List[DoctorScheduleResponse] = Field(..., description="班表列表")
    summary: Dict[str, Any] = Field(..., description="統計摘要")

class ExternalApiUpdateRequest(BaseModel):
    """外部API更新請求"""
    start_date: str = Field(..., description="開始日期 YYYYMMDD", pattern=r'^\d{8}$')
    end_date: str = Field(..., description="結束日期 YYYYMMDD", pattern=r'^\d{8}$')

class ExternalApiUpdateResponse(BaseModel):
    """外部API更新回應"""
    success: bool = Field(..., description="更新是否成功")
    saved_count: int = Field(..., description="儲存的記錄數量")
    message: str = Field(..., description="更新訊息")

class DoctorAreaCodeUpdateRequest(BaseModel):
    """醫師區域代碼更新請求"""
    new_area_code: str = Field(..., description="新的區域代碼")

class DoctorStatusToggleResponse(BaseModel):
    """醫師狀態切換回應"""
    success: bool = Field(..., description="切換是否成功")
    message: str = Field(..., description="操作訊息")

class UpdateLogResponse(BaseModel):
    """更新日誌回應"""
    id: int = Field(..., description="日誌ID")
    update_time: Optional[str] = Field(None, description="更新時間")
    start_date: str = Field(..., description="開始日期")
    end_date: str = Field(..., description="結束日期")
    success: bool = Field(..., description="更新是否成功")
    total_days: int = Field(..., description="總天數")
    error_message: Optional[str] = Field(None, description="錯誤訊息")
    processing_time: Optional[float] = Field(None, description="處理時間（秒）")

class UpdateLogListResponse(BaseModel):
    """更新日誌列表回應"""
    success: bool = Field(True, description="請求是否成功")
    logs: List[UpdateLogResponse] = Field(..., description="日誌列表")

class HealthCheckResponse(BaseModel):
    """健康檢查回應"""
    success: bool = Field(..., description="檢查是否成功")
    external_api_status: str = Field(..., description="外部API狀態")
    message: str = Field(..., description="狀態訊息")

class TodayScheduleResponse(BaseModel):
    """今日班表回應"""
    success: bool = Field(True, description="請求是否成功")
    schedule: Optional[DoctorScheduleResponse] = Field(None, description="今日班表")
    message: Optional[str] = Field(None, description="訊息") 