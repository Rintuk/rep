import asyncio
from database import AsyncSessionLocal
from models import ForexBotSnapshot
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as session:
        snap = (await session.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        if snap:
            print(f"net_invested = {snap.net_invested}")
            print(f"real_start_balance = {snap.real_start_balance}")
            print(f"hwm = {snap.hwm}")

asyncio.run(main())
