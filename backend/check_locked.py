import asyncio
from database import AsyncSessionLocal
from models import UserFinancials
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as session:
        fins = (await session.execute(select(UserFinancials))).scalars().all()
        for f in fins:
            if getattr(f, "locked_forex_pnl", 0.0) != 0.0:
                print(f"User {f.user_id}: locked_forex_pnl = {f.locked_forex_pnl}")
        print(f"Total locked_forex_pnl: {sum(f.locked_forex_pnl for f in fins if getattr(f, 'locked_forex_pnl', 0.0) != 0.0)}")

asyncio.run(main())
