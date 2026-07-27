import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from ..database import AsyncSessionLocal
from ..models import User, Message, UserStatus, ConversationParticipant, MessageReaction
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
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    # Fallback to cookie if token is not in query params
    if not token:
        cookie_token = websocket.cookies.get("access_token")
        if cookie_token and cookie_token.startswith("Bearer "):
            token = cookie_token.split(" ")[1]

    if not token:
        await websocket.close(code=1008)
        return

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

    import os
    import redis.asyncio as aioredis
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    redis_client = aioredis.from_url(redis_url)

    try:
        while True:
            data = await websocket.receive_text()
            if len(data) > 65536: # 64KB limit
                await websocket.close(code=1009)
                break
                
            # Rate limiting: max 5 messages per second via Redis
            rl_key = f"ratelimit:ws:{user_id}"
            try:
                current = await redis_client.incr(rl_key)
                if current == 1:
                    await redis_client.expire(rl_key, 1)
                if current > 5:
                    await websocket.send_json({"type": "error", "payload": "Rate limit exceeded"})
                    continue
            except Exception as e:
                print(f"Redis error: {e}")
                # Fail open if Redis is down
                pass

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
                    reply_to_message_id = payload.get("reply_to_message_id")
                    
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
                        new_msg = Message(
                            conversation_id=conversation_id, 
                            sender_id=user_id, 
                            content=content,
                            reply_to_message_id=reply_to_message_id
                        )
                        session.add(new_msg)
                        await session.commit()
                        await session.refresh(new_msg)
                        
                        # Load sender details for UI
                        result = await session.execute(
                            select(Message)
                            .where(Message.id == new_msg.id)
                            .options(
                                selectinload(Message.sender),
                                selectinload(Message.reply_to_message),
                                selectinload(Message.reactions).selectinload(MessageReaction.user)
                            )
                        )
                        loaded_msg = result.scalars().first()
                        
                        # Get all other participants to send to
                        part_result = await session.execute(
                            select(ConversationParticipant)
                            .where(ConversationParticipant.conversation_id == conversation_id)
                            .where(ConversationParticipant.user_id != user_id)
                        )
                        partners = part_result.scalars().all()
                        
                        from ..schemas import MessageResponse
                        msg_payload = MessageResponse.model_validate(loaded_msg).model_dump(mode='json')

                    # Send to target participants and back to self
                    for p in partners:
                        await manager.send_personal_message({
                            "type": "receive_message",
                            "payload": msg_payload
                        }, p.user_id)
                    
                    await manager.send_personal_message({
                        "type": "receive_message",
                        "payload": msg_payload
                    }, user_id)

                elif event_type == "mark_read":
                    conversation_id = payload.get("conversation_id")
                    if conversation_id:
                        async with AsyncSessionLocal() as session:
                            # Verify participant
                            part_result = await session.execute(
                                select(ConversationParticipant)
                                .where(ConversationParticipant.conversation_id == conversation_id)
                                .where(ConversationParticipant.user_id == user_id)
                            )
                            if not part_result.scalars().first():
                                continue # Not a participant
                                
                            # Update all messages in this conversation not sent by this user
                            from sqlalchemy import update
                            stmt = (
                                update(Message)
                                .where(Message.conversation_id == conversation_id)
                                .where(Message.sender_id != user_id)
                                .where(Message.is_read == False)
                                .values(is_read=True)
                            )
                            result = await session.execute(stmt)
                            await session.commit()
                            
                            # If any rows were updated, notify the other participants
                            if result.rowcount > 0:
                                # Get all participants to notify
                                part_result = await session.execute(
                                    select(ConversationParticipant)
                                    .where(ConversationParticipant.conversation_id == conversation_id)
                                    .where(ConversationParticipant.user_id != user_id)
                                )
                                partners = part_result.scalars().all()
                                for p in partners:
                                    await manager.send_personal_message({
                                        "type": "messages_read",
                                        "payload": {
                                            "conversation_id": conversation_id,
                                            "read_by": user_id
                                        }
                                    }, p.user_id)

                elif event_type == "delete_messages":
                    message_ids = payload.get("message_ids", [])
                    for_everyone = payload.get("for_everyone", False)
                    conversation_id = payload.get("conversation_id")
                    
                    if message_ids and conversation_id:
                        async with AsyncSessionLocal() as session:
                            # Verify participant
                            part_result = await session.execute(
                                select(ConversationParticipant)
                                .where(ConversationParticipant.conversation_id == conversation_id)
                                .where(ConversationParticipant.user_id == user_id)
                            )
                            if not part_result.scalars().first():
                                continue
                                
                            # Fetch all messages
                            from sqlalchemy import update, delete
                            msg_result = await session.execute(
                                select(Message)
                                .where(Message.id.in_(message_ids))
                                .where(Message.conversation_id == conversation_id)
                            )
                            msgs = msg_result.scalars().all()
                            
                            deleted_ids = []
                            for msg in msgs:
                                if for_everyone and msg.sender_id == user_id:
                                    # Hard delete for own messages
                                    await session.delete(msg)
                                    deleted_ids.append(msg.id)
                                elif not for_everyone:
                                    # Delete for me only
                                    deleted_by = msg.deleted_by or ""
                                    if f",{user_id}," not in deleted_by:
                                        msg.deleted_by = f"{deleted_by},{user_id}," if deleted_by else f",{user_id},"
                                    deleted_ids.append(msg.id)
                                    
                            await session.commit()
                            
                            if not deleted_ids:
                                continue
                                
                            if for_everyone:
                                # Notify everyone about deleted_ids
                                part_result = await session.execute(
                                    select(ConversationParticipant)
                                    .where(ConversationParticipant.conversation_id == conversation_id)
                                )
                                partners = part_result.scalars().all()
                                for p in partners:
                                    await manager.send_personal_message({
                                        "type": "messages_deleted",
                                        "payload": {
                                            "message_ids": deleted_ids,
                                            "conversation_id": conversation_id
                                        }
                                    }, p.user_id)
                            else:
                                # Notify only me
                                await manager.send_personal_message({
                                    "type": "messages_deleted",
                                    "payload": {
                                        "message_ids": deleted_ids,
                                        "conversation_id": conversation_id
                                    }
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
