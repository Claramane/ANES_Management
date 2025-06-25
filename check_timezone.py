#!/usr/bin/env python3

import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

import pytz
from datetime import datetime
import time
from app.utils.timezone import get_timezone_info
from app.core.database import SessionLocal
from sqlalchemy import text

def check_system_timezone():
    """檢查系統時區設置"""
    print("🌏 系統時區檢查")
    print("=" * 50)
    
    # 1. Python 系統時區
    print(f"Python time.tzname: {time.tzname}")
    print(f"環境變數 TZ: {os.environ.get('TZ', '未設定')}")
    
    # 2. 當前時間
    now_local = datetime.now()
    now_utc = datetime.utcnow()
    
    print(f"系統本地時間: {now_local}")
    print(f"UTC時間: {now_utc}")
    
    # 3. 使用pytz檢查台北時區
    taipei_tz = pytz.timezone('Asia/Taipei')
    taipei_time = datetime.now(taipei_tz)
    
    print(f"台北時間 (pytz): {taipei_time}")
    print(f"台北時區偏移: {taipei_time.strftime('%z %Z')}")

def check_app_timezone():
    """檢查應用程序時區設置"""
    print("\n🔧 應用程序時區檢查")
    print("=" * 50)
    
    try:
        # 使用應用的時區工具函數
        timezone_info = get_timezone_info()
        
        print(f"應用設定時區: {timezone_info['timezone']}")
        print(f"時區偏移: {timezone_info['offset']}")
        print(f"台灣時間: {timezone_info['taiwan_time']}")
        print(f"UTC時間: {timezone_info['utc_time']}")
        print(f"時間差: {timezone_info['time_difference_hours']} 小時")
        
    except Exception as e:
        print(f"❌ 無法獲取應用時區資訊: {e}")

def check_database_timezone():
    """檢查資料庫時區設置"""
    print("\n🗄️ 資料庫時區檢查")
    print("=" * 50)
    
    db = SessionLocal()
    try:
        # 檢查資料庫當前時間
        result = db.execute(text("SELECT NOW() as db_time"))
        db_time = result.fetchone()[0]
        print(f"資料庫時間: {db_time}")
        
        # 檢查資料庫時區設定
        result = db.execute(text("SHOW timezone"))
        db_timezone = result.fetchone()[0]
        print(f"資料庫時區設定: {db_timezone}")
        
        # 檢查一些用戶的登入時間
        result = db.execute(text("""
            SELECT username, last_login_time, created_at 
            FROM users 
            WHERE last_login_time IS NOT NULL 
            ORDER BY last_login_time DESC 
            LIMIT 3
        """))
        
        print("\n最近登入記錄:")
        for row in result.fetchall():
            print(f"  {row[0]}: {row[1]} (建立: {row[2]})")
            
    except Exception as e:
        print(f"❌ 無法檢查資料庫時區: {e}")
    finally:
        db.close()

def check_time_consistency():
    """檢查時間一致性"""
    print("\n🔍 時間一致性檢查")
    print("=" * 50)
    
    # 當前各種時間
    now_local = datetime.now()
    taipei_tz = pytz.timezone('Asia/Taipei')
    taipei_time = datetime.now(taipei_tz)
    utc_time = datetime.utcnow()
    
    # 計算時間差
    local_offset = (now_local - utc_time).total_seconds() / 3600
    taipei_offset = 8  # 台北時間 UTC+8
    
    print(f"本地時間與UTC差異: {local_offset:.1f} 小時")
    print(f"台北時間與UTC差異: {taipei_offset} 小時")
    
    if abs(local_offset - taipei_offset) < 0.1:
        print("✅ 系統時間與台北時間一致")
    else:
        print("❌ 系統時間與台北時間不一致")
        print(f"   差異: {abs(local_offset - taipei_offset):.1f} 小時")

if __name__ == "__main__":
    print("🕐 系統時間檢查工具")
    print("=" * 60)
    
    check_system_timezone()
    check_app_timezone()
    check_database_timezone()
    check_time_consistency()
    
    print("\n" + "=" * 60)
    print("時間檢查完成!") 