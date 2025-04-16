from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date

# 基本月班表項目模式
class MonthlyScheduleBase(BaseModel):
    user_id: int
    date: date
    shift_type: str
    area_code: Optional[str] = None
    work_time: Optional[str] = None
    version_id: int

# 用於創建月班表項目
class MonthlyScheduleCreate(MonthlyScheduleBase):
    pass

# 用於更新月班表項目
class MonthlyScheduleUpdate(BaseModel):
    shift_type: Optional[str] = None
    area_code: Optional[str] = None
    work_time: Optional[str] = None

# 月班表項目響應
class MonthlySchedule(MonthlyScheduleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

# 基本班表版本模式
class ScheduleVersionBase(BaseModel):
    version_number: str
    month: str
    notes: Optional[str] = None
    is_published: bool = False
    published_by: int

# 用於創建班表版本
class ScheduleVersionCreate(ScheduleVersionBase):
    pass

# 用於更新班表版本
class ScheduleVersionUpdate(BaseModel):
    notes: Optional[str] = None
    is_published: Optional[bool] = None

# 班表版本響應
class ScheduleVersion(ScheduleVersionBase):
    id: int
    published_at: datetime

    class Config:
        from_attributes = True

# 生成月班表的請求
class GenerateMonthScheduleRequest(BaseModel):
    year: int
    month: int
    description: Optional[str] = None 