from datetime import datetime, timedelta
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User
from app.models.announcement import AnnouncementCategory, AnnouncementPermission
from app.models.shift_swap import ShiftRule
from app.core.database import SessionLocal, create_tables
from migrations.initial_data import init_announcement_categories

def init_db():
    db = SessionLocal()
    try:
        # 創建表格
        create_tables()
        
        # 檢查是否已存在管理員用戶
        user = db.query(User).filter(User.username == settings.ADMIN_USERNAME).first()
        if not user:
            # 創建管理員用戶
            admin_user = User(
                username=settings.ADMIN_USERNAME,
                email="admin@example.com",
                full_name="系統管理員",
                hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
                role="head_nurse",
                identity="護理長",
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.add(admin_user)
            
            # 創建測試用護理師用戶
            test_nurse = User(
                username="nurse",
                email="nurse@example.com",
                full_name="測試護理師",
                hashed_password=get_password_hash("password"),
                role="nurse",
                identity="一般護理師",
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.add(test_nurse)
            
            # 創建默認公告分類
            categories = [
                {"name": "班表相關", "description": "與班表有關的公告"},
                {"name": "人事相關", "description": "與人事有關的公告"},
                {"name": "政令宣導", "description": "政策與法規宣導"},
                {"name": "開刀房規則", "description": "開刀房相關規定"},
                {"name": "閒聊", "description": "日常交流"},
                {"name": "教育訓練", "description": "教育訓練相關公告"}
            ]
            
            for category_data in categories:
                category = AnnouncementCategory(
                    name=category_data["name"],
                    description=category_data["description"],
                    is_active=True,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                db.add(category)
            
            # 提交變更以獲取ID
            db.commit()
            
            # 獲取所有分類
            all_categories = db.query(AnnouncementCategory).all()
            
            # 設置權限
            # 護理長可以在所有分類發布公告
            for category in all_categories:
                permission = AnnouncementPermission(
                    category_id=category.id,
                    identity="護理長",
                    can_create=True,
                    can_edit=True,
                    can_delete=True
                )
                db.add(permission)
            
            # 一般護理師只能在"閒聊"分類發布公告
            chat_category = next((c for c in all_categories if c.name == "閒聊"), None)
            if chat_category:
                permission = AnnouncementPermission(
                    category_id=chat_category.id,
                    identity="一般護理師",
                    can_create=True,
                    can_edit=True,
                    can_delete=False
                )
                db.add(permission)
            
            # 創建默認班別規則
            shift_rules = [
                {
                    "shift_type": "D",
                    "start_time": "08:00",
                    "end_time": "16:00",
                    "min_rest_hours": 12,
                    "max_weekly_shifts": 5,
                    "max_monthly_shifts": 20,
                    "description": "白班"
                },
                {
                    "shift_type": "A",
                    "start_time": "16:00",
                    "end_time": "00:00",
                    "min_rest_hours": 12,
                    "max_weekly_shifts": 5,
                    "max_monthly_shifts": 20,
                    "description": "小夜班"
                },
                {
                    "shift_type": "N",
                    "start_time": "00:00",
                    "end_time": "08:00",
                    "min_rest_hours": 24,
                    "max_weekly_shifts": 4,
                    "max_monthly_shifts": 16,
                    "description": "大夜班"
                },
                {
                    "shift_type": "O",
                    "start_time": "",
                    "end_time": "",
                    "min_rest_hours": 0,
                    "max_weekly_shifts": 7,
                    "max_monthly_shifts": 31,
                    "description": "休假"
                }
            ]
            
            for rule_data in shift_rules:
                rule = ShiftRule(
                    shift_type=rule_data["shift_type"],
                    start_time=rule_data["start_time"],
                    end_time=rule_data["end_time"],
                    min_rest_hours=rule_data["min_rest_hours"],
                    max_weekly_shifts=rule_data["max_weekly_shifts"],
                    max_monthly_shifts=rule_data["max_monthly_shifts"],
                    description=rule_data["description"],
                    is_active=True
                )
                db.add(rule)
                
            db.commit()
            
            # 添加以下代碼，確保在最後調用公告分類初始化
            init_announcement_categories(db)
            
            print("初始化數據庫完成!")
        else:
            print("數據庫已初始化，無需重複操作")
    
    except Exception as e:
        print(f"初始化數據庫時發生錯誤: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("正在初始化數據庫...")
    init_db() 