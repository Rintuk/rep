from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import User, UserFinancials, BotSnapshot, Position, Trade, AIFeedEntry, DepositRequest
from schemas import RegisterIn, LoginIn, TokenOut
from security import hash_password, verify_password, create_access_token, get_admin_user
from datetime import datetime, timedelta
from constants import INVESTOR_SHARE, POOL_FEE, L1_REF_FEE

router = APIRouter(prefix="/auth", tags=["auth"])


async def _get_pool_pnl_pct(db: AsyncSession) -> float:
    """Текущий PnL% пула от net_invested — используется как точка входа инвестора."""
    snap = (await db.execute(
        select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()
    if not snap:
        return 0.0
    positions = (await db.execute(
        select(Position).where(Position.snapshot_id == snap.id)
    )).scalars().all()
    pool_total = snap.balance_usdt + sum(
        p.amount * (p.current_price if p.current_price > 0 else p.avg_price)
        for p in positions
    )
    ref = snap.net_invested if snap.net_invested > 0 else (
        snap.real_start_balance if snap.real_start_balance > 0 else snap.hwm
    )
    return round((pool_total - ref) / ref * 100, 4) if ref > 0 else 0.0

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
    return TokenOut(access_token=create_access_token(user.id), is_admin=user.is_admin)


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

    current_pnl_pct = await _get_pool_pnl_pct(db)

    fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == user_id))).scalar_one_or_none()
    if fin:
        # Взвешенная точка входа при изменении суммы инвестиции
        old_inv = fin.investment_usdt
        if investment_usdt > 0 and old_inv != investment_usdt:
            if old_inv <= 0:
                fin.entry_pool_pnl_pct = current_pnl_pct
            elif investment_usdt > old_inv:
                # Взвешенная точка входа только при увеличении суммы
                fin.entry_pool_pnl_pct = round(
                    (old_inv * fin.entry_pool_pnl_pct + (investment_usdt - old_inv) * current_pnl_pct) / investment_usdt, 4
                )
            # При уменьшении суммы — точку входа не меняем
        fin.investment_usdt = investment_usdt
        fin.withdrawal_usdt = withdrawal_usdt
        fin.note = note
        fin.updated_at = datetime.utcnow()
    else:
        db.add(UserFinancials(
            user_id=user_id,
            investment_usdt=investment_usdt,
            withdrawal_usdt=withdrawal_usdt,
            note=note,
            entry_pool_pnl_pct=current_pnl_pct if investment_usdt > 0 else 0.0,
        ))
    await db.commit()
    return {"status": "ok"}


@router.get("/admin/pool-history", dependencies=[Depends(get_admin_user)])
async def admin_pool_history(db: AsyncSession = Depends(get_db)):
    """История PnL пула — последние 100 снимков для графика.
    Считается только с того момента когда бот имеет валидный real_start_balance.
    PnL = pool_total - net_invested (база фиксируется по первому валидному снимку).
    """
    snaps = (await db.execute(
        select(BotSnapshot).order_by(BotSnapshot.timestamp.asc()).limit(100)
    )).scalars().all()

    # Только снимки с net_invested > 0
    valid = [s for s in snaps if s.net_invested > 0]
    if not valid:
        return []

    # Используем последний снимок как эталон net_invested.
    # Фильтруем артефакты: снимки где net_invested < 50% от эталона — явно некорректные данные.
    ref_net = valid[-1].net_invested
    clean_snaps = [s for s in valid if s.net_invested >= ref_net * 0.5]
    if not clean_snaps:
        return []

    result = []
    for s in clean_snaps:
        positions = (await db.execute(
            select(Position).where(Position.snapshot_id == s.id)
        )).scalars().all()
        pool_positions = sum(p.amount * (p.current_price if p.current_price > 0 else p.avg_price) for p in positions)
        pool_total = round(s.balance_usdt + pool_positions, 2)
        pnl = round(pool_total - s.net_invested, 2)
        pnl_pct = round((pnl / s.net_invested) * 100, 2)
        result.append({
            "ts": s.timestamp.strftime("%d.%m %H:%M"),
            "pool_total": pool_total,
            "pnl": pnl,
            "pnl_pct": pnl_pct,
        })
    return result


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
        pool_positions_usdt = sum(p.amount * (p.current_price if p.current_price > 0 else p.avg_price) for p in snap_positions)
        pool_free = snap.balance_usdt
        pool_total = pool_free + pool_positions_usdt
        positions = [{"symbol": p.symbol, "amount": p.amount, "avg_price": p.avg_price,
                      "current_price": p.current_price if p.current_price > 0 else p.avg_price,
                      "value": round(p.amount * (p.current_price if p.current_price > 0 else p.avg_price), 2)} for p in snap_positions]

        all_trade_rows = (await db.execute(
            select(Trade).order_by(Trade.timestamp.desc()).limit(500)
        )).scalars().all()
        seen_trades = set()
        trades = []
        for t in all_trade_rows:
            key = (t.symbol, t.action, t.timestamp, t.price)
            if key not in seen_trades:
                seen_trades.add(key)
                trades.append({"symbol": t.symbol, "action": t.action, "amount": t.amount,
                                "price": t.price, "pnl": t.pnl, "timestamp": t.timestamp})
            if len(trades) >= 30:
                break

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

    # ── PnL пула (реальный = pool_total - net_invested) ──────────
    pool_pnl_usdt = 0.0
    pool_pnl_pct = 0.0
    real_start = 0.0
    net_invested_pool = 0.0
    if snap:
        # net_invested учитывает стартовый депозит + пополнения - снятия
        net_invested_pool = snap.net_invested if snap.net_invested > 0 else (
            snap.real_start_balance if snap.real_start_balance > 0 else snap.hwm
        )
        real_start = snap.real_start_balance if snap.real_start_balance > 0 else snap.hwm
        if net_invested_pool > 0:
            pool_pnl_usdt = round(pool_total - net_invested_pool, 2)
            pool_pnl_pct = round((pool_total - net_invested_pool) / net_invested_pool * 100, 2)

    # ── Таблица инвесторов + реальный доход админа ───────────────
    total_gross_pnl = 0.0
    total_admin_pnl = 0.0
    investors_table = []
    for u in investors:
        fin = fins_map.get(u.id)
        inv = fin.investment_usdt if fin else 0.0
        refs_count = sum(1 for x in all_users if x.referred_by == u.id)
        pnl = 0.0
        if inv > 0 and snap and pool_pnl_pct != 0:
            entry_pct = fin.entry_pool_pnl_pct if fin else 0.0
            incremental = pool_pnl_pct - entry_pct
            gross_pnl = inv * (incremental / 100)
            pnl = round(gross_pnl * INVESTOR_SHARE, 2)
            total_gross_pnl += gross_pnl
            # Если нет активного реферера — его 3% тоже идут администратору
            has_referrer = u.referred_by is not None and any(
                x.id == u.referred_by and x.is_active and not x.is_admin
                for x in all_users
            )
            admin_fee = POOL_FEE if has_referrer else POOL_FEE + L1_REF_FEE
            total_admin_pnl += gross_pnl * admin_fee
        investors_table.append({
            "id": u.id, "email": u.email, "created_at": str(u.created_at),
            "investment": inv, "withdrawal": fin.withdrawal_usdt if fin else 0.0,
            "pnl": pnl, "referrals_count": refs_count,
        })

    pool_profit = round(total_gross_pnl, 2)
    admin_income = round(total_admin_pnl, 2) if total_admin_pnl > 0 else 0.0

    # Собственный капитал администратора = всё что в пуле минус деньги инвесторов
    admin_own_capital = round(max(net_invested_pool - total_invested, 0.0), 2)
    admin_own_pnl = round(admin_own_capital * (pool_pnl_pct / 100), 2) if admin_own_capital > 0 else 0.0
    admin_total_income = round(admin_income + admin_own_pnl, 2)

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
        "admin_own_capital": admin_own_capital,
        "admin_own_pnl": admin_own_pnl,
        "admin_total_income": admin_total_income,
        "pool_profit": round(pool_profit, 2),
        "pool_pnl_usdt": pool_pnl_usdt,
        "pool_pnl_pct": pool_pnl_pct,
        "real_start_balance": round(real_start, 2),
        "net_invested_pool": round(net_invested_pool, 2),
        "positions": positions,
        "trades": trades,
        "ai_feed": ai_feed,
        "investors": investors_table,
        "referrals": referrals_l1,
        "pending_users": [{"id": u.id, "email": u.email, "created_at": str(u.created_at)} for u in pending],
    }


@router.post("/admin/users/{user_id}/reset-password", dependencies=[Depends(get_admin_user)])
async def reset_user_password(user_id: str, new_password: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.password_hash = hash_password(new_password)
    await db.commit()
    return {"status": "ok"}


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


# ── Заявки на пополнение депозита ─────────────────────────────
from security import get_current_user

@router.post("/deposits/request")
async def create_deposit_request(
    amount: float,
    comment: str = "",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть больше нуля")
    req = DepositRequest(user_id=user.id, amount=amount, comment=comment)
    db.add(req)
    await db.commit()
    return {"status": "ok", "message": "Заявка принята. Будет обработана в течение суток."}


@router.get("/deposits/my")
async def my_deposit_requests(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(DepositRequest).where(DepositRequest.user_id == user.id)
        .order_by(DepositRequest.created_at.desc()).limit(20)
    )).scalars().all()
    return [{"id": r.id, "amount": r.amount, "comment": r.comment,
             "status": r.status, "created_at": str(r.created_at)} for r in rows]


@router.get("/admin/deposits", dependencies=[Depends(get_admin_user)])
async def list_deposit_requests(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(DepositRequest).order_by(DepositRequest.created_at.desc()).limit(100)
    )).scalars().all()
    result = []
    for r in rows:
        user = (await db.execute(select(User).where(User.id == r.user_id))).scalar_one_or_none()
        result.append({
            "id": r.id, "user_id": r.user_id,
            "email": user.email if user else "?",
            "amount": r.amount, "comment": r.comment,
            "status": r.status, "created_at": str(r.created_at),
        })
    return result


@router.post("/admin/deposits/{request_id}/approve", dependencies=[Depends(get_admin_user)])
async def approve_deposit(request_id: str, actual_amount: float, db: AsyncSession = Depends(get_db)):
    if actual_amount <= 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть больше нуля")
    req = (await db.execute(select(DepositRequest).where(DepositRequest.id == request_id))).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Заявка уже обработана")

    # Прибавляем фактически полученную сумму к investment_usdt
    current_pnl_pct = await _get_pool_pnl_pct(db)
    fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == req.user_id))).scalar_one_or_none()
    if fin:
        old_inv = fin.investment_usdt
        # Взвешенная точка входа: старая доля + новый депозит по текущей цене пула
        new_inv = old_inv + actual_amount
        if old_inv <= 0:
            fin.entry_pool_pnl_pct = current_pnl_pct
        else:
            fin.entry_pool_pnl_pct = round(
                (old_inv * fin.entry_pool_pnl_pct + actual_amount * current_pnl_pct) / new_inv, 4
            )
        fin.investment_usdt = new_inv
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
    return {"status": "approved", "amount": actual_amount}


@router.post("/admin/deposits/{request_id}/reject", dependencies=[Depends(get_admin_user)])
async def reject_deposit(request_id: str, db: AsyncSession = Depends(get_db)):
    req = (await db.execute(select(DepositRequest).where(DepositRequest.id == request_id))).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    req.status = "rejected"
    req.updated_at = datetime.utcnow()
    await db.commit()
    return {"status": "rejected"}
