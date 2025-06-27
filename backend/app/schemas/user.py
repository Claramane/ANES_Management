from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime, date
from ..utils.timezone import utc_to_taiwan

# 基本用戶模式
class UserBase(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[str] = None  # head_nurse, nurse, leader, secretary
    identity: Optional[str] = None  # Optional: 護理師身份（一般護理師、資深護理師等）
    group_data: Optional[str] = None  # 儲存使用者分組資料，JSON字符串格式
    hire_date: Optional[date] = None  # 入職日期
    is_active: Optional[bool] = True  # 是否啟用
    deactivated_at: Optional[datetime] = None  # 停權時間

# 用於創建用戶
class UserCreate(UserBase):
    password: str

# 用於更新用戶
class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    identity: Optional[str] = None
    group_data: Optional[str] = None
    hire_date: Optional[date] = None
    is_active: Optional[bool] = None
    deactivated_at: Optional[datetime] = None

# 用戶登入
class UserLogin(BaseModel):
    username: str
    password: str

# 用戶資料響應
class UserInDB(UserBase):
    id: int
    hashed_password: str
    last_login_ip: Optional[str] = None
    last_login_time: Optional[datetime] = None
    last_activity_time: Optional[datetime] = None  # 新增：最後活動時間
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class User(UserBase):
    id: int
    last_login_ip: Optional[str] = None
    last_login_time: Optional[datetime] = None
    last_activity_time: Optional[datetime] = None  # 新增：最後活動時間
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
    
    # 自動轉換UTC時間為台灣時間
    @validator('last_login_time', 'last_activity_time', 'created_at', 'updated_at', 'deactivated_at', pre=False, always=True)
    def convert_utc_to_taiwan(cls, v):
        if v is None:
            return v
        return utc_to_taiwan(v)

# 令牌數據
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional[User] = None

# 令牌數據內容
class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

# 密碼變更模式
class PasswordChange(BaseModel):
    current_password: str
    new_password: str 
    
    @validator('new_password')
    def validate_password_length(cls, v):
        if len(v) < 6:
            raise ValueError("密碼必須至少6個字元")
        return v 