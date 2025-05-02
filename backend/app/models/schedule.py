from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date, Text, Boolean, JSON
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
    special_type = Column(String)  # 特殊分類標記 (SNP=小夜班包班, LNP=大夜班包班)
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
    is_base_version = Column(Boolean, default=False)  # 是否為基準版本
    
    # 關聯
    schedules = relationship("MonthlySchedule", back_populates="version")
    publisher = relationship("User")
    # 新增：差異關係
    diffs = relationship("ScheduleVersionDiff", foreign_keys="[ScheduleVersionDiff.version_id]", back_populates="version")
    base_for_diffs = relationship("ScheduleVersionDiff", foreign_keys="[ScheduleVersionDiff.base_version_id]", back_populates="base_version")

class ScheduleVersionDiff(Base):
    """排班表版本差異模型，儲存版本間的差異"""
    __tablename__ = "schedule_version_diffs"

    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("schedule_versions.id"))  # 當前版本ID
    base_version_id = Column(Integer, ForeignKey("schedule_versions.id"))  # 基準版本ID
    diff_data = Column(JSON)  # 差異數據，格式為JSON
    created_at = Column(DateTime, default=func.now())
    
    # 關聯
    version = relationship("ScheduleVersion", foreign_keys=[version_id], back_populates="diffs")
    base_version = relationship("ScheduleVersion", foreign_keys=[base_version_id], back_populates="base_for_diffs") 