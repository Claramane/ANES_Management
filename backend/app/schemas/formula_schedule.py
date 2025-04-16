from pydantic import BaseModel, Field
from typing import Optional, List, ForwardRef
from datetime import datetime

# 基本公式班表模式
class FormulaScheduleBase(BaseModel):
    name: str
    description: Optional[str] = None

# 公式班表模式
class FormulaSchedulePatternBase(BaseModel):
    formula_id: int
    group_number: int
    pattern: str

# 用於創建公式班表模式
class FormulaSchedulePatternCreate(FormulaSchedulePatternBase):
    pass

# 用於更新公式班表模式
class FormulaSchedulePatternUpdate(BaseModel):
    formula_id: Optional[int] = None
    group_number: Optional[int] = None
    pattern: Optional[str] = None

# 公式班表模式響應
class FormulaSchedulePattern(FormulaSchedulePatternBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# 用於創建公式班表
class FormulaScheduleCreate(FormulaScheduleBase):
    patterns: Optional[List[FormulaSchedulePatternCreate]] = []

# 用於更新公式班表
class FormulaScheduleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    patterns: Optional[List[FormulaSchedulePatternCreate]] = None

# 公式班表響應
class FormulaSchedule(FormulaScheduleBase):
    id: int
    created_at: datetime
    updated_at: datetime
    patterns: Optional[List[FormulaSchedulePattern]] = []

    class Config:
        from_attributes = True

# 護理師公式班表指派
class NurseFormulaAssignmentBase(BaseModel):
    user_id: int
    formula_id: int
    start_cycle: int = 1
    sort_order: int

# 用於創建護理師公式班表指派
class NurseFormulaAssignmentCreate(NurseFormulaAssignmentBase):
    pass

# 用於更新護理師公式班表指派
class NurseFormulaAssignmentUpdate(BaseModel):
    formula_id: Optional[int] = None
    start_cycle: Optional[int] = None
    sort_order: Optional[int] = None

# 護理師公式班表指派響應
class NurseFormulaAssignment(NurseFormulaAssignmentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# 護理師與模式的關聯
class PatternNurseAssignmentBase(BaseModel):
    pattern_id: int
    user_id: int

# 用於創建護理師與模式的關聯
class PatternNurseAssignmentCreate(PatternNurseAssignmentBase):
    pass

# 用於更新護理師與模式的關聯
class PatternNurseAssignmentUpdate(BaseModel):
    pattern_id: Optional[int] = None
    user_id: Optional[int] = None

# 護理師與模式的關聯響應
class PatternNurseAssignment(PatternNurseAssignmentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# 解析ForwardRef
FormulaSchedule.update_forward_refs() 