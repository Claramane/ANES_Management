import logging
import secrets
import time
from typing import Optional, Dict

import httpx
from jose import jwk
from jose.exceptions import JWTError, JWTClaimsError
from fastapi import APIRouter, Depends, HTTPException, Request, Body
from fastapi.responses import JSONResponse, RedirectResponse
from jose import jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.models.line_account import LineAccount
from app.models.user import User
from app.schemas.line import LineLoginStartResponse
from ..core.security import verify_password, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth/line", tags=["LINE Login"])

# 簡易的記憶體暫存，用於 QR 掃碼輪詢（低並發場景）
QR_SESSION_TTL = 600  # 秒
qr_sessions: Dict[str, dict] = {}


def generate_state() -> str:
    return secrets.token_urlsafe(16)


def generate_nonce() -> str:
    return secrets.token_urlsafe(16)


def generate_session_id() -> str:
    return secrets.token_urlsafe(20)


def store_temp(request: Request, key: str, value: str):
    request.session[key] = value
    request.session[f"{key}_ts"] = int(time.time())


def pop_temp(request: Request, key: str, ttl: int = 600) -> Optional[str]:
    val = request.session.get(key)
    ts = request.session.get(f"{key}_ts")
    if not val or not ts:
        return None
    if int(time.time()) - int(ts) > ttl:
        return None
    # 清理
    request.session.pop(key, None)
    request.session.pop(f"{key}_ts", None)
    return val


@router.get("/login", response_model=LineLoginStartResponse)
async def line_login_start(
    request: Request,
    redirect: Optional[str] = None,
    force_consent: bool = False,
    mode: Optional[str] = None
):
    """
    產生 LINE 授權網址，前端可直接 redirect。
    """
    state = generate_state()
    nonce = generate_nonce()
    store_temp(request, "line_state", state)
    store_temp(request, "line_nonce", nonce)
    if redirect:
        store_temp(request, "line_redirect", redirect)

    session_id = None
    if mode == "qr":
        session_id = generate_session_id()
        qr_sessions[session_id] = {
            "state": state,
            "nonce": nonce,
            "redirect": redirect,
            "status": "pending",
            "token": None,
            "created_at": time.time(),
            "message": None,
        }

    params = {
        "response_type": "code",
        "client_id": settings.LINE_CHANNEL_ID,
        "redirect_uri": settings.LINE_REDIRECT_URI,
        "state": state if not session_id else f"{state}:{session_id}",
        "scope": "profile openid",
        "nonce": nonce,
    }
    if force_consent:
        params["prompt"] = "consent"
    auth_url = settings.LINE_LOGIN_BASE_URL + "?" + "&".join(f"{k}={httpx.QueryParams({k: v})[k]}" for k, v in params.items())
    return LineLoginStartResponse(auth_url=auth_url, state=state, session_id=session_id)


@router.get("/callback")
async def line_login_callback(request: Request, code: str, state: str, db: Session = Depends(get_db)):
    """
    LINE 授權回調：交換 token -> 驗證 id_token -> 發 JWT 或要求綁定。
    """
    session_id = None
    if ":" in state:
        state, session_id = state.split(":", 1)

    saved_state = pop_temp(request, "line_state")
    nonce = pop_temp(request, "line_nonce")
    redirect_override = pop_temp(request, "line_redirect")

    if not saved_state or state != saved_state:
        raise HTTPException(status_code=400, detail="Invalid state")

    # 交換 token
    token_resp = await exchange_token(code)
    id_token = token_resp.get("id_token")
    access_token = token_resp.get("access_token")
    if not id_token:
        raise HTTPException(status_code=400, detail="Missing id_token")

    claims = verify_id_token(id_token, nonce)
    line_user_id = claims.get("sub")
    display_name = claims.get("name")
    picture_url = claims.get("picture")

    if not line_user_id:
        raise HTTPException(status_code=400, detail="Invalid LINE profile")

    account = db.query(LineAccount).filter(LineAccount.line_user_id == line_user_id).first()
    if account:
        user = db.query(User).filter(User.id == account.user_id, User.is_active == True).first()
        if not user:
            raise HTTPException(status_code=400, detail="User deactivated")

        account.last_login_at = time.strftime('%Y-%m-%d %H:%M:%S%z')
        db.commit()
        jwt_token = issue_jwt(user)
        if session_id and session_id in qr_sessions:
            qr_sessions[session_id]["status"] = "success"
            qr_sessions[session_id]["token"] = jwt_token
            qr_sessions[session_id]["message"] = None
        target = redirect_override or settings.FRONTEND_REDIRECT_AFTER_LOGIN
        return RedirectResponse(f"{target}?token={jwt_token}")

    # 未綁定：儲存 line_user_id 於 session 以便後續綁定，並回傳提示
    store_temp(request, "pending_line_user_id", line_user_id)
    store_temp(request, "pending_line_display_name", display_name or "")
    store_temp(request, "pending_line_picture_url", picture_url or "")

    # 導向前端設定頁提示綁定
    target = redirect_override or settings.FRONTEND_LINE_BIND_URL or settings.FRONTEND_REDIRECT_AFTER_LOGIN
    if session_id and session_id in qr_sessions:
        qr_sessions[session_id]["status"] = "need_binding"
        qr_sessions[session_id]["token"] = None
        qr_sessions[session_id]["message"] = "LINE 帳號尚未綁定"
    return RedirectResponse(f"{target}?line_status=need_binding")


@router.post("/bind")
async def line_bind(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    將 pending 的 LINE user 綁定到目前登入帳號（無需再輸入員工編號/密碼）。
    """
    line_user_id = pop_temp(request, "pending_line_user_id", ttl=600)
    if not line_user_id:
        raise HTTPException(status_code=400, detail="No pending LINE binding")

    # 檢查是否已綁定其他 LINE
    existing = db.query(LineAccount).filter(LineAccount.user_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="此帳號已綁定 LINE")

    # 檢查 line_user_id 是否被他人綁定
    other = db.query(LineAccount).filter(LineAccount.line_user_id == line_user_id).first()
    if other:
        raise HTTPException(status_code=400, detail="此 LINE 已綁定其他帳號")

    account = LineAccount(
        user_id=current_user.id,
        line_user_id=line_user_id,
        display_name=pop_temp(request, "pending_line_display_name", ttl=600),
        picture_url=pop_temp(request, "pending_line_picture_url", ttl=600),
        status="active",
    )
    db.add(account)
    db.commit()
    jwt_token = issue_jwt(current_user)
    return {"status": "success", "message": "LINE 綁定完成", "token": jwt_token}


async def exchange_token(code: str) -> dict:
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.LINE_REDIRECT_URI,
        "client_id": settings.LINE_CHANNEL_ID,
        "client_secret": settings.LINE_CHANNEL_SECRET,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(settings.LINE_TOKEN_URL, data=data, timeout=15)
        if resp.status_code != 200:
            logger.error("LINE token exchange failed: %s %s", resp.status_code, resp.text)
            raise HTTPException(status_code=400, detail="Token exchange failed")
        return resp.json()


_jwks_cache = {"keys": None, "ts": 0}


def fetch_jwks():
    now = time.time()
    if _jwks_cache["keys"] and now - _jwks_cache["ts"] < 3600:
        return _jwks_cache["keys"]
    resp = httpx.get(settings.LINE_CERTS_URL, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    _jwks_cache["keys"] = data["keys"]
    _jwks_cache["ts"] = now
    return _jwks_cache["keys"]


def verify_id_token(id_token: str, expected_nonce: Optional[str]) -> dict:
    try:
        header = jwt.get_unverified_header(id_token)
        kid = header.get("kid")
        alg = header.get("alg")
        logger.debug("LINE id_token header: %s", header)

        if alg == "RS256":
            jwks = fetch_jwks()
            key_dict = next((k for k in jwks if k.get("kid") == kid), None)
            if not key_dict and jwks:
                key_dict = jwks[0]
            if not key_dict:
                raise HTTPException(status_code=400, detail="No matching JWK")
            claims = jwt.decode(
                id_token,
                key_dict,
                algorithms=["RS256"],
                audience=settings.LINE_CHANNEL_ID,
                issuer="https://access.line.me",
            )
        elif alg == "HS256":
            # 若 LINE 後台設定為 HS256，使用 channel secret 驗簽
            claims = jwt.decode(
                id_token,
                settings.LINE_CHANNEL_SECRET,
                algorithms=["HS256"],
                audience=settings.LINE_CHANNEL_ID,
                issuer="https://access.line.me",
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported alg {alg}")

        if expected_nonce and claims.get("nonce") != expected_nonce:
            raise HTTPException(status_code=400, detail="Nonce mismatch")
        return claims
    except HTTPException:
        raise
    except (JWTError, JWTClaimsError) as e:
        logger.error("LINE id_token claims error: %s", e)
        raise HTTPException(status_code=400, detail=f"Invalid id_token: {str(e)}")
    except Exception as e:
        logger.exception("LINE id_token verify failed")
        raise HTTPException(status_code=400, detail=f"Invalid id_token: {str(e)}")


def issue_jwt(user: User) -> str:
    from datetime import timedelta
    expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return create_access_token(data={"sub": user.username}, expires_delta=expires)


def _cleanup_qr_sessions():
    now = time.time()
    expired = [k for k, v in qr_sessions.items() if now - v.get("created_at", 0) > QR_SESSION_TTL]
    for k in expired:
        qr_sessions.pop(k, None)


@router.get("/qr/status")
async def line_qr_status(session_id: str):
    _cleanup_qr_sessions()
    data = qr_sessions.get(session_id)
    if not data:
        raise HTTPException(status_code=404, detail="QR session not found or expired")
    return {
        "status": data.get("status", "pending"),
        "token": data.get("token"),
        "message": data.get("message"),
    }


@router.get("/status")
async def line_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = db.query(LineAccount).filter(LineAccount.user_id == current_user.id).first()
    if not account:
        return {"bound": False}
    return {
        "bound": True,
        "line_user_id": account.line_user_id,
        "display_name": account.display_name,
        "picture_url": account.picture_url,
    }


@router.delete("/unbind")
async def line_unbind(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = db.query(LineAccount).filter(LineAccount.user_id == current_user.id).first()
    if not account:
        raise HTTPException(status_code=404, detail="未綁定 LINE")
    db.delete(account)
    db.commit()
    return {"status": "success", "message": "LINE 已解除綁定"}
