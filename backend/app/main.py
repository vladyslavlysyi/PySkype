from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routes import auth, users, chats, upload
from .sockets import endpoints
import os
from fastapi.staticfiles import StaticFiles

from slowapi.errors import RateLimitExceeded
from fastapi import Request
from .limiter import limiter

app = FastAPI(title="Skype Clone API", version="1.0.0")
app.state.limiter = limiter
from slowapi import _rate_limit_exceeded_handler
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost").split(",")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import HTTPException

@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
        if not request.url.path.startswith("/api/auth/"):
            csrf_cookie = request.cookies.get("csrf_token")
            csrf_header = request.headers.get("x-csrf-token")
            if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
                from fastapi.responses import JSONResponse
                return JSONResponse(status_code=403, content={"detail": "CSRF token missing or invalid"})
    response = await call_next(request)
    return response

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/uploads/"):
        response.headers["Content-Security-Policy"] = "default-src 'none'; media-src 'self'; img-src 'self';"
        response.headers["X-Content-Type-Options"] = "nosniff"
        if response.headers.get("Content-Type") in ["text/html", "image/svg+xml"]:
            response.headers["Content-Type"] = "application/octet-stream"
    return response

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include Routers
from .routes import auth, users, chats, upload, messages
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(chats.router)
app.include_router(messages.router)
app.include_router(upload.router, prefix="/api/upload", tags=["Upload"])
app.include_router(endpoints.router, prefix="/api")

@app.on_event("startup")
async def startup():
    from sqlalchemy import text
    # create db tables if they don't exist
    async with engine.begin() as conn:
        # In production, use Alembic migrations instead of create_all
        await conn.run_sync(Base.metadata.create_all)
        
        # Auto-migrate new columns
        
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE users ADD COLUMN phone_number VARCHAR;"))
    except Exception:
        pass
        
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE users ADD COLUMN birthday VARCHAR;"))
    except Exception:
        pass
        
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE users ADD COLUMN theme_color VARCHAR;"))
    except Exception:
        pass
        
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE messages ADD COLUMN deleted_by VARCHAR DEFAULT '';"))
    except Exception:
        pass

    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE messages ADD COLUMN is_read BOOLEAN DEFAULT FALSE;"))
    except Exception:
        pass

    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE users ADD COLUMN global_chat_bg VARCHAR;"))
    except Exception:
        pass

    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE conversation_participants ADD COLUMN chat_bg VARCHAR;"))
    except Exception:
        pass

    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE messages ADD COLUMN is_edited BOOLEAN DEFAULT FALSE;"))
    except Exception:
        pass

    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE messages ADD COLUMN edited_at TIMESTAMP WITH TIME ZONE;"))
    except Exception:
        pass

    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE messages ADD COLUMN reply_to_message_id VARCHAR REFERENCES messages(id) ON DELETE SET NULL;"))
    except Exception:
        pass

    try:
        async with engine.begin() as conn:
            # Postgres specific: add GROUP to enum if not exists
            await conn.execute(text("ALTER TYPE conversationtype ADD VALUE IF NOT EXISTS 'GROUP';"))
    except Exception:
        pass

import traceback
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import Depends
from .database import get_db
from .models import Message, MessageReaction

@app.get("/api/debug_messages")
async def debug_messages(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(
            select(Message)
            .options(
                selectinload(Message.sender),
                selectinload(Message.reply_to_message),
                selectinload(Message.reactions).selectinload(MessageReaction.user)
            )
            .limit(10)
        )
        msgs = result.scalars().all()
        from .schemas import MessageResponse
        res = []
        for m in msgs:
            try:
                res.append(MessageResponse.model_validate(m).model_dump(mode='json'))
            except Exception as e:
                res.append({"error": str(e), "trace": traceback.format_exc(), "msg_id": m.id})
        return {"status": "ok", "messages": res}
    except Exception as e:
        return {"status": "error", "error": str(e), "trace": traceback.format_exc()}

@app.get("/health")
def health_check():
    return {"status": "ok"}
