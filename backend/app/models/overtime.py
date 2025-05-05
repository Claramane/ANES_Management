from sqlalchemy import Column, Integer, String, Date, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base

class OvertimeRecord(Base):
    __tablename__ = "overtime_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(Date, index=True)
    overtime_shift = Column(String(1))  # A, B, C, D, E, F 或 null
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # 關聯
    user = relationship("User")

class OvertimeMonthlyScore(Base):
    __tablename__ = "overtime_monthly_scores"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    year = Column(Integer)
    month = Column(Integer)
    total_score = Column(Integer)
    details = Column(Text)
    
    # 關聯
    user = relationship("User") 