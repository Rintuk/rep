import asyncio
from database import AsyncSessionLocal
from models import UserFinancials, ForexBotSnapshot, ForexPosition
from sqlalchemy import select

async def fix_forex_balances():
    async with AsyncSessionLocal() as db:
        snap = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        if not snap:
            print("No snap found")
            return
            
        fx_positions = (await db.execute(select(ForexPosition).where(ForexPosition.snapshot_id == snap.id))).scalars().all()
        forex_pool_positions = sum(p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price) for p in fx_positions)
        pool_total = snap.balance_usdt + forex_pool_positions
        
        ref = snap.net_invested if snap.net_invested > 0 else (snap.real_start_balance if snap.real_start_balance != 0.0 else snap.hwm)
        true_pct = round((pool_total - ref) / ref * 100, 4) if ref > 0 else 0.0
        
        print(f"True Forex Pct: {true_pct}%")
        
        fins = (await db.execute(select(UserFinancials))).scalars().all()
        count = 0
        for fin in fins:
            if fin.forex_investment_usdt > 0:
                fin.forex_entry_pool_pnl_pct = true_pct
                count += 1
                
        await db.commit()
        print(f"Fixed {count} forex users!")

asyncio.run(fix_forex_balances())
