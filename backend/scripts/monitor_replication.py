#!/usr/bin/env python3
"""
PostgreSQL 邏輯複製監控工具

此腳本用於監控 PostgreSQL 邏輯複製的狀態和健康度。

功能：
1. 檢查複製延遲
2. 監控複製槽位狀態
3. 檢測複製錯誤
4. 生成健康報告
5. 可整合到告警系統

使用方式：
    # 檢查訂閱端狀態
    python monitor_replication.py --mode subscriber

    # 檢查發布端狀態
    python monitor_replication.py --mode publisher

    # 生成詳細報告
    python monitor_replication.py --mode subscriber --detailed

    # 持續監控 (每30秒檢查一次)
    python monitor_replication.py --mode subscriber --watch 30

    # 設定告警閾值 (延遲超過60秒發出警告)
    python monitor_replication.py --mode subscriber --alert-threshold 60
"""

import sys
import os
from pathlib import Path

# 添加 backend 到 Python 路徑
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import asyncio
import asyncpg
import argparse
from datetime import datetime
from typing import Dict, List, Optional
from app.core.config import settings


# ============================================================================
# 監控邏輯
# ============================================================================

class ReplicationMonitor:
    """邏輯複製監控器"""

    def __init__(self, database_url: str):
        self.database_url = database_url

    async def check_subscriber_status(self) -> Dict:
        """檢查訂閱端狀態"""
        conn = await asyncpg.connect(self.database_url)
        try:
            # 1. 基本訂閱資訊
            subscriptions = await conn.fetch("""
                SELECT
                    subname,
                    subenabled,
                    subconninfo,
                    subpublications
                FROM pg_subscription
            """)

            if not subscriptions:
                return {
                    'status': 'no_subscription',
                    'message': '未設定任何訂閱'
                }

            sub = subscriptions[0]
            sub_name = sub['subname']

            # 2. 訂閱統計
            stats = await conn.fetchrow(f"""
                SELECT
                    subname,
                    pid,
                    received_lsn,
                    last_msg_send_time,
                    last_msg_receipt_time,
                    latest_end_lsn,
                    latest_end_time
                FROM pg_stat_subscription
                WHERE subname = $1
            """, sub_name)

            # 3. 計算延遲
            lag_seconds = None
            if stats and stats['latest_end_time']:
                lag_seconds = (datetime.now(stats['latest_end_time'].tzinfo) -
                             stats['latest_end_time']).total_seconds()

            # 4. 檢查複製槽位
            slot_info = await conn.fetchrow("""
                SELECT
                    slot_name,
                    plugin,
                    slot_type,
                    database,
                    active
                FROM pg_replication_slots
                WHERE slot_type = 'logical'
                LIMIT 1
            """)

            return {
                'status': 'active' if sub['subenabled'] else 'disabled',
                'subscription_name': sub_name,
                'enabled': sub['subenabled'],
                'publications': sub['subpublications'],
                'pid': stats['pid'] if stats else None,
                'lag_seconds': lag_seconds,
                'last_msg_time': stats['last_msg_receipt_time'] if stats else None,
                'slot_active': slot_info['active'] if slot_info else None,
                'slot_name': slot_info['slot_name'] if slot_info else None,
            }

        finally:
            await conn.close()

    async def check_publisher_status(self, database_url: str) -> Dict:
        """檢查發布端狀態"""
        conn = await asyncpg.connect(database_url)
        try:
            # 1. Publications 資訊
            publications = await conn.fetch("""
                SELECT
                    pubname,
                    puballtables,
                    pubinsert,
                    pubupdate,
                    pubdelete
                FROM pg_publication
            """)

            if not publications:
                return {
                    'status': 'no_publication',
                    'message': '未設定任何發布'
                }

            # 2. 複製槽位資訊
            slots = await conn.fetch("""
                SELECT
                    slot_name,
                    plugin,
                    slot_type,
                    database,
                    active,
                    restart_lsn,
                    confirmed_flush_lsn,
                    pg_size_pretty(
                        pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)
                    ) AS replication_lag
                FROM pg_replication_slots
                WHERE slot_type = 'logical'
            """)

            # 3. WAL 發送者統計
            wal_senders = await conn.fetch("""
                SELECT
                    pid,
                    application_name,
                    client_addr,
                    state,
                    sync_state,
                    pg_size_pretty(
                        pg_wal_lsn_diff(sent_lsn, write_lsn)
                    ) AS write_lag,
                    pg_size_pretty(
                        pg_wal_lsn_diff(write_lsn, flush_lsn)
                    ) AS flush_lag
                FROM pg_stat_replication
            """)

            return {
                'status': 'active',
                'publications': [
                    {
                        'name': pub['pubname'],
                        'all_tables': pub['puballtables'],
                        'operations': {
                            'insert': pub['pubinsert'],
                            'update': pub['pubupdate'],
                            'delete': pub['pubdelete']
                        }
                    }
                    for pub in publications
                ],
                'replication_slots': [
                    {
                        'name': slot['slot_name'],
                        'active': slot['active'],
                        'lag': slot['replication_lag']
                    }
                    for slot in slots
                ],
                'wal_senders': [
                    {
                        'client': str(sender['client_addr']),
                        'state': sender['state'],
                        'sync_state': sender['sync_state']
                    }
                    for sender in wal_senders
                ]
            }

        finally:
            await conn.close()

    async def get_table_sync_status(self, subscription_name: str) -> List[Dict]:
        """取得表格同步狀態"""
        conn = await asyncpg.connect(self.database_url)
        try:
            # 取得訂閱的表格狀態
            result = await conn.fetch(f"""
                SELECT
                    schemaname,
                    tablename,
                    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size
                FROM pg_subscription_rel r
                JOIN pg_subscription s ON s.oid = r.srsubid
                JOIN pg_class c ON c.oid = r.srrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE s.subname = $1
            """, subscription_name)

            return [
                {
                    'schema': row['schemaname'],
                    'table': row['tablename'],
                    'size': row['table_size']
                }
                for row in result
            ]
        finally:
            await conn.close()


# ============================================================================
# 報告生成
# ============================================================================

def print_subscriber_report(status: Dict, detailed: bool = False):
    """列印訂閱端報告"""
    print("\n" + "=" * 70)
    print("📊 訂閱端複製狀態報告")
    print("=" * 70)

    if status['status'] == 'no_subscription':
        print(f"❌ {status['message']}")
        return

    # 基本狀態
    status_icon = "✅" if status['enabled'] else "⚠️"
    print(f"\n{status_icon} 訂閱名稱: {status['subscription_name']}")
    print(f"   啟用狀態: {'啟用' if status['enabled'] else '停用'}")
    print(f"   發布清單: {', '.join(status['publications'])}")

    # 進程狀態
    if status['pid']:
        print(f"\n📡 複製進程:")
        print(f"   PID: {status['pid']}")
        print(f"   最後訊息: {status['last_msg_time']}")
    else:
        print(f"\n⚠️  複製進程未運行")

    # 延遲狀態
    if status['lag_seconds'] is not None:
        lag = status['lag_seconds']
        if lag < 5:
            icon = "✅"
            level = "正常"
        elif lag < 60:
            icon = "⚠️"
            level = "輕微延遲"
        else:
            icon = "❌"
            level = "嚴重延遲"

        print(f"\n{icon} 複製延遲:")
        print(f"   延遲時間: {lag:.2f} 秒")
        print(f"   狀態: {level}")
    else:
        print(f"\n⚠️  無法取得延遲資訊")

    # 槽位狀態
    if status['slot_name']:
        slot_icon = "✅" if status['slot_active'] else "❌"
        print(f"\n{slot_icon} 複製槽位:")
        print(f"   槽位名稱: {status['slot_name']}")
        print(f"   狀態: {'活動中' if status['slot_active'] else '非活動'}")

    print("\n" + "=" * 70)


def print_publisher_report(status: Dict, detailed: bool = False):
    """列印發布端報告"""
    print("\n" + "=" * 70)
    print("📊 發布端複製狀態報告")
    print("=" * 70)

    if status['status'] == 'no_publication':
        print(f"❌ {status['message']}")
        return

    # Publications
    print(f"\n📢 已發布的資料:")
    for pub in status['publications']:
        print(f"   ✅ {pub['name']}")
        if pub['all_tables']:
            print(f"      範圍: 所有表格")
        print(f"      操作: INSERT={pub['operations']['insert']}, "
              f"UPDATE={pub['operations']['update']}, "
              f"DELETE={pub['operations']['delete']}")

    # 複製槽位
    print(f"\n🔌 複製槽位狀態:")
    for slot in status['replication_slots']:
        icon = "✅" if slot['active'] else "⚠️"
        print(f"   {icon} {slot['name']}")
        print(f"      狀態: {'活動中' if slot['active'] else '非活動'}")
        print(f"      延遲: {slot['lag']}")

    # WAL 發送者
    if status['wal_senders']:
        print(f"\n📤 WAL 發送者:")
        for sender in status['wal_senders']:
            print(f"   ✅ 客戶端: {sender['client']}")
            print(f"      狀態: {sender['state']}")
            print(f"      同步: {sender['sync_state']}")
    else:
        print(f"\n⚠️  無活動的 WAL 發送者")

    print("\n" + "=" * 70)


# ============================================================================
# 命令列介面
# ============================================================================

async def main():
    parser = argparse.ArgumentParser(description='PostgreSQL 邏輯複製監控工具')
    parser.add_argument(
        '--mode',
        choices=['subscriber', 'publisher'],
        required=True,
        help='監控模式 (subscriber: 訂閱端, publisher: 發布端)'
    )
    parser.add_argument(
        '--detailed',
        action='store_true',
        help='顯示詳細報告'
    )
    parser.add_argument(
        '--watch',
        type=int,
        metavar='SECONDS',
        help='持續監控模式，指定檢查間隔（秒）'
    )
    parser.add_argument(
        '--alert-threshold',
        type=int,
        default=60,
        help='延遲告警閾值（秒）, 預設 60 秒'
    )
    parser.add_argument(
        '--publisher-url',
        type=str,
        help='發布端資料庫連線 (僅在 publisher 模式需要)'
    )

    args = parser.parse_args()

    # 取得資料庫連線
    if args.mode == 'subscriber':
        database_url = settings.DATABASE_URL
    else:
        if not args.publisher_url:
            print("❌ 發布端模式需要提供 --publisher-url 參數")
            sys.exit(1)
        database_url = args.publisher_url

    monitor = ReplicationMonitor(database_url)

    # 監控邏輯
    async def check_and_report():
        if args.mode == 'subscriber':
            status = await monitor.check_subscriber_status()
            print_subscriber_report(status, args.detailed)

            # 延遲告警
            if status.get('lag_seconds') and status['lag_seconds'] > args.alert_threshold:
                print(f"\n🚨 警告: 複製延遲 ({status['lag_seconds']:.2f}s) 超過閾值 ({args.alert_threshold}s)")

        else:  # publisher
            status = await monitor.check_publisher_status(database_url)
            print_publisher_report(status, args.detailed)

    # 執行監控
    if args.watch:
        print(f"🔄 持續監控模式 (每 {args.watch} 秒檢查一次，按 Ctrl+C 停止)")
        try:
            while True:
                await check_and_report()
                await asyncio.sleep(args.watch)
        except KeyboardInterrupt:
            print("\n\n👋 監控已停止")
    else:
        await check_and_report()


if __name__ == "__main__":
    asyncio.run(main())
