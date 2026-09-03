import asyncio
from sqlalchemy import text
from database import async_session

async def check():
    async with async_session() as db:
        try:
            res = await db.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
            tables = [r[0] for r in res.fetchall()]
            print("Tables:", tables)
        except Exception as e:
            print("Error:", e)

if __name__ == '__main__':
    asyncio.run(check())
