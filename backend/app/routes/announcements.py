from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import List, Optional
from datetime import datetime, timedelta
import logging

from ..core.database import get_db
from ..core.security import get_current_active_user
from ..models.user import User
from ..models.announcement import Announcement, AnnouncementCategory
from ..schemas.announcement import (
    AnnouncementCreate, 
    AnnouncementUpdate, 
    Announcement as AnnouncementSchema,
)
from ..schemas.user import User as UserSchema

# 設置logger
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/announcements",
    tags=["announcements"]
)

@router.get("/", response_model=List[dict])
async def get_all_announcements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    category_id: Optional[int] = None
):
    """
    取得所有公告列表
    """
    query = db.query(Announcement)
    
    # 根據參數篩選
    if active_only:
        query = query.filter(Announcement.is_active == True)
    
    if category_id:
        query = query.filter(Announcement.category_id == category_id)
    
    # 嘗試使用is_pinned排序，如果失敗則降級為僅使用created_at
    try:
        # 獲取公告記錄
        announcements = query.order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc()).offset(skip).limit(limit).all()
    except Exception as e:
        # 如果發生錯誤（例如is_pinned欄位不存在），則只按創建時間排序
        logger.warning(f"排序時發生錯誤，降級使用僅創建時間排序: {str(e)}")
        announcements = query.order_by(Announcement.created_at.desc()).offset(skip).limit(limit).all()
    
    # 處理響應，同時添加所需資訊
    result = []
    for ann in announcements:
        # 獲取分類名稱
        category = db.query(AnnouncementCategory).filter(AnnouncementCategory.id == ann.category_id).first()
        category_name = category.name if category else "未分類"
        
        # 獲取作者資訊
        author = db.query(User).filter(User.id == ann.author_id).first()
        author_info = None
        if author:
            author_info = {
                "id": author.id,
                "full_name": author.full_name,
                "email": author.email,
                "role": author.role,
                "identity": author.identity
            }
        
        # 構建響應
        announcement_data = {
            "id": ann.id,
            "title": ann.title,
            "content": ann.content,
            "category_id": ann.category_id,
            "category": category_name,
            "author_id": ann.author_id,
            "author": author_info,
            "is_active": ann.is_active,
            "created_at": ann.created_at,
            "updated_at": ann.updated_at
        }
        
        # 如果存在is_pinned欄位，則添加到響應中
        try:
            announcement_data["is_pinned"] = ann.is_pinned
        except:
            announcement_data["is_pinned"] = False
        
        result.append(announcement_data)
    
    return result

@router.get("/categories", response_model=List[dict])
async def get_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    獲取所有公告類別
    """
    categories = db.query(AnnouncementCategory).filter(AnnouncementCategory.is_active == True).all()
    
    result = []
    for cat in categories:
        result.append({
            "id": cat.id,
            "name": cat.name,
            "description": cat.description,
            "is_active": cat.is_active,
            "created_at": cat.created_at,
            "updated_at": cat.updated_at
        })
    
    return result

@router.get("/{announcement_id}", response_model=dict)
async def get_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    取得單一公告詳細資訊
    """
    ann = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="公告不存在")
    
    # 獲取分類名稱
    category = db.query(AnnouncementCategory).filter(AnnouncementCategory.id == ann.category_id).first()
    category_name = category.name if category else "未分類"
    
    # 獲取作者資訊
    author = db.query(User).filter(User.id == ann.author_id).first()
    author_info = None
    if author:
        author_info = {
            "id": author.id,
            "full_name": author.full_name,
            "email": author.email,
            "role": author.role,
            "identity": author.identity
        }
    
    # 構建響應
    result = {
        "id": ann.id,
        "title": ann.title,
        "content": ann.content,
        "category_id": ann.category_id,
        "category": category_name,
        "author_id": ann.author_id,
        "author": author_info,
        "is_active": ann.is_active,
        "is_pinned": ann.is_pinned,
        "created_at": ann.created_at,
        "updated_at": ann.updated_at
    }
    
    return result

@router.post("/", response_model=dict)
async def create_announcement(
    announcement: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    創建新公告
    """
    # 檢查用戶權限（根據角色或身份）
    if current_user.role not in ["admin", "head_nurse", "supervisor"]:
        # 護理師只可以發布特定類型的公告
        category = db.query(AnnouncementCategory).filter(AnnouncementCategory.id == announcement.category_id).first()
        if not category or category.name not in ["交班", "閒聊"]:
            raise HTTPException(status_code=403, detail="您沒有權限發布此類型的公告")
    
    # 檢查類別是否存在
    db_category = db.query(AnnouncementCategory).filter(AnnouncementCategory.id == announcement.category_id).first()
    if not db_category:
        # 嘗試使用名稱匹配
        category_name = announcement.category_id if isinstance(announcement.category_id, str) else None
        if category_name:
            db_category = db.query(AnnouncementCategory).filter(AnnouncementCategory.name == category_name).first()
            if db_category:
                announcement.category_id = db_category.id
        
        if not db_category:
            raise HTTPException(status_code=400, detail="指定的公告類別不存在")
    
    try:
        # 創建新公告
        db_announcement = Announcement(
            title=announcement.title,
            content=announcement.content,
            category_id=announcement.category_id,
            author_id=current_user.id,
            is_pinned=announcement.is_pinned
        )
        
        db.add(db_announcement)
        db.commit()
        db.refresh(db_announcement)
        
        # 獲取完整的公告信息用於返回
        result = await get_announcement(db_announcement.id, db, current_user)
        
        return {
            "success": True,
            "data": result
        }
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"無法創建公告: {str(e)}")
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"數據庫錯誤: {str(e)}")

@router.put("/{announcement_id}", response_model=dict)
async def update_announcement(
    announcement_id: int,
    announcement: AnnouncementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    更新公告内容
    """
    db_announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not db_announcement:
        raise HTTPException(status_code=404, detail="公告不存在")
    
    # 檢查用戶權限（用戶必須是發布者或管理員）
    if db_announcement.author_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="您沒有權限編輯此公告")
    
    try:
        # 更新公告
        update_data = announcement.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_announcement, key, value)
        
        db.commit()
        db.refresh(db_announcement)
        
        # 獲取完整的公告信息用於返回
        result = await get_announcement(announcement_id, db, current_user)
        
        return {
            "success": True,
            "data": result
        }
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"無法更新公告: {str(e)}")
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"數據庫錯誤: {str(e)}")

@router.delete("/{announcement_id}", response_model=dict)
async def delete_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    刪除公告
    """
    db_announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not db_announcement:
        raise HTTPException(status_code=404, detail="公告不存在")
    
    # 檢查用戶權限（用戶必須是發布者或管理員）
    if db_announcement.author_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="您沒有權限刪除此公告")
    
    try:
        # 邏輯刪除公告（設置為非活動狀態）
        db_announcement.is_active = False
        db.commit()
        
        return {
            "success": True,
            "message": "公告已成功刪除"
        }
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"數據庫錯誤: {str(e)}")

@router.post("/{announcement_id}/pin", response_model=dict)
async def pin_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    置頂公告
    """
    # 檢查用戶權限
    if current_user.role not in ["admin", "head_nurse", "supervisor"]:
        raise HTTPException(status_code=403, detail="您沒有權限置頂公告")
    
    db_announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not db_announcement:
        raise HTTPException(status_code=404, detail="公告不存在")
    
    try:
        # 更新置頂狀態
        db_announcement.is_pinned = not db_announcement.is_pinned
        db.commit()
        
        return {
            "success": True,
            "message": f"公告已{'置頂' if db_announcement.is_pinned else '取消置頂'}",
            "is_pinned": db_announcement.is_pinned
        }
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"數據庫錯誤: {str(e)}") 