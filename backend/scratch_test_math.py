import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models import UserFinancials, BotSnapshot, Position, ForexBotSnapshot, User
from database import async_session

async def test_math():
    async with async_session() as db:
        # Get pool stats
        snap = (await db.execute(select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        if snap:
            print(f"CRYPTO SNAP: Balance: {snap.balance_usdt}, Net Invested: {snap.net_invested}")
            
        forex_snap = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        if forex_snap:
            print(f"FOREX SNAP: Balance: {forex_snap.balance_usdt}, Net Invested: {forex_snap.net_invested}")
            
        fins = (await db.execute(select(UserFinancials))).scalars().all()
        for f in fins:
            user = (await db.execute(select(User).where(User.id == f.user_id))).scalar_one_or_none()
            name = user.email if user else "Unknown"
            print(f"User: {name} | Crypto Inv: {f.investment_usdt} | Crypto Entry: {f.entry_pool_pnl_pct}% | Forex Inv: {f.forex_investment_usdt} | Forex Entry: {f.forex_entry_pool_pnl_pct}%")

if __name__ == "__main__":
    asyncio.run(test_math())
