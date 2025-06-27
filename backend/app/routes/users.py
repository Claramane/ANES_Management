from fastapi import APIRouter, Depends, HTTPException, status, Request, Form
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Any
from datetime import timedelta
import logging
from sqlalchemy.sql import func

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
        # 查詢用戶
        user = db.query(User).filter(User.username == form_data.username).first()
        
        # 檢查用戶是否存在
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用戶名或密碼不正確",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 檢查用戶是否已停權
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="帳號已被停權，請聯繫管理員",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 驗證密碼
        if not verify_password(form_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用戶名或密碼不正確",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 創建訪問令牌
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username, "role": user.role}, expires_delta=access_token_expires
        )
        
        # 更新最後登入資訊
        user.last_login_time = func.now()
        user.last_activity_time = func.now()
        if request:
            user.last_login_ip = request.client.host
        
        # 確保用戶更新被追蹤
        db.add(user)
        
        # 添加登入日誌
        log = Log(
            user_id=user.id,
            operation_type="login",
            action="login",
            ip_address=request.client.host if request else None,
            description=f"用戶 {user.username} 登入系統"
        )
        db.add(log)
        db.commit()
        
        return {"access_token": access_token, "token_type": "bearer", "user": user}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"登入過程中發生錯誤: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="登入失敗，請稍後再試"
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
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """獲取所有用戶列表（所有登錄用戶可查看）"""
    query = db.query(User)
    
    # 預設只顯示啟用用戶，除非明確要求包含停權用戶
    if not include_inactive:
        query = query.filter(User.is_active == True)
    
    users = query.offset(skip).limit(limit).all()
    return users

@router.post("/heartbeat")
async def heartbeat(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """心跳端點 - 更新用戶活動時間"""
    try:
        # 更新當前用戶的活動時間
        current_user.last_activity_time = func.now()
        db.add(current_user)
        db.commit()
        
        return {"status": "success", "message": "心跳更新成功"}
        
    except Exception as e:
        logger.error(f"更新心跳時發生錯誤: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="心跳更新失敗"
        )

@router.get("/online-users", response_model=List[UserSchema])
async def get_online_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """獲取在線用戶列表（最近3分鐘內有活動的用戶）"""
    from datetime import datetime, timedelta
    from sqlalchemy import or_, func
    
    try:
        # 使用資料庫的當前時間來計算3分鐘前的時間，避免時區問題
        three_minutes_ago = func.now() - timedelta(minutes=3)
        
        # 查詢最近3分鐘內有活動的用戶（登錄或心跳）
        online_users = db.query(User).filter(
            User.is_active == True,
            or_(
                User.last_activity_time >= three_minutes_ago,
                User.last_login_time >= three_minutes_ago
            )
        ).order_by(
            User.last_activity_time.desc().nulls_last(),
            User.last_login_time.desc().nulls_last()
        ).all()
        
        return online_users
        
    except Exception as e:
        logger.error(f"獲取在線用戶時發生錯誤: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="獲取在線用戶失敗"
        )

@router.get("/debug/online-users-info")
async def debug_online_users_info(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """調適端點：獲取在線用戶詳細資訊"""
    from datetime import datetime, timedelta
    from sqlalchemy import or_, func, text
    
    try:
        # 獲取資料庫當前時間
        db_time_result = db.execute(text("SELECT NOW() as db_time")).fetchone()
        db_time = db_time_result[0]
        
        # 計算3分鐘前的時間
        three_minutes_ago = db_time - timedelta(minutes=3)
        
        # 獲取所有活躍用戶的時間資訊
        users_info = db.execute(text("""
            SELECT id, username, last_activity_time, last_login_time, 
                   CASE 
                       WHEN last_activity_time >= :three_minutes_ago OR last_login_time >= :three_minutes_ago 
                       THEN true 
                       ELSE false 
                   END as is_online
            FROM users 
            WHERE is_active = true 
            ORDER BY COALESCE(last_activity_time, '1900-01-01') DESC, 
                     COALESCE(last_login_time, '1900-01-01') DESC
            LIMIT 10
        """), {"three_minutes_ago": three_minutes_ago}).fetchall()
        
        users_list = []
        for user in users_info:
            users_list.append({
                "id": user[0],
                "username": user[1],
                "last_activity_time": user[2],
                "last_login_time": user[3],
                "is_online": user[4]
            })
        
        return {
            "db_current_time": db_time,
            "three_minutes_ago": three_minutes_ago,
            "total_active_users": len(users_list),
            "online_users_count": sum(1 for u in users_list if u["is_online"]),
            "users": users_list
        }
        
    except Exception as e:
        logger.error(f"獲取調適資訊時發生錯誤: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"獲取調適資訊失敗: {str(e)}"
        )

@router.get("/debug/timezone-test")
async def debug_timezone_test(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """調適端點：測試時區轉換功能"""
    from datetime import datetime, timedelta
    from sqlalchemy import func, text
    from ..utils.timezone import utc_to_taiwan, taiwan_to_utc, format_taiwan_time, get_timezone_info
    
    try:
        # 獲取資料庫當前時間
        db_time_result = db.execute(text("SELECT NOW() as db_time")).fetchone()
        db_utc_time = db_time_result[0]
        
        # 測試時區轉換
        taiwan_time = utc_to_taiwan(db_utc_time)
        back_to_utc = taiwan_to_utc(taiwan_time) if taiwan_time else None
        formatted_taiwan = format_taiwan_time(db_utc_time)
        
        # 獲取時區資訊
        timezone_info = get_timezone_info()
        
        # 測試用戶資料的時間轉換
        test_user = db.query(User).filter(User.id == current_user.id).first()
        
        return {
            "database_utc_time": db_utc_time,
            "converted_taiwan_time": taiwan_time,
            "back_to_utc_time": back_to_utc,
            "formatted_taiwan_time": formatted_taiwan,
            "timezone_info": timezone_info,
            "current_user_times": {
                "last_login_time_raw": test_user.last_login_time,
                "last_activity_time_raw": test_user.last_activity_time,
                "created_at_raw": test_user.created_at,
                "updated_at_raw": test_user.updated_at
            },
            "schema_conversion_note": "User Schema 會自動將這些時間轉換為台灣時間"
        }
        
    except Exception as e:
        logger.error(f"時區測試失敗: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"時區測試失敗: {str(e)}"
        )

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
async def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """停權用戶（僅護理長可操作）"""
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(
            status_code=404,
            detail="用戶不存在"
        )
    
    # 防止停權自己
    if db_user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="不能停權自己的帳號"
        )
    
    # 檢查用戶是否已經停權
    if not db_user.is_active:
        raise HTTPException(
            status_code=400,
            detail="用戶已經處於停權狀態"
        )
    
    try:
        # 設置為停權狀態
        db_user.is_active = False
        db_user.deactivated_at = func.now()
        
        # 添加操作日誌
        log = Log(
            user_id=current_user.id,
            operation_type="deactivate_user",
            action="deactivate_user",
            description=f"停權用戶: {db_user.username} (ID: {user_id})"
        )
        db.add(log)
        
        db.commit()
        db.refresh(db_user)
        
        return db_user
        
    except Exception as e:
        db.rollback()
        logger.error(f"停權用戶時發生錯誤: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"停權用戶失敗: {str(e)}"
        )

@router.post("/users/{user_id}/activate", response_model=UserSchema)
async def activate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """啟用用戶（僅護理長可操作）"""
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(
            status_code=404,
            detail="用戶不存在"
        )
    
    # 檢查用戶是否已經啟用
    if db_user.is_active:
        raise HTTPException(
            status_code=400,
            detail="用戶已經處於啟用狀態"
        )
    
    try:
        # 設置為啟用狀態
        db_user.is_active = True
        db_user.deactivated_at = None
        
        # 添加操作日誌
        log = Log(
            user_id=current_user.id,
            operation_type="activate_user",
            action="activate_user",
            description=f"啟用用戶: {db_user.username} (ID: {user_id})"
        )
        db.add(log)
        
        db.commit()
        db.refresh(db_user)
        
        return db_user
        
    except Exception as e:
        db.rollback()
        logger.error(f"啟用用戶時發生錯誤: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"啟用用戶失敗: {str(e)}"
        )

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