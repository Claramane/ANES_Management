from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date

# 基本換班請求模式
class ShiftSwapRequestBase(BaseModel):
    requester_id: int
    original_date: date
    original_shift_type: str
    original_area_code: Optional[str] = None
    target_date: date
    target_shift_type: str
    target_area_code: Optional[str] = None

# 用於創建換班請求
class ShiftSwapRequestCreate(ShiftSwapRequestBase):
    pass

# 用於更新換班請求
class ShiftSwapRequestUpdate(BaseModel):
    acceptor_id: Optional[int] = None
    status: Optional[str] = None
    validation_result: Optional[bool] = None
    validation_message: Optional[str] = None

# 換班請求響應
class ShiftSwapRequest(ShiftSwapRequestBase):
    id: int
    acceptor_id: Optional[int] = None
    status: str
    validation_result: Optional[bool] = None
    validation_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    accepted_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# 基本班別規則模式
class ShiftRuleBase(BaseModel):
    shift_type: str
    start_time: str
    end_time: str
    min_rest_hours: int
    max_weekly_shifts: int
    max_monthly_shifts: int
    description: Optional[str] = None
    is_active: bool = True

# 用於創建班別規則
class ShiftRuleCreate(ShiftRuleBase):
    pass

# 用於更新班別規則
class ShiftRuleUpdate(BaseModel):
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    min_rest_hours: Optional[int] = None
    max_weekly_shifts: Optional[int] = None
    max_monthly_shifts: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

# 班別規則響應
class ShiftRule(ShiftRuleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# 驗證換班請求
class ValidateSwapRequest(BaseModel):
    request_id: int 