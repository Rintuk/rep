import os

AUTH_FILE = r"c:\temp\maklersite\backend\routers\auth.py"

endpoint_code = '''
@router.post("/admin/align-db")
async def api_align_db(db: AsyncSession = Depends(get_db)):
    from models import UserFinancials, BotSnapshot, Position, ForexBotSnapshot, User
    from routers.forex import _get_forex_pool_pnl_pct

    # ---- CRYPTO ALIGNMENT ----
    snap = (await db.execute(select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
    all_fins = (await db.execute(select(UserFinancials))).scalars().all()
    all_users = (await db.execute(select(User))).scalars().all()
    investors = [u for u in all_users if u.is_active and not u.is_admin]
    fins_map = {f.user_id: f for f in all_fins}
    
    crypto_msg = "No crypto snap"
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
            crypto_msg = f"Expected: {expected_investor_gross}, Actual: {actual_investor_gross}, Disc: {discrepancy}"
            
            if abs(discrepancy) > 0.01:
                if total_invested > 0:
                    delta_entry = -(discrepancy * 100) / total_invested
                    for f in all_fins:
                        if f.investment_usdt > 0:
                            f.entry_pool_pnl_pct = round(f.entry_pool_pnl_pct + delta_entry, 4)
                    crypto_msg += f" | Adjusted entry by {delta_entry}%"

    # ---- FOREX ALIGNMENT ----
    forex_snap = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
    forex_pool_pct = await _get_forex_pool_pnl_pct(db)
    
    forex_msg = "No forex snap"
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
            forex_msg = f"Expected: {fx_expected_investor_gross}, Actual: {fx_actual_investor_gross}, Disc: {fx_discrepancy}"
            
            if abs(fx_discrepancy) > 0.01:
                if fx_total_invested > 0:
                    delta_entry = -(fx_discrepancy * 100) / fx_total_invested
                    for f in all_fins:
                        if f.forex_investment_usdt > 0:
                            f.forex_entry_pool_pnl_pct = round(f.forex_entry_pool_pnl_pct + delta_entry, 4)
                    forex_msg += f" | Adjusted fx entry by {delta_entry}%"
    
    await db.commit()
    return {"status": "ok", "crypto": crypto_msg, "forex": forex_msg}
'''

with open(AUTH_FILE, "a", encoding="utf-8") as f:
    f.write(endpoint_code)

print("Endpoint added")
