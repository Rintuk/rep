import re
with open('backend/routers/auth.py', 'r', encoding='utf-8') as f:
    content = f.read()

new_code = '''@router.post("/admin/deposits/{request_id}/approve", dependencies=[Depends(get_admin_user)])
async def approve_deposit(request_id: str, actual_amount: float, db: AsyncSession = Depends(get_db)):
    if actual_amount <= 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть больше нуля")
    req = (await db.execute(select(DepositRequest).where(DepositRequest.id == request_id))).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Заявка не в ожидании")

    snap = (await db.execute(
        select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()
    if snap:
        positions = (await db.execute(
            select(Position).where(Position.snapshot_id == snap.id)
        )).scalars().all()
        pool_total_without_deposit = snap.balance_usdt + sum(
            p.amount * (p.current_price if p.current_price > 0 else p.avg_price) for p in positions
        )
        start = snap.real_start_balance if snap.real_start_balance > 0 else snap.hwm
        total_inv = (await db.execute(select(func.sum(UserFinancials.investment_usdt)))).scalar() or 0.0
        total_wd = (await db.execute(select(func.sum(UserFinancials.withdrawal_usdt)))).scalar() or 0.0
        ref = start + total_inv - total_wd
        if ref <= 0:
            ref = snap.net_invested if snap.net_invested > 0 else start
        current_pnl_pct = round((pool_total_without_deposit - ref) / ref * 100, 4) if ref > 0 else 0.0
    else:
        current_pnl_pct = 0.0

    await _migrate_pnl_internal(db, override_crypto_pct=current_pnl_pct)

    fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == req.user_id))).scalar_one_or_none()
    if fin:
        fin.investment_usdt += actual_amount
        fin.updated_at = datetime.utcnow()
    else:
        db.add(UserFinancials(
            user_id=req.user_id,
            investment_usdt=actual_amount,
            entry_pool_pnl_pct=current_pnl_pct,
        ))

    req.status = "approved"
    req.updated_at = datetime.utcnow()
    await db.commit()

    if snap:
        snap.balance_usdt += actual_amount
        snap.net_invested += actual_amount
        await db.commit()
        
        total_inv_new = (await db.execute(select(func.sum(UserFinancials.investment_usdt)))).scalar() or 0.0
        total_wd_new = (await db.execute(select(func.sum(UserFinancials.withdrawal_usdt)))).scalar() or 0.0
        ref_new = start + total_inv_new - total_wd_new
        if ref_new <= 0:
            ref_new = snap.net_invested if snap.net_invested > 0 else start
        
        pool_total_new = snap.balance_usdt + sum(
            p.amount * (p.current_price if p.current_price > 0 else p.avg_price) for p in positions
        )
        post_deposit_pct = round((pool_total_new - ref_new) / ref_new * 100, 4) if ref_new > 0 else 0.0
        
        from sqlalchemy import text
        await db.execute(text(f"UPDATE user_financials SET entry_pool_pnl_pct = {post_deposit_pct} WHERE investment_usdt > 0"))
        await db.commit()

    return {"status": "approved", "amount": actual_amount}

@router.post("/admin/emergency-fix-pnl")
async def emergency_fix_pnl(db: AsyncSession = Depends(get_db)):
    pool_pnl_pct = await _get_pool_pnl_pct(db)
    from sqlalchemy import text
    await db.execute(text(f"UPDATE user_financials SET entry_pool_pnl_pct = {pool_pnl_pct} WHERE investment_usdt > 0"))
    await db.commit()
    return {"status": "success", "new_pct": pool_pnl_pct}'''

start_idx = content.find('@router.post("/admin/deposits/{request_id}/approve"')
end_idx = content.find('@router.post("/admin/deposits/{request_id}/reject"')
if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_code + '\n\n' + content[end_idx:]
    with open('backend/routers/auth.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched successfully")
else:
    print("Could not find markers")
