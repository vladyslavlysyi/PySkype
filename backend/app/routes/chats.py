from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from ..database import get_db
from ..models import User, Conversation, ConversationParticipant, Message
from ..schemas import ConversationResponse, MessageResponse, CreateChatRequest, ChatResponse
from .deps import get_current_user

router = APIRouter(prefix="/api/chats", tags=["chats"])

@router.post("", response_model=ChatResponse)
async def create_or_get_chat(req: CreateChatRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    target_user_id = req.targetUserId
    
    # Check if target user exists
    target_result = await db.execute(select(User).where(User.id == target_user_id))
    target_user = target_result.scalars().first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if a direct conversation already exists between the two
    # A bit complex in SQL, let's find a conversation where both are participants and type is DIRECT
    stmt = (
        select(Conversation)
        .join(ConversationParticipant)
        .where(Conversation.type == "DIRECT")
        .where(ConversationParticipant.user_id.in_([current_user.id, target_user_id]))
        .group_by(Conversation.id)
        .having(func.count(ConversationParticipant.user_id) == 2)
        .options(selectinload(Conversation.participants).selectinload(ConversationParticipant.user))
    )
    
    result = await db.execute(stmt)
    existing_conv = result.scalars().first()
    
    if existing_conv:
        return {"conversation": existing_conv}
        
    # Create new conversation
    new_conv = Conversation(type="DIRECT")
    db.add(new_conv)
    await db.commit()
    await db.refresh(new_conv)
    
    p1 = ConversationParticipant(user_id=current_user.id, conversation_id=new_conv.id)
    p2 = ConversationParticipant(user_id=target_user_id, conversation_id=new_conv.id)
    db.add_all([p1, p2])
    await db.commit()
    
    # Reload with participants
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == new_conv.id)
        .options(selectinload(Conversation.participants).selectinload(ConversationParticipant.user))
    )
    return {"conversation": result.scalars().first()}

@router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(conversation_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Verify participant
    part_result = await db.execute(
        select(ConversationParticipant)
        .where(ConversationParticipant.conversation_id == conversation_id)
        .where(ConversationParticipant.user_id == current_user.id)
    )
    if not part_result.scalars().first():
        raise HTTPException(status_code=403, detail="Not a participant of this conversation")
        
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .options(selectinload(Message.sender))
    )
    messages = result.scalars().all()
    # Filter out messages deleted by this user
    filtered_messages = [m for m in messages if m.deleted_by is None or f",{current_user.id}," not in m.deleted_by]
    # Reverse to get chronological order for UI
    return filtered_messages[::-1]

@router.post("/{conversation_id}/pin")
async def toggle_pin_chat(conversation_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Verify participant
    part_result = await db.execute(
        select(ConversationParticipant)
        .where(ConversationParticipant.conversation_id == conversation_id)
        .where(ConversationParticipant.user_id == current_user.id)
    )
    participant = part_result.scalars().first()
    if not participant:
        raise HTTPException(status_code=403, detail="Not a participant of this conversation")
    
    participant.is_pinned = not participant.is_pinned
    await db.commit()
    
    return {"status": "success", "is_pinned": participant.is_pinned}

@router.delete("/{conversation_id}")
async def delete_chat(conversation_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Verify participant
    part_result = await db.execute(
        select(ConversationParticipant)
        .where(ConversationParticipant.conversation_id == conversation_id)
        .where(ConversationParticipant.user_id == current_user.id)
    )
    participant = part_result.scalars().first()
    if not participant:
        raise HTTPException(status_code=403, detail="Not a participant of this conversation")
    
    # Soft-delete: Just remove the current user from the participants
    await db.delete(participant)
    await db.commit()
    
    # Check if there are any participants left. If none, we can safely delete the conversation and messages.
    part_count_result = await db.execute(
        select(func.count(ConversationParticipant.user_id))
        .where(ConversationParticipant.conversation_id == conversation_id)
    )
    count = part_count_result.scalar()
    
    if count == 0:
        conv_result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conv = conv_result.scalars().first()
        if conv:
            await db.delete(conv)
            await db.commit()
            
    return {"status": "success"}

from pydantic import BaseModel

class UpdateChatBgRequest(BaseModel):
    chat_bg: str | None = None

@router.put("/{conversation_id}/bg")
async def update_chat_bg(conversation_id: str, req: UpdateChatBgRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Verify participant
    part_result = await db.execute(
        select(ConversationParticipant)
        .where(ConversationParticipant.conversation_id == conversation_id)
        .where(ConversationParticipant.user_id == current_user.id)
    )
    participant = part_result.scalars().first()
    if not participant:
        raise HTTPException(status_code=403, detail="Not a participant of this conversation")
    
    participant.chat_bg = req.chat_bg
    await db.commit()
    
    return {"status": "success", "chat_bg": participant.chat_bg}
