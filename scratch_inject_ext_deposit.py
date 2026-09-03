new_endpoint = '''
class ExternalDepositPayload(BaseModel):
    user_id: str
    amount: float

@router.post("/admin/external-deposit", dependencies=[Depends(get_admin_user)])
async def external_deposit(payload: ExternalDepositPayload, db: AsyncSession = Depends(get_db)):
    """
    Регистрация внешнего пополнения: деньги пришли снаружи и уже физически на счёте.
    Правильно увеличивает balance_usdt и net_invested снапшота,
    добавляет сумму к investment_usdt инвестора,
    устанавливает его entry_pool_pnl_pct на текущий PnL пула.
    Не трогает entry_pool_pnl_pct других инвесторов.
    """
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть больше нуля")

    snap = (await db.execute(
        select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()

    current_pnl_pct = 0.0
    if snap:
        positions = (await db.execute(
            select(Position).where(Position.snapshot_id == snap.id)
        )).scalars().all()
        pool_total = snap.balance_usdt + sum(
            p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price) for p in positions
        )
        start = snap.real_start_balance if snap.real_start_balance != 0.0 else snap.hwm
        total_inv = (await db.execute(select(func.sum(UserFinancials.investment_usdt)))).scalar() or 0.0
        total_wd = (await db.execute(select(func.sum(UserFinancials.withdrawal_usdt)))).scalar() or 0.0
        ref = start + total_inv - total_wd
        if ref <= 0:
            ref = snap.net_invested if snap.net_invested > 0 else start
        current_pnl_pct = round((pool_total - ref) / ref * 100, 4) if ref > 0 else 0.0

    fin = (await db.execute(
        select(UserFinancials).where(UserFinancials.user_id == payload.user_id)
    )).scalar_one_or_none()

    if fin:
        if fin.investment_usdt > 0:
            incr = current_pnl_pct - fin.entry_pool_pnl_pct
            if incr > 0:
                from constants import get_investor_share
                gross = fin.investment_usdt * (incr / 100)
                user_profit = round(gross * get_investor_share(fin), 2)
                if user_profit > 0:
                    fin.locked_crypto_pnl += user_profit
        fin.entry_pool_pnl_pct = current_pnl_pct
        fin.investment_usdt += payload.amount
        fin.updated_at = datetime.utcnow()
    else:
        db.add(UserFinancials(
            user_id=payload.user_id,
            investment_usdt=payload.amount,
            entry_pool_pnl_pct=current_pnl_pct,
        ))

    if snap:
        snap.balance_usdt += payload.amount
        snap.net_invested += payload.amount

    await db.commit()

    return {
        "status": "success",
        "user_id": payload.user_id,
        "amount": payload.amount,
        "entry_pct": current_pnl_pct,
        "note": "Внешний депозит зарегистрирован. balance_usdt и net_invested увеличены."
    }

'''

with open('C:\\temp\\MaklerSite\\backend\\routers\\auth.py', 'r', encoding='utf-8') as f:
    c = f.read()

marker = '    return {"status": "approved", "amount": actual_amount}\n\n@router.post("/admin/emergency-fix-pnl")'
if marker in c:
    c = c.replace(marker, '    return {"status": "approved", "amount": actual_amount}\n' + new_endpoint + '@router.post("/admin/emergency-fix-pnl")')
    print("Injected external-deposit endpoint")
else:
    print("Marker not found, searching alternative...")
    idx = c.find('@router.post("/admin/emergency-fix-pnl")')
    if idx > 0:
        c = c[:idx] + new_endpoint + c[idx:]
        print("Injected before emergency-fix-pnl")
    else:
        print("Cannot find insertion point!")

with open('C:\\temp\\MaklerSite\\backend\\routers\\auth.py', 'w', encoding='utf-8') as f:
    f.write(c)
print("Done")
