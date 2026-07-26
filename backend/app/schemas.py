from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum

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
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    phone_number: Optional[str] = None
    birthday: Optional[str] = None
    theme_color: Optional[str] = None

class UserResponse(UserBase):
    id: str
    avatar_url: Optional[str] = None
    phone_number: Optional[str] = None
    birthday: Optional[str] = None
    theme_color: Optional[str] = None
    status: UserStatus
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Message Schemas ---
class MessageBase(BaseModel):
    content: str

class MessageCreate(MessageBase):
    conversation_id: str

class MessageResponse(MessageBase):
    id: str
    conversation_id: str
    sender_id: str
    is_read: bool = False
    created_at: datetime
    sender: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class CreateChatRequest(BaseModel):
    targetUserId: str

# --- Conversation Schemas ---
class ConversationParticipantResponse(BaseModel):
    user: UserResponse
    joined_at: datetime
    is_pinned: bool = False

    class Config:
        from_attributes = True

class ConversationResponse(BaseModel):
    id: str
    type: ConversationType
    created_at: datetime
    participants: List[ConversationParticipantResponse]
    last_message: Optional[dict] = None

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
    token: str
