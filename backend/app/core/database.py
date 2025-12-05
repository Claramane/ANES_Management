from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# 創建SQLAlchemy引擎
# 確保使用 psycopg 驅動
database_url = settings.DATABASE_URL
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

# 連線到 PgBouncer（交易模式）時，server‑side prepared statements 會在連線被重用時失效，
# 因此關閉 prepared statements 並預先檢測連線健康度。
engine = create_engine(
    database_url,
    connect_args={"prepare_threshold": 0},  # 關閉 server-side prepared statements
    pool_pre_ping=True,
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
