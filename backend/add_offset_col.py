import asyncio
from sqlalchemy import text
from database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text('ALTER TABLE global_settings ADD COLUMN forex_pnl_offset FLOAT DEFAULT 0.0'))
            await db.commit()
            print("Column forex_pnl_offset added")
        except Exception as e:
            print("forex_pnl_offset error:", e)
            
        try:
            await db.execute(text('ALTER TABLE global_settings ADD COLUMN crypto_pnl_offset FLOAT DEFAULT 0.0'))
            await db.commit()
            print("Column crypto_pnl_offset added")
        except Exception as e:
            print("crypto_pnl_offset error:", e)

if __name__ == '__main__':
    asyncio.run(main())
