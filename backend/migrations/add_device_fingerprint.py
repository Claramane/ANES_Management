#!/usr/bin/env python3
"""
遷移腳本：為現有的WebAuthn憑證添加設備指紋
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.core.database import engine
from sqlalchemy import text
import hashlib
import re

def generate_device_fingerprint(user_agent: str, credential_id: str, public_key: str) -> str:
    """
    生成設備指紋，用於識別唯一設備
    結合用戶代理、憑證ID的部分和公鑰的部分來生成指紋
    """
    # 簡化用戶代理，移除版本號等變動較大的資訊
    ua_simplified = re.sub(r'\d+\.\d+\.\d+', 'x.x.x', user_agent.lower())
    ua_simplified = re.sub(r'\d+\.\d+', 'x.x', ua_simplified)
    
    # 使用憑證ID和公鑰的前64個字元作為設備特徵
    device_signature = f"{ua_simplified}:{credential_id[:64]}:{public_key[:64]}"
    
    # 生成SHA256哈希作為設備指紋
    return hashlib.sha256(device_signature.encode()).hexdigest()

def add_device_fingerprints():
    """為現有的WebAuthn憑證添加設備指紋"""
    try:
        with engine.connect() as conn:
            # 獲取所有沒有設備指紋的憑證
            result = conn.execute(text("""
                SELECT id, device_name, credential_id, public_key
                FROM webauthn_credentials 
                WHERE device_fingerprint IS NULL
            """))
            
            credentials = result.fetchall()
            updated_count = 0
            
            for credential in credentials:
                # 為現有憑證生成設備指紋
                device_fingerprint = generate_device_fingerprint(
                    credential[1] or "Unknown Device",  # device_name
                    credential[2],  # credential_id
                    credential[3]   # public_key
                )
                
                # 更新記錄
                conn.execute(text("""
                    UPDATE webauthn_credentials 
                    SET device_fingerprint = :fingerprint 
                    WHERE id = :id
                """), {"fingerprint": device_fingerprint, "id": credential[0]})
                
                updated_count += 1
            
            conn.commit()
            print(f"成功為 {updated_count} 個憑證添加設備指紋")
        
    except Exception as e:
        print(f"遷移失敗: {e}")
        raise

if __name__ == "__main__":
    print("開始為現有WebAuthn憑證添加設備指紋...")
    add_device_fingerprints()
    print("遷移完成！") 