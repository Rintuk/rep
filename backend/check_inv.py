import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres:WvVpTjRydwDqINaJkQCLYhLhNrtGqBIs@autorack.proxy.rlwy.net:45887/railway', ssl=False)
    rows = await conn.fetch('SELECT u.email, f.forex_investment_usdt FROM user_financials f JOIN users u ON u.id = f.user_id WHERE f.forex_investment_usdt > 0')
    for r in rows:
        print(f"{r['email']}: {r['forex_investment_usdt']}")
    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
