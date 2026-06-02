with open('backend/routers/auth.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('\nref = snap.net_invested', '\n        ref = snap.net_invested')

# Add snap.net_invested -= actual_amount
target = 'req.updated_at = datetime.utcnow()\n    await db.commit()\n    return {"status": "approved", "amount": actual_amount}'
replacement = '''req.updated_at = datetime.utcnow()
    
    # ВАЖНО: Уменьшаем капитал пула
    snap_update = (await db.execute(select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
    if snap_update:
        snap_update.net_invested -= actual_amount
        if snap_update.net_invested < 0:
            snap_update.net_invested = 0

    await db.commit()
    return {"status": "approved", "amount": actual_amount}'''

content = content.replace(target, replacement)

with open('backend/routers/auth.py', 'w', encoding='utf-8') as f:
    f.write(content)

with open('backend/routers/dashboard.py', 'r', encoding='utf-8') as f:
    dash = f.read()

import re
dash = re.sub(
    r"_total_inv = \(await db\.execute\(select\(func\.sum\(UserFinancials\.investment_usdt\)\)\)\)\.scalar\(\) or 0\.0\s+_total_wd = \(await db\.execute\(select\(func\.sum\(UserFinancials\.withdrawal_usdt\)\)\)\)\.scalar\(\) or 0\.0\s+net_inv = _start \+ _total_inv \- _total_wd\s+if net_inv <= 0:\s+net_inv = snap\.net_invested if snap\.net_invested > 0 else _start",
    "net_inv = snap.net_invested if snap.net_invested > 0 else _start",
    dash
)

with open('backend/routers/dashboard.py', 'w', encoding='utf-8') as f:
    f.write(dash)
