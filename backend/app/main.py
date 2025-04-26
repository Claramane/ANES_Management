from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import logging
from typing import List

from .core.config import settings
from .core.database import engine, Base
from .core.security import get_current_active_user
from .routes import users, formula_schedules, schedules
from .routes import announcements  # 導入公告路由
from .routes import overtime  # 導入加班記錄路由

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    description="護理班表管理系統API",
    version="1.0.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 包含各模塊的路由
app.include_router(users.router, prefix="/api", tags=["用戶管理"])
app.include_router(formula_schedules.router, prefix="/api", tags=["公式班表"])
app.include_router(schedules.router, prefix="/api", tags=["班表管理"])
app.include_router(announcements.router, prefix="/api", tags=["公告管理"])
app.include_router(overtime.router, prefix="/api", tags=["加班管理"])

@app.on_event("startup")
async def startup_event():
    Base.metadata.create_all(bind=engine)
    logger.info("應用啟動，數據庫表已創建")

@app.get("/")
async def root():
    return {"message": "歡迎使用護理班表管理系統API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True) 