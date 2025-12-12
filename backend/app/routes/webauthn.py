import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Body
from sqlalchemy.orm import Session
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers.structs import (
    PublicKeyCredentialDescriptor,
    RegistrationCredential,
    AuthenticationCredential,
    AuthenticatorAssertionResponse
)
from webauthn.helpers import bytes_to_base64url, base64url_to_bytes
from typing import List, Optional
import json
from sqlalchemy.sql import func
import base64
import hashlib
import hmac
import time

from ..core.database import get_db
from ..models.user import User
from ..models.webauthn import WebAuthnCredential
from ..core.security import get_current_user, create_access_token
from ..schemas.webauthn import WebAuthnRegistrationCredential, AuthenticatorAttestationResponseSchema
from webauthn.helpers.structs import AuthenticatorAttestationResponse
from ..core.config import settings

router = APIRouter(prefix="/webauthn", tags=["WebAuthn"])
logger = logging.getLogger(__name__)

# WebAuthn設定
RP_NAME = "ANES Management System"
RP_ID = settings.WEBAUTHN_RP_ID  # 改為讀取環境變數

CHALLENGE_TOKEN_TTL = 300  # 5分鐘

def safe_base64url_to_bytes(s):
    if isinstance(s, bytes):
        s = s.decode('utf-8')
    s = s + '=' * (-len(s) % 4)
    from webauthn.helpers import base64url_to_bytes as _b2b
    return _b2b(s)

def generate_device_fingerprint(user_agent: str, client_data_json: str = None, headers: dict = None) -> str:
    """
    生成設備指紋，用於識別唯一設備
    只使用穩定的設備特徵，不使用每次註冊都會變化的credential_id和public_key
    """
    import re
    import json
    headers = headers or {}
    
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

    ch_ua = headers.get("sec-ch-ua", "unknown")
    ch_platform = headers.get("sec-ch-ua-platform", "unknown")
    
    # 如果有client_data_json，可以提取更多穩定的設備信息
    origin = 'unknown'
    if client_data_json:
        try:
            client_data = json.loads(client_data_json)
            origin = client_data.get('origin', 'unknown')
        except:
            pass
    
    # 生成基於穩定設備特徵的指紋
    device_signature = f"{os_info}:{browser_info}:{origin}:{ch_ua}:{ch_platform}:{RP_ID}:{ua_simplified[:100]}"
    
    # 生成SHA256哈希作為設備指紋
    return hashlib.sha256(device_signature.encode()).hexdigest()

def generate_challenge_token(challenge_b64: str, user_id: Optional[int], purpose: str) -> str:
    ts = int(time.time())
    payload = f"{challenge_b64}|{user_id}|{purpose}|{ts}"
    mac = hmac.new(settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256).digest()
    token_bytes = json.dumps({
        "c": challenge_b64,
        "u": user_id,
        "p": purpose,
        "t": ts,
        "m": bytes_to_base64url(mac)
    }).encode()
    return bytes_to_base64url(token_bytes)

def verify_challenge_token(token: str, expected_user_id: Optional[int], purpose: str, ttl: int = CHALLENGE_TOKEN_TTL) -> str:
    try:
        data = json.loads(base64url_to_bytes(token))
        challenge_b64 = data.get("c")
        user_id = data.get("u")
        token_purpose = data.get("p")
        ts = data.get("t")
        mac_b64 = data.get("m")
        if token_purpose != purpose:
            raise ValueError("purpose mismatch")
        if expected_user_id is not None and user_id != expected_user_id:
            raise ValueError("user mismatch")
        if ts is None or int(time.time()) - int(ts) > ttl:
            raise ValueError("token expired")
        payload = f"{challenge_b64}|{user_id}|{token_purpose}|{ts}"
        expected_mac = hmac.new(settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(expected_mac, base64url_to_bytes(mac_b64)):
            raise ValueError("invalid signature")
        return challenge_b64
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid challenge token: {str(e)}")

@router.post("/register/start")
async def register_start(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """開始WebAuthn註冊流程"""
    logger.info("webauthn register_start user=%s ua=%s origin=%s",
                current_user.id,
                request.headers.get('user-agent', 'Unknown'),
                request.headers.get('origin', 'Unknown'))

    # 為目前使用者填入 excludeCredentials，避免同一 authenticator 重複註冊
    existing_credentials = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.user_id == current_user.id,
        WebAuthnCredential.is_active == True
    ).all()
    exclude_descriptors = [
        PublicKeyCredentialDescriptor(
            id=safe_base64url_to_bytes(cred.credential_id),
            type="public-key"
        )
        for cred in existing_credentials
    ]

    options = generate_registration_options(
        rp_id=RP_ID,
        rp_name=RP_NAME,
        user_id=str(current_user.id).encode(),
        user_name=current_user.username,
        user_display_name=current_user.full_name,
        exclude_credentials=exclude_descriptors
    )
    challenge_b64 = bytes_to_base64url(options.challenge)
    request.session["webauthn_challenge"] = challenge_b64
    logger.debug("webauthn register_start stored challenge prefix=%s...", challenge_b64[:10])
    
    response_data = {
        "publicKey": {
            "rp": {
                "name": options.rp.name,
                "id": options.rp.id,
            },
            "user": {
                "id": bytes_to_base64url(options.user.id),
                "name": options.user.name,
                "displayName": options.user.display_name,
            },
            "challenge": bytes_to_base64url(options.challenge),
            "pubKeyCredParams": [
                {"type": "public-key", "alg": -7},
                {"type": "public-key", "alg": -257},
            ],
            "timeout": 60000,
            "excludeCredentials": [
                {
                    "type": "public-key",
                    "id": cred.credential_id
                } for cred in existing_credentials
            ],
            "authenticatorSelection": {
                "authenticatorAttachment": "platform",
                "userVerification": "preferred",
                "requireResidentKey": False,
            },
            "attestation": "none",
        },
        # 添加challenge到響應中，讓前端可以暫存
        "challenge_b64": challenge_b64,
        "user_id": current_user.id,  # 用於驗證
        "challenge_token": generate_challenge_token(challenge_b64, current_user.id, "register")
    }
    
    return response_data

@router.post("/register/finish")
async def register_finish(
    request: Request,
    credential: WebAuthnRegistrationCredential,
    challenge_token: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """完成WebAuthn註冊流程"""
    try:
        logger.info("webauthn register_finish user=%s ua=%s origin=%s",
                    current_user.id,
                    request.headers.get('user-agent', 'Unknown'),
                    request.headers.get('origin', 'Unknown'))
        
        session_challenge = request.session.get("webauthn_challenge")
        if session_challenge:
            challenge_b64_to_use = session_challenge
            logger.debug("webauthn register_finish use session challenge prefix=%s...", session_challenge[:10])
        elif challenge_token:
            challenge_b64_to_use = verify_challenge_token(challenge_token, current_user.id, "register")
            logger.debug("webauthn register_finish use token challenge prefix=%s...", challenge_b64_to_use[:10])
        else:
            raise HTTPException(status_code=400, detail="Missing challenge token")

        logger.debug("webauthn register_finish using challenge prefix=%s...", challenge_b64_to_use[:10])
        expected_challenge = base64url_to_bytes(challenge_b64_to_use)

        # 將 raw_id 轉成 bytes
        raw_id_bytes = base64url_to_bytes(credential.raw_id)
        # id 保持 str
        # response 內部欄位轉 bytes
        new_response = AuthenticatorAttestationResponse(
            client_data_json=base64url_to_bytes(credential.response.client_data_json),
            attestation_object=base64url_to_bytes(credential.response.attestation_object),
        )
        # type 直接用
        new_credential = RegistrationCredential(
            id=credential.id,
            raw_id=raw_id_bytes,
            response=new_response,
            type=credential.type,
        )
        verification = verify_registration_response(
            credential=new_credential,
            expected_challenge=expected_challenge,
            expected_origin=settings.WEBAUTHN_EXPECTED_ORIGIN,
            expected_rp_id=RP_ID,
        )
        # 清理session中的challenge（如果存在）
        if "webauthn_challenge" in request.session:
            del request.session["webauthn_challenge"]
        
        # 生成設備指紋
        user_agent = request.headers.get("user-agent", "Unknown Device")
        
        # 正確處理client_data_json - 可能是str或bytes
        client_data_json = None
        if hasattr(credential.response, 'client_data_json'):
            if isinstance(credential.response.client_data_json, bytes):
                # 如果是bytes，先轉換為base64url string，再轉回bytes，最後decode為json string
                try:
                    client_data_json_bytes = base64url_to_bytes(credential.response.client_data_json)
                    client_data_json = client_data_json_bytes.decode('utf-8')
                except:
                    # 如果base64解碼失敗，直接decode
                    client_data_json = credential.response.client_data_json.decode('utf-8')
            elif isinstance(credential.response.client_data_json, str):
                # 如果已經是string，嘗試解碼base64url
                try:
                    client_data_json_bytes = base64url_to_bytes(credential.response.client_data_json)
                    client_data_json = client_data_json_bytes.decode('utf-8')
                except:
                    # 如果不是base64編碼，直接使用
                    client_data_json = credential.response.client_data_json
        
        device_fingerprint = generate_device_fingerprint(user_agent, client_data_json)
        
        # 檢查該設備是否已經被其他用戶註冊
        existing_credential = db.query(WebAuthnCredential).filter(
            WebAuthnCredential.device_fingerprint == device_fingerprint,
            WebAuthnCredential.user_id != current_user.id,
            WebAuthnCredential.is_active == True
        ).first()
        
        if existing_credential:
            # 獲取已綁定用戶的用戶名
            existing_user = db.query(User).filter(User.id == existing_credential.user_id).first()
            existing_username = existing_user.username if existing_user else "未知用戶"
            
            raise HTTPException(
                status_code=400,
                detail=f"此設備已經綁定到其他帳號。一台設備只能綁定一個帳號。"
            )
        
        # 將憑證ID和公鑰轉換為base64url編碼
        credential_id_b64 = bytes_to_base64url(verification.credential_id)
        public_key_b64 = bytes_to_base64url(verification.credential_public_key)
        
        # 創建新的WebAuthn憑證記錄
        new_credential_db = WebAuthnCredential(
            user_id=current_user.id,
            credential_id=credential_id_b64,
            public_key=public_key_b64,
            sign_count=verification.sign_count,
            device_name=user_agent,
            device_fingerprint=device_fingerprint
        )
        db.add(new_credential_db)
        db.commit()
        logger.info("webauthn register_finish success user=%s credential=%s", current_user.id, credential_id_b64[:10] + "...")
        return {"status": "success", "message": "Passkey registered successfully"}
    except Exception as e:
        logger.exception("webauthn register_finish failed user=%s", current_user.id if current_user else None)
        error_detail = str(e)
        if hasattr(e, 'detail') and e.detail:
            error_detail = e.detail
        elif hasattr(e, 'args') and e.args:
            error_detail = str(e.args[0])
        raise HTTPException(status_code=400, detail=f"Passkey registration failed: {error_detail}")

@router.post("/authenticate/start")
async def authenticate_start(
    request: Request,
    payload: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db)
):
    """開始WebAuthn認證流程（需指定 username，僅回傳該用戶憑證）"""
    username = None
    if payload and isinstance(payload, dict):
        username = payload.get("username")

    if not username:
        raise HTTPException(status_code=400, detail="Username is required for passkey authentication")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    credentials = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.user_id == user.id,
        WebAuthnCredential.is_active == True
    ).all()
    if not credentials:
        raise HTTPException(status_code=400, detail="No passkeys available for this user")
    
    # 生成認證選項
    options = generate_authentication_options(
        rp_id=RP_ID,
        allow_credentials=[
            PublicKeyCredentialDescriptor(
                id=safe_base64url_to_bytes(cred.credential_id),
                type="public-key"
            ) for cred in credentials
        ]
    )
    
    return {
        "publicKey": {
            "challenge": bytes_to_base64url(options.challenge),
            "timeout": 60000,
            "rpId": options.rp_id,
            "allowCredentials": [
                {
                    "type": "public-key",
                    "id": cred.credential_id,
                    "transports": ["internal"]
                } for cred in credentials
            ],
            "userVerification": "preferred",
        },
        "challenge_token": generate_challenge_token(
            bytes_to_base64url(options.challenge),
            user.id if user else None,
            "authenticate"
        )
    }

@router.post("/authenticate/finish")
async def authenticate_finish(
    request: Request,
    credential: AuthenticationCredential,
    challenge_token: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """完成WebAuthn認證流程"""
    try:
        credential_id_str = credential.id if isinstance(credential.id, str) else credential.id.decode('utf-8')
        stored_credential = db.query(WebAuthnCredential).filter(
            WebAuthnCredential.credential_id == credential_id_str
        ).first()
        if not stored_credential:
            raise HTTPException(status_code=400, detail="Credential not found")

        response_from_client = credential.response

        client_data_json_bytes = safe_base64url_to_bytes(response_from_client.client_data_json)
        authenticator_data_bytes = safe_base64url_to_bytes(response_from_client.authenticator_data)
        signature_bytes = safe_base64url_to_bytes(response_from_client.signature)
        
        user_handle_bytes = None
        if response_from_client.user_handle:
            user_handle_bytes = safe_base64url_to_bytes(response_from_client.user_handle)

        # auth_response 改為 AuthenticatorAssertionResponse 物件
        auth_response = AuthenticatorAssertionResponse(
            client_data_json=client_data_json_bytes,
            authenticator_data=authenticator_data_bytes,
            signature=signature_bytes,
            user_handle=user_handle_bytes
        )

        client_data = json.loads(client_data_json_bytes.decode('utf-8'))
        challenge_b64 = client_data['challenge']

        if challenge_token:
            verified_challenge_b64 = verify_challenge_token(challenge_token, stored_credential.user_id, "authenticate")
            if verified_challenge_b64 != challenge_b64:
                raise HTTPException(status_code=400, detail="Challenge mismatch")
        expected_challenge = safe_base64url_to_bytes(challenge_b64)
        
        raw_id_bytes = safe_base64url_to_bytes(credential.raw_id if isinstance(credential.raw_id, str) else credential.raw_id.decode('utf-8'))

        new_auth_credential = AuthenticationCredential(
            id=credential_id_str,
            raw_id=raw_id_bytes,
            response=auth_response, # 使用 AuthenticatorAssertionResponse 物件
            type=credential.type,
            authenticator_attachment=credential.authenticator_attachment,
        )
        
        verification = verify_authentication_response(
            credential=new_auth_credential,
            expected_challenge=expected_challenge,
            expected_origin=settings.WEBAUTHN_EXPECTED_ORIGIN,
            expected_rp_id=RP_ID,
            credential_public_key=safe_base64url_to_bytes(stored_credential.public_key),
            credential_current_sign_count=stored_credential.sign_count,
        )
        
        # 更新sign_count
        stored_credential.sign_count = verification.new_sign_count
        stored_credential.last_used_at = func.now()
        
        # 獲取對應的用戶
        user = db.query(User).filter(User.id == stored_credential.user_id).first()
        
        # 更新用戶最後登入資訊
        user.last_login_time = func.now()
        user.last_login_ip = request.client.host if request else None
        
        # 添加登入日誌
        from ..models.log import Log
        log = Log(
            user_id=user.id,
            operation_type="webauthn_login",
            action="webauthn_login",
            ip_address=request.client.host if request else None,
            description=f"用戶 {user.username} 使用WebAuthn登入系統"
        )
        db.add(log)
        
        db.commit()
        
        # 產生 JWT token
        from datetime import timedelta
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        
        return {
            "status": "success",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role
            }
        }
        
    except Exception as e:
        logger.exception("webauthn authenticate_finish failed credential=%s", credential.id if hasattr(credential, 'id') else None)
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/credentials")
async def list_credentials(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """列出用戶的所有passkey"""
    credentials = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.user_id == current_user.id
    ).all()
    
    return [{
        "id": cred.id,
        "device_name": cred.device_name,
        "created_at": cred.created_at,
        "last_used_at": cred.last_used_at,
        "is_active": cred.is_active
    } for cred in credentials]

@router.delete("/credentials/{credential_id}")
async def delete_credential(
    credential_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """刪除指定的passkey"""
    credential = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.id == credential_id,
        WebAuthnCredential.user_id == current_user.id
    ).first()
    
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    db.delete(credential)
    db.commit()
    
    return {"status": "success", "message": "Credential deleted successfully"}

@router.get("/debug/session")
async def debug_session(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """調試端點：檢查session狀態"""
    import time
    
    # 嘗試寫入和讀取 session 來測試是否正常工作
    test_key = f"test_{int(time.time())}"
    request.session[test_key] = "test_value"
    test_read = request.session.get(test_key)
    
    return {
        "session_contents": dict(request.session),
        "session_keys": list(request.session.keys()),
        "user_id": current_user.id,
        "user_agent": request.headers.get("user-agent", "Unknown"),
        "origin": request.headers.get("origin", "Unknown"),
        "referer": request.headers.get("referer", "Unknown"),
        "host": request.headers.get("host", "Unknown"),
        "rp_id": RP_ID,
        "expected_origin": settings.WEBAUTHN_EXPECTED_ORIGIN,
        "cors_origins": settings.BACKEND_CORS_ORIGINS,
        "https_only": settings.HTTPS_ONLY,
        "is_production": settings.IS_PRODUCTION,
        "secret_key_length": len(settings.SECRET_KEY),
        "secret_key_preview": settings.SECRET_KEY[:10] + "..." if settings.SECRET_KEY else "None",
        "test_session_write": test_read == "test_value",
        "cookies": dict(request.cookies),
        "session_cookie_name": "session",  # 從 middleware 配置中得知
        "request_url": str(request.url),
        "request_method": request.method
    }

@router.post("/test/session")
async def test_session(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """測試端點：檢查 session cookie 是否正確設置"""
    import time
    from fastapi.responses import JSONResponse
    
    # 設置一個測試值
    test_key = f"test_{int(time.time())}"
    request.session[test_key] = "test_session_cookie"
    
    # 準備回應和調試信息
    debug_info = {
        "session_contents": dict(request.session),
        "session_keys": list(request.session.keys()),
        "user_id": current_user.id,
        "cookies_received": dict(request.cookies),
        "origin": request.headers.get("origin", "Unknown"),
        "host": request.headers.get("host", "Unknown"),
        "user_agent": request.headers.get("user-agent", "Unknown"),
        "is_production": settings.IS_PRODUCTION,
        "https_only": settings.HTTPS_ONLY
    }
    
    # 創建回應並設置 cookie
    response = JSONResponse(content=debug_info)
    
    return response 
