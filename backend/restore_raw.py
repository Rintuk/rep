import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:WvVpTjRydwDqINaJkQCLYhLhNrtGqBIs@autorack.proxy.rlwy.net:45887/railway"

async def main():
    engine = create_async_engine(DATABASE_URL, echo=False, connect_args={"ssl": False})
    async with engine.begin() as conn:
        res = await conn.execute(text("UPDATE user_financials SET forex_entry_pool_pnl_pct = 0.0, locked_forex_pnl = 0.0 WHERE forex_investment_usdt > 0"))
        print(f"Обновлено инвесторов: {res.rowcount}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
