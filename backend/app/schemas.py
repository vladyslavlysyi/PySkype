from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum
import re

class UserStatus(str, Enum):
    ONLINE = "ONLINE"
    AWAY = "AWAY"
    DO_NOT_DISTURB = "DO_NOT_DISTURB"
    OFFLINE = "OFFLINE"

class ConversationType(str, Enum):
    DIRECT = "DIRECT"
    GROUP = "GROUP"

# --- User Schemas ---
class UserBase(BaseModel):
    username: str
    email: EmailStr
    description: Optional[str] = ""

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    
    @field_validator('password')
    def password_complexity(cls, v):
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    phone_number: Optional[str] = None
    birthday: Optional[str] = None
    theme_color: Optional[str] = None
    global_chat_bg: Optional[str] = None

class UserResponse(UserBase):
    id: str
    avatar_url: Optional[str] = None
    phone_number: Optional[str] = None
    birthday: Optional[str] = None
    theme_color: Optional[str] = None
    global_chat_bg: Optional[str] = None
    status: UserStatus
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Message Schemas ---
class MessageBase(BaseModel):
    content: str | None = Field(None, max_length=10000)

class MessageCreate(MessageBase):
    conversation_id: str
    reply_to_message_id: Optional[str] = None

class MessageUpdate(BaseModel):
    content: str = Field(..., max_length=10000)

class MessageReactionToggle(BaseModel):
    emoji: str = Field(..., max_length=10)

class MessageReactionResponse(BaseModel):
    emoji: str
    user_id: str
    created_at: datetime
    user: UserResponse

    class Config:
        from_attributes = True

class MessagePreview(BaseModel):
    id: str
    sender_id: str
    content: str | None
    is_deleted: bool = False
    
    class Config:
        from_attributes = True

class MessageResponse(MessageBase):
    id: str
    conversation_id: str
    sender_id: str
    is_read: bool = False
    created_at: datetime
    is_edited: bool = False
    edited_at: Optional[datetime] = None
    deleted_by: str = ""
    reply_to_message_id: Optional[str] = None
    reply_to_message: Optional[MessagePreview] = None
    reactions: List[MessageReactionResponse] = []
    sender: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class CreateChatRequest(BaseModel):
    targetUserId: str

class CreateGroupRequest(BaseModel):
    name: str = Field(..., max_length=100)
    member_ids: List[str]
    avatar_url: Optional[str] = None

class ManageMembersRequest(BaseModel):
    member_ids: List[str]

# --- Conversation Schemas ---
class ConversationParticipantResponse(BaseModel):
    user: UserResponse
    joined_at: datetime
    is_pinned: bool = False
    chat_bg: Optional[str] = None
    role: str = "member"

    class Config:
        from_attributes = True

class ConversationResponse(BaseModel):
    id: str
    type: ConversationType
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime
    participants: List[ConversationParticipantResponse]
    last_message: Optional[dict] = None

    class Config:
        from_attributes = True

class PinnedMessageResponse(BaseModel):
    id: str
    message_id: str
    pinned_by: str
    pinned_at: datetime
    message: Optional[MessageResponse] = None
    
    class Config:
        from_attributes = True

class ChatResponse(BaseModel):
    conversation: ConversationResponse

# --- Auth Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class AuthResponse(BaseModel):
    user: UserResponse
