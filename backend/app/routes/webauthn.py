from fastapi import APIRouter, Depends, HTTPException, Request
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

from ..core.database import get_db
from ..models.user import User
from ..models.webauthn import WebAuthnCredential
from ..core.security import get_current_user, create_access_token
from ..schemas.webauthn import WebAuthnRegistrationCredential, AuthenticatorAttestationResponseSchema
from webauthn.helpers.structs import AuthenticatorAttestationResponse
from ..core.config import settings

router = APIRouter(prefix="/webauthn", tags=["WebAuthn"])

# WebAuthn設定
RP_NAME = "ANES Management System"
RP_ID = settings.WEBAUTHN_RP_ID  # 改為讀取環境變數

def safe_base64url_to_bytes(s):
    if isinstance(s, bytes):
        s = s.decode('utf-8')
    s = s + '=' * (-len(s) % 4)
    from webauthn.helpers import base64url_to_bytes as _b2b
    return _b2b(s)

@router.post("/register/start")
async def register_start(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """開始WebAuthn註冊流程"""
    options = generate_registration_options(
        rp_id=RP_ID,
        rp_name=RP_NAME,
        user_id=str(current_user.id).encode(),
        user_name=current_user.username,
        user_display_name=current_user.full_name,
    )
    # 將 challenge (bytes) 轉換為 base64url 字串後存到 session
    request.session["webauthn_challenge"] = bytes_to_base64url(options.challenge)
    return {
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
            "excludeCredentials": [],
            "authenticatorSelection": {
                "authenticatorAttachment": "platform",
                "userVerification": "preferred",
                "requireResidentKey": False,
            },
            "attestation": "none",
        }
    }

@router.post("/register/finish")
async def register_finish(
    request: Request,
    credential: WebAuthnRegistrationCredential,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        base64url_challenge = request.session.get("webauthn_challenge")
        if not base64url_challenge:
            raise HTTPException(status_code=400, detail="No challenge in session")
        expected_challenge = base64url_to_bytes(base64url_challenge)

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
        del request.session["webauthn_challenge"]
        new_credential_db = WebAuthnCredential(
            user_id=current_user.id,
            credential_id=bytes_to_base64url(verification.credential_id),
            public_key=bytes_to_base64url(verification.credential_public_key),
            sign_count=verification.sign_count,
            device_name=request.headers.get("user-agent", "Unknown Device")
        )
        db.add(new_credential_db)
        db.commit()
        return {"status": "success", "message": "Passkey registered successfully"}
    except Exception as e:
        print(f"Error during WebAuthn register_finish: {type(e).__name__} - {str(e)}")
        error_detail = str(e)
        if hasattr(e, 'detail') and e.detail:
            error_detail = e.detail
        elif hasattr(e, 'args') and e.args:
            error_detail = str(e.args[0])
        raise HTTPException(status_code=400, detail=f"Passkey registration failed: {error_detail}")

@router.post("/authenticate/start")
async def authenticate_start(
    request: Request,
    db: Session = Depends(get_db)
):
    """開始WebAuthn認證流程"""
    # 獲取所有有效的credential
    credentials = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.is_active == True
    ).all()
    
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
        }
    }

@router.post("/authenticate/finish")
async def authenticate_finish(
    request: Request,
    credential: AuthenticationCredential,
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
        db.commit()
        
        # 獲取對應的用戶
        user = db.query(User).filter(User.id == stored_credential.user_id).first()
        
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
        # 更詳細的錯誤記錄
        import traceback
        print(f"Error in authenticate_finish: {type(e).__name__} - {str(e)}")
        print(traceback.format_exc())
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