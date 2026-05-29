import asyncio
import os
import json
from sqlalchemy.ext.asyncio import AsyncSession
from database import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("SELECT user_id, forex_investment_usdt, forex_entry_pool_pnl_pct, locked_forex_pnl FROM user_financials WHERE forex_investment_usdt > 0"))
        rows = res.fetchall()
        for r in rows:
            print(dict(r))

if __name__ == "__main__":
    asyncio.run(main())
