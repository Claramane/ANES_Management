import os
import sys
from pathlib import Path

# 設定時區環境變數（在導入其他模組之前）
os.environ['TZ'] = 'Asia/Taipei'

# 嘗試在Unix系統上設定時區
try:
    import time
    time.tzset()
except (ImportError, AttributeError):
    # Windows系統或其他不支援tzset的系統
    pass

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import logging
import uvicorn
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy import text
from contextlib import asynccontextmanager
import asyncio

from app.core.config import settings
from app.core.database import engine, Base, create_tables, get_db
from app.routes import routers
from app.tasks.doctor_schedule_tasks import doctor_schedule_task_manager
from app.routers.doctor_schedule import router as doctor_schedule_router
from app.models import doctor_schedule
from app.services.doctor_schedule_service import DoctorScheduleService
from app.core.scheduler import scheduler

# 添加專案根目錄到 Python 路徑
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

# 記錄時區設定
logger.info(f"應用啟動時設定時區: {os.environ.get('TZ', '未設定')}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 啟動時執行
    print("🚀 正在啟動醫師班表管理系統...")
    
    # 記錄當前時區和時間
    from datetime import datetime
    current_time = datetime.now()
    logger.info(f"系統當前時間: {current_time}")
    logger.info(f"時區環境變數: {os.environ.get('TZ', '未設定')}")
    
    # 初始化資料庫表
    create_tables()
    print("✅ 資料庫表已初始化")
    
    # 測試資料庫連接和創建表
    try:
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
        
    except Exception as e:
        logger.error(f"資料庫連接失敗: {str(e)}")
        raise Exception("無法連接到資料庫，請檢查資料庫配置和連接狀態")
    
    # 啟動醫師班表定時任務管理器（包含自動下班檢測）
    try:
        doctor_schedule_task_manager.start_scheduler()
        logger.info("醫師班表定時任務啟動成功（包含自動下班檢測）")
        
        # 啟動時執行一次自動狀態更新
        db = next(get_db())
        try:
            DoctorScheduleService.update_doctors_active_status_by_time(db)
            logger.info("啟動時執行自動狀態更新完成")
        except Exception as e:
            logger.error(f"啟動時自動狀態更新失敗: {str(e)}")
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"啟動醫師班表定時任務失敗: {str(e)}")
    
    yield
    
    # 關閉時執行
    print("🛑 正在關閉醫師班表管理系統...")
    
    # 停止醫師班表定時任務
    try:
        doctor_schedule_task_manager.stop_scheduler()
        logger.info("醫師班表定時任務已停止")
    except Exception as e:
        logger.error(f"停止定時任務時發生錯誤: {str(e)}")
    
    print("✅ 系統已安全關閉")

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
    same_site="none" if settings.IS_PRODUCTION else "lax",  # 生產環境使用none，開發環境使用lax
    https_only=settings.HTTPS_ONLY  # 生產環境應該為True
)

# 配置CORS
cors_origins = ["http://localhost:3000", "http://127.0.0.1:3000"] if not settings.IS_PRODUCTION else settings.BACKEND_CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,  # 根據環境動態設置
    allow_credentials=True,  # 確保允許攜帶credentials
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=[
        "Authorization", 
        "Content-Type", 
        "Accept",
        "Origin",
        "X-Requested-With",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
        "Cookie"  # 添加Cookie header
    ],
    # 重要：設置 preflight 緩存時間為 24 小時
    max_age=86400,  # 24小時內瀏覽器不會重複發送 preflight 請求
    expose_headers=["Set-Cookie"]  # 確保Set-Cookie header被暴露
)

# 註冊所有路由
for router in routers:
    app.include_router(router, prefix="/api")

# 添加調試中間件（僅在生產環境用於調試）
@app.middleware("http")
async def debug_requests(request, call_next):
    # 只記錄問題路徑的請求
    if "/doctor-schedules/doctor/" in str(request.url) and "/set-status" in str(request.url):
        logger.info(f"收到請求: {request.method} {request.url}")
        logger.info(f"請求頭: {dict(request.headers)}")
        
        # 記錄可用路由（只在第一次記錄）
        if not hasattr(debug_requests, '_routes_logged'):
            debug_requests._routes_logged = True
            available_routes = []
            for route in app.routes:
                if hasattr(route, 'path'):
                    available_routes.append(f"{route.methods if hasattr(route, 'methods') else 'N/A'} {route.path}")
            logger.info(f"可用路由: {available_routes[:20]}")  # 只記錄前20個避免日誌過多
    
    response = await call_next(request)
    return response

@app.get("/")
async def root():
    return {"message": "歡迎使用護理班表管理系統API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "系統運行正常"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 