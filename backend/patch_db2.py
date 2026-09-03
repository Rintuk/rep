import asyncio
from database import engine
from sqlalchemy import text

async def alter_table():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE user_financials ADD COLUMN custom_pool_fee FLOAT;"))
            print("Added custom_pool_fee")
        except Exception as e:
            print("Error custom_pool_fee:", e)

        try:
            await conn.execute(text("ALTER TABLE user_financials ADD COLUMN custom_ref_bonus FLOAT;"))
            print("Added custom_ref_bonus")
        except Exception as e:
            print("Error custom_ref_bonus:", e)

if __name__ == "__main__":
    asyncio.run(alter_table())
