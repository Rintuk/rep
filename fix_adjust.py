with open('backend/routers/auth.py', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''    # Баг 16 fix: Обязательно фиксируем прибыль перед изменением net_invested
    await _migrate_pnl_internal(db)
    
    snaps = (await db.execute(select(BotSnapshot))).scalars().all()'''

replacement = '''    snap = (await db.execute(select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
    if snap:
        from models import Position
        positions = (await db.execute(select(Position).where(Position.snapshot_id == snap.id))).scalars().all()
        pool_total = snap.balance_usdt + sum(p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price) for p in positions)
        
        start = snap.real_start_balance if snap.real_start_balance != 0.0 else snap.hwm
        total_inv = (await db.execute(select(func.sum(UserFinancials.investment_usdt)))).scalar() or 0.0
        total_wd = (await db.execute(select(func.sum(UserFinancials.withdrawal_usdt)))).scalar() or 0.0
        ref = start + total_inv - total_wd
        if ref <= 0:
            ref = snap.net_invested if snap.net_invested > 0 else start
            
        current_pnl_pct = round((pool_total - ref) / ref * 100, 4) if ref > 0 else 0.0
        ref_post = ref + add_amount
        post_adjust_pct = round((pool_total - ref) / ref_post * 100, 4) if ref_post > 0 else 0.0
        
        await _migrate_pnl_internal(db, override_crypto_pct=current_pnl_pct, final_crypto_pct=post_adjust_pct)
    else:
        await _migrate_pnl_internal(db)
    
    snaps = (await db.execute(select(BotSnapshot))).scalars().all()'''

content = content.replace(target, replacement)

with open('backend/routers/auth.py', 'w', encoding='utf-8') as f:
    f.write(content)

with open('backend/routers/forex.py', 'r', encoding='utf-8') as f:
    content = f.read()

target2 = '''    # Баг 16 fix: Обязательно фиксируем прибыль перед изменением net_invested
    from routers.auth import _migrate_pnl_internal
    await _migrate_pnl_internal(db)
    
    snaps = (await db.execute(select(ForexBotSnapshot))).scalars().all()'''

replacement2 = '''    from routers.auth import _migrate_pnl_internal
    snap = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
    if snap:
        from models import ForexPosition
        fx_positions = (await db.execute(select(ForexPosition).where(ForexPosition.snapshot_id == snap.id))).scalars().all()
        forex_pool_positions = sum(p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price) for p in fx_positions)
        pool_total = snap.balance_usdt + forex_pool_positions
        
        ref = snap.net_invested if snap.net_invested > 0 else (snap.real_start_balance if snap.real_start_balance != 0.0 else snap.hwm)
        current_pnl_pct = round((pool_total - ref) / ref * 100, 4) if ref > 0 else 0.0
        ref_post = ref + add_amount
        post_adjust_pct = round((pool_total - ref) / ref_post * 100, 4) if ref_post > 0 else 0.0
        
        await _migrate_pnl_internal(db, override_forex_pct=current_pnl_pct, final_forex_pct=post_adjust_pct)
    else:
        await _migrate_pnl_internal(db)
        
    snaps = (await db.execute(select(ForexBotSnapshot))).scalars().all()'''

content = content.replace(target2, replacement2)

with open('backend/routers/forex.py', 'w', encoding='utf-8') as f:
    f.write(content)
