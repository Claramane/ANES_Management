#!/usr/bin/env python3
"""
修正設備指紋生成邏輯
重新生成所有設備指紋，使用穩定的設備特徵而不是變動的憑證信息
"""

import sys
import os

# 設置正確的路徑
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.core.database import get_db, engine
from app.models.webauthn import WebAuthnCredential
from sqlalchemy.orm import sessionmaker
import hashlib
import re
import json

def generate_device_fingerprint(user_agent: str, client_data_json: str = None) -> str:
    """
    生成設備指紋，用於識別唯一設備
    只使用穩定的設備特徵，不使用每次註冊都會變化的credential_id和public_key
    """
    # 簡化用戶代理，移除版本號等變動較大的資訊
    ua_simplified = re.sub(r'\d+\.\d+\.\d+', 'x.x.x', user_agent.lower())
    ua_simplified = re.sub(r'\d+\.\d+', 'x.x', ua_simplified)
    
    # 從user agent中提取關鍵設備信息
    # 提取操作系統信息
    os_pattern = r'(mac os x|windows nt|linux|android|ios)'
    os_match = re.search(os_pattern, ua_simplified)
    os_info = os_match.group(1) if os_match else 'unknown'
    
    # 提取瀏覽器信息  
    browser_pattern = r'(chrome|firefox|safari|edge|opera)'
    browser_match = re.search(browser_pattern, ua_simplified)
    browser_info = browser_match.group(1) if browser_match else 'unknown'
    
    # 如果有client_data_json，可以提取更多穩定的設備信息
    origin = 'unknown'
    if client_data_json:
        try:
            client_data = json.loads(client_data_json)
            origin = client_data.get('origin', 'unknown')
        except:
            pass
    
    # 生成基於穩定設備特徵的指紋
    # 不使用credential_id和public_key，因為它們每次註冊都不同
    device_signature = f"{os_info}:{browser_info}:{origin}:{ua_simplified[:100]}"
    
    # 生成SHA256哈希作為設備指紋
    return hashlib.sha256(device_signature.encode()).hexdigest()

def main():
    """重新生成所有設備指紋"""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # 獲取所有WebAuthn憑證
        credentials = db.query(WebAuthnCredential).all()
        
        print(f"找到 {len(credentials)} 個WebAuthn憑證")
        
        updated_count = 0
        device_groups = {}  # 用於分組相同設備的憑證
        
        for cred in credentials:
            # 使用新算法生成設備指紋
            new_fingerprint = generate_device_fingerprint(cred.device_name or "Unknown Device")
            
            print(f"憑證 ID {cred.id}:")
            print(f"  用戶 ID: {cred.user_id}")
            print(f"  設備名稱: {cred.device_name}")
            print(f"  舊指紋: {cred.device_fingerprint}")
            print(f"  新指紋: {new_fingerprint}")
            
            # 更新設備指紋
            cred.device_fingerprint = new_fingerprint
            updated_count += 1
            
            # 記錄相同設備的憑證
            if new_fingerprint not in device_groups:
                device_groups[new_fingerprint] = []
            device_groups[new_fingerprint].append(cred)
            
            print()
        
        # 檢查是否有設備被多個用戶綁定
        conflicts = []
        for fingerprint, creds in device_groups.items():
            user_ids = list(set(cred.user_id for cred in creds))
            if len(user_ids) > 1:
                conflicts.append((fingerprint, creds))
        
        if conflicts:
            print("⚠️  發現設備衝突！")
            for fingerprint, creds in conflicts:
                print(f"設備指紋 {fingerprint[:16]}... 被以下用戶綁定:")
                for cred in creds:
                    print(f"  - 用戶 {cred.user_id} (憑證 {cred.id}) - 創建於 {cred.created_at}")
                print()
                
                # 保留最早創建的憑證，停用其他憑證
                creds_sorted = sorted(creds, key=lambda x: x.created_at)
                keep_cred = creds_sorted[0]
                deactivate_creds = creds_sorted[1:]
                
                print(f"保留最早的憑證 {keep_cred.id} (用戶 {keep_cred.user_id})")
                for cred in deactivate_creds:
                    print(f"停用憑證 {cred.id} (用戶 {cred.user_id})")
                    cred.is_active = False
                print()
        
        # 提交更改
        db.commit()
        print(f"✅ 成功更新 {updated_count} 個設備指紋")
        
        if conflicts:
            print(f"🔧 處理了 {len(conflicts)} 個設備衝突")
            print("建議受影響的用戶重新註冊Passkey")
        
    except Exception as e:
        db.rollback()
        print(f"❌ 錯誤: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main() 