from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import datetime, date

# 基本換班請求模式
class ShiftSwapRequestBase(BaseModel):
    from_date: date
    from_shift: str
    to_date: date
    to_shift: Optional[str] = None
    swap_type: str
    target_nurse_id: Optional[int] = None
    from_mission: Optional[str] = None
    to_mission: Optional[str] = None
    from_overtime: Optional[str] = None
    to_overtime: Optional[str] = None
    notes: Optional[str] = None

# 用於創建換班請求
class ShiftSwapRequestCreate(ShiftSwapRequestBase):
    @validator('to_shift', 'to_overtime')
    def validate_based_on_swap_type(cls, v, values):
        swap_type = values.get('swap_type')
        if swap_type == 'shift' and not v:
            field_name = 'to_shift' if v is None else 'to_overtime'
            raise ValueError(f'當換班類型為shift時，{field_name}是必填欄位')
        elif swap_type == 'overtime' and 'to_shift' not in values and not values.get('to_overtime'):
            raise ValueError('當換班類型為overtime時，to_overtime是必填欄位')
        return v

# 用於更新換班請求
class ShiftSwapRequestUpdate(BaseModel):
    acceptor_id: Optional[int] = None
    status: Optional[str] = None
    validation_result: Optional[bool] = None
    validation_message: Optional[str] = None

# 換班請求響應
class ShiftSwapRequest(ShiftSwapRequestBase):
    id: int
    requestor_id: int
    acceptor_id: Optional[int] = None
    status: str
    validation_result: Optional[bool] = None
    validation_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    accepted_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# 完整換班資訊（包含關聯數據）
class ShiftSwapRequestFull(ShiftSwapRequest):
    requestor: Optional[dict] = None
    acceptor: Optional[dict] = None

# 基本班別規則模式
class ShiftRuleBase(BaseModel):
    name: str
    shift_type: str
    start_time: str
    end_time: str
    max_consecutive: Optional[int] = None
    min_rest_hours: Optional[int] = None
    max_weekly_shifts: Optional[int] = None
    max_monthly_shifts: Optional[int] = None
    description: Optional[str] = None
    is_active: bool = True

# 用於創建班別規則
class ShiftRuleCreate(ShiftRuleBase):
    pass

# 用於更新班別規則
class ShiftRuleUpdate(BaseModel):
    name: Optional[str] = None
    shift_type: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    max_consecutive: Optional[int] = None
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