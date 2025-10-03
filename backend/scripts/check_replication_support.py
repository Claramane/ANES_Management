#!/usr/bin/env python3
"""
檢查 PostgreSQL 資料庫是否支援邏輯複製功能

此腳本會檢查：
1. wal_level 是否設定為 'logical'
2. 是否有 REPLICATION 權限
3. 是否可以建立 PUBLICATION
4. PostgreSQL 版本資訊

使用方式：
    python check_replication_support.py
"""

import sys
import os
from pathlib import Path

# 添加 backend 到 Python 路徑
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import asyncio
import asyncpg
from sqlalchemy import create_engine, text
from app.core.config import settings


async def check_async_support(database_url: str):
    """使用 asyncpg 檢查複製支援"""
    print(f"\n🔍 檢查資料庫: {database_url.split('@')[1] if '@' in database_url else 'local'}")
    print("=" * 70)

    try:
        # 轉換 SQLAlchemy URL 為 asyncpg 格式
        if 'postgresql+psycopg' in database_url:
            database_url = database_url.replace('postgresql+psycopg', 'postgresql')

        # 解析 DATABASE_URL
        conn = await asyncpg.connect(database_url)

        # 1. 檢查 PostgreSQL 版本
        version = await conn.fetchval("SELECT version()")
        print(f"\n📌 PostgreSQL 版本:")
        print(f"   {version}")

        # 2. 檢查 wal_level
        wal_level = await conn.fetchval("SHOW wal_level")
        print(f"\n📌 WAL Level: {wal_level}")
        if wal_level == 'logical':
            print("   ✅ 支援邏輯複製")
        else:
            print(f"   ❌ 不支援邏輯複製 (需要 'logical'，當前為 '{wal_level}')")

        # 3. 檢查 max_replication_slots
        max_slots = await conn.fetchval("SHOW max_replication_slots")
        print(f"\n📌 最大複製槽位數: {max_slots}")
        if int(max_slots) > 0:
            print("   ✅ 已配置複製槽位")
        else:
            print("   ❌ 未配置複製槽位")

        # 4. 檢查當前用戶權限
        current_user = await conn.fetchval("SELECT current_user")
        print(f"\n📌 當前用戶: {current_user}")

        # 檢查是否為超級用戶或有 REPLICATION 權限
        is_superuser = await conn.fetchval(
            "SELECT usesuper FROM pg_user WHERE usename = $1", current_user
        )
        is_replication = await conn.fetchval(
            "SELECT userepl FROM pg_user WHERE usename = $1", current_user
        )

        print(f"   超級用戶: {'✅ 是' if is_superuser else '❌ 否'}")
        print(f"   複製權限: {'✅ 是' if is_replication else '❌ 否'}")

        # 5. 測試建立 PUBLICATION (不實際建立)
        print(f"\n📌 測試 PUBLICATION 權限:")
        try:
            # 檢查是否已有測試用 publication
            existing_pubs = await conn.fetch(
                "SELECT pubname FROM pg_publication WHERE pubname = 'test_pub_check'"
            )
            if existing_pubs:
                await conn.execute("DROP PUBLICATION test_pub_check")

            # 嘗試建立測試 publication
            await conn.execute("CREATE PUBLICATION test_pub_check FOR ALL TABLES")
            print("   ✅ 可以建立 PUBLICATION")

            # 清理測試 publication
            await conn.execute("DROP PUBLICATION test_pub_check")
        except Exception as e:
            print(f"   ❌ 無法建立 PUBLICATION: {e}")

        # 6. 檢查現有的 publications
        publications = await conn.fetch("SELECT * FROM pg_publication")
        print(f"\n📌 現有的 Publications: {len(publications)} 個")
        for pub in publications:
            print(f"   - {pub['pubname']}")

        # 7. 檢查現有的 subscriptions
        try:
            subscriptions = await conn.fetch("SELECT * FROM pg_subscription")
            print(f"\n📌 現有的 Subscriptions: {len(subscriptions)} 個")
            for sub in subscriptions:
                print(f"   - {sub['subname']}")
        except Exception as e:
            print(f"\n📌 無法查詢 Subscriptions: {e}")

        await conn.close()

        # 總結
        print("\n" + "=" * 70)
        print("📊 總結:")
        if wal_level == 'logical' and (is_superuser or is_replication):
            print("✅ 此資料庫 **完全支援** PostgreSQL 邏輯複製")
            print("   建議使用邏輯複製方案進行資料同步")
            return True
        else:
            print("❌ 此資料庫 **不支援** PostgreSQL 邏輯複製")
            print("   建議使用 Python 增量同步方案")
            return False

    except Exception as e:
        print(f"❌ 連接失敗: {e}")
        return False


def check_sync_support():
    """使用 SQLAlchemy 檢查基本連接"""
    try:
        engine = create_engine(settings.DATABASE_URL)
        with engine.connect() as conn:
            # 檢查資料庫連接
            result = conn.execute(text("SELECT 1"))
            print("✅ 資料庫連接成功")

            # 檢查 updated_at 欄位（用於增量同步）
            tables_with_updated_at = []
            tables = ['users', 'schedules', 'shift_swap_requests', 'overtime_records',
                     'announcements', 'doctor_schedules']

            print(f"\n📌 檢查表格的 updated_at 欄位（用於增量同步）:")
            for table in tables:
                try:
                    result = conn.execute(text(f"""
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name = '{table}'
                        AND column_name IN ('updated_at', 'created_at')
                    """))
                    columns = [row[0] for row in result]
                    if 'updated_at' in columns:
                        tables_with_updated_at.append(table)
                        print(f"   ✅ {table}: 有 updated_at")
                    elif 'created_at' in columns:
                        print(f"   ⚠️  {table}: 只有 created_at (可用但不理想)")
                    else:
                        print(f"   ❌ {table}: 無時間戳記欄位")
                except Exception as e:
                    print(f"   ❌ {table}: 查詢失敗 ({e})")

            print(f"\n   共 {len(tables_with_updated_at)}/{len(tables)} 個表格支援增量同步")

    except Exception as e:
        print(f"❌ 資料庫連接失敗: {e}")


async def main():
    """主函數"""
    print("\n" + "=" * 70)
    print("🔍 PostgreSQL 邏輯複製支援檢查工具")
    print("=" * 70)

    # 檢查邏輯複製支援
    supports_replication = await check_async_support(settings.DATABASE_URL)

    # 檢查增量同步支援
    print("\n" + "=" * 70)
    check_sync_support()

    # 提供建議
    print("\n" + "=" * 70)
    print("💡 建議方案:")
    print("=" * 70)
    if supports_replication:
        print("""
✅ 推薦方案：PostgreSQL 邏輯複製

優點：
  - 即時同步（毫秒級延遲）
  - 自動處理增量
  - PostgreSQL 原生支援
  - 資源消耗低

下一步：
  1. 執行 setup_replication.sql 設定 PUBLICATION
  2. 在目標資料庫執行 SUBSCRIPTION 設定
  3. 使用 monitor_replication.py 監控同步狀態
        """)
    else:
        print("""
⚠️  備案方案：Python 增量同步

優點：
  - 完全控制同步邏輯
  - 輕量級實作
  - 可整合現有 APScheduler

下一步：
  1. 使用 sync_db_incremental.py 進行增量同步
  2. 配置 sync_config.json 設定同步規則
  3. 整合到現有的排程系統
        """)


if __name__ == "__main__":
    asyncio.run(main())
