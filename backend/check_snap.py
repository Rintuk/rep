import asyncio
from database import AsyncSessionLocal
from models import BotSnapshot, ForexBotSnapshot
from sqlalchemy.future import select

async def main():
    async with AsyncSessionLocal() as db:
        snap = (await db.execute(select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        print(f"Crypto: net_invested={snap.net_invested}, internal_reinvested={snap.internal_reinvested}")
        fsnap = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        if fsnap:
            print(f"Forex: net_invested={fsnap.net_invested}, internal_reinvested={fsnap.internal_reinvested}")
asyncio.run(main())
