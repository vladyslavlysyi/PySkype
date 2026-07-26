import enum
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class UserStatus(enum.Enum):
    ONLINE = "ONLINE"
    AWAY = "AWAY"
    DO_NOT_DISTURB = "DO_NOT_DISTURB"
    OFFLINE = "OFFLINE"

class ConversationType(enum.Enum):
    DIRECT = "DIRECT"
    GROUP = "GROUP"

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    description = Column(String, nullable=True, default='')
    phone_number = Column(String, nullable=True)
    birthday = Column(String, nullable=True)
    status = Column(Enum(UserStatus), default=UserStatus.OFFLINE, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    messages = relationship("Message", back_populates="sender", cascade="all, delete-orphan")
    conversations = relationship("ConversationParticipant", back_populates="user", cascade="all, delete-orphan")

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    type = Column(Enum(ConversationType), default=ConversationType.DIRECT, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    participants = relationship("ConversationParticipant", back_populates="conversation", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"

    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    is_pinned = Column(Boolean, default=False)

    user = relationship("User", back_populates="conversations")
    conversation = relationship("Conversation", back_populates="participants")

class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sender = relationship("User", back_populates="messages")
    conversation = relationship("Conversation", back_populates="messages")
