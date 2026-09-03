with open('C:\\temp\\MaklerSite\\backend\\routers\\auth.py', 'r', encoding='utf-8') as f:
    c = f.read()

# Fix: Remove the destructive UPDATE that resets all users' entry_pnl_pct on deposit approval
bad = '''        from sqlalchemy import text
        await db.execute(text(f"UPDATE user_financials SET entry_pool_pnl_pct = {post_deposit_pct} WHERE investment_usdt > 0"))
        await db.commit()'''

good = '''        # Only update the new depositor's entry point, not everyone else
        new_depositor_fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == req.user_id))).scalar_one_or_none()
        if new_depositor_fin:
            new_depositor_fin.entry_pool_pnl_pct = post_deposit_pct
            await db.commit()'''

if bad in c:
    c = c.replace(bad, good)
    print('Fixed destructive UPDATE query - SUCCESS')
else:
    print('Bad block not found exactly, searching...')
    if 'UPDATE user_financials SET entry_pool_pnl_pct' in c:
        print('Found partial match - need manual check')
    else:
        print('Not found at all')

with open('C:\\temp\\MaklerSite\\backend\\routers\\auth.py', 'w', encoding='utf-8') as f:
    f.write(c)

print('Done')
