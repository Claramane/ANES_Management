from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base

class DoctorSchedule(Base):
    """醫師每日班表"""
    __tablename__ = "doctor_schedules"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String(8), unique=True, index=True, nullable=False)  # YYYYMMDD 格式
    duty_doctor = Column(String(50), nullable=True)  # 值班醫師
    schedule_notes = Column(JSON, nullable=True)  # 排班注記，存儲JSON格式
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 關聯白班醫師
    day_shift_doctors = relationship("DayShiftDoctor", back_populates="schedule", cascade="all, delete-orphan")

class DayShiftDoctor(Base):
    """白班醫師資料"""
    __tablename__ = "day_shift_doctors"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey('doctor_schedules.id'), nullable=False)
    name = Column(String(50), nullable=False)  # 醫師姓名（從summary中提取）
    summary = Column(String(200), nullable=False)  # 原始summary，如"陳柏羽/A"
    time = Column(String(50), nullable=False)  # 工作時間，如"08:00-18:00"
    area_code = Column(String(20), nullable=False)  # 轉換後的區域代碼
    active = Column(Boolean, default=True, nullable=False)  # 是否啟用
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 關聯班表
    schedule = relationship("DoctorSchedule", back_populates="day_shift_doctors")

class DoctorScheduleUpdateLog(Base):
    """醫師班表更新日誌"""
    __tablename__ = "doctor_schedule_update_logs"

    id = Column(Integer, primary_key=True, index=True)
    update_time = Column(DateTime, default=func.now())
    start_date = Column(String(8), nullable=False)  # 更新的開始日期
    end_date = Column(String(8), nullable=False)    # 更新的結束日期
    success = Column(Boolean, nullable=False)       # 是否成功
    total_days = Column(Integer, default=0)         # 總天數
    error_message = Column(Text, nullable=True)     # 錯誤訊息
    processing_time = Column(String(50), nullable=True)  # 處理時間 