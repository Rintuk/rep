import re

# Fix auth.py
with open("backend/routers/auth.py", "r", encoding="utf-8") as f:
    auth_content = f.read()

new_auth_func = """
@router.post("/admin/deposits/{request_id}/approve-from-pool", dependencies=[Depends(get_admin_user)])
async def approve_deposit_from_pool(request_id: str, actual_amount: float, db: AsyncSession = Depends(get_db)):
    try:
        if actual_amount <= 0:
            raise HTTPException(status_code=400, detail="Сумма должна быть положительной")
        req = (await db.execute(select(DepositRequest).where(DepositRequest.id == request_id))).scalar_one_or_none()
        if not req:
            raise HTTPException(status_code=404, detail="Заявка не найдена")
        if req.status != "pending":
            raise HTTPException(status_code=400, detail="Заявка уже не в ожидании")

        payload = DepositFromPoolPayload(user_id=req.user_id, amount=actual_amount)
        await deposit_from_pool(payload, db)

        req = (await db.execute(select(DepositRequest).where(DepositRequest.id == request_id))).scalar_one_or_none()
        req.status = "approved"
        req.updated_at = datetime.utcnow()
        await db.commit()
        return {"status": "success", "message": "Депозит пополнен из пула админа"}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        err_msg = traceback.format_exc()
        raise HTTPException(status_code=400, detail="INTERNAL_ERROR: " + err_msg)
"""

auth_content = re.sub(
    r'@router\.post\("/admin/deposits/\{request_id\}/approve-from-pool", dependencies=\[Depends\(get_admin_user\)\]\)\nasync def approve_deposit_from_pool.*?return \{"status": "success", "message": ".*?"\}',
    new_auth_func.strip(),
    auth_content,
    flags=re.DOTALL
)

with open("backend/routers/auth.py", "w", encoding="utf-8") as f:
    f.write(auth_content)


# Fix forex.py
with open("backend/routers/forex.py", "r", encoding="utf-8") as f:
    forex_content = f.read()

new_forex_func = """
@router.post("/admin/deposits/{request_id}/forex-approve-from-pool", dependencies=[Depends(get_admin_user)])
async def forex_approve_deposit_from_pool(request_id: str, actual_amount: float, db: AsyncSession = Depends(get_db)):
    try:
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
        return {"status": "success", "message": "Форекс депозит пополнен из пула"}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        err_msg = traceback.format_exc()
        raise HTTPException(status_code=400, detail="INTERNAL_ERROR: " + err_msg)
"""

forex_content = re.sub(
    r'@router\.post\("/admin/deposits/\{request_id\}/forex-approve-from-pool", dependencies=\[Depends\(get_admin_user\)\]\)\nasync def forex_approve_deposit_from_pool.*?return \{"status": "success", "message": ".*?"\}',
    new_forex_func.strip(),
    forex_content,
    flags=re.DOTALL
)

with open("backend/routers/forex.py", "w", encoding="utf-8") as f:
    f.write(forex_content)

print("Patch applied to return tracebacks to frontend.")
