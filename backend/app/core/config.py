import os
import secrets
from typing import List, Union, Optional
from pydantic import AnyHttpUrl, validator, field_validator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "恩主公麻醉科班表管理系統"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 525600  # 修改為 525600 分鐘 (一年)，實現長期登入狀態
    
    # 應用配置
    DEBUG: bool = False
    
    # 數據庫配置
    DATABASE_URL: str = "postgresql://anes_user:anes_password@localhost/anes_db"
    
    # CORS設置
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost", "http://localhost:3000"]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)
        
    @field_validator("DEBUG", mode="before")
    def parse_debug(cls, v: Union[str, bool]) -> bool:
        if isinstance(v, str):
            return v.lower() in ("true", "1", "t", "yes")
        return bool(v)

    # 管理員設置
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "changeme"

    class Config:
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings() 