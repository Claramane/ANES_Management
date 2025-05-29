from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import uvicorn
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine, Base
from app.routes import routers

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    description="護理班表管理系統API",
    version="1.0.0"
)

# 加入 SessionMiddleware
app.add_middleware(
    SessionMiddleware, 
    secret_key=settings.SECRET_KEY,
    session_cookie="session",
    max_age=3600,  # 1小時過期
    same_site="none",  # 跨域環境使用 none
    https_only=settings.HTTPS_ONLY  # 根據環境變數決定
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
    except Exception as e:
        logger.error(f"資料庫連接失敗: {str(e)}")
        raise Exception("無法連接到資料庫，請檢查資料庫配置和連接狀態")

@app.get("/")
async def root():
    return {"message": "歡迎使用護理班表管理系統API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 