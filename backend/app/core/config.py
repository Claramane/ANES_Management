# 本設定檔所有欄位皆可用環境變數（.env）覆蓋
# 建議務必在.env中設置SECRET_KEY，避免每次啟動隨機產生
# 
# 開發環境範例：
# APP_NAME=恩主公麻醉科班表管理系統
# SECRET_KEY=your-very-secret-key-for-development
# ALGORITHM=HS256
# ACCESS_TOKEN_EXPIRE_MINUTES=480
# DEBUG=true
# DATABASE_URL=postgresql+psycopg://anes_user:anes_password@localhost/anes_db
# FRONTEND_ORIGIN=http://localhost:3000
# WEBAUTHN_RP_ID=localhost
# BACKEND_CORS_ORIGINS=http://localhost:3000
# WEBAUTHN_EXPECTED_ORIGIN=http://localhost:3000
# IS_PRODUCTION=false
# HTTPS_ONLY=false
# ADMIN_USERNAME=admin
# ADMIN_PASSWORD=changeme
#
# 生產環境範例：
# APP_NAME=恩主公麻醉科班表管理系統
# SECRET_KEY=your-super-secure-production-secret-key-minimum-32-chars
# ALGORITHM=HS256
# ACCESS_TOKEN_EXPIRE_MINUTES=480
# DEBUG=false
# DATABASE_URL=postgresql+psycopg://production_user:production_password@production_host/production_db
# FRONTEND_ORIGIN=https://your-frontend-domain.zeabur.app
# WEBAUTHN_RP_ID=your-frontend-domain.zeabur.app
# BACKEND_CORS_ORIGINS=https://your-frontend-domain.zeabur.app
# WEBAUTHN_EXPECTED_ORIGIN=https://your-frontend-domain.zeabur.app
# IS_PRODUCTION=true
# HTTPS_ONLY=true
# ADMIN_USERNAME=admin
# ADMIN_PASSWORD=secure-production-password

import os
import secrets
from typing import List, Union, Optional
from pydantic import AnyHttpUrl, validator, field_validator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "恩主公麻醉科班表管理系統"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 修改為 480 分鐘 (8小時)，提升安全性
    
    # 應用配置
    DEBUG: bool = False
    
    # 數據庫配置
    DATABASE_URL: str = "postgresql+psycopg://anes_user:anes_password@localhost/anes_db"

    # 新增前端與 RP_ID 環境變數
    FRONTEND_ORIGIN: str = "http://localhost:3000"
    WEBAUTHN_RP_ID: str = "localhost"

    # CORS設置
    BACKEND_CORS_ORIGINS: List[str] = []

    WEBAUTHN_EXPECTED_ORIGIN: str = "http://localhost:3000"
    
    # 遠端環境設定
    IS_PRODUCTION: bool = False
    HTTPS_ONLY: bool = False

    # 安全檢查開關
    ENFORCE_WEB_SECURITY_CHECKS: bool = True

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]], info) -> List[str]:
        if not v or v == []:
            # 若未指定則用 FRONTEND_ORIGIN
            frontend = info.data.get("FRONTEND_ORIGIN", "http://localhost:3000")
            return [frontend]
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
        
    @field_validator("IS_PRODUCTION", mode="before")
    def parse_production(cls, v: Union[str, bool]) -> bool:
        if isinstance(v, str):
            return v.lower() in ("true", "1", "t", "yes")
        return bool(v)
        
    @field_validator("HTTPS_ONLY", mode="before") 
    def parse_https_only(cls, v: Union[str, bool]) -> bool:
        if isinstance(v, str):
            return v.lower() in ("true", "1", "t", "yes")
        return bool(v)

    # 管理員設置
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "changeme"
    
    # 外部API設置
    EXTERNAL_API_BASE: str = "https://docdutyapi.zeabur.app"

    class Config:
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings() 
