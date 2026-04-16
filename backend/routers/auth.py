from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import User, UserFinancials, BotSnapshot, Position, Trade, AIFeedEntry
from schemas import RegisterIn, LoginIn, TokenOut
from security import hash_password, verify_password, create_access_token, get_admin_user
from datetime import datetime, timedelta

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register")
async def register(data: RegisterIn, db: AsyncSession = Depends(get_db)):
    import traceback
    try:
        return await _register(data, db)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{str(e)} | {traceback.format_exc()}")

async def _register(data: RegisterIn, db: AsyncSession):
    # Проверяем уникальность email
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email уже используется")

    referred_by_id = None
    if data.referral_code:
        ref_user = await db.execute(select(User).where(User.referral_code == data.referral_code))
        ref_user = ref_user.scalar_one_or_none()
        if not ref_user:
            raise HTTPException(status_code=400, detail="Реферальный код не найден")
        # Проверяем лимит рефералов
        count = await db.execute(select(func.count()).where(User.referred_by == ref_user.id))
        if count.scalar() >= ref_user.referral_limit:
            raise HTTPException(status_code=400, detail="Реферальный лимит исчерпан")
        referred_by_id = ref_user.id

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        referred_by=referred_by_id,
        is_active=False,  # ждёт одобрения администратора
    )
    db.add(user)
    await db.commit()
    return {"status": "pending", "message": "Регистрация принята. Ожидайте одобрения администратора."}

@router.post("/login", response_model=TokenOut)
async def login(data: LoginIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Аккаунт ожидает одобрения администратора")
    return TokenOut(access_token=create_access_token(user.id))


# ── Админ: управление пользователями ──────────────────────────
@router.get("/admin/users", dependencies=[Depends(get_admin_user)])
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [{"id": u.id, "email": u.email, "is_active": u.is_active,
             "is_admin": u.is_admin, "referral_code": u.referral_code,
             "referral_limit": u.referral_limit, "created_at": str(u.created_at)} for u in users]

@router.post("/admin/approve/{user_id}", dependencies=[Depends(get_admin_user)])
async def approve_user(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.is_active = True
    await db.commit()
    return {"status": "approved", "email": user.email}

@router.post("/admin/reject/{user_id}", dependencies=[Depends(get_admin_user)])
async def reject_user(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    await db.delete(user)
    await db.commit()
    return {"status": "rejected"}

@router.patch("/admin/referral-limit/{user_id}", dependencies=[Depends(get_admin_user)])
async def set_referral_limit(user_id: str, limit: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.referral_limit = limit
    await db.commit()
    return {"status": "ok", "referral_limit": limit}


@router.get("/admin/users/{user_id}", dependencies=[Depends(get_admin_user)])
async def get_user_detail(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Рефералы
    refs = (await db.execute(select(User).where(User.referred_by == user_id))).scalars().all()

    # Финансы
    fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == user_id))).scalar_one_or_none()

    return {
        "id": user.id,
        "email": user.email,
        "is_active": user.is_active,
        "is_admin": user.is_admin,
        "referral_code": user.referral_code,
        "referral_limit": user.referral_limit,
        "referred_by": user.referred_by,
        "created_at": str(user.created_at),
        "investment_usdt": fin.investment_usdt if fin else 0.0,
        "withdrawal_usdt": fin.withdrawal_usdt if fin else 0.0,
        "note": fin.note if fin else "",
        "referrals": [
            {"id": r.id, "email": r.email, "is_active": r.is_active, "created_at": str(r.created_at)}
            for r in refs
        ],
    }


@router.patch("/admin/users/{user_id}/financials", dependencies=[Depends(get_admin_user)])
async def update_user_financials(
    user_id: str,
    investment_usdt: float = 0.0,
    withdrawal_usdt: float = 0.0,
    note: str = "",
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.id == user_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == user_id))).scalar_one_or_none()
    if fin:
        fin.investment_usdt = investment_usdt
        fin.withdrawal_usdt = withdrawal_usdt
        fin.note = note
        fin.updated_at = datetime.utcnow()
    else:
        db.add(UserFinancials(user_id=user_id, investment_usdt=investment_usdt,
                              withdrawal_usdt=withdrawal_usdt, note=note))
    await db.commit()
    return {"status": "ok"}


@router.get("/admin/overview", dependencies=[Depends(get_admin_user)])
async def admin_overview(db: AsyncSession = Depends(get_db)):
    """Полный обзор для администратора."""
    # ── Снимок бота ──────────────────────────────────────────────
    snap = (await db.execute(
        select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()

    pool_total = 0.0
    pool_free = 0.0
    pool_positions_usdt = 0.0
    server_online = False
    positions = []
    trades = []
    ai_feed = []

    if snap:
        server_online = (datetime.utcnow() - snap.timestamp) < timedelta(minutes=30)
        snap_positions = (await db.execute(
            select(Position).where(Position.snapshot_id == snap.id)
        )).scalars().all()
        pool_positions_usdt = sum(p.amount * p.avg_price for p in snap_positions)
        pool_free = snap.balance_usdt
        pool_total = pool_free + pool_positions_usdt
        positions = [{"symbol": p.symbol, "amount": p.amount, "avg_price": p.avg_price,
                      "value": round(p.amount * p.avg_price, 2)} for p in snap_positions]

        trades_rows = (await db.execute(
            select(Trade).order_by(Trade.timestamp.desc()).limit(30)
        )).scalars().all()
        trades = [{"symbol": t.symbol, "action": t.action, "amount": t.amount,
                   "price": t.price, "pnl": t.pnl, "timestamp": t.timestamp} for t in trades_rows]

        ai_rows = (await db.execute(
            select(AIFeedEntry).order_by(AIFeedEntry.timestamp.desc()).limit(10)
        )).scalars().all()
        ai_feed = [{"timestamp": a.timestamp, "action": a.action,
                    "symbol": a.symbol, "reason": a.reason} for a in ai_rows]

    # ── Пользователи ─────────────────────────────────────────────
    all_users = (await db.execute(select(User))).scalars().all()
    all_fins = (await db.execute(select(UserFinancials))).scalars().all()
    fins_map = {f.user_id: f for f in all_fins}

    investors = [u for u in all_users if u.is_active and not u.is_admin]
    pending = [u for u in all_users if not u.is_active and not u.is_admin]

    total_invested = sum(fins_map[u.id].investment_usdt for u in investors if u.id in fins_map)
    total_withdrawn = sum(fins_map[u.id].withdrawal_usdt for u in investors if u.id in fins_map)

    # ── Рефералы L1 и L2 ─────────────────────────────────────────
    investor_ids = {u.id for u in investors}
    l1_users = [u for u in all_users if u.referred_by in investor_ids or
                (u.referred_by and any(a.id == u.referred_by for a in all_users if not a.is_admin))]

    # Строим дерево рефералов
    referrals_l1 = []
    for u in all_users:
        if u.referred_by and any(a.id == u.referred_by and not a.is_admin for a in all_users):
            referrer = next((a for a in all_users if a.id == u.referred_by), None)
            fin = fins_map.get(u.id)
            referrals_l1.append({
                "id": u.id, "email": u.email, "is_active": u.is_active,
                "referred_by_email": referrer.email if referrer else "",
                "investment": fin.investment_usdt if fin else 0.0,
            })

    # ── Мой доход (17% от прибыли пула) ──────────────────────────
    pool_profit = pool_total - total_invested if total_invested > 0 else 0.0
    admin_income = round(pool_profit * 0.17, 2) if pool_profit > 0 else 0.0

    # ── Таблица инвесторов ────────────────────────────────────────
    investors_table = []
    for u in investors:
        fin = fins_map.get(u.id)
        inv = fin.investment_usdt if fin else 0.0
        refs_count = sum(1 for x in all_users if x.referred_by == u.id)
        # PnL пропорционально drawdown бота
        pnl = 0.0
        if inv > 0 and snap:
            pnl = round(inv * (snap.drawdown_pct / 100), 2)
        investors_table.append({
            "id": u.id, "email": u.email, "created_at": str(u.created_at),
            "investment": inv, "withdrawal": fin.withdrawal_usdt if fin else 0.0,
            "pnl": pnl, "referrals_count": refs_count,
        })

    return {
        "pool_total": round(pool_total, 2),
        "pool_free": round(pool_free, 2),
        "pool_positions_usdt": round(pool_positions_usdt, 2),
        "server_online": server_online,
        "drawdown_pct": snap.drawdown_pct if snap else 0.0,
        "hwm": snap.hwm if snap else 0.0,
        "last_updated": snap.timestamp.isoformat() if snap else None,
        "investors_count": len(investors),
        "pending_count": len(pending),
        "total_invested": round(total_invested, 2),
        "total_withdrawn": round(total_withdrawn, 2),
        "admin_income": admin_income,
        "pool_profit": round(pool_profit, 2),
        "positions": positions,
        "trades": trades,
        "ai_feed": ai_feed,
        "investors": investors_table,
        "referrals": referrals_l1,
        "pending_users": [{"id": u.id, "email": u.email, "created_at": str(u.created_at)} for u in pending],
    }


@router.delete("/admin/users/{user_id}", dependencies=[Depends(get_admin_user)])
async def delete_user(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.is_admin:
        raise HTTPException(status_code=403, detail="Нельзя удалить администратора")
    await db.delete(user)
    await db.commit()
    return {"status": "deleted"}
