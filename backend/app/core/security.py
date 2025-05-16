from datetime import datetime, timedelta
from typing import Any, Union, Optional
from jose import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .config import settings
from ..models.user import User
from .database import get_db
import ipaddress

# 密碼上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """驗證密碼"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """生成密碼哈希"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """創建訪問令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def check_ip_restriction(user: User, client_ip: str) -> bool:
    """檢查IP限制（僅用於護理長帳戶）"""
    if user.role != "head_nurse":
        return True  # 非護理長帳戶不受IP限制
    
    # 檢查該護理長是否有其他活動會話
    # 在實際實現中，可能需要檢查數據庫中的會話記錄
    # 這裡簡化處理
    return True  # 暫時返回True，實際應用中需要實現完整邏輯

async def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    """獲取當前用戶"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="無效的身份驗證憑據",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """獲取當前用戶（用於需要登入權限的操作）
    不檢查 is_active 狀態，直接返回已認證的用戶"""
    return current_user

def get_head_nurse_user(current_user: User = Depends(get_current_user)) -> User:
    """獲取護理長用戶（用於需要護理長權限的操作）"""
    if current_user.role != "head_nurse" and current_user.role != "admin" and current_user.username != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="沒有足夠的權限執行此操作"
        )
    return current_user

def get_shift_swap_privileged_user(request: Request, current_user: User = Depends(get_current_user)) -> User:
    """換班特權用戶（允許在換班工作流程中修改排班）
    
    此函數用於換班功能相關的API，允許一般護理師在處理換班時獲得臨時權限來修改資料庫。
    系統會檢查:
    1. 請求路徑是否來自換班相關API（包含"shift-swap"）
    2. 用戶是否已登入
    
    如果上述條件滿足，即使是一般護理師也能獲得修改排班的權限。
    """
    path = request.url.path
    
    # 檢查請求路徑是否包含換班相關字串
    is_from_shift_swap = "shift-swap" in path
    
    # 檢查請求頭或查詢參數是否表明這是來自換班流程的請求
    from_shift_swap_header = request.headers.get("X-From-Shift-Swap", "").lower() == "true"
    from_shift_swap_param = request.query_params.get("from_shift_swap", "").lower() == "true"
    
    # 檢查是否是加班相關請求
    is_overtime_request = "overtime" in path
    
    # 如果用戶已經是護理長或管理員，直接允許
    if current_user.role == "head_nurse" or current_user.role == "admin" or current_user.username == "admin":
        return current_user
    
    # 如果請求來自換班功能，允許一般護理師獲得臨時權限
    if is_from_shift_swap or from_shift_swap_header or from_shift_swap_param:
        return current_user
    
    # 如果是加班請求且包含特定參數或來源，也允許
    if is_overtime_request and (request.query_params.get("shift_swap_flow") == "true" or 
                              request.headers.get("X-Shift-Swap-Flow") == "true"):
        return current_user
    
    # 其他情況，需要護理長或管理員權限
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="沒有足夠的權限執行此操作"
    ) 