from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import logging
import uvicorn
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy import text
from contextlib import asynccontextmanager
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings
from app.core.database import engine, Base, create_tables
from app.routes import routers
from app.tasks.doctor_schedule_tasks import doctor_schedule_task_manager
from app.services.doctor_schedule_service import DoctorScheduleService
from app.core.database import get_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 創建排程器
scheduler = AsyncIOScheduler()

async def auto_update_doctor_status():
    """在關鍵時刻（上下班時間點）更新醫師active狀態的任務"""
    try:
        db = next(get_db())
        DoctorScheduleService.update_doctors_active_status_by_time(db)
        # 移除print以減少日誌噪音，只在實際更新時會有日誌輸出
    except Exception as e:
        print(f"❌ 自動更新醫師狀態失敗: {str(e)}")
    finally:
        if 'db' in locals():
            db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 啟動時執行
    print("🚀 正在啟動醫師班表管理系統...")
    
    # 初始化資料庫表
    create_tables()
    print("✅ 資料庫表已初始化")
    
    # 啟動定時任務
    scheduler.add_job(
        auto_update_doctor_status,
        trigger=IntervalTrigger(minutes=1),  # 改為每分鐘檢查一次，以精確捕捉上下班時間點
        id='update_doctor_status',
        replace_existing=True
    )
    scheduler.start()
    print("✅ 定時任務已啟動（每分鐘檢查上下班時間點）")
    
    yield
    
    # 關閉時執行
    print("🛑 正在關閉醫師班表管理系統...")
    scheduler.shutdown()
    print("✅ 定時任務已停止")

app = FastAPI(
    title=settings.APP_NAME,
    description="護理班表管理系統API",
    version="1.0.0",
    redirect_slashes=False,  # 禁用自動斜槓重定向
    lifespan=lifespan
)

# 添加 HTTPS 重定向中間件（僅在生產環境中啟用）
# 註解掉因為 Zeabur 平台已經處理 HTTPS 終止，會導致重定向循環
# if settings.IS_PRODUCTION:
#     app.add_middleware(HTTPSRedirectMiddleware)

# 添加可信主機中間件
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["*"] if not settings.IS_PRODUCTION else [
        "anesmanagementbackend.zeabur.app",
        "eckanesmanagement.zeabur.app"
    ]
)

# 加入 SessionMiddleware
app.add_middleware(
    SessionMiddleware, 
    secret_key=settings.SECRET_KEY,
    session_cookie="session",
    max_age=3600,  # 1小時過期
    same_site="none",  # 跨域環境使用 none
    https_only=False  # 在 Zeabur 環境中設為 False，因為代理已處理 HTTPS
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 註冊所有路由
for router in routers:
    app.include_router(router, prefix="/api")

@app.on_event("startup")
async def startup_event():
    try:
        # 測試資料庫連接
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            db_name = engine.url.database
            logger.info(f"資料庫連接成功，資料庫名稱：{db_name}")
        # 列出所有 ORM 定義的表名
        table_names = list(Base.metadata.tables.keys())
        logger.info(f"預期建立的資料表：{table_names}")
        # 創建資料庫表
        Base.metadata.create_all(bind=engine)
        logger.info("資料表建立流程完成（如表已存在則不會重複建立）")
        
        # 啟動醫師班表定時任務
        try:
            doctor_schedule_task_manager.start_scheduler()
            logger.info("醫師班表定時任務啟動成功")
        except Exception as e:
            logger.error(f"啟動醫師班表定時任務失敗: {str(e)}")
            
    except Exception as e:
        logger.error(f"資料庫連接失敗: {str(e)}")
        raise Exception("無法連接到資料庫，請檢查資料庫配置和連接狀態")

@app.on_event("shutdown")
async def shutdown_event():
    try:
        # 停止醫師班表定時任務
        doctor_schedule_task_manager.stop_scheduler()
        logger.info("醫師班表定時任務已停止")
    except Exception as e:
        logger.error(f"停止定時任務時發生錯誤: {str(e)}")

@app.get("/")
async def root():
    return {"message": "歡迎使用護理班表管理系統API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "系統運行正常"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 