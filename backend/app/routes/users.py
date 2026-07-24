from fastapi import APIRouter, Depends
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..database import get_db
from ..models import User
from ..schemas import UserResponse
from .deps import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/search", response_model=List[UserResponse])
async def search_users(q: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not q:
        return []
    
    result = await db.execute(
        select(User)
        .where(User.username.ilike(f"%{q}%"))
        .where(User.id != current_user.id)
        .limit(20)
    )
    users = result.scalars().all()
    return users

from sqlalchemy.orm import selectinload
from ..models import Conversation, ConversationParticipant, Message
from ..schemas import ConversationResponse

@router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Find conversations where the user is a participant and the conversation has at least one message
    result = await db.execute(
        select(Conversation)
        .join(ConversationParticipant)
        .join(Message, Message.conversation_id == Conversation.id)
        .where(ConversationParticipant.user_id == current_user.id)
        .group_by(Conversation.id)
        .options(
            selectinload(Conversation.participants).selectinload(ConversationParticipant.user)
        )
    )
    conversations = result.scalars().all()
    return conversations

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

from ..schemas import UserUpdate
from ..auth import get_password_hash

@router.put("/me", response_model=UserResponse)
async def update_me(
    user_update: UserUpdate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    if user_update.username is not None:
        current_user.username = user_update.username
    if user_update.email is not None:
        current_user.email = user_update.email
    if user_update.description is not None:
        current_user.description = user_update.description
    if user_update.avatar_url is not None:
        current_user.avatar_url = user_update.avatar_url
    if user_update.password is not None and user_update.password != "":
        current_user.hashed_password = get_password_hash(user_update.password)
        
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user
