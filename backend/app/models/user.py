from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String)
    hashed_password = Column(String)
    role = Column(String)  # head_nurse, nurse
    identity = Column(String)  # 護理師身份（一般護理師、資深護理師等）
    group_data = Column(Text, nullable=True)  # 用於儲存使用者分組資料，JSON格式
    hire_date = Column(Date, nullable=True)  # 入職日期
    last_login_ip = Column(String)
    last_login_time = Column(DateTime)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # 關聯
    monthly_schedules = relationship("MonthlySchedule", back_populates="user")
    formula_assignments = relationship("NurseFormulaAssignment", back_populates="user")
    pattern_assignments = relationship("PatternNurseAssignment", back_populates="user")
    shift_swap_requests = relationship("ShiftSwapRequest", foreign_keys="ShiftSwapRequest.requester_id", back_populates="requester")
    shift_swap_acceptors = relationship("ShiftSwapRequest", foreign_keys="ShiftSwapRequest.acceptor_id", back_populates="acceptor")
    announcements = relationship("Announcement", back_populates="author")
    
    # 虛擬屬性，不保存到數據庫
    @property
    def is_active(self):
        return True 