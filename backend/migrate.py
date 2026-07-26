import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgrespassword@localhost:5432/skype_clone")

async def migrate():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN phone_number VARCHAR;"))
            print("Added phone_number column")
        except Exception as e:
            print("phone_number column might already exist:", e)

        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN birthday VARCHAR;"))
            print("Added birthday column")
        except Exception as e:
            print("birthday column might already exist:", e)
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
