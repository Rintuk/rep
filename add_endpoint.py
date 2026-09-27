import re

with open('backend/routers/auth.py', 'r', encoding='utf-8') as f:
    text = f.read()

new_endpoint = '''class SetForexPositionsPayload(BaseModel):
    amount: float

@router.post("/admin/set-forex-positions", dependencies=[Depends(get_admin_user)])
async def admin_set_forex_positions(payload: SetForexPositionsPayload, db: AsyncSession = Depends(get_db)):
    from models import GlobalSettings
    settings = (await db.execute(select(GlobalSettings))).scalar_one_or_none()
    if settings:
        settings.forex_pool_positions = payload.amount
        await db.commit()
    return {"status": "ok"}

@router.post("/admin/reinvest-all"'''

text = text.replace('@router.post("/admin/reinvest-all"', new_endpoint)

with open('backend/routers/auth.py', 'w', encoding='utf-8') as f:
    f.write(text)
