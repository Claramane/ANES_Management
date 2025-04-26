from sqlalchemy.orm import Session
from app.models.announcement import AnnouncementCategory

def init_announcement_categories(db: Session):
    # 檢查是否已有分類數據
    existing_categories = db.query(AnnouncementCategory).all()
    if existing_categories:
        print("公告分類已存在，跳過初始化")
        return
    
    # 創建基本分類
    categories = [
        AnnouncementCategory(name="長官佈達", description="主管級別的重要通知"),
        AnnouncementCategory(name="政令宣導", description="政策法規相關宣導"),
        AnnouncementCategory(name="系統公告", description="系統維護及更新通知"),
        AnnouncementCategory(name="交班", description="班次交接相關訊息"),
        AnnouncementCategory(name="閒聊", description="一般討論與分享")
    ]
    
    # 批量添加到資料庫
    db.add_all(categories)
    db.commit()
    
    print(f"成功初始化 {len(categories)} 個公告分類") 