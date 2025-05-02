from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base

class FormulaSchedule(Base):
    """
    公式排班表模型
    """
    __tablename__ = "formula_schedules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    identity = Column(String(50), default="")
    num_groups = Column(Integer, default=1)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # 關聯
    patterns = relationship("FormulaSchedulePattern", back_populates="formula")
    nurse_assignments = relationship("NurseFormulaAssignment", back_populates="formula")

class FormulaSchedulePattern(Base):
    """
    公式排班模式模型
    """
    __tablename__ = "formula_schedule_patterns"

    id = Column(Integer, primary_key=True, index=True)
    formula_id = Column(Integer, ForeignKey("formula_schedules.id"), nullable=False)
    group_number = Column(Integer, nullable=False)
    day_offset = Column(Integer, default=0)
    pattern = Column(String(20))
    shift_type = Column(String(5))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # 唯一約束
    __table_args__ = (
        UniqueConstraint('formula_id', 'group_number', 'day_offset'),
    )

    # 關聯
    formula = relationship("FormulaSchedule", back_populates="patterns")
    nurse_assignments = relationship("PatternNurseAssignment", back_populates="pattern")

class NurseFormulaAssignment(Base):
    """
    護理師與公式班表分配關聯模型
    """
    __tablename__ = "nurse_formula_assignments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    formula_id = Column(Integer, ForeignKey("formula_schedules.id"), nullable=False)
    group_number = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # 唯一約束
    __table_args__ = (
        UniqueConstraint('user_id', 'formula_id'),
    )

    # 關聯
    user = relationship("User", back_populates="formula_assignments")
    formula = relationship("FormulaSchedule", back_populates="nurse_assignments")

class PatternNurseAssignment(Base):
    """
    護理師與公式班表模式分配關聯模型
    """
    __tablename__ = "pattern_nurse_assignments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    pattern_id = Column(Integer, ForeignKey("formula_schedule_patterns.id"), nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # 唯一約束
    __table_args__ = (
        UniqueConstraint('user_id', 'pattern_id'),
    )

    # 關聯
    user = relationship("User", back_populates="pattern_assignments")
    pattern = relationship("FormulaSchedulePattern", back_populates="nurse_assignments") 