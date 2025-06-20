import os
import sys
from datetime import datetime
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.security import get_password_hash
from app.models.user import User
from app.models.announcement import AnnouncementCategory, AnnouncementPermission
from app.models.shift_swap import ShiftRule
from migrations.initial_data import init_announcement_categories

# 設置logger
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 生產資料庫連接字串
PRODUCTION_DATABASE_URL = "postgresql://root:SGPdg26Npyc35KtzHoW1x4U0YC7TkL98@hnd1.clusters.zeabur.com:32221/zeabur"

def init_production_db():
    """初始化生產資料庫，確保必要的用戶和數據存在"""
    try:
        # 創建資料庫引擎和會話
        engine = create_engine(PRODUCTION_DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        logger.info("連接到生產資料庫成功")
        
        # 檢查是否已存在訪客用戶
        guest_user = db.query(User).filter(User.username == "guest").first()
        if not guest_user:
            # 獲取當前最大的用戶ID
            max_user = db.query(User).order_by(User.id.desc()).first()
            next_id = (max_user.id + 1) if max_user else 1
            
            guest_user = User(
                id=next_id,
                username="guest",
                email="guest@example.com",
                full_name="訪客用戶",
                hashed_password=get_password_hash("guest123"),
                role="guest",
                identity="訪客",
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.add(guest_user)
            db.commit()
            logger.info(f"成功創建訪客用戶，ID: {next_id}")
        else:
            logger.info(f"訪客用戶已存在，ID: {guest_user.id}")
        
        # 檢查管理員用戶
        admin_user = db.query(User).filter(User.username == "admin").first()
        if admin_user:
            logger.info(f"管理員用戶存在，ID: {admin_user.id}")
        else:
            logger.warning("管理員用戶不存在")
        
        # 顯示所有用戶
        all_users = db.query(User).all()
        logger.info("當前資料庫用戶列表:")
        for user in all_users:
            logger.info(f"  ID: {user.id}, 用戶名: {user.username}, 角色: {user.role}, 身份: {user.identity}")
        
        db.close()
        logger.info("生產資料庫初始化完成!")
        
    except Exception as e:
        logger.error(f"初始化生產資料庫時發生錯誤: {e}")
        if 'db' in locals():
            db.rollback()
            db.close()
        raise e

if __name__ == "__main__":
    logger.info("開始初始化生產資料庫...")
    init_production_db() 