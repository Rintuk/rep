import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import sys

DATABASE_URL = "postgresql+asyncpg://postgres:WvVpTjRydwDqINaJkQCLYhLhNrtGqBIs@autorack.proxy.rlwy.net:45887/railway"

async def main():
    engine = create_async_engine(DATABASE_URL, echo=False, connect_args={"ssl": False})
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT id, timestamp, balance_usdt, net_invested, hwm FROM forex_bot_snapshots ORDER BY timestamp DESC LIMIT 20"))
        snaps = res.fetchall()
        
        with open("c:\\temp\\maklersite\\backend\\snapshots_dump.txt", "w") as f:
            for s in snaps:
                f.write(f"ID: {s.id}, TS: {s.timestamp}, Bal: {s.balance_usdt}, NetInv: {s.net_invested}, HWM: {s.hwm}\n")

if __name__ == "__main__":
    asyncio.run(main())
