import asyncio
from sqlalchemy import text
import sys
sys.path.append('c:\\temp\\maklersite\\backend')
from database import async_session

async def patch():
    async with async_session() as db:
        try:
            await db.execute(text("ALTER TABLE users ADD COLUMN last_read_news_at DATETIME"))
            await db.commit()
            print("Successfully added last_read_news_at to users.")
        except Exception as e:
            print("Failed (might already exist):", e)

if __name__ == '__main__':
    asyncio.run(patch())
