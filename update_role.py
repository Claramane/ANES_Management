import sys
from pathlib import Path

# 將backend目錄添加到Python路徑
project_root = Path(__file__).resolve().parent
backend_path = project_root / 'backend'
sys.path.insert(0, str(backend_path))

from app.core.database import SessionLocal
from app.models.user import User

db = SessionLocal()
try:
    # 查找用戶名為101的用戶
    user = db.query(User).filter(User.username == "101").first()
    if user:
        print(f"找到用戶: {user.username}, {user.full_name}, 目前角色: {user.role}")
        # 修改角色
        user.role = "head_nurse"
        db.commit()
        print(f"已將用戶 {user.username} 的角色從 boss 修改為 head_nurse")
    else:
        print("找不到用戶名為101的用戶")
finally:
    db.close() 