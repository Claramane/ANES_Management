from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base

class FormulaSchedule(Base):
    __tablename__ = "formula_schedules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    description = Column(String)
    # pattern欄位已移至formula_schedule_patterns表，資料庫中已不存在此欄位
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # 關聯
    nurse_assignments = relationship("NurseFormulaAssignment", back_populates="formula")
    patterns = relationship("FormulaSchedulePattern", back_populates="formula", order_by="FormulaSchedulePattern.group_number", lazy="select", cascade="all, delete-orphan")

class NurseFormulaAssignment(Base):
    __tablename__ = "nurse_formula_assignments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    formula_id = Column(Integer, ForeignKey("formula_schedules.id"))
    start_cycle = Column(Integer, default=1)  # 從哪個週期開始
    sort_order = Column(Integer)  # 排序順序
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # 關聯
    user = relationship("User", back_populates="formula_assignments")
    formula = relationship("FormulaSchedule", back_populates="nurse_assignments")

class FormulaSchedulePattern(Base):
    __tablename__ = "formula_schedule_patterns"

    id = Column(Integer, primary_key=True, index=True)
    formula_id = Column(Integer, ForeignKey("formula_schedules.id"))
    group_number = Column(Integer)
    pattern = Column(String)  # 班別排列字串，例如 "DDOAONN"
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # 關聯
    formula = relationship("FormulaSchedule", back_populates="patterns")
    nurse_assignments = relationship("PatternNurseAssignment", back_populates="pattern")

class PatternNurseAssignment(Base):
    __tablename__ = "pattern_nurse_assignments"

    id = Column(Integer, primary_key=True, index=True)
    pattern_id = Column(Integer, ForeignKey("formula_schedule_patterns.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # 關聯
    pattern = relationship("FormulaSchedulePattern", back_populates="nurse_assignments")
    user = relationship("User", back_populates="pattern_assignments") 