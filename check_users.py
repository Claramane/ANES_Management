import sys
from pathlib import Path

# 將backend目錄添加到Python路徑
project_root = Path(__file__).resolve().parent
backend_path = project_root / 'backend'
sys.path.insert(0, str(backend_path))

from app.core.database import SessionLocal
from app.models.user import User
from sqlalchemy import inspect

db = SessionLocal()
try:
    # 檢查User模型的結構
    inspector = inspect(User)
    print("User模型的屬性:")
    for attr in inspector.attrs:
        print(f"- {attr.key}")
    
    # 檢查資料庫中現有的使用者
    users = db.query(User).all()
    print(f"\n總計 {len(users)} 個使用者")
    
    if users:
        print("\n使用者類型統計:")
        identity_counts = {}
        role_counts = {}
        for user in users:
            identity_counts[user.identity] = identity_counts.get(user.identity, 0) + 1
            role_counts[user.role] = role_counts.get(user.role, 0) + 1
        
        for identity, count in identity_counts.items():
            print(f"- {identity}: {count}人")
        
        print("\n角色統計:")
        for role, count in role_counts.items():
            print(f"- {role}: {count}人")
        
        print("\n前10個使用者資料:")
        for i, user in enumerate(users[:10]):
            print(f"{i+1}. {user.username}: {user.full_name}, 身份={user.identity}, 角色={user.role}, formula_group={user.last_login_ip}")
    else:
        print("資料庫中沒有使用者資料")
finally:
    db.close() 