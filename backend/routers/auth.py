from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import User, UserFinancials, BotSnapshot, Position, Trade, AIFeedEntry, VirtualAccount, VirtualTrade, DepositRequest, WithdrawalRequest, NewsItem, ForexBotSnapshot
from schemas import RegisterIn, LoginIn, TokenOut, NewsItemCreate, NewsItemOut
from security import hash_password, verify_password, create_access_token, get_admin_user, get_current_user
from datetime import datetime, timedelta
from constants import INVESTOR_SHARE, get_investor_share, POOL_FEE, REF_FEES, STATUS_THRESHOLDS, get_investor_share

router = APIRouter(prefix="/auth", tags=["auth"])


async def _get_pool_pnl_pct(db: AsyncSession) -> float:
    """Текущий PnL% пула — использует реальный net_invested из БД (депозиты инвесторов),
    чтобы пополнения не отображались как прибыль."""
    snap = (await db.execute(
        select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()
    if not snap:
        return 0.0
    positions = (await db.execute(
        select(Position).where(Position.snapshot_id == snap.id)
    )).scalars().all()
    pool_total = snap.balance_usdt + sum(
        p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price)
        for p in positions
    )
    start = snap.real_start_balance if snap.real_start_balance > 0 else snap.hwm
    total_inv = (await db.execute(select(func.sum(UserFinancials.investment_usdt)))).scalar() or 0.0
    total_wd = (await db.execute(select(func.sum(UserFinancials.withdrawal_usdt)))).scalar() or 0.0
    ref = start + total_inv - total_wd
    if ref <= 0:
        ref = snap.net_invested if snap.net_invested > 0 else start
    return round((pool_total - ref) / ref * 100, 4) if ref > 0 else 0.0

@router.post("/admin/emergency-force-set-pct")
async def emergency_force_set_pct(pct: float, db: AsyncSession = Depends(get_db)):
    fins = (await db.execute(select(UserFinancials))).scalars().all()
    for f in fins:
        if f.investment_usdt > 0:
            f.entry_pool_pnl_pct = pct
    await db.commit()
    return {"status": "success", "new_pct": pct}

from pydantic import BaseModel
class SqlQuery(BaseModel):
    query: str

@router.post("/admin/sql")
async def execute_sql(payload: SqlQuery, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import text
    try:
        res = await db.execute(text(payload.query))
        await db.commit()
        rows = [dict(r._mapping) for r in res] if res.returns_rows else []
        return {"status": "success", "rows": rows}
    except Exception as e:
        return {"status": "error", "error": str(e)}

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

    if not (3 <= len(data.nickname) <= 10):
        raise HTTPException(status_code=400, detail="Никнейм должен быть от 3 до 10 символов")
    import re
    if not re.match(r"^[a-zA-Z0-9_]+$", data.nickname):
        raise HTTPException(status_code=400, detail="Никнейм может содержать только английские буквы, цифры и подчеркивание")
    existing_nick = await db.execute(select(User).where(User.nickname == data.nickname))
    if existing_nick.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Никнейм уже занят")

    referred_by_id = None
    if data.referral_code:
        ref_user = await db.execute(select(User).where(User.referral_code == data.referral_code))
        ref_user = ref_user.scalar_one_or_none()
        if not ref_user:
            raise HTTPException(status_code=400, detail="Реферальный код не найден")
        # Динамический подсчет лимита
        all_u = (await db.execute(select(User))).scalars().all()
        all_f = (await db.execute(select(UserFinancials))).scalars().all()
        f_map = {f.user_id: f for f in all_f}
        c_map = {}
        for u in all_u:
            if u.referred_by:
                c_map.setdefault(u.referred_by, []).append(u)
        
        my_f = f_map.get(ref_user.id)
        total_vol = (my_f.investment_usdt + my_f.forex_investment_usdt) if my_f else 0.0
        
        q = [ref_user.id]
        while q:
            curr = q.pop(0)
            for child in c_map.get(curr, []):
                if child.is_active:
                    cf = f_map.get(child.id)
                    if cf:
                        total_vol += cf.investment_usdt + cf.forex_investment_usdt
                    q.append(child.id)
                    
        from routers.dashboard import _get_status_and_limits
        from constants import STATUS_INVITE_LIMITS
        
        status, _, _ = _get_status_and_limits(total_vol, ref_user.manual_status_override)
            
        dynamic_limit = STATUS_INVITE_LIMITS.get(status, 3)
        # Если админ вручную дал limit больше чем по статусу, используем его
        actual_limit = max(ref_user.referral_limit, dynamic_limit)
        
        count = await db.execute(select(func.count()).where(User.referred_by == ref_user.id))
        if count.scalar() >= actual_limit:
            raise HTTPException(status_code=400, detail="Реферальный лимит исчерпан")
        referred_by_id = ref_user.id

    user = User(
        email=data.email,
        nickname=data.nickname,
        password_hash=hash_password(data.password),
        referred_by=referred_by_id,
        is_active=False,  # Ждем апрува админом
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
    return TokenOut(access_token=create_access_token(user.id, remember_me=data.remember_me), is_admin=user.is_admin)


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
    
    # Баг 7 fix: проверяем наличие рефералов перед удалением
    refs = (await db.execute(select(User).where(User.referred_by == user_id))).scalars().all()
    if refs:
        raise HTTPException(status_code=400, detail="Нельзя удалить пользователя, у которого уже есть рефералы")
        
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

from pydantic import BaseModel
class InvestorShareRequest(BaseModel):
    share: Optional[float]

@router.post("/admin/investor-share/{user_id}", dependencies=[Depends(get_admin_user)])
async def set_investor_share(user_id: str, data: InvestorShareRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserFinancials).where(UserFinancials.user_id == user_id))
    fin = result.scalar_one_or_none()
    
    if fin:
        # Calculate current dynamic PnL
        crypto_pool_pct = await _get_pool_pnl_pct(db)
        from models import ForexBotSnapshot
        forex_snap = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        forex_pool_pct = 0.0
        if forex_snap:
            fx_net_inv = forex_snap.net_invested if forex_snap.net_invested > 0 else (forex_snap.real_start_balance if forex_snap.real_start_balance > 0 else forex_snap.hwm)
            if fx_net_inv > 0:
                forex_pool_pct = round((forex_snap.balance_usdt - fx_net_inv) / fx_net_inv * 100, 4)
                
        # Lock crypto pnl
        if fin.investment_usdt > 0:
            incr = crypto_pool_pct - fin.entry_pool_pnl_pct
            gross = fin.investment_usdt * (incr / 100)
            user_profit = round(gross * get_investor_share(fin), 2)
            if user_profit > 0:
                fin.locked_crypto_pnl += user_profit
            fin.entry_pool_pnl_pct = crypto_pool_pct
            
        # Lock forex pnl
        if fin.forex_investment_usdt > 0:
            fx_incr = forex_pool_pct - fin.forex_entry_pool_pnl_pct
            fx_gross = fin.forex_investment_usdt * (fx_incr / 100)
            fx_user_profit = round(fx_gross * get_investor_share(fin), 2)
            if fx_user_profit > 0:
                fin.locked_forex_pnl += fx_user_profit
            fin.forex_entry_pool_pnl_pct = forex_pool_pct
            
        # Update custom share
        fin.custom_investor_share = data.share
    else:
        # User has no financials yet, just create with the new share
        db.add(UserFinancials(
            user_id=user_id,
            custom_investor_share=data.share
        ))

    await db.commit()
    return {"status": "ok"}

@router.patch("/admin/status-override/{user_id}", dependencies=[Depends(get_admin_user)])
async def set_status_override(user_id: str, status: Optional[str], db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # "NONE" or empty string clears the override
    if status == "NONE" or status == "":
        status = None
        
    user.manual_status_override = status
    await db.commit()
    return {"status": "ok", "manual_status_override": status}


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

    # Поиск email пригласителя
    referred_by_email = ""
    if user.referred_by:
        referrer = (await db.execute(select(User).where(User.id == user.referred_by))).scalar_one_or_none()
        if referrer:
            referred_by_email = referrer.email

    return {
        "id": user.id,
        "email": user.email,
        "is_active": user.is_active,
        "is_admin": user.is_admin,
        "referral_code": user.referral_code,
        "referral_limit": user.referral_limit,
        "manual_status_override": user.manual_status_override,
        "referred_by": user.referred_by,
        "referred_by_email": referred_by_email,
        "created_at": str(user.created_at),
        "investment_usdt": fin.investment_usdt if fin else 0.0,
        "withdrawal_usdt": fin.withdrawal_usdt if fin else 0.0,
        "forex_investment_usdt": fin.forex_investment_usdt if fin else 0.0,
        "forex_withdrawal_usdt": fin.forex_withdrawal_usdt if fin else 0.0,
        "note": fin.note if fin else "",
        "custom_investor_share": fin.custom_investor_share if fin else None,
        "referrals": [
            {"id": r.id, "email": r.email, "is_active": r.is_active, "created_at": str(r.created_at)}
            for r in refs
        ],
    }


@router.get("/admin/users/{user_id}/history", dependencies=[Depends(get_admin_user)])
async def get_user_history(user_id: str, db: AsyncSession = Depends(get_db)):
    """История пополнений и выводов конкретного инвестора."""
    deposits = (await db.execute(
        select(DepositRequest).where(DepositRequest.user_id == user_id)
        .order_by(DepositRequest.created_at.desc())
    )).scalars().all()

    withdrawals = (await db.execute(
        select(WithdrawalRequest).where(WithdrawalRequest.user_id == user_id)
        .order_by(WithdrawalRequest.created_at.desc())
    )).scalars().all()

    return {
        "deposits": [{"id": r.id, "amount": r.amount, "comment": r.comment,
                      "status": r.status, "pool_type": r.pool_type, "created_at": str(r.created_at)} for r in deposits],
        "withdrawals": [{"id": r.id, "amount": r.amount, "comment": r.comment,
                         "status": r.status, "pool_type": r.pool_type, "created_at": str(r.created_at)} for r in withdrawals],
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
    # Фильтруем артефакты: снимки где net_invested выходит за диапазон [50%, 110%] от эталона.
    # 110% верхняя граница отсекает демо-снимки (VIRTUAL_START_BALANCE=1000 при реальном ~867).
    ref_net = valid[-1].net_invested
    clean_snaps = [s for s in valid if ref_net * 0.5 <= s.net_invested <= ref_net * 1.1]
    if not clean_snaps:
        return []

    result = []
    for s in clean_snaps:
        positions = (await db.execute(
            select(Position).where(Position.snapshot_id == s.id)
        )).scalars().all()
        pool_positions = sum(p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price) for p in positions)
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
        pool_positions_usdt = sum(p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price) for p in snap_positions)
        pool_free = snap.balance_usdt
        pool_total = pool_free + pool_positions_usdt
        positions = [{"symbol": p.symbol, "amount": p.amount, "avg_price": p.avg_price,
                      "current_price": p.current_price if (p.current_price or 0) > 0 else p.avg_price,
                      "value": round(p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price), 2)} for p in snap_positions]

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
        real_start = snap.real_start_balance if snap.real_start_balance > 0 else snap.hwm
        # Считаем net_invested из БД: стартовый капитал + депозиты инвесторов - снятия
        net_invested_pool = real_start + total_invested - total_withdrawn
        if net_invested_pool <= 0:
            net_invested_pool = snap.net_invested if snap.net_invested > 0 else real_start
        if net_invested_pool > 0:
            pool_pnl_usdt = round(pool_total - net_invested_pool, 2)
            pool_pnl_pct = round((pool_total - net_invested_pool) / net_invested_pool * 100, 4)

    # ── Таблица инвесторов + реальный доход админа ───────────────
    total_gross_pnl = 0.0
    total_admin_pnl = 0.0
    investors_table = []
    from routers.forex import _get_forex_pool_pnl_pct
    from routers.dashboard import _calc_referral_tree
    forex_pool_pct = await _get_forex_pool_pnl_pct(db)

    for u in investors:
        fin = fins_map.get(u.id)
        inv = fin.investment_usdt if fin else 0.0
        refs_count = sum(1 for x in all_users if x.referred_by == u.id)
        pnl = 0.0
        if inv > 0 and snap and net_invested_pool > 0:
            entry_pct = fin.entry_pool_pnl_pct if fin else 0.0
            incremental = pool_pnl_pct - entry_pct
            gross_pnl = inv * (incremental / 100)
            
            locked_crypto_pnl = fin.locked_crypto_pnl if fin else 0.0
            pnl = round(gross_pnl * get_investor_share(fin) + locked_crypto_pnl, 2)
            
            # Reconstruct historical gross profit that was locked during migration
            locked_gross = locked_crypto_pnl / get_investor_share(fin)
            
            total_gross_pnl += (gross_pnl + locked_gross)
            
            # Временно упрощаем для админской статы: 
            # Админ получает POOL_FEE (20%) со всех. 
            # Невыплаченные реферальные % из оставшихся 5% тоже идут админу, но для простоты здесь пока оставим базовые 20%
            admin_fee = POOL_FEE 
            total_admin_pnl += (gross_pnl + locked_gross) * admin_fee
        
        status, total_volume, next_vol, crypto_ref, forex_ref, refs_info = await _calc_referral_tree(
            u.id, db, pool_pnl_pct, forex_pool_pct, fin, u.manual_status_override
        )
        
        investors_table.append({
            "id": u.id, "email": u.email, "created_at": str(u.created_at),
            "investment": inv, "withdrawal": fin.withdrawal_usdt if fin else 0.0,
            "pnl": pnl, "referrals_count": refs_count,
            "ref_income": round(crypto_ref, 2),
            "status": status,
            "total_volume": round(total_volume, 2),
            "next_vol": next_vol,
            "custom_investor_share": fin.custom_investor_share if fin else None,
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

class SetReferrerPayload(BaseModel):
    referred_by_email: Optional[str]

@router.patch("/admin/set-referrer/{user_id}", dependencies=[Depends(get_admin_user)])
async def set_user_referrer(user_id: str, payload: SetReferrerPayload, db: AsyncSession = Depends(get_db)):
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if payload.referred_by_email:
        referrer = (await db.execute(select(User).where(User.email == payload.referred_by_email))).scalar_one_or_none()
        if not referrer:
            raise HTTPException(status_code=404, detail="Пригласитель с таким email не найден")
        if referrer.id == u.id:
            raise HTTPException(status_code=400, detail="Нельзя пригласить самого себя")
        u.referred_by = referrer.id
    else:
        u.referred_by = None
    await db.commit()
    return {"status": "success", "referred_by": u.referred_by}

@router.post("/admin/adjust-net-invested", dependencies=[Depends(get_admin_user)])
async def adjust_net_invested(add_amount: float, db: AsyncSession = Depends(get_db)):
    """Прибавляет add_amount к net_invested во всех снимках.
    Используется когда в пул добавлен капитал (например, BNB→USDT), который бот не учёл в net_invested.
    """
    if add_amount == 0:
        raise HTTPException(status_code=400, detail="add_amount не может быть 0")
        
    # Баг 16 fix: обязательно фиксируем прибыль ДО изменения net_invested
    await _migrate_pnl_internal(db)
    
    snaps = (await db.execute(select(BotSnapshot))).scalars().all()
    updated = 0
    for s in snaps:
        s.net_invested = round(s.net_invested + add_amount, 4)
        updated += 1
    await db.commit()
    return {
        "updated_snapshots": updated,
        "add_amount": add_amount,
        "message": f"net_invested скорректирован на +{add_amount} $ в {updated} снимках",
    }


@router.post("/admin/forex-adjust-net-invested", dependencies=[Depends(get_admin_user)])
async def adjust_forex_net_invested(add_amount: float, db: AsyncSession = Depends(get_db)):
    """Прибавляет add_amount к net_invested во всех снимках форекс-пула."""
    if add_amount == 0:
        raise HTTPException(status_code=400, detail="add_amount не может быть 0")
        
    await _migrate_pnl_internal(db)
    
    from models import ForexBotSnapshot
    snaps = (await db.execute(select(ForexBotSnapshot))).scalars().all()
    updated = 0
    for s in snaps:
        s.net_invested = round(s.net_invested + add_amount, 4)
        updated += 1
    await db.commit()
    return {
        "updated_snapshots": updated,
        "add_amount": add_amount,
        "message": f"Forex net_invested скорректирован на {add_amount:+g} $ в {updated} снимках",
    }


@router.post("/admin/cleanup-demo-snapshots", dependencies=[Depends(get_admin_user)])
async def cleanup_demo_snapshots(db: AsyncSession = Depends(get_db)):
    """Удаляет демо-снимки из БД и сбрасывает точки входа инвесторов.
    Демо-снимки определяются по net_invested вне диапазона [50%, 150%] от последнего реального снимка.
    """
    from sqlalchemy import delete as sa_delete

    # Находим последний снимок как эталон
    last_snap = (await db.execute(
        select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()

    deleted_snaps = 0
    if last_snap and last_snap.net_invested > 0:
        ref = last_snap.net_invested
        lo, hi = ref * 0.5, ref * 1.1
        bad_snaps = (await db.execute(
            select(BotSnapshot).where(
                (BotSnapshot.net_invested < lo) | (BotSnapshot.net_invested > hi)
            )
        )).scalars().all()
        for s in bad_snaps:
            await db.delete(s)
        deleted_snaps = len(bad_snaps)

    # АВТО-МИГРАЦИЯ PNL: фиксируем прибыль всех инвесторов ДО сброса точек входа,
    # иначе вся накопленная прибыль будет стёрта при обнулении entry_pool_pnl_pct
    await _migrate_pnl_internal(db)

    # Сбрасываем entry_pool_pnl_pct всем инвесторам → 0 (после фиксации прибыли)
    all_fins = (await db.execute(select(UserFinancials))).scalars().all()
    for fin in all_fins:
        fin.entry_pool_pnl_pct = 0.0
    reset_count = len(all_fins)

    await db.commit()
    return {
        "deleted_snapshots": deleted_snaps,
        "reset_investors": reset_count,
        "message": f"Удалено {deleted_snaps} демо-снимков, сброшено точек входа: {reset_count}",
    }


@router.post("/admin/crypto-full-reset", dependencies=[Depends(get_admin_user)])
async def crypto_full_reset(db: AsyncSession = Depends(get_db)):
    """Полный сброс крипто-пула: снапшоты, финансы пользователей, демо-счета."""
    all_snaps = (await db.execute(select(BotSnapshot))).scalars().all()
    for s in all_snaps:
        await db.delete(s)

    all_fins = (await db.execute(select(UserFinancials))).scalars().all()
    for fin in all_fins:
        fin.investment_usdt = 0.0
        fin.withdrawal_usdt = 0.0
        fin.entry_pool_pnl_pct = 0.0
        fin.updated_at = datetime.utcnow()

    all_va = (await db.execute(select(VirtualAccount))).scalars().all()
    for va in all_va:
        va.balance_usdt = 0.0
        va.start_balance = 0.0
        va.start_real_total = 0.0
        va.is_started = False
        va.updated_at = datetime.utcnow()
        trades = (await db.execute(
            select(VirtualTrade).where(VirtualTrade.user_id == va.user_id)
        )).scalars().all()
        for t in trades:
            await db.delete(t)

    await db.commit()
    return {
        "deleted_snapshots": len(all_snaps),
        "reset_investors": len(all_fins),
        "reset_demo_accounts": len(all_va),
        "message": f"Крипто сброшен: {len(all_snaps)} снапшотов удалено, {len(all_fins)} инвесторов обнулено, {len(all_va)} демо-счетов сброшено",
    }


@router.post("/admin/rollback-hwm", dependencies=[Depends(get_admin_user)])
async def rollback_hwm(
    target_crypto_pct: Optional[float] = None, 
    target_forex_pct: Optional[float] = None, 
    target_crypto_profit_usdt: Optional[float] = None,
    target_forex_profit_usdt: Optional[float] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Откат фальшивой прибыли. Можно указать целевой процент (pct) ИЛИ целевую сумму прибыли в пуле (usdt).
    """
    if target_crypto_profit_usdt is not None:
        snap = (await db.execute(select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        if snap:
            start = snap.real_start_balance if snap.real_start_balance > 0 else snap.hwm
            total_inv = (await db.execute(select(func.sum(UserFinancials.investment_usdt)))).scalar() or 0.0
            total_wd = (await db.execute(select(func.sum(UserFinancials.withdrawal_usdt)))).scalar() or 0.0
            ref = start + total_inv - total_wd
            if ref <= 0:
                ref = snap.net_invested if snap.net_invested > 0 else start
            if ref > 0:
                target_crypto_pct = round((target_crypto_profit_usdt / ref) * 100, 4)

    if target_forex_profit_usdt is not None:
        from models import ForexBotSnapshot
        forex_snap = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        if forex_snap:
            fx_net_inv = forex_snap.net_invested if forex_snap.net_invested > 0 else (forex_snap.real_start_balance if forex_snap.real_start_balance > 0 else forex_snap.hwm)
            if fx_net_inv > 0:
                target_forex_pct = round((target_forex_profit_usdt / fx_net_inv) * 100, 4)

    from constants import INVESTOR_SHARE, get_investor_share
    all_fins = (await db.execute(select(UserFinancials))).scalars().all()
    rolled_back_crypto = 0.0
    rolled_back_forex = 0.0
    users_affected = 0
    
    for f in all_fins:
        affected = False
        if target_crypto_pct is not None and f.entry_pool_pnl_pct > target_crypto_pct:
            diff = f.entry_pool_pnl_pct - target_crypto_pct
            gross = f.investment_usdt * (diff / 100)
            fake_profit = round(gross * get_investor_share(f), 2)
            f.locked_crypto_pnl = max(0.0, f.locked_crypto_pnl - fake_profit)
            f.entry_pool_pnl_pct = target_crypto_pct
            rolled_back_crypto += fake_profit
            affected = True
            
        if target_forex_pct is not None and f.forex_entry_pool_pnl_pct > target_forex_pct:
            diff = f.forex_entry_pool_pnl_pct - target_forex_pct
            gross = f.forex_investment_usdt * (diff / 100)
            fake_profit = round(gross * get_investor_share(f), 2)
            f.locked_forex_pnl = max(0.0, f.locked_forex_pnl - fake_profit)
            f.forex_entry_pool_pnl_pct = target_forex_pct
            rolled_back_forex += fake_profit
            affected = True
            
        if affected:
            users_affected += 1
            
    await db.commit()
    return {
        "status": "success",
        "users_affected": users_affected,
        "rolled_back_crypto_usdt": round(rolled_back_crypto, 2),
        "rolled_back_forex_usdt": round(rolled_back_forex, 2)
    }

@router.post("/admin/emergency-set-net-invested", dependencies=[Depends(get_admin_user)])
async def emergency_set_net_invested(new_net_invested: float, pool_type: str = "forex", db: AsyncSession = Depends(get_db)):
    """Жесткая установка net_invested во всех снимках БЕЗ вызова миграции прибыли."""
    if pool_type == "forex":
        from models import ForexBotSnapshot
        snaps = (await db.execute(select(ForexBotSnapshot))).scalars().all()
        for s in snaps:
            s.net_invested = new_net_invested
    else:
        snaps = (await db.execute(select(BotSnapshot))).scalars().all()
        for s in snaps:
            s.net_invested = new_net_invested
    await db.commit()
    return {"status": "success", "new_net_invested": new_net_invested, "updated_snapshots": len(snaps)}

@router.post("/admin/emergency-restore-forex-stats", dependencies=[Depends(get_admin_user)])
async def emergency_restore_forex_stats(db: AsyncSession = Depends(get_db)):
    """Полностью восстанавливает статистику инвесторов: сбрасывает точку входа до 0 и обнуляет locked_pnl."""
    all_fins = (await db.execute(select(UserFinancials))).scalars().all()
    updated = 0
    for f in all_fins:
        if f.forex_investment_usdt > 0:
            f.forex_entry_pool_pnl_pct = 0.0
            f.locked_forex_pnl = 0.0
            updated += 1
    await db.commit()
    return {"status": "success", "investors_restored": updated}

@router.post("/admin/emergency-restore-old-investors", dependencies=[Depends(get_admin_user)])
async def emergency_restore_old_investors(db: AsyncSession = Depends(get_db)):
    from routers.forex import _get_forex_pool_pnl_pct
    from constants import INVESTOR_SHARE, get_investor_share
    current_pool_pct = await _get_forex_pool_pnl_pct(db)
    
    all_fins = (await db.execute(select(UserFinancials))).scalars().all()
    new_emails = ['kushnar080868@mail.ru', 'sanekkushnarenko777@gmail.com']
    new_users = (await db.execute(select(User).where(User.email.in_(new_emails)))).scalars().all()
    new_user_ids = {u.id for u in new_users}
    
    total_old = sum(f.forex_investment_usdt for f in all_fins if f.user_id not in new_user_ids and f.forex_investment_usdt > 0)
    TOTAL_PROFIT = 290.0
    updated = 0
    
    if total_old > 0:
        for f in all_fins:
            if f.user_id in new_user_ids or f.forex_investment_usdt <= 0:
                continue
                
            ideal_net_profit = (f.forex_investment_usdt / total_old) * TOTAL_PROFIT * get_investor_share(f)
            current_net_profit = f.forex_investment_usdt * (current_pool_pct / 100) * get_investor_share(f)
            missing_profit = ideal_net_profit - current_net_profit
            
            if missing_profit > 0:
                f.locked_forex_pnl = round(f.locked_forex_pnl + missing_profit, 2)
                updated += 1
                
        await db.commit()
    return {"status": "success", "updated": updated}

from pydantic import BaseModel
class RecalibratePayload(BaseModel):
    target_profit_usdt: float
    new_investor_emails: list[str]

@router.post("/admin/emergency-recalibrate-pool", dependencies=[Depends(get_admin_user)])
async def emergency_recalibrate_pool(payload: RecalibratePayload, db: AsyncSession = Depends(get_db)):
    from models import ForexBotSnapshot, User, UserFinancials
    from constants import INVESTOR_SHARE, get_investor_share
    
    # 1. Update net_invested
    snaps = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalars().all()
    if not snaps:
        return {"status": "error", "detail": "No snapshots"}
    current_balance = snaps[0].balance_usdt
    new_net_invested = current_balance - payload.target_profit_usdt
    
    all_snaps = (await db.execute(select(ForexBotSnapshot))).scalars().all()
    for s in all_snaps:
        s.net_invested = new_net_invested
        
    pool_pnl_pct = (payload.target_profit_usdt / new_net_invested * 100) if new_net_invested > 0 else 0.0
    
    # 2. Reset everyone
    all_fins = (await db.execute(select(UserFinancials))).scalars().all()
    for f in all_fins:
        if f.forex_investment_usdt > 0:
            f.forex_entry_pool_pnl_pct = 0.0
            f.locked_forex_pnl = 0.0
            
    # 3. Handle new investors
    new_users = (await db.execute(select(User).where(User.email.in_(payload.new_investor_emails)))).scalars().all()
    new_user_ids = {u.id for u in new_users}
    
    for f in all_fins:
        if f.user_id in new_user_ids and f.forex_investment_usdt > 0:
            f.forex_entry_pool_pnl_pct = pool_pnl_pct
            
    # 4. Handle old investors
    total_old = sum(f.forex_investment_usdt for f in all_fins if f.user_id not in new_user_ids and f.forex_investment_usdt > 0)
    if total_old > 0:
        for f in all_fins:
            if f.user_id in new_user_ids or f.forex_investment_usdt <= 0:
                continue
            ideal_net_profit = (f.forex_investment_usdt / total_old) * payload.target_profit_usdt * get_investor_share(f)
            current_net_profit = f.forex_investment_usdt * (pool_pnl_pct / 100) * get_investor_share(f)
            missing_profit = ideal_net_profit - current_net_profit
            if missing_profit > 0:
                f.locked_forex_pnl = round(missing_profit, 2)
                
    await db.commit()
    return {
        "status": "success", 
        "new_net_invested": new_net_invested,
        "pool_pnl_pct": pool_pnl_pct,
        "total_old_investment": total_old,
        "target_profit": payload.target_profit_usdt
    }

@router.get("/admin/emergency-restore-hardcoded")
async def emergency_restore_hardcoded(db: AsyncSession = Depends(get_db)):
    from models import User, UserFinancials
    from routers.forex import _get_forex_pool_pnl_pct
    profits = [
        {"email": "maksimsegolev6@gmail.com", "exact_profit": 37.42},
        {"email": "aleko_k@inbox.ru", "exact_profit": 54.43},
        {"email": "juniorvasilva@gmail.com", "exact_profit": 13.95},
        {"email": "sanekkushnarenko777@gmail.com", "exact_profit": 0.0},
        {"email": "kushnar080868@mail.ru", "exact_profit": 0.0}
    ]
    current_pct = await _get_forex_pool_pnl_pct(db)
    updated = 0
    for p in profits:
        user = (await db.execute(select(User).where(User.email == p["email"]))).scalar_one_or_none()
        if user:
            fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == user.id))).scalar_one_or_none()
            if fin:
                fin.locked_forex_pnl = p["exact_profit"]
                fin.forex_entry_pool_pnl_pct = current_pct
                updated += 1
    await db.commit()
@router.get("/admin/emergency-fix-exact-193", dependencies=[Depends(get_admin_user)])
async def emergency_fix_exact_193(db: AsyncSession = Depends(get_db)):
    # Exact distribution of $193 pool profit, accounting for entry points
    correct_profits = {
        "maksimsegolev6@gmail.com": 37.64,
        "aleko_k@inbox.ru": 54.75,
        "juniorvasilva@gmail.com": 14.03,
        "sanekkushnarenko777@gmail.com": 1.22,
        "kushnar080868@mail.ru": 0.40
    }
    
    # Get current pool pct
    snap = (await db.execute(
        select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()
    current_pct = 0.0
    if snap and snap.net_invested > 0:
        current_pct = (snap.balance_usdt - snap.net_invested) / snap.net_invested * 100.0

    updated = 0
    for email, target_pnl in correct_profits.items():
        res = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if res:
            fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == res.id))).scalar_one_or_none()
            if fin:
                # Lock the exact calculated profit
                fin.locked_forex_pnl = target_pnl
                # Reset their entry point to current pool pct so floating profit starts at 0
                fin.forex_entry_pool_pnl_pct = current_pct
                updated += 1
                
    await db.commit()
    return {"status": "success", "updated": updated, "new_pct": current_pct, "applied_profits": correct_profits}

class SetProfitPayload(BaseModel):
    email: str
    exact_profit: float

@router.post("/admin/emergency-set-profit", dependencies=[Depends(get_admin_user)])
async def emergency_set_profit(payload: SetProfitPayload, db: AsyncSession = Depends(get_db)):
    from models import User, UserFinancials
    user = (await db.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()
    if user:
        fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == user.id))).scalar_one_or_none()
        if fin:
            fin.locked_forex_pnl = payload.exact_profit
            from routers.forex import _get_forex_pool_pnl_pct
            current_pct = await _get_forex_pool_pnl_pct(db)
            fin.forex_entry_pool_pnl_pct = current_pct
            await db.commit()
            return {"status": "success", "email": payload.email, "new_profit": payload.exact_profit}
    return {"status": "error"}

@router.get("/admin/emergency-diag")
async def emergency_diag(db: AsyncSession = Depends(get_db)):
    from models import ForexBotSnapshot, UserFinancials, User
    snaps = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()))).scalars().all()
    fins = (await db.execute(select(UserFinancials))).scalars().all()
    users = (await db.execute(select(User))).scalars().all()
    
    snap_data = [{"id": s.id, "ts": str(s.timestamp), "bal": s.balance_usdt, "net": s.net_invested, "hwm": s.hwm} for s in snaps]
    user_map = {u.id: u.email for u in users}
    fin_data = [{"email": user_map.get(f.user_id), "inv": f.forex_investment_usdt, "pct": f.forex_entry_pool_pnl_pct, "locked": f.locked_forex_pnl} for f in fins if f.forex_investment_usdt > 0]
    
    return {"snaps": snap_data, "fins": fin_data}

@router.post("/admin/emergency-fix-user", dependencies=[Depends(get_admin_user)])
async def emergency_fix_user(email: str, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if user:
        fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == user.id))).scalar_one_or_none()
        if fin:
            from routers.forex import _get_forex_pool_pnl_pct
            current_pct = await _get_forex_pool_pnl_pct(db)
            fin.forex_entry_pool_pnl_pct = current_pct
            fin.locked_forex_pnl = 0.0
            await db.commit()
            return {"status": "success", "user": email, "new_entry": current_pct}
    return {"status": "error"}

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
        
    refs = (await db.execute(select(User).where(User.referred_by == user_id))).scalars().all()
    if refs:
        raise HTTPException(status_code=400, detail="Нельзя удалить пользователя, у которого уже есть рефералы")
        
    from sqlalchemy import delete
    from models import DepositRequest, WithdrawalRequest, SupportTicket
    await db.execute(delete(DepositRequest).where(DepositRequest.user_id == user_id))
    await db.execute(delete(WithdrawalRequest).where(WithdrawalRequest.user_id == user_id))
    await db.execute(delete(SupportTicket).where(SupportTicket.user_id == user_id))
    
    await db.delete(user)
    await db.commit()
    return {"status": "deleted"}


@router.get("/admin/backup-db", dependencies=[Depends(get_admin_user)])
async def backup_db(db: AsyncSession = Depends(get_db)):
    """Создает бэкап пользователей и их финансов в формате JSON."""
    users = (await db.execute(select(User))).scalars().all()
    fins = (await db.execute(select(UserFinancials))).scalars().all()
    
    backup_data = []
    fins_map = {f.user_id: f for f in fins}
    
    for u in users:
        f = fins_map.get(u.id)
        backup_data.append({
            "id": u.id, "email": u.email, "is_admin": u.is_admin, "referral_code": u.referral_code,
            "referred_by": u.referred_by, "is_active": u.is_active,
            "financials": {
                "investment_usdt": f.investment_usdt if f else 0,
                "entry_pool_pnl_pct": f.entry_pool_pnl_pct if f else 0,
                "locked_crypto_pnl": f.locked_crypto_pnl if f else 0,
                "forex_investment_usdt": f.forex_investment_usdt if f else 0,
                "forex_entry_pool_pnl_pct": f.forex_entry_pool_pnl_pct if f else 0,
                "locked_forex_pnl": f.locked_forex_pnl if f else 0
            } if f else None
        })
    return {"timestamp": datetime.utcnow().isoformat(), "users_count": len(users), "data": backup_data}


@router.post("/admin/migrate-pnl", dependencies=[Depends(get_admin_user)])
async def migrate_pnl(db: AsyncSession = Depends(get_db)):
    """
    Фиксирует прибыль всех инвесторов перед изменением параметров пула (или перед пополнением).
    Сбрасывает точки входа (entry_pool_pnl_pct) на текущие проценты пулов.
    Защищает прибыль от ретроспективного урезания или размытия.
    """
    return await _migrate_pnl_internal(db)
async def _migrate_pnl_internal(db: AsyncSession, override_crypto_pct: Optional[float] = None, override_forex_pct: Optional[float] = None):
    # 1. Получаем текущие PnL пулов
    crypto_pool_pct = override_crypto_pct if override_crypto_pct is not None else await _get_pool_pnl_pct(db)
    
    # 2. Получаем форекс PnL пула
    from models import ForexBotSnapshot
    forex_snap = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
    forex_pool_pct = override_forex_pct if override_forex_pct is not None else 0.0
    if forex_snap and override_forex_pct is None:
        fx_net_inv = forex_snap.net_invested if forex_snap.net_invested > 0 else (forex_snap.real_start_balance if forex_snap.real_start_balance > 0 else forex_snap.hwm)
        if fx_net_inv > 0:
            forex_pool_pct = round((forex_snap.balance_usdt - fx_net_inv) / fx_net_inv * 100, 4)

    # 3. Фиксируем прибыль
    from constants import INVESTOR_SHARE, get_investor_share
    all_fins = (await db.execute(select(UserFinancials))).scalars().all()
    updated = 0
    total_crypto_locked = 0.0
    
    for f in all_fins:
        # Crypto
        if f.investment_usdt > 0:
            incr = crypto_pool_pct - f.entry_pool_pnl_pct
            gross = f.investment_usdt * (incr / 100)
            user_profit = round(gross * get_investor_share(f), 2)
            if user_profit > 0:
                f.locked_crypto_pnl += user_profit
                total_crypto_locked += user_profit
                f.entry_pool_pnl_pct = crypto_pool_pct
            elif override_crypto_pct is not None:
                # Если это принудительная миграция перед депозитом/выводом
                f.entry_pool_pnl_pct = crypto_pool_pct
        else:
            f.entry_pool_pnl_pct = crypto_pool_pct
        
        # Forex
        if f.forex_investment_usdt > 0:
            fx_incr = forex_pool_pct - f.forex_entry_pool_pnl_pct
            fx_gross = f.forex_investment_usdt * (fx_incr / 100)
            fx_user_profit = round(fx_gross * get_investor_share(f), 2)
            if fx_user_profit > 0:
                f.locked_forex_pnl += fx_user_profit
                f.forex_entry_pool_pnl_pct = forex_pool_pct
            elif override_forex_pct is not None:
                f.forex_entry_pool_pnl_pct = forex_pool_pct
        else:
            f.forex_entry_pool_pnl_pct = forex_pool_pct
        
        updated += 1
        
    await db.commit()
    return {
        "status": "success", 
        "updated_investors": updated, 
        "total_crypto_locked": round(total_crypto_locked, 2),
        "new_crypto_entry_pct": crypto_pool_pct,
        "new_forex_entry_pct": forex_pool_pct
    }

from fastapi import UploadFile, File
import json

@router.post("/admin/restore-ref-bonus", dependencies=[Depends(get_admin_user)])
async def restore_ref_bonus(backup_file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    content = await backup_file.read()
    try:
        backup = json.loads(content)
    except Exception:
        raise HTTPException(status_code=400, detail="Неверный JSON файл")
        
    data = backup.get("data", [])
    backup_fins = {f["id"]: f.get("financials") or {} for f in data}
    
    crypto_pool_pct = await _get_pool_pnl_pct(db)
    from routers.forex import _get_forex_pool_pnl_pct
    forex_pool_pct = await _get_forex_pool_pnl_pct(db)
    
    all_users = (await db.execute(select(User))).scalars().all()
    children_map = {}
    for u in all_users:
        if u.referred_by:
            children_map.setdefault(u.referred_by, []).append(u)
            
    all_fins_db = (await db.execute(select(UserFinancials))).scalars().all()
    fins_db_map = {f.user_id: f for f in all_fins_db}
    
    updated = 0
    from routers.dashboard import _get_status_and_limits
    from constants import REF_FEES
    
    for u in all_users:
        fin_db = fins_db_map.get(u.id)
        if not fin_db: continue
        
        # Get from backup, fallback to current db if backup didn't have financials
        my_backup = backup_fins.get(u.id, {})
        my_inv = my_backup.get("investment_usdt", fin_db.investment_usdt)
        my_fx = my_backup.get("forex_investment_usdt", fin_db.forex_investment_usdt)
        total_volume = my_inv + my_fx
        
        q = [u.id]
        while q:
            curr = q.pop(0)
            for child in children_map.get(curr, []):
                if child.is_active:
                    child_f = backup_fins.get(child.id, {})
                    total_volume += child_f.get("investment_usdt", 0.0) + child_f.get("forex_investment_usdt", 0.0)
                    q.append(child.id)
                    
        status, next_vol, levels_allowed = _get_status_and_limits(total_volume, u.manual_status_override)
        
        crypto_bonus = 0.0
        forex_bonus = 0.0
        
        queue = [(u.id, 1)]
        while queue:
            curr, depth = queue.pop(0)
            if depth > 5: continue
            
            for child in children_map.get(curr, []):
                # Баг 8 fix: компрессия дерева — всегда обходим потомков неактивных,
                # но бонус считаем только для активных (согласно _calc_referral_tree)
                queue.append((child.id, depth + 1))
                
                if not child.is_active: continue
                child_f = backup_fins.get(child.id, {})
                
                inv = child_f.get("investment_usdt", 0.0)
                fx = child_f.get("forex_investment_usdt", 0.0)
                
                # Fetch child's db record to use locked_pnl as fallback
                child_db = fins_db_map.get(child.id)
                
                if inv > 0 and depth <= levels_allowed and depth in REF_FEES:
                    ref_entry = child_f.get("entry_pool_pnl_pct", 0.0)
                    incr = crypto_pool_pct - ref_entry
                    gross = 0.0
                    if incr > 0:
                        gross = inv * (incr / 100)
                    elif child_db and child_db.locked_crypto_pnl > 0:
                        # User created backup AFTER migration. Recover from locked_crypto_pnl
                        gross = child_db.locked_crypto_pnl / get_investor_share(child_db)
                        
                    if gross > 0:
                        crypto_bonus += gross * REF_FEES[depth]
                        
                if fx > 0 and depth <= levels_allowed and depth in REF_FEES:
                    fx_entry = child_f.get("forex_entry_pool_pnl_pct", 0.0)
                    fx_incr = forex_pool_pct - fx_entry
                    fx_gross = 0.0
                    if fx_incr > 0:
                        fx_gross = fx * (fx_incr / 100)
                    elif child_db and child_db.locked_forex_pnl > 0:
                        fx_gross = child_db.locked_forex_pnl / get_investor_share(child_db)
                        
                    if fx_gross > 0:
                        forex_bonus += fx_gross * REF_FEES[depth]
                
        if crypto_bonus > 0 or forex_bonus > 0:
            fin_db.locked_crypto_ref_bonus = round(crypto_bonus, 2)
            fin_db.locked_forex_ref_bonus = round(forex_bonus, 2)
            updated += 1
            
    await db.commit()
    return {"status": "success", "updated": updated}


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
    # Баг 10 fix: добавляем pool_type для различия крипто и форекс заявок
    return [{"id": r.id, "amount": r.amount, "comment": r.comment,
             "status": r.status, "pool_type": r.pool_type, "created_at": str(r.created_at)} for r in rows]


@router.get("/admin/deposits", dependencies=[Depends(get_admin_user)])
async def list_deposit_requests(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(DepositRequest).where(DepositRequest.pool_type == "crypto")
        .order_by(DepositRequest.created_at.desc()).limit(100)
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
        raise HTTPException(status_code=400, detail="Заявка не в ожидании")

    snap = (await db.execute(
        select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()
    if snap:
        positions = (await db.execute(
            select(Position).where(Position.snapshot_id == snap.id)
        )).scalars().all()
        pool_total_without_deposit = snap.balance_usdt + sum(
            p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price) for p in positions
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
            p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price) for p in positions
        )
        post_deposit_pct = round((pool_total_new - ref_new) / ref_new * 100, 4) if ref_new > 0 else 0.0
        
        from sqlalchemy import text
        await db.execute(text(f"UPDATE user_financials SET entry_pool_pnl_pct = {post_deposit_pct} WHERE investment_usdt > 0"))
        await db.commit()

    return {"status": "approved", "amount": actual_amount}

@router.post("/admin/emergency-fix-pnl")
async def emergency_fix_pnl(db: AsyncSession = Depends(get_db)):
    pool_pnl_pct = await _get_pool_pnl_pct(db)
    fins = (await db.execute(select(UserFinancials))).scalars().all()
    for f in fins:
        if f.investment_usdt > 0:
            f.entry_pool_pnl_pct = pool_pnl_pct
    await db.commit()
    return {"status": "success", "new_pct": pool_pnl_pct}

@router.post("/admin/deposits/{request_id}/reject", dependencies=[Depends(get_admin_user)])
async def reject_deposit(request_id: str, db: AsyncSession = Depends(get_db)):
    req = (await db.execute(select(DepositRequest).where(DepositRequest.id == request_id))).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    req.status = "rejected"
    req.updated_at = datetime.utcnow()
    await db.commit()
    return {"status": "rejected"}


# ── Заявки на вывод средств ────────────────────────────────────

@router.post("/withdrawals/request")
async def create_withdrawal_request(
    amount: float,
    comment: str = "",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть больше нуля")
        
    fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == user.id))).scalar_one_or_none()
    if not fin:
        raise HTTPException(status_code=400, detail="Нет активных инвестиций")
        
    crypto_pool_pct = await _get_pool_pnl_pct(db)
    from routers.forex import _get_forex_pool_pnl_pct
    from routers.dashboard import _calc_referral_tree
    forex_pool_pct = await _get_forex_pool_pnl_pct(db)
    
    _, _, _, crypto_ref, _, _ = await _calc_referral_tree(user.id, db, crypto_pool_pct, forex_pool_pct, fin, user.manual_status_override)
    
    incr = crypto_pool_pct - fin.entry_pool_pnl_pct
    gross = fin.investment_usdt * (incr / 100) if incr > 0 else 0.0
    pnl = round(gross * get_investor_share(fin) + fin.locked_crypto_pnl, 2)
    
    pending_reqs = (await db.execute(select(func.sum(WithdrawalRequest.amount)).where(WithdrawalRequest.user_id == user.id, WithdrawalRequest.status == "pending", WithdrawalRequest.pool_type == "crypto"))).scalar() or 0.0
    
    max_available = round(fin.investment_usdt + pnl + crypto_ref - pending_reqs, 2)
    if amount > max_available + 1: # небольшой запас на округление
        raise HTTPException(status_code=400, detail=f"Сумма превышает доступный баланс. Доступно (с учетом других заявок): ~{max_available} $")
        
    req = WithdrawalRequest(user_id=user.id, amount=amount, comment=comment)
    db.add(req)
    await db.commit()
    return {"status": "ok", "message": "Заявка принята. Будет обработана в течение суток."}


@router.get("/withdrawals/my")
async def my_withdrawal_requests(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(WithdrawalRequest).where(WithdrawalRequest.user_id == user.id)
        .order_by(WithdrawalRequest.created_at.desc()).limit(20)
    )).scalars().all()
    return [{"id": r.id, "amount": r.amount, "comment": r.comment,
             "status": r.status, "created_at": str(r.created_at)} for r in rows]


@router.get("/admin/withdrawals", dependencies=[Depends(get_admin_user)])
async def list_withdrawal_requests(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(WithdrawalRequest).where(WithdrawalRequest.pool_type == "crypto")
        .order_by(WithdrawalRequest.created_at.desc()).limit(100)
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


@router.post("/admin/withdrawals/{request_id}/approve", dependencies=[Depends(get_admin_user)])
async def approve_withdrawal(request_id: str, actual_amount: float, db: AsyncSession = Depends(get_db)):
    if actual_amount <= 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть больше нуля")
    req = (await db.execute(select(WithdrawalRequest).where(WithdrawalRequest.id == request_id))).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Заявка уже обработана")

    # Считаем PnL пула ДО вывода средств (так как деньги, скорее всего, уже сняты с Binance)
    snap = (await db.execute(
        select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()
    
    current_pnl_pct = 0.0
    if snap:
        positions = (await db.execute(
            select(Position).where(Position.snapshot_id == snap.id)
        )).scalars().all()
        # Прибавляем выведенную сумму обратно к пулу, чтобы узнать % до вывода
        pool_total_before_withdrawal = snap.balance_usdt + actual_amount + sum(
            p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price) for p in positions
        )
        start = snap.real_start_balance if snap.real_start_balance > 0 else snap.hwm
        total_inv = (await db.execute(select(func.sum(UserFinancials.investment_usdt)))).scalar() or 0.0
        total_wd = (await db.execute(select(func.sum(UserFinancials.withdrawal_usdt)))).scalar() or 0.0
        ref = start + total_inv - total_wd
        if ref <= 0:
            ref = snap.net_invested if snap.net_invested > 0 else start
        current_pnl_pct = round((pool_total_before_withdrawal - ref) / ref * 100, 4) if ref > 0 else 0.0

    # АВТО-МИГРАЦИЯ PNL (чтобы не стереть накопленную прибыль пользователя при уменьшении его депозита)
    await _migrate_pnl_internal(db, override_crypto_pct=current_pnl_pct)

    fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == req.user_id))).scalar_one_or_none()
    if fin:
        fin.investment_usdt = max(fin.investment_usdt - actual_amount, 0.0)
        fin.withdrawal_usdt = round(fin.withdrawal_usdt + actual_amount, 2)
        # Баг 2 fix: при полном выводе обнуляем locked_crypto_pnl, иначе при новом депозите будет двойной счёт
        if fin.investment_usdt <= 0:
            fin.locked_crypto_pnl = 0.0
        fin.updated_at = datetime.utcnow()

    req.status = "approved"
    req.updated_at = datetime.utcnow()
    await db.commit()
    return {"status": "approved", "amount": actual_amount}


@router.post("/admin/withdrawals/{request_id}/reject", dependencies=[Depends(get_admin_user)])
async def reject_withdrawal(request_id: str, db: AsyncSession = Depends(get_db)):
    req = (await db.execute(select(WithdrawalRequest).where(WithdrawalRequest.id == request_id))).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    req.status = "rejected"
    req.updated_at = datetime.utcnow()
    await db.commit()
    return {"status": "rejected"}


@router.get("/admin/news", response_model=list[NewsItemOut])
async def admin_list_news(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    items = (await db.execute(
        select(NewsItem).order_by(NewsItem.created_at.desc())
    )).scalars().all()
    return items


@router.post("/admin/news", response_model=NewsItemOut)
async def admin_create_news(
    data: NewsItemCreate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    item = NewsItem(title=data.title, body=data.body, pool_type=data.pool_type, image_url=data.image_url)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.post("/admin/news/upload-image")
async def admin_upload_news_image(
    file: UploadFile = File(...),
    admin: User = Depends(get_admin_user),
):
    import base64
    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Только JPG, PNG, WEBP, GIF")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(status_code=400, detail="Файл слишком большой (макс 5MB)")
    b64 = base64.b64encode(content).decode("utf-8")
    data_url = f"data:{file.content_type};base64,{b64}"
    return {"url": data_url}


@router.delete("/admin/news/{news_id}")
async def admin_delete_news(
    news_id: str,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    item = (await db.execute(select(NewsItem).where(NewsItem.id == news_id))).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Новость не найдена")
    await db.delete(item)
    await db.commit()
    return {"status": "deleted"}


from schemas import UpdateNicknameIn
@router.post("/profile/nickname")
async def update_nickname(data: UpdateNicknameIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not (3 <= len(data.nickname) <= 10):
        raise HTTPException(status_code=400, detail="Никнейм должен быть от 3 до 10 символов")
    import re
    if not re.match(r"^[a-zA-Z0-9_]+$", data.nickname):
        raise HTTPException(status_code=400, detail="Только английские буквы, цифры и подчеркивание")
    if data.nickname == user.nickname:
        return {"status": "ok"}
    existing = await db.execute(select(User).where(User.nickname == data.nickname))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Никнейм уже занят")
    user.nickname = data.nickname
    await db.commit()
    return {"status": "ok"}

@router.post("/change-password")
async def change_password(
    old_password: str,
    new_password: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Неверный текущий пароль")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Новый пароль должен содержать не менее 6 символов")
    user.password_hash = hash_password(new_password)
    await db.commit()
    return {"status": "ok"}


class SilentWithdrawPayload(BaseModel):
    pool: str
    amount: float

@router.post("/admin/silent-withdraw", dependencies=[Depends(get_admin_user)])
async def admin_silent_withdraw(payload: SilentWithdrawPayload, db: AsyncSession = Depends(get_db)):
    """
    Позволяет админу "тихо" вывести прибыль, уменьшив базовый капитал пула строго пропорционально,
    чтобы процент PnL остался идентичным. (для запуска через F12 Console)
    """
    w = payload.amount
    if w <= 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть больше нуля")

    if payload.pool == "crypto":
        from models import BotSnapshot, Position
        snap = (await db.execute(select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        if not snap:
            raise HTTPException(status_code=404, detail="Снапшот crypto пула не найден.")

        positions = (await db.execute(select(Position).where(Position.snapshot_id == snap.id))).scalars().all()
        pool_total_usdt = snap.balance_usdt + sum(p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price) for p in positions)
        
        _start = snap.real_start_balance if snap.real_start_balance > 0 else snap.hwm
        _total_inv = (await db.execute(select(func.sum(UserFinancials.investment_usdt)))).scalar() or 0.0
        _total_wd = (await db.execute(select(func.sum(UserFinancials.withdrawal_usdt)))).scalar() or 0.0
        
        net_inv = _start + _total_inv - _total_wd
        if net_inv <= 0:
            net_inv = snap.net_invested if snap.net_invested > 0 else _start
            
        if net_inv <= 0 or pool_total_usdt <= 0:
            raise HTTPException(status_code=400, detail="Ошибка: net_inv или pool_total <= 0")

        delta_n = w * (net_inv / pool_total_usdt)
        new_start = _start - delta_n

        snap.real_start_balance = new_start
        if snap.net_invested > 0:
            snap.net_invested = snap.net_invested - delta_n
        await db.commit()
        return {"status": "success", "pool": "crypto", "decreased_base_by": delta_n, "new_start": new_start}

    elif payload.pool == "forex":
        from models import ForexBotSnapshot, ForexPosition
        snap = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        if not snap:
            raise HTTPException(status_code=404, detail="Снапшот forex пула не найден.")

        fx_positions = (await db.execute(select(ForexPosition).where(ForexPosition.snapshot_id == snap.id))).scalars().all()
        forex_pool_positions = sum(p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price) for p in fx_positions)
        pool_total_usdt = snap.balance_usdt + forex_pool_positions

        net_inv = snap.net_invested if snap.net_invested > 0 else (snap.real_start_balance if snap.real_start_balance > 0 else snap.hwm)
        
        if net_inv <= 0 or pool_total_usdt <= 0:
            raise HTTPException(status_code=400, detail="Ошибка: net_inv или pool_total <= 0")

        delta_n = w * (net_inv / pool_total_usdt)
        new_net_inv = net_inv - delta_n

        snap.net_invested = new_net_inv
        snap.real_start_balance = snap.real_start_balance - delta_n if snap.real_start_balance > 0 else 0
        await db.commit()
        return {"status": "success", "pool": "forex", "decreased_base_by": delta_n, "new_net_inv": new_net_inv}

    raise HTTPException(status_code=400, detail="Неверный pool_type")

class RevertSilentPayload(BaseModel):
    pool: str
    decreased_base_by: float

@router.post("/admin/revert-silent-withdraw", dependencies=[Depends(get_admin_user)])
async def admin_revert_silent_withdraw(payload: RevertSilentPayload, db: AsyncSession = Depends(get_db)):
    """Откат тихого вывода. Восстанавливает базу во всех свежих снапшотах."""
    if payload.pool == "crypto":
        from models import BotSnapshot
        snaps = (await db.execute(select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(20))).scalars().all()
        for s in snaps:
            s.real_start_balance += payload.decreased_base_by
            if s.net_invested > 0:
                s.net_invested += payload.decreased_base_by
        await db.commit()
        return {"status": "success"}

    elif payload.pool == "forex":
        from models import ForexBotSnapshot
        snaps = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(20))).scalars().all()
        for s in snaps:
            s.net_invested += payload.decreased_base_by
            s.real_start_balance += payload.decreased_base_by
        await db.commit()
        return {"status": "success"}

@router.get("/admin/users/{user_id}/tree", dependencies=[Depends(get_admin_user)])
async def get_user_referral_tree(user_id: str, db: AsyncSession = Depends(get_db)):
    from routers.dashboard import _calc_referral_tree
    from routers.forex import _get_forex_pool_pnl_pct
    
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
        
    fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == user_id))).scalar_one_or_none()
    crypto_pool_pct = await _get_pool_pnl_pct(db)
    forex_pool_pct = await _get_forex_pool_pnl_pct(db)
    
    _, _, _, _, _, refs_info = await _calc_referral_tree(user_id, db, crypto_pool_pct, forex_pool_pct, fin, user.manual_status_override)
    return {"referrals": refs_info}

