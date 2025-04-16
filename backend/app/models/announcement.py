from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base

class AnnouncementCategory(Base):
    __tablename__ = "announcement_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    description = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 關聯
    announcements = relationship("Announcement", back_populates="category")
    permissions = relationship("AnnouncementPermission", back_populates="category")

class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    content = Column(Text)
    category_id = Column(Integer, ForeignKey("announcement_categories.id"))
    author_id = Column(Integer, ForeignKey("users.id"))
    is_active = Column(Boolean, default=True)
    is_pinned = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 關聯
    category = relationship("AnnouncementCategory", back_populates="announcements")
    author = relationship("User", back_populates="announcements")

class AnnouncementPermission(Base):
    __tablename__ = "announcement_permissions"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("announcement_categories.id"))
    identity = Column(String)  # 對應到 User.identity
    can_create = Column(Boolean, default=False)
    can_edit = Column(Boolean, default=False)
    can_delete = Column(Boolean, default=False)
    
    # 關聯
    category = relationship("AnnouncementCategory", back_populates="permissions") 