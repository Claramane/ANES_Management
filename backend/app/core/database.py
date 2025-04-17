from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# 創建SQLAlchemy引擎
engine = create_engine(
    settings.DATABASE_URL
)

# 創建SessionLocal類
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 創建Base類，所有模型將繼承此類
Base = declarative_base()

# 獲取數據庫會話
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 創建所有表格
def create_tables():
    Base.metadata.create_all(bind=engine) 