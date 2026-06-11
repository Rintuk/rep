with open('backend/routers/auth.py', 'r', encoding='utf-8') as f:
    content = f.read()

fix_endpoint = '''
@router.get("/admin/emergency-fix-forex", dependencies=[Depends(get_admin_user)])
async def emergency_fix_forex(db: AsyncSession = Depends(get_db)):
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
    count = 0
    for fin in fins:
        if fin.forex_investment_usdt > 0:
            fin.forex_entry_pool_pnl_pct = true_pct
            count += 1
            
    await db.commit()
    return {"status": "SUCCESS", "message": f"Fixed {count} forex users! True Pct set to {true_pct}%."}
'''

content += fix_endpoint

with open('backend/routers/auth.py', 'w', encoding='utf-8') as f:
    f.write(content)
