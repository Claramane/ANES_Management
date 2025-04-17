from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base

class Log(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(100), nullable=False)  # 添加必填欄位action
    operation_type = Column(String)  # 操作類型：login, logout, create_schedule, update_schedule, etc.
    operation_time = Column(DateTime, default=func.now())
    ip_address = Column(String)
    description = Column(Text)
    details = Column(Text)
    user_agent = Column(Text)
    created_at = Column(DateTime, default=func.now())
    
    # 關聯
    user = relationship("User") 