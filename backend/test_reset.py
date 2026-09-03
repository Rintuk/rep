import asyncio
import sys
sys.path.append('c:\\temp\\maklersite\\backend')
from database import async_session
from models import AdminProfitLog
from sqlalchemy import select, update

async def main():
    async with async_session() as db:
        logs = (await db.execute(select(AdminProfitLog))).scalars().all()
        print("Before reset:")
        for l in logs:
            print(f"Date: {l.date}, Crypto: {l.crypto_profit}, Forex: {l.forex_profit}")
            
        await db.execute(update(AdminProfitLog).values(crypto_profit=0.0))
        await db.commit()
        
        logs = (await db.execute(select(AdminProfitLog))).scalars().all()
        print("After reset:")
        for l in logs:
            print(f"Date: {l.date}, Crypto: {l.crypto_profit}, Forex: {l.forex_profit}")

if __name__ == '__main__':
    asyncio.run(main())
