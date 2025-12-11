import logging
import secrets
import time
from typing import Optional

import httpx
from jose import jwk
from jose.exceptions import JWTError, JWTClaimsError
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from jose import jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.models.line_account import LineAccount
from app.models.user import User
from app.schemas.line import LineLoginStartResponse
from ..core.security import verify_password

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth/line", tags=["LINE Login"])


def generate_state() -> str:
    return secrets.token_urlsafe(16)


def generate_nonce() -> str:
    return secrets.token_urlsafe(16)


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
async def line_login_start(request: Request, redirect: Optional[str] = None):
    """
    產生 LINE 授權網址，前端可直接 redirect。
    """
    state = generate_state()
    nonce = generate_nonce()
    store_temp(request, "line_state", state)
    store_temp(request, "line_nonce", nonce)
    if redirect:
        store_temp(request, "line_redirect", redirect)

    params = {
        "response_type": "code",
        "client_id": settings.LINE_CHANNEL_ID,
        "redirect_uri": settings.LINE_REDIRECT_URI,
        "state": state,
        "scope": "profile openid",
        "nonce": nonce,
        "prompt": "consent",
    }
    auth_url = settings.LINE_LOGIN_BASE_URL + "?" + "&".join(f"{k}={httpx.QueryParams({k: v})[k]}" for k, v in params.items())
    return LineLoginStartResponse(auth_url=auth_url, state=state)


@router.get("/callback")
async def line_login_callback(request: Request, code: str, state: str, db: Session = Depends(get_db)):
    """
    LINE 授權回調：交換 token -> 驗證 id_token -> 發 JWT 或要求綁定。
    """
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
        target = redirect_override or settings.FRONTEND_REDIRECT_AFTER_LOGIN
        return RedirectResponse(f"{target}?token={jwt_token}")

    # 未綁定：儲存 line_user_id 於 session 以便後續綁定，並回傳提示
    store_temp(request, "pending_line_user_id", line_user_id)
    store_temp(request, "pending_line_display_name", display_name or "")
    store_temp(request, "pending_line_picture_url", picture_url or "")

    return JSONResponse(
        status_code=200,
        content={
            "status": "need_binding",
            "line_user_id": line_user_id,
            "display_name": display_name,
            "picture_url": picture_url,
            "message": "LINE 帳號尚未綁定，請輸入員工編號與密碼完成綁定。"
        }
    )


@router.post("/bind")
async def line_bind(
    request: Request,
    employee_id: str,
    password: str,
    db: Session = Depends(get_db),
):
    """
    將 pending 的 LINE user 綁定到指定員工帳號（需密碼驗證）。
    """
    line_user_id = pop_temp(request, "pending_line_user_id", ttl=600)
    if not line_user_id:
        raise HTTPException(status_code=400, detail="No pending LINE binding")

    user = db.query(User).filter(User.username == employee_id, User.is_active == True).first()
    if not user or not user.hashed_password or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=400, detail="員工編號或密碼錯誤")

    # 檢查是否已綁定其他 LINE
    existing = db.query(LineAccount).filter(LineAccount.user_id == user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="此帳號已綁定 LINE")

    # 檢查 line_user_id 是否被他人綁定
    other = db.query(LineAccount).filter(LineAccount.line_user_id == line_user_id).first()
    if other:
        raise HTTPException(status_code=400, detail="此 LINE 已綁定其他帳號")

    account = LineAccount(
        user_id=user.id,
        line_user_id=line_user_id,
        display_name=pop_temp(request, "pending_line_display_name", ttl=600),
        picture_url=pop_temp(request, "pending_line_picture_url", ttl=600),
        status="active",
    )
    db.add(account)
    db.commit()
    jwt_token = issue_jwt(user)
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
        if alg != "RS256":
            raise HTTPException(status_code=400, detail="Unsupported alg")
        jwks = fetch_jwks()
        key_dict = next((k for k in jwks if k.get("kid") == kid), None)
        if not key_dict and jwks:
            # 某些情況 kid 可能缺失，若只提供單一 key 則回退第一把
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
