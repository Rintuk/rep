import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:WvVpTjRydwDqINaJkQCLYhLhNrtGqBIs@autorack.proxy.rlwy.net:45887/railway"

async def main():
    engine = create_async_engine(DATABASE_URL, echo=False, connect_args={"ssl": False})
    async with engine.begin() as conn:
        res = await conn.execute(text("""
            SELECT u.email, f.forex_investment_usdt, f.forex_entry_pool_pnl_pct, f.locked_forex_pnl 
            FROM user_financials f 
            JOIN users u ON u.id = f.user_id 
            WHERE f.forex_investment_usdt > 0
        """))
        for row in res.fetchall():
            print(f"{row.email}: inv={row.forex_investment_usdt}, entry={row.forex_entry_pool_pnl_pct}, locked={row.locked_forex_pnl}")
            
        res = await conn.execute(text("SELECT balance_usdt, net_invested FROM forex_bot_snapshots ORDER BY timestamp DESC LIMIT 1"))
        snap = res.fetchone()
        print(f"Snap: balance={snap.balance_usdt}, net_invested={snap.net_invested}")

if __name__ == "__main__":
    asyncio.run(main())
