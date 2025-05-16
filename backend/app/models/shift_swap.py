from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Date, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base

class ShiftSwapRequest(Base):
    __tablename__ = "shift_swap_requests"

    id = Column(Integer, primary_key=True, index=True)
    requestor_id = Column(Integer, ForeignKey("users.id"))
    acceptor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # 日期和班別信息
    from_date = Column(Date)
    from_shift = Column(String)
    from_mission = Column(String, nullable=True)
    from_overtime = Column(String, nullable=True)
    
    to_date = Column(Date)
    to_shift = Column(String)
    to_mission = Column(String, nullable=True)
    to_overtime = Column(String, nullable=True)
    
    # 目標護理師
    target_nurse_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # 換班類型
    swap_type = Column(String)  # shift, mission, overtime
    
    # 備註
    notes = Column(Text, nullable=True)
    
    # 狀態追蹤
    status = Column(String, default="pending")  # pending, accepted, rejected
    validation_result = Column(Boolean, nullable=True)  # 驗證結果
    validation_message = Column(Text, nullable=True)  # 驗證訊息
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    accepted_at = Column(DateTime, nullable=True)
    
    # 關聯
    requestor = relationship("User", foreign_keys=[requestor_id], back_populates="swap_requests")
    acceptor = relationship("User", foreign_keys=[acceptor_id], back_populates="swap_accepts")
    target_nurse = relationship("User", foreign_keys=[target_nurse_id])

class ShiftRule(Base):
    __tablename__ = "shift_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    shift_type = Column(String, nullable=False)
    start_time = Column(String, nullable=False)
    end_time = Column(String, nullable=False)
    max_consecutive = Column(Integer)
    min_rest_hours = Column(Integer)
    max_weekly_shifts = Column(Integer)
    max_monthly_shifts = Column(Integer)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now()) 