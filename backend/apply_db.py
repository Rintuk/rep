import asyncio
import asyncpg
import os
import sys

async def main():
    db_url = "postgresql://postgres:EOpwVFVZttiaKduQBQwcRLBPWnoxYNNl@nozomi.proxy.rlwy.net:38606/railway"
    try:
        conn = await asyncpg.connect(db_url)
        print("Connected to Railway!")
        try:
            await conn.execute("ALTER TABLE user_financials ADD COLUMN custom_pool_fee FLOAT;")
            print("Added custom_pool_fee")
        except Exception as e:
            print("Already exists or error:", e)
        try:
            await conn.execute("ALTER TABLE user_financials ADD COLUMN custom_ref_bonus FLOAT;")
            print("Added custom_ref_bonus")
        except Exception as e:
            print("Already exists or error:", e)
        await conn.close()
    except Exception as e:
        print("Connection failed:", e)

if __name__ == "__main__":
    asyncio.run(main())
