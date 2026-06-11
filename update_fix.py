with open('backend/routers/auth.py', 'r', encoding='utf-8') as f:
    content = f.read()

import re

# Find the old emergency-fix-forex and replace it
target_pattern = re.compile(r'@router\.get\("/admin/emergency-fix-forex".*?return \{"status": "SUCCESS".*?\}', re.DOTALL)

replacement = '''@router.get("/admin/emergency-fix-forex", dependencies=[Depends(get_admin_user)])
async def emergency_fix_forex(db: AsyncSession = Depends(get_db)):
    from models import UserFinancials, ForexBotSnapshot, ForexPosition
    
    # 1. Сначала добавляем недостающие 900 к капиталу во всех снимках
    snaps = (await db.execute(select(ForexBotSnapshot))).scalars().all()
    for s in snaps:
        if s.net_invested > 0:
            s.net_invested = round(s.net_invested + 900, 4)
        else:
            ref_val = s.real_start_balance if s.real_start_balance != 0.0 else s.hwm
            s.net_invested = round(ref_val + 900, 4)
            
    await db.commit() # Сохраняем увеличенный капитал
    
    # 2. Теперь берем последний снимок и считаем правильный процент
    snap = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
    if not snap:
        return {"error": "No forex snap"}
        
    fx_positions = (await db.execute(select(ForexPosition).where(ForexPosition.snapshot_id == snap.id))).scalars().all()
    forex_pool_positions = sum(p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price) for p in fx_positions)
    pool_total = snap.balance_usdt + forex_pool_positions
    
    ref = snap.net_invested if snap.net_invested > 0 else (snap.real_start_balance if snap.real_start_balance != 0.0 else snap.hwm)
    true_pct = round((pool_total - ref) / ref * 100, 4) if ref > 0 else 0.0
    
    # 3. Применяем этот правильный процент всем инвесторам
    fins = (await db.execute(select(UserFinancials))).scalars().all()
    count = 0
    for fin in fins:
        if fin.forex_investment_usdt > 0:
            fin.forex_entry_pool_pnl_pct = true_pct
            count += 1
            
    await db.commit()
    return {"status": "SUCCESS", "message": f"Fixed {count} forex users! Added 900 to net_invested. True Pct set to {true_pct}%."}'''

content = target_pattern.sub(replacement, content)

with open('backend/routers/auth.py', 'w', encoding='utf-8') as f:
    f.write(content)
