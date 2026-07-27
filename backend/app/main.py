from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routes import auth, users, chats, upload
from .sockets import endpoints
import os
from fastapi.staticfiles import StaticFiles

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Skype Clone API", version="1.0.0")
app.state.limiter = limiter
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
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(chats.router)
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

@app.get("/health")
def health_check():
    return {"status": "ok"}
