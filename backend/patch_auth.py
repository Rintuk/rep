import sys

file_path = r'c:\temp\maklersite\backend\routers\auth.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''@router.post("/admin/notebook/reset-crypto", dependencies=[Depends(get_admin_user)])
async def admin_notebook_reset_crypto(db: AsyncSession = Depends(get_db)):
    """Reset all crypto profit records in AdminProfitLog (set crypto_profit = 0 for all rows)."""
    from sqlalchemy import update as sa_update
    await db.execute(
        sa_update(AdminProfitLog).values(crypto_profit=0.0)
    )
    await db.commit()
    return {"status": "ok", "message": "Crypto notebook reset"}'''

replacement = '''@router.post("/admin/notebook/reset-crypto", dependencies=[Depends(get_admin_user)])
async def admin_notebook_reset_crypto(db: AsyncSession = Depends(get_db)):
    """Reset all crypto profit records in AdminProfitLog."""
    logs = (await db.execute(select(AdminProfitLog))).scalars().all()
    for log in logs:
        log.crypto_profit = 0.0
    await db.commit()
    return {"status": "ok", "message": "Crypto notebook reset"}

@router.post("/admin/notebook/reset-forex", dependencies=[Depends(get_admin_user)])
async def admin_notebook_reset_forex(db: AsyncSession = Depends(get_db)):
    """Reset all forex profit records in AdminProfitLog."""
    logs = (await db.execute(select(AdminProfitLog))).scalars().all()
    for log in logs:
        log.forex_profit = 0.0
    await db.commit()
    return {"status": "ok", "message": "Forex notebook reset"}'''

# In case of CRLF
target = target.replace('\r\n', '\n')
content = content.replace('\r\n', '\n')

content = content.replace(target, replacement)

with open(file_path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print('Done!')
