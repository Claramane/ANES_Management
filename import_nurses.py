import json
import os
import sys
from pathlib import Path
from sqlalchemy.orm import Session

# 將項目根目錄添加到Python路徑
# 假設此腳本位於項目根目錄
project_root = Path(__file__).resolve().parent
backend_path = project_root / 'backend'
sys.path.insert(0, str(backend_path))

print(f"項目根目錄: {project_root}")
print(f"Backend 路徑: {backend_path}")
print(f"Backend 路徑存在: {backend_path.exists()}")

from app.core.database import SessionLocal, Base, engine, create_tables
from app.models.user import User  # 從models導入User
from app.core.security import get_password_hash

def import_nurses_from_data(db: Session, users_data: list):
    """
    從提供的用戶數據列表導入護理師數據到數據庫。
    """
    # 確保表格已創建
    print("確保資料庫表格已創建...")
    create_tables()
    
    imported_count = 0
    skipped_count = 0

    print(f"開始導入 {len(users_data)} 筆用戶數據...")

    for user_data in users_data:
        # 檢查必要欄位 (不包含 formula_group)
        required_fields = ['username', 'email', 'full_name', 'password', 'role', 'identity']
        if not all(field in user_data for field in required_fields):
            print(f"警告：用戶數據 {user_data.get('username', 'N/A')} 缺少必要欄位，已跳過。字段: {required_fields}")
            skipped_count += 1
            continue

        # 處理可能出現的註釋問題
        # 移除 is_active 字段的註釋
        if "#" in str(user_data):
            print(f"警告：用戶數據 {user_data.get('username', 'N/A')} 包含註釋，這可能導致JSON解析錯誤")

        # 檢查用戶是否已存在
        existing_user = db.query(User).filter(User.username == user_data['username']).first()
        if existing_user:
            print(f"用戶 {user_data['username']} 已存在，跳過導入。")
            skipped_count += 1
            continue

        # 創建新用戶
        try:
            hashed_password = get_password_hash(user_data['password'])
            new_user = User(
                username=user_data['username'],
                email=user_data['email'],
                full_name=user_data['full_name'],
                hashed_password=hashed_password,
                role=user_data['role'],
                identity=user_data['identity'],
                is_active=True,  # 設置為 True，而不是從輸入數據中獲取
                # 注意：將 formula_group 存儲在 last_login_ip 字段中作為臨時解決方案
                # 因為我們沒有 formula_group 字段，但需要這個信息
                last_login_ip=str(user_data.get('formula_group', 0)),
            )
            db.add(new_user)
            imported_count += 1
            print(f"已添加用戶 {user_data['username']}: {user_data['full_name']}, 身份={user_data['identity']}")
        except Exception as e:
            print(f"導入用戶 {user_data['username']} 時發生錯誤: {e}")
            skipped_count += 1
            db.rollback() # 回滾此用戶的添加操作

    try:
        db.commit()
        print(f"導入完成！成功導入 {imported_count} 筆，跳過 {skipped_count} 筆。")
    except Exception as e:
        print(f"提交數據庫時發生錯誤: {e}")
        db.rollback()

if __name__ == "__main__":
    # 完整的護理師數據
    provided_data = {
      "users": [
        {
          "username": "101",
          "email": "zisuk.wang@hospital.com",
          "full_name": "王子夙",
          "password": "password123",
          "role": "boss",
          "identity": "護理長",
          "formula_group": 0
        },
        {
          "username": "102",
          "email": "peihui.chuang@hospital.com",
          "full_name": "莊佩慧",
          "password": "password123",
          "role": "leader",
          "identity": "麻醉科Leader",
          "formula_group": 1
        },
        {
          "username": "103",
          "email": "chingling.huang@hospital.com",
          "full_name": "黃靜玲",
          "password": "password123",
          "role": "leader",
          "identity": "麻醉科Leader",
          "formula_group": 2
        },
        {
          "username": "104",
          "email": "shiouling.hong@hospital.com",
          "full_name": "洪秀玲",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "105",
          "email": "shiouchin.tsai@hospital.com",
          "full_name": "蔡秀金",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 2
        },
        {
          "username": "106",
          "email": "tzupei.chang@hospital.com",
          "full_name": "張慈珮",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 3
        },
        {
          "username": "107",
          "email": "shuhui.hsu@hospital.com",
          "full_name": "許舒惠",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 4
        },
        {
          "username": "108",
          "email": "yinghui.he@hospital.com",
          "full_name": "何瑩慧",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 5
        },
        {
          "username": "109",
          "email": "shueimei.lin@hospital.com",
          "full_name": "林雪美",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "110",
          "email": "peiling.hsieh@hospital.com",
          "full_name": "謝珮陵",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "111",
          "email": "chiping.chen@hospital.com",
          "full_name": "陳稚平",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "112",
          "email": "siangchun.lee@hospital.com",
          "full_name": "李相君",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "113",
          "email": "hsinru.ku@hospital.com",
          "full_name": "顧心如",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "114",
          "email": "chaopu.yeh@hospital.com",
          "full_name": "葉朝菩",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "115",
          "email": "yuching.shi@hospital.com",
          "full_name": "石育菁",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "116",
          "email": "tzuhui.wang@hospital.com",
          "full_name": "王姿惠",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "117",
          "email": "wenyi.jen@hospital.com",
          "full_name": "任雯怡",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "118",
          "email": "youchen.lee@hospital.com",
          "full_name": "李宥蓁",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "119",
          "email": "fanya.wei@hospital.com",
          "full_name": "魏凡雅",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "120",
          "email": "yingsheng.chou@hospital.com",
          "full_name": "周穎昇",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "121",
          "email": "jenchie.chao@hospital.com",
          "full_name": "趙仁傑",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "122",
          "email": "yingying.shih@hospital.com",
          "full_name": "施瑩瑩",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "123",
          "email": "yiwen.yeh@hospital.com",
          "full_name": "葉怡彣",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "124",
          "email": "huiling.chiu@hospital.com",
          "full_name": "邱卉羚",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "125",
          "email": "yawen.lo@hospital.com",
          "full_name": "羅雅文",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "126",
          "email": "shihpu.wang@hospital.com",
          "full_name": "王釋璞",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "127",
          "email": "chachen.yu@hospital.com",
          "full_name": "游佳蓁",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "128",
          "email": "yujung.chang@hospital.com",
          "full_name": "張育蓉",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "129",
          "email": "peiya.tai@hospital.com",
          "full_name": "戴培雅",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "130",
          "email": "chiahsin.lee@hospital.com",
          "full_name": "李佳欣",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "131",
          "email": "hsinmei.wang@hospital.com",
          "full_name": "王欣媚",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "132",
          "email": "chihsin.yu@hospital.com",
          "full_name": "游芷欣",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "133",
          "email": "chen.lin@hospital.com",
          "full_name": "林蓁",
          "password": "password123",
          "role": "nurse",
          "identity": "麻醉專科護理師",
          "formula_group": 0
        },
        {
          "username": "134",
          "email": "yuching.hung@hospital.com",
          "full_name": "洪玉晶",
          "password": "password123",
          "role": "nurse",
          "identity": "恢復室護理師",
          "formula_group": 0
        },
        {
          "username": "135",
          "email": "chenchun.liu@hospital.com",
          "full_name": "劉宸君",
          "password": "password123",
          "role": "nurse",
          "identity": "恢復室護理師",
          "formula_group": 0
        },
        {
          "username": "136",
          "email": "huiting.tsai@hospital.com",
          "full_name": "蔡惠婷",
          "password": "password123",
          "role": "nurse",
          "identity": "恢復室護理師",
          "formula_group": 0
        },
        {
          "username": "137",
          "email": "yuchun.chen@hospital.com",
          "full_name": "陳聿均",
          "password": "password123",
          "role": "nurse",
          "identity": "恢復室護理師",
          "formula_group": 0
        },
        {
          "username": "138",
          "email": "mengting.lee@hospital.com",
          "full_name": "李孟亭",
          "password": "password123",
          "role": "nurse",
          "identity": "恢復室護理師",
          "formula_group": 0
        },
        {
          "username": "139",
          "email": "chingyi.pan@hospital.com",
          "full_name": "潘靜怡",
          "password": "password123",
          "role": "nurse",
          "identity": "恢復室護理師",
          "formula_group": 0
        },
        {
          "username": "140",
          "email": "yingpei.chen@hospital.com",
          "full_name": "陳盈蓓",
          "password": "password123",
          "role": "nurse",
          "identity": "恢復室護理師",
          "formula_group": 0
        },
        {
          "username": "141",
          "email": "shuhui.kuo@hospital.com",
          "full_name": "郭淑慧",
          "password": "password123",
          "role": "secretary",
          "identity": "麻醉科書記",
          "formula_group": 1
        }
      ]
    }

    # 測試連接資料庫
    print("測試資料庫連接...")
    try:
        db = SessionLocal()
        print("成功連接資料庫")

        # 檢查資料庫是否包含user表
        try:
            print("檢查資料庫表格...")
            User.__table__.create(engine, checkfirst=True)
            user_count = db.query(User).count()
            print(f"用戶表中有 {user_count} 條記錄")
        except Exception as e:
            print(f"檢查表格時出錯: {e}")

        # 導入所有護理師資料
        all_users = provided_data.get('users', [])
        print(f"將嘗試導入 {len(all_users)} 位護理師...")
        import_nurses_from_data(db, all_users)
    except Exception as e:
        print(f"連接資料庫時出錯: {e}")
    finally:
        db.close()
        print("數據庫連接已關閉。") 