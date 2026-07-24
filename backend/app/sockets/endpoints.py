import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from ..database import AsyncSessionLocal
from ..models import User, Message, UserStatus, ConversationParticipant
from ..auth import decode_access_token
from .manager import manager

router = APIRouter()

async def get_user_from_token(token: str):
    payload = decode_access_token(token)
    if not payload:
        return None
    username = payload.get("sub")
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.username == username))
        return result.scalars().first()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str):
    user = await get_user_from_token(token)
    if not user:
        await websocket.close(code=1008)
        return

    user_id = user.id
    await manager.connect(user_id, websocket)

    # Broadcast ONLINE status
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        u = result.scalars().first()
        u.status = UserStatus.ONLINE
        await session.commit()
    
    await manager.broadcast({
        "type": "user_status_changed",
        "payload": {"user_id": user_id, "status": "ONLINE"}
    })

    try:
        while True:
            data = await websocket.receive_text()
            print(f"WS Received: {data}", flush=True)
            try:
                parsed_data = json.loads(data)
                event_type = parsed_data.get("type")
                target_user_id = parsed_data.get("target_user_id")
                payload = parsed_data.get("payload", {})

                if event_type == "update_status":
                    status_val = payload.get("status")
                    async with AsyncSessionLocal() as session:
                        result = await session.execute(select(User).where(User.id == user_id))
                        u = result.scalars().first()
                        u.status = getattr(UserStatus, status_val, UserStatus.ONLINE)
                        await session.commit()
                    await manager.broadcast({
                        "type": "user_status_changed",
                        "payload": {"user_id": user_id, "status": status_val}
                    })
                
                elif event_type == "send_message":
                    # Validate user is in conversation
                    conversation_id = payload.get("conversation_id")
                    content = payload.get("content")
                    async with AsyncSessionLocal() as session:
                        # Verify participant
                        part_result = await session.execute(
                            select(ConversationParticipant)
                            .where(ConversationParticipant.conversation_id == conversation_id)
                            .where(ConversationParticipant.user_id == user_id)
                        )
                        if not part_result.scalars().first():
                            # User not in conversation, ignore
                            continue

                        # Save to DB
                        new_msg = Message(conversation_id=conversation_id, sender_id=user_id, content=content)
                        session.add(new_msg)
                        await session.commit()
                        await session.refresh(new_msg)
                        
                        # Load sender details for UI
                        result = await session.execute(
                            select(Message)
                            .where(Message.id == new_msg.id)
                            .options(selectinload(Message.sender))
                        )
                        loaded_msg = result.scalars().first()
                        
                        msg_payload = {
                            "id": loaded_msg.id,
                            "conversation_id": loaded_msg.conversation_id,
                            "sender_id": loaded_msg.sender_id,
                            "content": loaded_msg.content,
                            "created_at": loaded_msg.created_at.isoformat(),
                            "sender": {
                                "id": loaded_msg.sender.id,
                                "username": loaded_msg.sender.username,
                                "avatar_url": loaded_msg.sender.avatar_url
                            }
                        }

                    # Send to target and back to self
                    if target_user_id:
                        await manager.send_personal_message({
                            "type": "receive_message",
                            "payload": msg_payload
                        }, target_user_id)
                    
                    await manager.send_personal_message({
                        "type": "receive_message",
                        "payload": msg_payload
                    }, user_id)

                # WebRTC Signaling routes
                elif event_type in ["call_offer", "call_answer", "ice_candidate", "end_call", "reject_call"]:
                    if target_user_id:
                        event_mapping = {
                            "call_offer": "incoming_call",
                            "call_answer": "call_accepted",
                            "ice_candidate": "ice_candidate_received",
                            "end_call": "call_ended",
                            "reject_call": "call_rejected"
                        }
                        
                        forward_payload = payload.copy()
                        if event_type in ["call_offer", "ice_candidate"]:
                            forward_payload["from"] = user_id
                            
                        await manager.send_personal_message({
                            "type": event_mapping[event_type],
                            "payload": forward_payload
                        }, target_user_id)

            except json.JSONDecodeError:
                pass
            except Exception as e:
                print(f"Error handling message: {e}", flush=True)

    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
        # Check if user has no more active connections
        if user_id not in manager.active_connections:
            async with AsyncSessionLocal() as session:
                result = await session.execute(select(User).where(User.id == user_id))
                u = result.scalars().first()
                if u:
                    u.status = UserStatus.OFFLINE
                    await session.commit()
            
            await manager.broadcast({
                "type": "user_status_changed",
                "payload": {"user_id": user_id, "status": "OFFLINE"}
            })
