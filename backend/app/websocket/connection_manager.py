"""
WebSocket 連接管理器
管理所有 WebSocket 連接、心跳保活、狀態廣播
"""
from typing import Dict, Set, Optional
from fastapi import WebSocket
from datetime import datetime
import json
import asyncio
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """WebSocket 連接管理器"""

    def __init__(self):
        # 用戶 ID -> WebSocket 連接的映射
        self.active_connections: Dict[int, WebSocket] = {}

        # 用戶 ID -> 最後心跳時間的映射
        self.last_heartbeat: Dict[int, datetime] = {}

        # 正在執行心跳檢查的任務
        self.heartbeat_task: Optional[asyncio.Task] = None

        # 心跳超時時間（秒）
        self.heartbeat_timeout = 30

        # 心跳檢查間隔（秒）
        self.heartbeat_check_interval = 10

    async def connect(self, websocket: WebSocket, user_id: int):
        """
        接受新的 WebSocket 連接

        Args:
            websocket: WebSocket 連接實例
            user_id: 用戶 ID
        """
        await websocket.accept()

        # 如果用戶已經有連接，先關閉舊連接
        if user_id in self.active_connections:
            try:
                old_ws = self.active_connections[user_id]
                await old_ws.close()
                logger.info(f"關閉用戶 {user_id} 的舊連接")
            except Exception as e:
                logger.error(f"關閉舊連接時發生錯誤: {str(e)}")

        # 儲存新連接
        self.active_connections[user_id] = websocket
        self.last_heartbeat[user_id] = datetime.now()

        logger.info(f"用戶 {user_id} 已連接，當前在線用戶數: {len(self.active_connections)}")

        # 啟動心跳檢查任務（如果尚未啟動）
        if self.heartbeat_task is None or self.heartbeat_task.done():
            self.heartbeat_task = asyncio.create_task(self._heartbeat_checker())

    async def disconnect(self, user_id: int):
        """
        斷開用戶連接

        Args:
            user_id: 用戶 ID
        """
        if user_id in self.active_connections:
            try:
                # 移除連接
                del self.active_connections[user_id]
                del self.last_heartbeat[user_id]

                logger.info(f"用戶 {user_id} 已斷開連接，當前在線用戶數: {len(self.active_connections)}")

                # 廣播用戶離線事件
                await self.broadcast_user_status_change(user_id, "offline")

            except Exception as e:
                logger.error(f"斷開連接時發生錯誤: {str(e)}")

    async def send_personal_message(self, message: dict, user_id: int):
        """
        發送私人訊息給特定用戶

        Args:
            message: 訊息內容（字典）
            user_id: 目標用戶 ID
        """
        if user_id in self.active_connections:
            try:
                websocket = self.active_connections[user_id]
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"發送訊息給用戶 {user_id} 失敗: {str(e)}")
                # 發送失敗時斷開連接
                await self.disconnect(user_id)

    async def broadcast(self, message: dict, exclude_user: Optional[int] = None):
        """
        廣播訊息給所有連接的用戶

        Args:
            message: 訊息內容（字典）
            exclude_user: 排除的用戶 ID（可選）
        """
        disconnected_users = []

        for user_id, websocket in self.active_connections.items():
            # 排除特定用戶
            if exclude_user and user_id == exclude_user:
                continue

            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"廣播訊息給用戶 {user_id} 失敗: {str(e)}")
                disconnected_users.append(user_id)

        # 清理斷開的連接
        for user_id in disconnected_users:
            await self.disconnect(user_id)

    async def broadcast_user_status_change(self, user_id: int, status: str):
        """
        廣播用戶狀態變更

        Args:
            user_id: 用戶 ID
            status: 狀態（online/offline）
        """
        message = {
            "type": "user_status_change",
            "data": {
                "user_id": user_id,
                "status": status,
                "timestamp": datetime.now().isoformat()
            }
        }
        await self.broadcast(message)

    async def broadcast_online_users_list(self, online_users: list):
        """
        廣播在線用戶列表

        Args:
            online_users: 在線用戶列表
        """
        message = {
            "type": "online_users_update",
            "data": {
                "users": online_users,
                "count": len(online_users),
                "timestamp": datetime.now().isoformat()
            }
        }
        await self.broadcast(message)

    def update_heartbeat(self, user_id: int):
        """
        更新用戶心跳時間

        Args:
            user_id: 用戶 ID
        """
        if user_id in self.active_connections:
            self.last_heartbeat[user_id] = datetime.now()
            logger.debug(f"更新用戶 {user_id} 的心跳時間")

    async def _heartbeat_checker(self):
        """
        定期檢查心跳超時的連接（背景任務）
        """
        logger.info("心跳檢查任務已啟動")

        while True:
            try:
                await asyncio.sleep(self.heartbeat_check_interval)

                if not self.active_connections:
                    continue

                now = datetime.now()
                timeout_users = []

                # 檢查所有連接的心跳時間
                for user_id, last_time in self.last_heartbeat.items():
                    if (now - last_time).total_seconds() > self.heartbeat_timeout:
                        timeout_users.append(user_id)
                        logger.warning(f"用戶 {user_id} 心跳超時")

                # 斷開超時的連接
                for user_id in timeout_users:
                    await self.disconnect(user_id)

            except asyncio.CancelledError:
                logger.info("心跳檢查任務已取消")
                break
            except Exception as e:
                logger.error(f"心跳檢查時發生錯誤: {str(e)}")

    def get_online_user_ids(self) -> Set[int]:
        """
        獲取所有在線用戶的 ID

        Returns:
            在線用戶 ID 集合
        """
        return set(self.active_connections.keys())

    def get_online_count(self) -> int:
        """
        獲取在線用戶數量

        Returns:
            在線用戶數量
        """
        return len(self.active_connections)

    async def shutdown(self):
        """
        關閉所有連接（應用關閉時調用）
        """
        logger.info("正在關閉所有 WebSocket 連接...")

        # 取消心跳檢查任務
        if self.heartbeat_task:
            self.heartbeat_task.cancel()
            try:
                await self.heartbeat_task
            except asyncio.CancelledError:
                pass

        # 關閉所有連接
        for user_id, websocket in list(self.active_connections.items()):
            try:
                await websocket.close()
            except Exception as e:
                logger.error(f"關閉用戶 {user_id} 連接時發生錯誤: {str(e)}")

        self.active_connections.clear()
        self.last_heartbeat.clear()

        logger.info("所有 WebSocket 連接已關閉")


# 全局連接管理器實例
connection_manager = ConnectionManager()
