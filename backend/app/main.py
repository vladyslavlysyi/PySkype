from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routes import auth, users, chats, upload
from .sockets import endpoints
import os
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Skype Clone API", version="1.0.0")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
            await conn.execute(text("ALTER TABLE users ADD COLUMN phone_number VARCHAR;"))
        except Exception:
            pass
            
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN birthday VARCHAR;"))
        except Exception:
            pass
            
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN theme_color VARCHAR;"))
        except Exception:
            pass

@app.get("/health")
def health_check():
    return {"status": "ok"}
