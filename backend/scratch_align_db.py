import asyncio
import sys
import os
env_file = r"c:\temp\maklersite\.env"
if os.path.exists(env_file):
    with open(env_file) as f:
        for line in f:
            if line.strip() and not line.startswith('#'):
                k, v = line.strip().split('=', 1)
                os.environ[k] = v

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models import UserFinancials, BotSnapshot, Position, ForexBotSnapshot, User
from database import AsyncSessionLocal

async def _get_forex_pool_pnl_pct(db: AsyncSession):
    from models import ForexBotSnapshot
    snap = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
    if not snap:
        return 0.0
    return snap.pool_pnl_pct

async def align_db():
    async with AsyncSessionLocal() as db:
        # ---- CRYPTO ALIGNMENT ----
        snap = (await db.execute(select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        all_fins = (await db.execute(select(UserFinancials))).scalars().all()
        all_users = (await db.execute(select(User))).scalars().all()
        investors = [u for u in all_users if u.is_active and not u.is_admin]
        fins_map = {f.user_id: f for f in all_fins}
        
        if snap:
            pool_free = snap.balance_usdt
            snap_positions = (await db.execute(select(Position).where(Position.snapshot_id == snap.id))).scalars().all()
            pool_positions_usdt = sum(p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price) for p in snap_positions)
            pool_total = pool_free + pool_positions_usdt
            
            total_invested = sum(fins_map[u.id].investment_usdt for u in investors if u.id in fins_map)
            real_start = snap.real_start_balance if snap.real_start_balance != 0.0 else snap.hwm
            net_invested_pool = real_start + total_invested
            if net_invested_pool <= 0:
                net_invested_pool = snap.net_invested if snap.net_invested > 0 else real_start
                
            if net_invested_pool > 0:
                pool_pnl_usdt = round(pool_total - net_invested_pool, 2)
                pool_pnl_pct = round(pool_pnl_usdt / net_invested_pool * 100, 4)
                
                admin_own_capital = round(max(net_invested_pool - total_invested, 0.0), 2)
                admin_own_pnl = round(pool_pnl_usdt * (admin_own_capital / net_invested_pool), 2)
                
                expected_investor_gross = pool_pnl_usdt - admin_own_pnl
                
                actual_investor_gross = 0.0
                for u in investors:
                    fin = fins_map.get(u.id)
                    inv = fin.investment_usdt if fin else 0.0
                    if inv > 0:
                        entry_pct = fin.entry_pool_pnl_pct
                        incremental = pool_pnl_pct - entry_pct
                        actual_investor_gross += inv * (incremental / 100)
                
                discrepancy = expected_investor_gross - actual_investor_gross
                print(f"CRYPTO: Expected Gross: {expected_investor_gross}, Actual Gross: {actual_investor_gross}, Discrepancy: {discrepancy}")
                
                if abs(discrepancy) > 0.01:
                    if total_invested > 0:
                        delta_entry = -(discrepancy * 100) / total_invested
                        for f in all_fins:
                            if f.investment_usdt > 0:
                                f.entry_pool_pnl_pct = round(f.entry_pool_pnl_pct + delta_entry, 4)
                        print(f"Adjusted all crypto entry_pct by {delta_entry}%")
        
        # ---- FOREX ALIGNMENT ----
        forex_snap = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        forex_pool_pct = await _get_forex_pool_pnl_pct(db)
        
        if forex_snap and forex_pool_pct is not None:
            from models import ForexPosition
            fx_positions = (await db.execute(select(ForexPosition).where(ForexPosition.snapshot_id == forex_snap.id))).scalars().all()
            fx_pool_positions_usdt = sum(p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price) for p in fx_positions)
            fx_pool_total = forex_snap.balance_usdt + fx_pool_positions_usdt
            
            fx_total_invested = sum(fins_map[u.id].forex_investment_usdt for u in investors if u.id in fins_map)
            fx_real_start = forex_snap.real_start_balance if forex_snap.real_start_balance != 0.0 else forex_snap.hwm
            fx_net_invested_pool = fx_real_start + fx_total_invested
            if fx_net_invested_pool <= 0:
                fx_net_invested_pool = forex_snap.net_invested if forex_snap.net_invested > 0 else fx_real_start
                
            if fx_net_invested_pool > 0:
                fx_pool_pnl_usdt = round(fx_pool_total - fx_net_invested_pool, 2)
                
                fx_admin_own_capital = round(max(fx_net_invested_pool - fx_total_invested, 0.0), 2)
                fx_admin_own_pnl = round(fx_pool_pnl_usdt * (fx_admin_own_capital / fx_net_invested_pool), 2)
                
                fx_expected_investor_gross = fx_pool_pnl_usdt - fx_admin_own_pnl
                
                fx_actual_investor_gross = 0.0
                for u in investors:
                    fin = fins_map.get(u.id)
                    inv = fin.forex_investment_usdt if fin else 0.0
                    if inv > 0:
                        entry_pct = fin.forex_entry_pool_pnl_pct
                        incremental = forex_pool_pct - entry_pct
                        fx_actual_investor_gross += inv * (incremental / 100)
                        
                fx_discrepancy = fx_expected_investor_gross - fx_actual_investor_gross
                print(f"FOREX: Expected Gross: {fx_expected_investor_gross}, Actual Gross: {fx_actual_investor_gross}, Discrepancy: {fx_discrepancy}")
                
                if abs(fx_discrepancy) > 0.01:
                    if fx_total_invested > 0:
                        delta_entry = -(fx_discrepancy * 100) / fx_total_invested
                        for f in all_fins:
                            if f.forex_investment_usdt > 0:
                                f.forex_entry_pool_pnl_pct = round(f.forex_entry_pool_pnl_pct + delta_entry, 4)
                        print(f"Adjusted all forex entry_pct by {delta_entry}%")
        
        await db.commit()
        print("Database aligned successfully.")

if __name__ == "__main__":
    asyncio.run(align_db())
