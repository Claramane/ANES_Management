#!/usr/bin/env python3
"""
測試登入是否正確更新 last_login_ip 和 last_login_time
"""

import requests
import time
import json
from datetime import datetime

# API 基礎 URL
BASE_URL = "http://localhost:8000/api"

def test_login_update():
    """測試登入更新功能"""
    print("🔍 開始測試登入更新功能...")
    
    # 測試登入
    login_data = {
        "username": "admin",  # 假設有admin用戶
        "password": "admin123"
    }
    
    print(f"📝 嘗試登入用戶: {login_data['username']}")
    
    try:
        # 執行登入
        response = requests.post(
            f"{BASE_URL}/login",
            data=login_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ 登入成功!")
            
            # 取得用戶資訊
            user_info = result.get('user', {})
            print(f"👤 用戶ID: {user_info.get('id')}")
            print(f"📧 用戶名: {user_info.get('username')}")
            print(f"🌐 最後登入IP: {user_info.get('last_login_ip')}")
            print(f"⏰ 最後登入時間: {user_info.get('last_login_time')}")
            
            if user_info.get('last_login_ip') and user_info.get('last_login_time'):
                print("✅ 最後登入資訊已正確更新!")
                return True
            else:
                print("❌ 最後登入資訊未更新!")
                return False
        else:
            print(f"❌ 登入失敗: {response.status_code}")
            print(f"錯誤訊息: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ 無法連接到後端服務，請確認服務是否正在運行")
        return False
    except Exception as e:
        print(f"❌ 測試過程中發生錯誤: {e}")
        return False

def check_database_directly():
    """直接檢查資料庫中的最後登入資訊"""
    print("\n🔍 直接檢查資料庫...")
    
    try:
        import sys
        import os
        sys.path.append('backend')
        
        from backend.app.core.database import engine
        from sqlalchemy import text
        
        with engine.connect() as connection:
            # 查詢最近登入的用戶
            result = connection.execute(text("""
                SELECT username, last_login_ip, last_login_time, created_at
                FROM users 
                WHERE last_login_time IS NOT NULL
                ORDER BY last_login_time DESC 
                LIMIT 5
            """)).fetchall()
            
            if result:
                print("📊 最近登入的用戶:")
                for row in result:
                    print(f"  👤 {row[0]} | IP: {row[1]} | 時間: {row[2]}")
            else:
                print("❌ 沒有找到任何登入記錄")
                
            # 檢查 logs 表
            log_result = connection.execute(text("""
                SELECT operation_type, ip_address, operation_time, description
                FROM logs 
                WHERE operation_type IN ('login', 'webauthn_login')
                ORDER BY operation_time DESC 
                LIMIT 5
            """)).fetchall()
            
            if log_result:
                print("\n📋 最近的登入日誌:")
                for row in log_result:
                    print(f"  🔐 {row[0]} | IP: {row[1]} | 時間: {row[2]} | {row[3]}")
            else:
                print("❌ 沒有找到登入日誌")
                
    except Exception as e:
        print(f"❌ 資料庫檢查失敗: {e}")

if __name__ == "__main__":
    # 等待服務啟動
    print("⏳ 等待後端服務啟動...")
    time.sleep(3)
    
    # 測試登入更新
    success = test_login_update()
    
    # 檢查資料庫
    check_database_directly()
    
    if success:
        print("\n✅ 測試完成！登入更新功能正常工作。")
    else:
        print("\n❌ 測試失敗！請檢查問題。") 