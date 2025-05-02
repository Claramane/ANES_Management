from fastapi import APIRouter, Depends, HTTPException, status, Request, Form
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Any
from datetime import timedelta
import logging

from ..core.database import get_db
from ..core.security import (
    verify_password, 
    get_password_hash, 
    create_access_token, 
    get_current_active_user,
    get_head_nurse_user
)
from ..core.config import settings
from ..models.user import User
from ..models.log import Log
from ..schemas.user import UserCreate, UserUpdate, User as UserSchema, Token, PasswordChange

# 設置logger
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/login", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
    request: Request = None
):
    try:
        # 獲取用戶
        user = db.query(User).filter(User.username == form_data.username).first()
        if not user or not verify_password(form_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="帳號或密碼不正確",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 獲取客戶端 IP
        client_ip = request.client.host if request else None
        
        # 創建訪問令牌
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        
        # 暫時跳過日誌記錄
        # log = Log(
        #     user_id=user.id,
        #     operation_type="login",
        #     action="login",
        #     ip_address=client_ip,
        #     description=f"用戶 {user.username} 登入成功"
        # )
        # db.add(log)
        # db.commit()
        
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        logger.error(f"登錄時發生錯誤: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"登錄發生錯誤: {str(e)}"
        )

@router.post("/users", response_model=UserSchema)
async def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """創建新用戶（僅護理長可操作）"""
    # 檢查用戶名是否已存在
    db_user = db.query(User).filter(User.username == user_in.username).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="用戶名已被使用"
        )
    
    # 創建新用戶
    hashed_password = get_password_hash(user_in.password)
    db_user = User(
        username=user_in.username,
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=hashed_password,
        role=user_in.role,
        identity=user_in.identity
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # 添加操作日誌
    log = Log(
        user_id=current_user.id,
        operation_type="create_user",
        action="create_user",
        description=f"創建用戶: {user_in.username}"
    )
    db.add(log)
    db.commit()
    
    return db_user

@router.get("/users/me", response_model=UserSchema)
async def read_current_user(current_user: User = Depends(get_current_active_user)):
    """獲取當前登入用戶資料"""
    return current_user

@router.get("/users", response_model=List[UserSchema])
async def read_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """獲取所有用戶列表（僅護理長可查看）"""
    users = db.query(User).offset(skip).limit(limit).all()
    return users

@router.put("/users/{user_id}", response_model=UserSchema)
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """更新用戶資料（僅護理長可操作）"""
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(
            status_code=404,
            detail="用戶不存在"
        )
    
    # 更新用戶資料
    update_data = user_in.dict(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    
    for field, value in update_data.items():
        setattr(db_user, field, value)
    
    db.commit()
    db.refresh(db_user)
    
    # 添加操作日誌
    log = Log(
        user_id=current_user.id,
        operation_type="update_user",
        action="update_user",
        description=f"更新用戶: {db_user.username} (ID: {user_id})"
    )
    db.add(log)
    db.commit()
    
    return db_user

@router.delete("/users/{user_id}", response_model=UserSchema)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """刪除用戶（僅護理長可操作）"""
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(
            status_code=404,
            detail="用戶不存在"
        )
    
    # 防止刪除自己
    if db_user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="不能刪除自己的帳號"
        )
    
    # 添加操作日誌
    log = Log(
        user_id=current_user.id,
        operation_type="delete_user",
        action="delete_user",
        description=f"刪除用戶: {db_user.username} (ID: {user_id})"
    )
    db.add(log)
    
    # 刪除用戶
    db.delete(db_user)
    db.commit()
    
    return db_user

@router.post("/users/change-password", response_model=dict)
async def change_password(
    password_data: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """用戶修改自己的密碼"""
    # 驗證當前密碼
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="當前密碼不正確"
        )
    
    # 更新密碼
    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()
    
    # 添加操作日誌
    log = Log(
        user_id=current_user.id,
        operation_type="change_password",
        action="change_password",
        description=f"用戶 {current_user.username} 修改了密碼"
    )
    db.add(log)
    db.commit()
    
    return {"message": "密碼修改成功"}

@router.put("/users/me", response_model=UserSchema)
async def update_current_user(
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """更新當前用戶的個人資料（自己的郵箱、姓名等）"""
    # 提取可以由用戶自己更新的字段
    update_data = user_in.dict(exclude_unset=True)
    
    # 限制用戶只能更新某些字段（防止更改角色等重要資訊）
    allowed_fields = {"email", "full_name"}
    update_data = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    # 更新用戶資料
    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    db.commit()
    db.refresh(current_user)
    
    # 添加操作日誌
    log = Log(
        user_id=current_user.id,
        operation_type="update_profile",
        description=f"用戶 {current_user.username} 更新了個人資料"
    )
    db.add(log)
    db.commit()
    
    return current_user

@router.post("/test-login")
async def test_login(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    """簡化的登錄測試端點，不創建日誌記錄"""
    try:
        # 查詢用戶
        user = db.query(User).filter(User.username == username).first()
        
        # 使用日誌輸出診斷信息
        logger.info(f"測試登錄: 用戶名 {username}")
        logger.info(f"找到用戶: {user is not None}")
        
        if user:
            logger.info(f"用戶ID: {user.id}, 姓名: {user.full_name}, 角色: {user.role}")
            logger.debug(f"密碼哈希: {user.hashed_password[:10]}...")
            
            # 測試密碼驗證
            is_valid = verify_password(password, user.hashed_password)
            logger.info(f"密碼驗證結果: {is_valid}")
            
            if is_valid:
                return {"status": "success", "message": "登錄成功", "user_id": user.id, "role": user.role}
            else:
                return {"status": "error", "message": "密碼不正確"}
        else:
            return {"status": "error", "message": "用戶不存在"}
            
    except Exception as e:
        logger.error(f"測試登錄發生錯誤: {str(e)}")
        return {"status": "error", "message": f"發生錯誤: {str(e)}"}

@router.post("/admin/fix-passwords")
async def fix_all_passwords(
    master_password: str = Form(...),
    db: Session = Depends(get_db)
):
    """修復所有用戶密碼哈希 - 僅管理目的使用"""
    # 簡單的身份驗證檢查 - 在實際應用中應該更加嚴格
    if master_password != "admin123456":
        return {"status": "error", "message": "權限不足"}
    
    try:
        # 獲取所有用戶
        users = db.query(User).all()
        updated_count = 0
        
        for user in users:
            # 為所有用戶重新生成哈希密碼
            new_hashed_password = get_password_hash("changeme")
            user.hashed_password = new_hashed_password
            updated_count += 1
        
        # 提交更改
        db.commit()
        
        return {
            "status": "success", 
            "message": f"已為 {updated_count} 位用戶重設密碼哈希。所有用戶的密碼現在都是「changeme」"
        }
    
    except Exception as e:
        logger.error(f"修復密碼時發生錯誤: {str(e)}")
        return {"status": "error", "message": f"發生錯誤: {str(e)}"} 