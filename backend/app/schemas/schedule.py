from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, date

# 基本月度排班表模式
class MonthlyScheduleBase(BaseModel):
    user_id: int
    date: date
    shift_type: str
    area_code: Optional[str] = None
    work_time: Optional[str] = None

# 用於創建月度排班表
class MonthlyScheduleCreate(MonthlyScheduleBase):
    version_id: int

# 用於更新月度排班表
class MonthlyScheduleUpdate(BaseModel):
    shift_type: Optional[str] = None
    area_code: Optional[str] = None
    work_time: Optional[str] = None

# 月度排班表響應
class MonthlySchedule(MonthlyScheduleBase):
    id: int
    version_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# 基本班表版本模式
class ScheduleVersionBase(BaseModel):
    version_number: str
    month: str
    notes: Optional[str] = None
    is_published: bool = False
    published_by: int
    is_base_version: Optional[bool] = False

# 用於創建班表版本
class ScheduleVersionCreate(ScheduleVersionBase):
    pass

# 用於更新班表版本
class ScheduleVersionUpdate(BaseModel):
    notes: Optional[str] = None
    is_published: Optional[bool] = None
    is_base_version: Optional[bool] = None

# 班表版本響應
class ScheduleVersion(ScheduleVersionBase):
    id: int
    published_at: datetime

    class Config:
        from_attributes = True

# 基本班表版本差異模式
class ScheduleVersionDiffBase(BaseModel):
    version_id: int
    base_version_id: int
    diff_data: Dict[str, Any]

# 用於創建班表版本差異
class ScheduleVersionDiffCreate(ScheduleVersionDiffBase):
    pass

# 班表版本差異響應
class ScheduleVersionDiff(ScheduleVersionDiffBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# 生成月班表的請求
class GenerateMonthScheduleRequest(BaseModel):
    year: int
    month: int
    description: Optional[str] = None
    as_base_version: Optional[bool] = False  # 是否作為基準版本
    temporary: Optional[bool] = False  # 是否為臨時生成（不保存到資料庫）

# 获取月度排班详情的响应
class MonthlyScheduleResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None 