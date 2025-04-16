from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Date, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base

class ShiftSwapRequest(Base):
    __tablename__ = "shift_swap_requests"

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"))
    acceptor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # 原班詳情
    original_date = Column(Date)
    original_shift_type = Column(String)
    original_area_code = Column(String)
    
    # 目標班詳情
    target_date = Column(Date)
    target_shift_type = Column(String)
    target_area_code = Column(String)
    
    # 狀態追蹤
    status = Column(String)  # 待審核/已換班/拒絕
    validation_result = Column(Boolean)  # 驗證結果
    validation_message = Column(Text)  # 驗證訊息
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    accepted_at = Column(DateTime, nullable=True)
    
    # 關聯
    requester = relationship("User", foreign_keys=[requester_id], back_populates="shift_swap_requests")
    acceptor = relationship("User", foreign_keys=[acceptor_id], back_populates="shift_swap_acceptors")

class ShiftRule(Base):
    __tablename__ = "shift_rules"

    id = Column(Integer, primary_key=True, index=True)
    shift_type = Column(String)  # D, A, N, O
    start_time = Column(String)  # 開始時間
    end_time = Column(String)  # 結束時間
    min_rest_hours = Column(Integer)  # 最小休息時間(小時)
    max_weekly_shifts = Column(Integer)  # 每週最大班數
    max_monthly_shifts = Column(Integer)  # 每月最大班數
    description = Column(String)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now()) 