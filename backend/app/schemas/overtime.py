from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional, List, Dict

# 共享基本欄位的基礎模型
class OvertimeRecordBase(BaseModel):
    date: date
    overtime_shift: Optional[str] = None

# 創建加班記錄請求模型
class OvertimeRecordCreate(OvertimeRecordBase):
    pass

# 更新加班記錄請求模型
class OvertimeRecordUpdate(BaseModel):
    overtime_shift: Optional[str] = None

# 批量創建加班記錄請求模型
class BulkOvertimeRecordCreate(BaseModel):
    records: List[OvertimeRecordCreate]
    user_id: Optional[int] = None  # 若未提供，則使用當前用戶的ID

# 批量更新加班記錄請求模型
class BulkOvertimeRecordUpdate(BaseModel):
    date: date
    overtime_shift: Optional[str] = None
    user_ids: List[int]

# 整月批量更新加班記錄請求模型
class MultipleDatesOvertimeUpdate(BaseModel):
    records: List[Dict]  # 包含多個日期、班次和用戶IDs的記錄列表

# 加班記錄響應模型
class OvertimeRecord(OvertimeRecordBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# 月度加班分數基礎模型
class OvertimeMonthlyScoreBase(BaseModel):
    user_id: int
    year: int
    month: int
    total_score: int
    details: Optional[str] = None

# 創建月度加班分數請求模型
class OvertimeMonthlyScoreCreate(OvertimeMonthlyScoreBase):
    pass

# 更新月度加班分數請求模型
class OvertimeMonthlyScoreUpdate(BaseModel):
    total_score: Optional[int] = None
    details: Optional[str] = None

# 批量更新月度加班分數請求模型
class BulkOvertimeMonthlyScoreUpdate(BaseModel):
    scores: List[OvertimeMonthlyScoreCreate]

# 月度加班分數響應模型
class OvertimeMonthlyScore(OvertimeMonthlyScoreBase):
    id: int

    class Config:
        from_attributes = True 