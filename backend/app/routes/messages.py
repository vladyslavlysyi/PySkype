from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from datetime import datetime, timezone
import json

from ..database import get_db
from ..models import User, Message, MessageReaction, ConversationParticipant
from ..schemas import MessageResponse, MessageUpdate, MessageReactionToggle
from .deps import get_current_user
from ..sockets.manager import manager

router = APIRouter(prefix="/api/messages", tags=["messages"])

ALLOWED_EMOJIS = {"👍", "👎", "❤️", "😂", "😮", "😢", "🔥", "🎉"}

@router.patch("/{message_id}", response_model=MessageResponse)
async def edit_message(message_id: str, req: MessageUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 1. Fetch message
    result = await db.execute(
        select(Message)
        .where(Message.id == message_id)
        .options(
            selectinload(Message.sender),
            selectinload(Message.reply_to_message),
            selectinload(Message.reactions).selectinload(MessageReaction.user)
        )
    )
    msg = result.scalars().first()
    
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
        
    # 2. Authorization
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only edit own messages")
        
    # 3. Check if deleted
    if msg.deleted_by:
        raise HTTPException(status_code=400, detail="Cannot edit deleted message")
        
    # 4. Check time limit (48 hours)
    now = datetime.now(timezone.utc)
    if msg.created_at.tzinfo is None:
        msg_time = msg.created_at.replace(tzinfo=timezone.utc)
    else:
        msg_time = msg.created_at
        
    delta = now - msg_time
    if delta.total_seconds() > 48 * 3600:
        raise HTTPException(status_code=400, detail="Edit time limit expired (48 hours)")

    # 5. Sanitize and update (Frontend will render markdown safely, but we restrict length via pydantic)
    msg.content = req.content
    msg.is_edited = True
    msg.edited_at = func.now()
    
    await db.commit()
    await db.refresh(msg)
    
    # 6. Broadcast via WebSocket
    # We must only broadcast to participants
    part_res = await db.execute(
        select(ConversationParticipant.user_id)
        .where(ConversationParticipant.conversation_id == msg.conversation_id)
    )
    participant_ids = [row[0] for row in part_res.all()]
    
    # Convert to response dict for websocket
    msg_schema = MessageResponse.model_validate(msg)
    
    # The manager needs a method to broadcast to specific users
    if hasattr(manager, 'broadcast_to_users'):
        await manager.broadcast_to_users(participant_ids, {
            "type": "message_edited",
            "payload": msg_schema.model_dump(mode='json')
        })
    else:
        # Fallback if method not yet implemented
        await manager.broadcast({
            "type": "message_edited",
            "payload": msg_schema.model_dump(mode='json')
        })
    
    return msg

@router.post("/{message_id}/reactions")
async def toggle_reaction(message_id: str, req: MessageReactionToggle, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if req.emoji not in ALLOWED_EMOJIS:
        raise HTTPException(status_code=400, detail="Invalid emoji")
        
    # Verify message and access
    msg_result = await db.execute(select(Message).where(Message.id == message_id))
    msg = msg_result.scalars().first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
        
    part_result = await db.execute(
        select(ConversationParticipant)
        .where(ConversationParticipant.conversation_id == msg.conversation_id)
        .where(ConversationParticipant.user_id == current_user.id)
    )
    if not part_result.scalars().first():
        raise HTTPException(status_code=403, detail="Not a participant")
        
    # Toggle reaction in one transaction
    async with db.begin_nested():
        existing_result = await db.execute(
            select(MessageReaction)
            .where(MessageReaction.message_id == message_id)
            .where(MessageReaction.user_id == current_user.id)
            .where(MessageReaction.emoji == req.emoji)
            .with_for_update()
        )
        existing = existing_result.scalars().first()
        
        if existing:
            await db.delete(existing)
            action = "removed"
        else:
            new_reaction = MessageReaction(
                message_id=message_id,
                user_id=current_user.id,
                emoji=req.emoji
            )
            db.add(new_reaction)
            action = "added"
            
    await db.commit()
    
    # Aggregate counts for broadcast
    agg_result = await db.execute(
        select(MessageReaction.emoji, func.count(MessageReaction.id))
        .where(MessageReaction.message_id == message_id)
        .group_by(MessageReaction.emoji)
    )
    reaction_counts = {row[0]: row[1] for row in agg_result.all()}
    
    # Get participant IDs for broadcast
    part_res = await db.execute(
        select(ConversationParticipant.user_id)
        .where(ConversationParticipant.conversation_id == msg.conversation_id)
    )
    participant_ids = [row[0] for row in part_res.all()]
    
    payload = {
        "message_id": message_id,
        "reaction_counts": reaction_counts,
        "user_id": current_user.id,
        "emoji": req.emoji,
        "action": action
    }
    
    if hasattr(manager, 'broadcast_to_users'):
        await manager.broadcast_to_users(participant_ids, {
            "type": "reaction_updated",
            "payload": payload
        })
    else:
        await manager.broadcast({
            "type": "reaction_updated",
            "payload": payload
        })
    
    return {"status": "success", "action": action, "counts": reaction_counts}

@router.delete("/{message_id}")
async def delete_message(message_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Message).where(Message.id == message_id))
    msg = result.scalars().first()
    
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
        
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only delete own messages")
        
    msg.content = "This message was deleted"
    msg.deleted_by = current_user.id
    await db.commit()
    
    part_res = await db.execute(
        select(ConversationParticipant.user_id)
        .where(ConversationParticipant.conversation_id == msg.conversation_id)
    )
    participant_ids = [row[0] for row in part_res.all()]
    
    if hasattr(manager, 'broadcast_to_users'):
        await manager.broadcast_to_users(participant_ids, {
            "type": "message_deleted",
            "payload": {"message_id": message_id}
        })
    
    return {"status": "success"}
