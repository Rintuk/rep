with open('backend/routers/auth.py', 'r', encoding='utf-8') as f:
    content = f.read()

debug_endpoint = '''
@router.get("/debug-state-xyz")
async def debug_state_xyz(db: AsyncSession = Depends(get_db)):
    from models import UserFinancials, ForexBotSnapshot, ForexPosition
    snap = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
    if not snap:
        return {"error": "No forex snap"}
        
    fx_positions = (await db.execute(select(ForexPosition).where(ForexPosition.snapshot_id == snap.id))).scalars().all()
    forex_pool_positions = sum(p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price) for p in fx_positions)
    pool_total = snap.balance_usdt + forex_pool_positions
    
    ref = snap.net_invested if snap.net_invested > 0 else (snap.real_start_balance if snap.real_start_balance != 0.0 else snap.hwm)
    true_pct = round((pool_total - ref) / ref * 100, 4) if ref > 0 else 0.0
    
    fins = (await db.execute(select(UserFinancials))).scalars().all()
    users = []
    for fin in fins:
        if fin.forex_investment_usdt > 0:
            users.append({
                "user_id": fin.user_id,
                "investment": fin.forex_investment_usdt,
                "locked": fin.locked_forex_pnl,
                "entry_pct": fin.forex_entry_pool_pnl_pct
            })
            
    return {
        "snapshot": {
            "balance_usdt": snap.balance_usdt,
            "net_invested": snap.net_invested,
            "forex_pool_positions": forex_pool_positions,
            "pool_total": pool_total,
            "ref": ref,
            "true_pct": true_pct
        },
        "users": users
    }
'''

content += debug_endpoint

with open('backend/routers/auth.py', 'w', encoding='utf-8') as f:
    f.write(content)
