import asyncio
import os
from sqlalchemy.ext.asyncio import AsyncSession
from database import AsyncSessionLocal
from routers.auth import emergency_set_net_invested, rollback_hwm

async def main():
    async with AsyncSessionLocal() as db:
        print("Начинаем установку капитала...")
        res1 = await emergency_set_net_invested(new_net_invested=5938.68, pool_type="forex", db=db)
        print("Капитал установлен:", res1)
        
        print("Начинаем откат прибыли до 290...")
        res2 = await rollback_hwm(target_crypto_profit_usdt=None, target_forex_profit_usdt=290, db=db)
        print("Прибыль скорректирована:", res2)

if __name__ == "__main__":
    asyncio.run(main())
