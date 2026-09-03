import re

with open("backend/routers/auth.py", "r", encoding="utf-8") as f:
    content = f.read()

new_endpoint = """
@router.post("/admin/deposits/{request_id}/approve-from-pool", dependencies=[Depends(get_admin_user)])
async def approve_deposit_from_pool(request_id: str, actual_amount: float, db: AsyncSession = Depends(get_db)):
    if actual_amount <= 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть положительной")
    req = (await db.execute(select(DepositRequest).where(DepositRequest.id == request_id))).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Заявка уже не в ожидании")

    # Сначала выполняем логику пополнения из пула (пересчет процентов не нужен, так как пула баланс не меняется)
    payload = DepositFromPoolPayload(user_id=req.user_id, amount=actual_amount)
    await deposit_from_pool(payload, db)

    # Помечаем заявку как одобренную (хотя баланс снапшота не увеличился)
    req = (await db.execute(select(DepositRequest).where(DepositRequest.id == request_id))).scalar_one_or_none()
    req.status = "approved"
    req.updated_at = datetime.utcnow()
    await db.commit()
    return {"status": "success", "message": "Депозит пополнен из пула админа"}
"""

if "def approve_deposit_from_pool" not in content:
    content = content.replace(
        "async def approve_deposit(request_id: str, actual_amount: float, db: AsyncSession = Depends(get_db)):",
        new_endpoint + "\n\n@router.post(\"/admin/deposits/{request_id}/approve\", dependencies=[Depends(get_admin_user)])\nasync def approve_deposit(request_id: str, actual_amount: float, db: AsyncSession = Depends(get_db)):"
    )
    with open("backend/routers/auth.py", "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched auth.py")
else:
    print("Already patched auth.py")


with open("backend/routers/forex.py", "r", encoding="utf-8") as f:
    content = f.read()

new_forex_endpoint = """
@router.post("/admin/deposits/{request_id}/forex-approve-from-pool", dependencies=[Depends(get_admin_user)])
async def forex_approve_deposit_from_pool(request_id: str, actual_amount: float, db: AsyncSession = Depends(get_db)):
    if actual_amount <= 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть положительной")
    req = (await db.execute(select(DepositRequest).where(DepositRequest.id == request_id, DepositRequest.pool_type == "forex"))).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Заявка уже не в ожидании")

    from routers.auth import DepositFromPoolPayload, forex_deposit_from_pool
    payload = DepositFromPoolPayload(user_id=req.user_id, amount=actual_amount)
    await forex_deposit_from_pool(payload, db)

    req = (await db.execute(select(DepositRequest).where(DepositRequest.id == request_id, DepositRequest.pool_type == "forex"))).scalar_one_or_none()
    req.status = "approved"
    req.updated_at = datetime.utcnow()
    await db.commit()
    return {"status": "success", "message": "Форекс депозит пополнен из пула админа"}
"""

if "def forex_approve_deposit_from_pool" not in content:
    content = content.replace(
        "async def approve_forex_deposit(request_id: str, actual_amount: float, db: AsyncSession = Depends(get_db)):",
        new_forex_endpoint + "\n\n@router.post(\"/admin/deposits/{request_id}/approve\", dependencies=[Depends(get_admin_user)])\nasync def approve_forex_deposit(request_id: str, actual_amount: float, db: AsyncSession = Depends(get_db)):"
    )
    with open("backend/routers/forex.py", "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched forex.py")
else:
    print("Already patched forex.py")
