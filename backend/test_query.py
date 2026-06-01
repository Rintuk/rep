import os
os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:WvVpTjRydwDqINaJkQCLYhLhNrtGqBIs@autorack.proxy.rlwy.net:45887/railway"
os.environ["SECRET_KEY"] = "secret"
os.environ["BOT_API_KEY"] = "secret"

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from models import User, UserFinancials

DATABASE_URL = os.environ["DATABASE_URL"]

async def main():
    engine = create_async_engine(DATABASE_URL, echo=False, connect_args={"ssl": False})
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        res = await db.execute(select(User).where(User.is_admin == False).limit(5))
        users = res.scalars().all()
        for u in users:
            print(f"User: {u.email}, is_active: {u.is_active}, nickname: {u.nickname}")
            
            # Simulate _calc_referral_tree for this user
            try:
                from routers.dashboard import _calc_referral_tree
                fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == u.id))).scalar_one_or_none()
                await _calc_referral_tree(u.id, db, 0.0, 0.0, fin, u.manual_status_override)
                print("Dashboard referral tree calc OK")
            except Exception as e:
                import traceback
                print("Error calculating dashboard:", traceback.format_exc())

if __name__ == "__main__":
    asyncio.run(main())
