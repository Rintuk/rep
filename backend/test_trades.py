import asyncio
from database import async_session
from models import ForexTrade
from sqlalchemy import select

async def check():
    async with async_session() as db:
        trades = (await db.execute(select(ForexTrade).order_by(ForexTrade.timestamp.desc()).limit(10))).scalars().all()
        for t in trades:
            print(f"Trade: {t.symbol} {t.action} {t.amount} {t.price} PNL: {t.pnl} Time: {t.timestamp}")

if __name__ == '__main__':
    asyncio.run(check())
