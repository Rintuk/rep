import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text, select
import sys
sys.path.append('c:\\temp\\maklersite\\backend')
from models import User, UserFinancials, ForexBotSnapshot

DATABASE_URL = "postgresql+asyncpg://postgres:WvVpTjRydwDqINaJkQCLYhLhNrtGqBIs@autorack.proxy.rlwy.net:45887/railway"

async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    correct_profits = {
        "maksimsegolev6@gmail.com": 49.17,
        "aleko_k@inbox.ru": 71.53,
        "juniorvasilva@gmail.com": 18.33,
        "sanekkushnarenko777@gmail.com": 40.58,
        "kushnar080868@mail.ru": 13.39
    }
    
    async with async_session() as db:
        snap = (await db.execute(
            select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1)
        )).scalar_one_or_none()
        current_pct = 0.0
        if snap and snap.net_invested > 0:
            current_pct = (snap.balance_usdt - snap.net_invested) / snap.net_invested * 100.0

        print(f"Current pool pct: {current_pct}")
        
        updated = 0
        for email, target_pnl in correct_profits.items():
            res = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
            if res:
                fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == res.id))).scalar_one_or_none()
                if fin:
                    print(f"Updating {email}: {fin.locked_forex_pnl} -> {target_pnl}")
                    fin.locked_forex_pnl = target_pnl
                    fin.forex_entry_pool_pnl_pct = current_pct
                    updated += 1
        
        await db.commit()
        print(f"Updated {updated} users. New pct set to {current_pct}")

if __name__ == "__main__":
    import nest_asyncio
    nest_asyncio.apply()
    asyncio.run(main())
