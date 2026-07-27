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
        .options(
            selectinload(Message.sender),
            selectinload(Message.reply_to_message),
            selectinload(Message.reactions).selectinload(MessageReaction.user)
        )
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

from ..models import ConversationType, PinnedMessage
from ..schemas import CreateGroupRequest, ManageMembersRequest, PinnedMessageResponse

@router.post("/group", response_model=ChatResponse)
async def create_group_chat(req: CreateGroupRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if len(req.member_ids) > 200:
        raise HTTPException(status_code=400, detail="Maximum 200 members allowed")
    
    # Create conversation
    conv = Conversation(type=ConversationType.GROUP)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    
    # Add creator as owner
    owner_part = ConversationParticipant(
        user_id=current_user.id,
        conversation_id=conv.id,
        role="owner"
    )
    db.add(owner_part)
    
    # Add other members
    for uid in set(req.member_ids):
        if uid != current_user.id:
            # Check user exists
            usr_result = await db.execute(select(User).where(User.id == uid))
            if usr_result.scalars().first():
                db.add(ConversationParticipant(
                    user_id=uid,
                    conversation_id=conv.id,
                    role="member"
                ))
    
    await db.commit()
    
    # Fetch full conversation
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conv.id)
        .options(selectinload(Conversation.participants).selectinload(ConversationParticipant.user))
    )
    return {"conversation": result.scalars().first()}

@router.get("/{conversation_id}/messages/search", response_model=List[MessageResponse])
async def search_messages(conversation_id: str, q: str, limit: int = 20, offset: int = 0, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not q or len(q) > 200:
        raise HTTPException(status_code=400, detail="Invalid search query")
        
    # Check access using SQL Join
    has_access = await db.execute(
        select(1)
        .select_from(ConversationParticipant)
        .where(ConversationParticipant.conversation_id == conversation_id)
        .where(ConversationParticipant.user_id == current_user.id)
    )
    if not has_access.scalar():
        raise HTTPException(status_code=403, detail="Access denied")
        
    query = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .where(Message.deleted_by == "")
        .where(func.to_tsvector('english', Message.content).op('@@')(func.plainto_tsquery('english', q)))
        .options(
            selectinload(Message.sender),
            selectinload(Message.reply_to_message),
            selectinload(Message.reactions).selectinload(MessageReaction.user)
        )
        .order_by(Message.created_at.desc())
        .limit(min(limit, 100))
        .offset(offset)
    )
    
    result = await db.execute(query)
    messages = result.scalars().all()
    
    # Reverse to return chronological order or leave as desc (search usually desc)
    return messages

@router.post("/{conversation_id}/messages/{message_id}/pin", response_model=PinnedMessageResponse)
async def pin_message(conversation_id: str, message_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Check participant and role
    part_result = await db.execute(
        select(ConversationParticipant)
        .options(selectinload(ConversationParticipant.conversation))
        .where(ConversationParticipant.conversation_id == conversation_id)
        .where(ConversationParticipant.user_id == current_user.id)
    )
    participant = part_result.scalars().first()
    
    if not participant:
        raise HTTPException(status_code=403, detail="Not a participant")
        
    if participant.conversation.type == ConversationType.GROUP and participant.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only owner or admin can pin in groups")
        
    # Check max pins
    count_res = await db.execute(
        select(func.count(PinnedMessage.id))
        .where(PinnedMessage.conversation_id == conversation_id)
    )
    if count_res.scalar() >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 pinned messages allowed")
        
    # Check if already pinned
    existing_res = await db.execute(
        select(PinnedMessage)
        .where(PinnedMessage.message_id == message_id)
    )
    if existing_res.scalars().first():
        raise HTTPException(status_code=400, detail="Message already pinned")
        
    # Check if message exists in this conv
    msg_res = await db.execute(
        select(Message)
        .where(Message.id == message_id)
        .where(Message.conversation_id == conversation_id)
    )
    if not msg_res.scalars().first():
        raise HTTPException(status_code=404, detail="Message not found in this conversation")
        
    new_pin = PinnedMessage(
        conversation_id=conversation_id,
        message_id=message_id,
        pinned_by=current_user.id
    )
    db.add(new_pin)
    await db.commit()
    await db.refresh(new_pin)
    
    # Need to load message and pinner
    final_res = await db.execute(
        select(PinnedMessage)
        .where(PinnedMessage.id == new_pin.id)
        .options(
            selectinload(PinnedMessage.message),
            selectinload(PinnedMessage.pinner)
        )
    )
    
    from ..sockets.manager import manager
    if hasattr(manager, 'broadcast_to_conversation'):
        await manager.broadcast_to_conversation(conversation_id, {
            "type": "message_pinned",
            "payload": {"message_id": message_id}
        }, db)
    
    return final_res.scalars().first()

@router.delete("/{conversation_id}/messages/{message_id}/pin")
async def unpin_message(conversation_id: str, message_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    part_result = await db.execute(
        select(ConversationParticipant)
        .options(selectinload(ConversationParticipant.conversation))
        .where(ConversationParticipant.conversation_id == conversation_id)
        .where(ConversationParticipant.user_id == current_user.id)
    )
    participant = part_result.scalars().first()
    
    if not participant:
        raise HTTPException(status_code=403, detail="Not a participant")
        
    if participant.conversation.type == ConversationType.GROUP and participant.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only owner or admin can unpin in groups")
        
    existing_res = await db.execute(
        select(PinnedMessage)
        .where(PinnedMessage.message_id == message_id)
        .where(PinnedMessage.conversation_id == conversation_id)
    )
    existing = existing_res.scalars().first()
    if not existing:
        raise HTTPException(status_code=404, detail="Pinned message not found")
        
    await db.delete(existing)
    await db.commit()
    
    from ..sockets.manager import manager
    if hasattr(manager, 'broadcast_to_conversation'):
        await manager.broadcast_to_conversation(conversation_id, {
            "type": "message_unpinned",
            "payload": {"message_id": message_id}
        }, db)
    
    return {"status": "success"}

@router.post("/{conversation_id}/members")
async def add_group_members(conversation_id: str, req: ManageMembersRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    part_result = await db.execute(
        select(ConversationParticipant)
        .options(selectinload(ConversationParticipant.conversation))
        .where(ConversationParticipant.conversation_id == conversation_id)
        .where(ConversationParticipant.user_id == current_user.id)
    )
    participant = part_result.scalars().first()
    
    if not participant or participant.conversation.type != ConversationType.GROUP:
        raise HTTPException(status_code=400, detail="Invalid group or not a participant")
        
    if participant.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only owner or admin can add members")
        
    count_res = await db.execute(select(func.count(ConversationParticipant.user_id)).where(ConversationParticipant.conversation_id == conversation_id))
    current_count = count_res.scalar()
    
    if current_count + len(req.member_ids) > 200:
        raise HTTPException(status_code=400, detail="Maximum 200 members allowed")
        
    added = []
    for uid in set(req.member_ids):
        # Check if already in group
        ext_res = await db.execute(
            select(1).where(ConversationParticipant.conversation_id == conversation_id).where(ConversationParticipant.user_id == uid)
        )
        if not ext_res.scalar():
            usr_result = await db.execute(select(User).where(User.id == uid))
            usr = usr_result.scalars().first()
            if usr:
                new_part = ConversationParticipant(user_id=uid, conversation_id=conversation_id, role="member")
                db.add(new_part)
                added.append(uid)
                
    await db.commit()
    return {"status": "success", "added_count": len(added)}
