from fastapi import WebSocket
from typing import Dict, List

class ConnectionManager:
    def __init__(self):
        # Maps user_id to a list of active WebSocket connections
        # A user can be connected from multiple tabs/devices
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: str):
        """Sends a JSON message to a specific user (all their active connections)."""
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"Error sending message to {user_id}: {e}")

    async def broadcast_to_users(self, user_ids: List[str], message: dict):
        """Broadcasts a message to a specific list of users."""
        for user_id in user_ids:
            await self.send_personal_message(message, user_id)
            
    async def broadcast_to_conversation(self, conversation_id: str, message: dict, db):
        """Broadcasts a message to all participants of a conversation."""
        from sqlalchemy.future import select
        from app.models import ConversationParticipant
        
        part_res = await db.execute(
            select(ConversationParticipant.user_id)
            .where(ConversationParticipant.conversation_id == conversation_id)
        )
        participant_ids = [row[0] for row in part_res.all()]
        await self.broadcast_to_users(participant_ids, message)

manager = ConnectionManager()
