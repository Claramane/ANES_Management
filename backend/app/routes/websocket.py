"""
WebSocket 路由
處理 WebSocket 連接、心跳、狀態廣播
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, status
from sqlalchemy.orm import Session
from typing import Optional
import logging
import json
from datetime import datetime

from ..core.database import get_db
from ..core.security import decode_access_token
from ..models.user import User
from ..websocket.connection_manager import connection_manager

logger = logging.getLogger(__name__)

router = APIRouter()


async def get_current_user_from_token(
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    從 WebSocket 查詢參數中的 token 獲取當前用戶

    Args:
        token: JWT token
        db: 資料庫 session

    Returns:
        User 實例或 None
    """
    if not token:
        return None

    try:
        # 解碼 JWT token
        payload = decode_access_token(token)
        if not payload:
            return None

        username = payload.get("sub")
        if not username:
            return None

        # 查詢用戶
        user = db.query(User).filter(User.username == username).first()
        if not user or not user.is_active:
            return None

        return user

    except Exception as e:
        logger.error(f"驗證 WebSocket token 時發生錯誤: {str(e)}")
        return None


def get_user_data_with_avatar(user: User, db: Session) -> dict:
    """
    獲取用戶資料（包含 LINE 頭像）

    Args:
        user: User 實例
        db: 資料庫 session

    Returns:
        用戶資料字典
    """
    user_dict = {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "identity": user.identity,
        "role": user.role,
        "last_login_time": user.last_login_time.isoformat() if user.last_login_time else None,
        "line_avatar_url": None,
        "picture_url": None
    }

    # 注入 LINE 頭像
    if hasattr(user, "line_account") and user.line_account and user.line_account.picture_url:
        user_dict["line_avatar_url"] = user.line_account.picture_url
        user_dict["picture_url"] = user.line_account.picture_url

    return user_dict


async def get_online_users_data(db: Session) -> list:
    """
    獲取所有在線用戶的完整資料

    Args:
        db: 資料庫 session

    Returns:
        在線用戶列表
    """
    online_user_ids = connection_manager.get_online_user_ids()

    if not online_user_ids:
        return []

    # 查詢所有在線用戶的資料
    users = db.query(User).filter(
        User.id.in_(online_user_ids),
        User.is_active == True
    ).all()

    # 轉換為字典格式並注入頭像
    return [get_user_data_with_avatar(user, db) for user in users]


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    WebSocket 主端點
    處理連接、心跳、訊息接收
    """
    # 驗證用戶
    user = await get_current_user_from_token(token, db)

    if not user:
        logger.warning("WebSocket 連接被拒絕：無效的 token")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = user.id
    logger.info(f"用戶 {user.username} (ID: {user_id}) 嘗試建立 WebSocket 連接")

    # 接受連接
    await connection_manager.connect(websocket, user_id)

    try:
        # 發送歡迎訊息
        await connection_manager.send_personal_message({
            "type": "connection_established",
            "data": {
                "user_id": user_id,
                "username": user.username,
                "timestamp": datetime.now().isoformat()
            }
        }, user_id)

        # 廣播用戶上線事件
        await connection_manager.broadcast_user_status_change(user_id, "online")

        # 發送當前在線用戶列表給新連接的用戶
        online_users = await get_online_users_data(db)
        await connection_manager.send_personal_message({
            "type": "online_users_update",
            "data": {
                "users": online_users,
                "count": len(online_users),
                "timestamp": datetime.now().isoformat()
            }
        }, user_id)

        # 廣播更新後的在線用戶列表給所有用戶
        await connection_manager.broadcast_online_users_list(online_users)

        # 持續接收訊息
        while True:
            # 接收客戶端訊息
            data = await websocket.receive_text()

            try:
                message = json.loads(data)
                message_type = message.get("type")

                # 處理心跳訊息
                if message_type == "ping":
                    # 更新心跳時間
                    connection_manager.update_heartbeat(user_id)

                    # 回應 pong
                    await connection_manager.send_personal_message({
                        "type": "pong",
                        "timestamp": datetime.now().isoformat()
                    }, user_id)

                # 處理請求在線用戶列表
                elif message_type == "get_online_users":
                    online_users = await get_online_users_data(db)
                    await connection_manager.send_personal_message({
                        "type": "online_users_update",
                        "data": {
                            "users": online_users,
                            "count": len(online_users),
                            "timestamp": datetime.now().isoformat()
                        }
                    }, user_id)

                # 其他訊息類型可以在這裡擴展
                else:
                    logger.warning(f"收到未知的訊息類型: {message_type}")

            except json.JSONDecodeError:
                logger.error(f"無法解析來自用戶 {user_id} 的訊息: {data}")
            except Exception as e:
                logger.error(f"處理訊息時發生錯誤: {str(e)}")

    except WebSocketDisconnect:
        logger.info(f"用戶 {user.username} (ID: {user_id}) WebSocket 連接已斷開")

    except Exception as e:
        logger.error(f"WebSocket 連接發生錯誤: {str(e)}")

    finally:
        # 斷開連接並廣播用戶離線
        await connection_manager.disconnect(user_id)

        # 廣播更新後的在線用戶列表
        online_users = await get_online_users_data(db)
        await connection_manager.broadcast_online_users_list(online_users)


@router.get("/ws/status")
async def get_websocket_status():
    """
    獲取 WebSocket 服務狀態（用於健康檢查）
    """
    return {
        "status": "running",
        "online_users": connection_manager.get_online_count(),
        "timestamp": datetime.now().isoformat()
    }
