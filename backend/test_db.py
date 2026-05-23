import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from database import engine

async def run():
    async with engine.begin() as conn:
        print('DB connection successful')

asyncio.run(run())
