import asyncio
from sqlalchemy import select
from database import SessionLocal
from models import UserFinancials, ForexBotSnapshot
from constants import get_investor_share

async def run():
    async with SessionLocal() as db:
        user_email = "juniorvasilva@gmail.com"
        from models import User
        user = (await db.execute(select(User).where(User.email == user_email))).scalar_one_or_none()
        if not user:
            print("User not found")
            return
            
        fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == user.id))).scalar_one_or_none()
        snap = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        
        fx_ref = snap.net_invested if snap.net_invested > 0 else (snap.real_start_balance if snap.real_start_balance > 0 else snap.hwm)
        pool_pct = round((snap.balance_usdt - fx_ref) / fx_ref * 100, 4) if fx_ref > 0 else 0.0
        
        print(f"Current pool pct: {pool_pct}")
        print(f"User entry pct: {fin.forex_entry_pool_pnl_pct}")
        print(f"User investment: {fin.forex_investment_usdt}")
        print(f"User locked pnl: {fin.locked_forex_pnl}")
        
        incr = pool_pct - fin.forex_entry_pool_pnl_pct
        gross = fin.forex_investment_usdt * (incr / 100)
        pnl = round(gross * get_investor_share(fin) + fin.locked_forex_pnl, 2)
        print(f"User current PNL: {pnl}")

asyncio.run(run())
