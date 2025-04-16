from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# 基本公告類別模式
class AnnouncementCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True

# 用於創建公告類別
class AnnouncementCategoryCreate(AnnouncementCategoryBase):
    pass

# 用於更新公告類別
class AnnouncementCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

# 公告類別響應
class AnnouncementCategory(AnnouncementCategoryBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# 基本公告模式
class AnnouncementBase(BaseModel):
    title: str
    content: str
    category_id: int
    author_id: int
    is_active: bool = True
    is_pinned: bool = False

# 用於創建公告
class AnnouncementCreate(BaseModel):
    title: str
    content: str
    category_id: int
    is_pinned: bool = False

# 用於更新公告
class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category_id: Optional[int] = None
    is_active: Optional[bool] = None
    is_pinned: Optional[bool] = None

# 公告響應
class Announcement(AnnouncementBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# 基本公告權限模式
class AnnouncementPermissionBase(BaseModel):
    category_id: int
    identity: str
    can_create: bool = False
    can_edit: bool = False
    can_delete: bool = False

# 用於創建公告權限
class AnnouncementPermissionCreate(AnnouncementPermissionBase):
    pass

# 用於更新公告權限
class AnnouncementPermissionUpdate(BaseModel):
    can_create: Optional[bool] = None
    can_edit: Optional[bool] = None
    can_delete: Optional[bool] = None

# 公告權限響應
class AnnouncementPermission(AnnouncementPermissionBase):
    id: int

    class Config:
        from_attributes = True 