from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base

class MonthlySchedule(Base):
    __tablename__ = "monthly_schedules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(Date, index=True)
    shift_type = Column(String)  # D=白班, A=小夜班, N=大夜班, O=休假
    area_code = Column(String)  # 房區代號
    work_time = Column(String)  # 工作時間
    version_id = Column(Integer, ForeignKey("schedule_versions.id"))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # 關聯
    user = relationship("User", back_populates="monthly_schedules")
    version = relationship("ScheduleVersion", back_populates="schedules")

class ScheduleVersion(Base):
    __tablename__ = "schedule_versions"

    id = Column(Integer, primary_key=True, index=True)
    version_number = Column(String)  # 版本編號
    month = Column(String)  # 年月格式 YYYYMM
    published_at = Column(DateTime, default=func.now())
    notes = Column(Text)  # 備註
    is_published = Column(Boolean, default=False)  # 是否已發布
    published_by = Column(Integer, ForeignKey("users.id"))
    
    # 關聯
    schedules = relationship("MonthlySchedule", back_populates="version")
    publisher = relationship("User") 