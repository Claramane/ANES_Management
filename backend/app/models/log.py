from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base

class Log(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    operation_type = Column(String)  # 操作類型：login, logout, create_schedule, update_schedule, etc.
    operation_time = Column(DateTime, default=func.now())
    ip_address = Column(String)
    description = Column(Text)
    
    # 關聯
    user = relationship("User") 