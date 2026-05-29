import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:WvVpTjRydwDqINaJkQCLYhLhNrtGqBIs@autorack.proxy.rlwy.net:45887/railway"

async def main():
    engine = create_async_engine(DATABASE_URL, echo=False, connect_args={"ssl": False})
    async with engine.begin() as conn:
        res = await conn.execute(text("""
            SELECT u.email, f.forex_investment_usdt 
            FROM user_financials f 
            JOIN users u ON u.id = f.user_id 
            WHERE f.forex_investment_usdt > 0
        """))
        for row in res.fetchall():
            print(f"{row.email}: {row.forex_investment_usdt}")

if __name__ == "__main__":
    import nest_asyncio
    nest_asyncio.apply()
    asyncio.run(main())
