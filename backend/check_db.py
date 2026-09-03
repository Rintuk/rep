import asyncio
from database import AsyncSessionLocal
from models import ForexBotSnapshot, UserFinancials
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as session:
        snap = (await session.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        if snap:
            print(f"snap.net_invested = {snap.net_invested}")
        else:
            print("No snap")
        
        fins = (await session.execute(select(UserFinancials))).scalars().all()
        total_inv = sum(f.forex_investment_usdt for f in fins)
        print(f"total_invested = {total_inv}")

asyncio.run(main())
