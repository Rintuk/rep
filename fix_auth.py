with open('backend/routers/auth.py', 'r', encoding='utf-8') as f:
    content = f.read()

import re
# Match the block from wait _migrate_pnl_internal to snaps = (await db.execute
pattern = re.compile(r"    # Баг 16 fix: обязательно фиксируем прибыль ДО изменения net_invested\s+await _migrate_pnl_internal\(db\)\s+snaps = \(await db.execute\(select\(BotSnapshot\)\)\)\.scalars\(\)\.all\(\)")

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
        
        from routers.auth import _migrate_pnl_internal
        await _migrate_pnl_internal(db, override_crypto_pct=current_pnl_pct, final_crypto_pct=post_adjust_pct)
    else:
        from routers.auth import _migrate_pnl_internal
        await _migrate_pnl_internal(db)
    
    snaps = (await db.execute(select(BotSnapshot))).scalars().all()'''

content = pattern.sub(replacement, content)

with open('backend/routers/auth.py', 'w', encoding='utf-8') as f:
    f.write(content)
