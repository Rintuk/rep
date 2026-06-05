from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import (User, UserFinancials, ForexBotSnapshot, ForexPosition, ForexTrade,
                    ForexAIFeedEntry, ForexVirtualAccount, ForexVirtualTrade,
                    DepositRequest, WithdrawalRequest)
from security import get_admin_user, get_current_user
from datetime import datetime, timedelta
from constants import INVESTOR_SHARE, POOL_FEE, REF_FEES, STATUS_THRESHOLDS, get_investor_share

router = APIRouter(prefix="/auth", tags=["forex"])


# Override удален, используем только БД

async def _get_forex_pool_pnl_pct(db: AsyncSession) -> float:
    snap = (await db.execute(
        select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()
    if not snap:
        return 0.0
    ref = snap.net_invested if snap.net_invested > 0 else (
        snap.real_start_balance if snap.real_start_balance != 0.0 else snap.hwm
    )
    return round((snap.balance_usdt - ref) / ref * 100, 4) if ref > 0 else 0.0


# ── Форекс обзор для администратора ──────────────────────────────────────────

@router.get("/admin/forex-overview", dependencies=[Depends(get_admin_user)])
async def admin_forex_overview(db: AsyncSession = Depends(get_db)):
    snap = (await db.execute(
        select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()

    pool_total = pool_free = pool_positions_usdt = 0.0
    server_online = False
    positions = trades = ai_feed = []

    if snap:
        server_online = (datetime.utcnow() - snap.timestamp) < timedelta(minutes=30)
        snap_positions = (await db.execute(
            select(ForexPosition).where(ForexPosition.snapshot_id == snap.id)
        )).scalars().all()
        pool_positions_usdt = sum(
            p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price)
            for p in snap_positions
        )
        pool_free = snap.balance_usdt
        pool_total = pool_free
        positions = [{"symbol": p.symbol, "amount": p.amount, "avg_price": p.avg_price,
                      "current_price": p.current_price if (p.current_price or 0) > 0 else p.avg_price,
                      "value": round(p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price), 2)}
                     for p in snap_positions]

        all_trade_rows = (await db.execute(
            select(ForexTrade).order_by(ForexTrade.timestamp.desc()).limit(500)
        )).scalars().all()
        seen_trades: set = set()
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
            select(ForexAIFeedEntry).order_by(ForexAIFeedEntry.timestamp.desc()).limit(10)
        )).scalars().all()
        ai_feed = [{"timestamp": a.timestamp, "action": a.action,
                    "symbol": a.symbol, "reason": a.reason} for a in ai_rows]

    all_users = (await db.execute(select(User))).scalars().all()
    all_fins = (await db.execute(select(UserFinancials))).scalars().all()
    fins_map = {f.user_id: f for f in all_fins}

    investors = [u for u in all_users if u.is_active and not u.is_admin]
    pending = [u for u in all_users if not u.is_active and not u.is_admin]

    total_invested = sum(fins_map[u.id].forex_investment_usdt for u in investors if u.id in fins_map)
    total_withdrawn = sum(fins_map[u.id].forex_withdrawal_usdt for u in investors if u.id in fins_map)

    referrals_l1 = []
    for u in all_users:
        if u.referred_by and any(a.id == u.referred_by and not a.is_admin for a in all_users):
            referrer = next((a for a in all_users if a.id == u.referred_by), None)
            fin = fins_map.get(u.id)
            referrals_l1.append({
                "id": u.id, "email": u.email, "is_active": u.is_active,
                "referred_by_email": referrer.email if referrer else "",
                "investment": fin.forex_investment_usdt if fin else 0.0,
            })

    pool_pnl_usdt = pool_pnl_pct = net_invested_pool = real_start = 0.0
    if snap:
        net_invested_pool = snap.net_invested if snap.net_invested > 0 else (
            snap.real_start_balance if snap.real_start_balance != 0.0 else snap.hwm
        )
        real_start = snap.real_start_balance if snap.real_start_balance != 0.0 else snap.hwm
        if net_invested_pool > 0:
            pool_pnl_usdt = round(pool_free - net_invested_pool, 2)
            pool_pnl_pct = round((pool_free - net_invested_pool) / net_invested_pool * 100, 4)

    total_gross_pnl = total_admin_pnl = 0.0
    investors_table = []
    from routers.auth import _get_pool_pnl_pct
    from routers.dashboard import _calc_referral_tree
    crypto_pool_pct = await _get_pool_pnl_pct(db)

    for u in investors:
        fin = fins_map.get(u.id)
        inv = fin.forex_investment_usdt if fin else 0.0
        refs_count = sum(1 for x in all_users if x.referred_by == u.id)
        pnl = 0.0
        if inv > 0 and snap and net_invested_pool > 0:
            entry_pct = fin.forex_entry_pool_pnl_pct if fin else 0.0
            incremental = pool_pnl_pct - entry_pct
            gross_pnl = inv * (incremental / 100)
            locked_forex_pnl = fin.locked_forex_pnl if fin else 0.0
            pnl = round(gross_pnl * get_investor_share(fin) + locked_forex_pnl, 2)
            
            # Gross
            locked_gross = locked_forex_pnl / get_investor_share(fin)
            
            total_gross_pnl += (gross_pnl + locked_gross)
            admin_fee = POOL_FEE
            total_admin_pnl += (gross_pnl + locked_gross) * admin_fee
            
        status, total_volume, next_vol, crypto_ref, forex_ref, refs_info = await _calc_referral_tree(
            u.id, db, crypto_pool_pct, pool_pnl_pct, fin, u.manual_status_override
        )
        
        investors_table.append({
            "id": u.id, "email": u.email, "created_at": str(u.created_at),
            "investment": inv, "withdrawal": fin.forex_withdrawal_usdt if fin else 0.0,
            "pnl": pnl, "referrals_count": refs_count,
            "ref_income": round(forex_ref, 2),
            "status": status,
            "total_volume": round(total_volume, 2),
            "next_vol": next_vol,
        })

    admin_income = round(total_admin_pnl, 2) if total_admin_pnl > 0 else 0.0
    admin_own_capital = round(max(net_invested_pool - total_invested, 0.0), 2)
    # Admin profit
    # Рассчитываем профит админа как остаток от общей прибыли пула, чтобы избежать математических дыр
    # при размытии пула (когда net_invested меняется, а у админа нет фиксированной точки входа)
    admin_own_pnl = round(pool_pnl_usdt - total_gross_pnl - admin_income, 2)
    if admin_own_pnl < 0 and admin_own_capital <= 0:
        admin_own_pnl = 0.0

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
        "admin_total_income": round(admin_income + admin_own_pnl, 2),
        "pool_profit": round(total_gross_pnl, 2),
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


@router.get("/admin/forex-pool-history", dependencies=[Depends(get_admin_user)])
async def admin_forex_pool_history(db: AsyncSession = Depends(get_db)):
    snaps = (await db.execute(
        select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.asc()).limit(100)
    )).scalars().all()

    valid = [s for s in snaps if s.net_invested > 0]
    if not valid:
        return []

    ref_net = valid[-1].net_invested
    clean_snaps = [s for s in valid if ref_net * 0.5 <= s.net_invested <= ref_net * 1.1]
    if not clean_snaps:
        return []

    for s in clean_snaps:
        ref = s.net_invested
        pnl = round(s.balance_usdt - ref, 2)
        pnl_pct = round((pnl / ref) * 100, 2)
        result.append({"ts": s.timestamp.strftime("%d.%m %H:%M"), "pool_total": round(s.balance_usdt, 2),
                        "pnl": pnl, "pnl_pct": pnl_pct})
    return result


# ── Форекс финансы пользователей ─────────────────────────────────────────────

@router.patch("/admin/users/{user_id}/forex-financials", dependencies=[Depends(get_admin_user)])
async def update_user_forex_financials(
    user_id: str,
    forex_investment_usdt: float = 0.0,
    forex_withdrawal_usdt: float = 0.0,
    note: str = "",
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.id == user_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == user_id))).scalar_one_or_none()
    old_inv = fin.forex_investment_usdt if fin else 0.0
    old_wd  = fin.forex_withdrawal_usdt if fin else 0.0

    current_pnl_pct = await _get_forex_pool_pnl_pct(db)

    if fin:
        if forex_investment_usdt > 0 and old_inv != forex_investment_usdt:
            if old_inv <= 0:
                fin.forex_entry_pool_pnl_pct = current_pnl_pct
            elif forex_investment_usdt > old_inv:
                # Фиксируем плавающую прибыль старой суммы, затем обновляем точку входа.
                # Новые деньги начинают зарабатывать только с этого момента.
                incr = current_pnl_pct - fin.forex_entry_pool_pnl_pct
                if incr > 0:
                    gross = old_inv * (incr / 100)
                    user_profit = round(gross * get_investor_share(fin), 2)
                    if user_profit > 0:
                        fin.locked_forex_pnl += user_profit
                fin.forex_entry_pool_pnl_pct = current_pnl_pct
        fin.forex_investment_usdt = forex_investment_usdt
        fin.forex_withdrawal_usdt = forex_withdrawal_usdt
        fin.note = note
        fin.updated_at = datetime.utcnow()
    else:
        db.add(UserFinancials(
            user_id=user_id,
            forex_investment_usdt=forex_investment_usdt,
            forex_withdrawal_usdt=forex_withdrawal_usdt,
            note=note,
            forex_entry_pool_pnl_pct=current_pnl_pct if forex_investment_usdt > 0 else 0.0,
        ))

    await db.commit()
    return {"status": "ok"}


# ── Форекс депозиты (пользователь) ───────────────────────────────────────────

@router.post("/forex-deposits/request")
async def create_forex_deposit_request(
    amount: float,
    comment: str = "",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть больше нуля")
    req = DepositRequest(user_id=user.id, amount=amount, comment=comment, pool_type="forex")
    db.add(req)
    await db.commit()
    return {"status": "ok", "message": "Заявка принята. Будет обработана в течение суток."}


@router.get("/forex-deposits/my")
async def my_forex_deposit_requests(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(DepositRequest)
        .where(DepositRequest.user_id == user.id, DepositRequest.pool_type == "forex")
        .order_by(DepositRequest.created_at.desc()).limit(20)
    )).scalars().all()
    return [{"id": r.id, "amount": r.amount, "comment": r.comment,
             "status": r.status, "created_at": str(r.created_at)} for r in rows]


# ── Форекс депозиты (admin) ───────────────────────────────────────────────────

@router.get("/admin/forex-deposits", dependencies=[Depends(get_admin_user)])
async def list_forex_deposits(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(DepositRequest).where(DepositRequest.pool_type == "forex")
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


@router.post("/admin/forex-deposits/{request_id}/approve", dependencies=[Depends(get_admin_user)])
async def approve_forex_deposit(request_id: str, actual_amount: float, db: AsyncSession = Depends(get_db)):
    if actual_amount <= 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть больше нуля")
    req = (await db.execute(
        select(DepositRequest).where(DepositRequest.id == request_id, DepositRequest.pool_type == "forex")
    )).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Заявка уже обработана")

    current_pnl_pct = await _get_forex_pool_pnl_pct(db)

    # АВТО-МИГРАЦИЯ PNL (защита от размытия процентов)
    from routers.auth import _migrate_pnl_internal
    await _migrate_pnl_internal(db, override_forex_pct=current_pnl_pct)

    fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == req.user_id))).scalar_one_or_none()
    if fin:
        old_inv = fin.forex_investment_usdt
        new_inv = old_inv + actual_amount
        if old_inv <= 0:
            fin.forex_entry_pool_pnl_pct = current_pnl_pct
        else:
            fin.forex_entry_pool_pnl_pct = round(
                (old_inv * fin.forex_entry_pool_pnl_pct + actual_amount * current_pnl_pct) / new_inv, 4
            )
        fin.forex_investment_usdt = new_inv
        fin.updated_at = datetime.utcnow()
    else:
        db.add(UserFinancials(
            user_id=req.user_id,
            forex_investment_usdt=actual_amount,
            forex_entry_pool_pnl_pct=current_pnl_pct,
        ))

    req.status = "approved"
    req.updated_at = datetime.utcnow()
    
    # ВАЖНО: Увеличиваем капитал пула, чтобы депозит не считался прибылью
    snap = (await db.execute(
        select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()
    if snap:
        snap.net_invested += actual_amount
        snap.hwm += actual_amount

    await db.commit()
    return {"status": "approved", "amount": actual_amount}


@router.post("/admin/forex-deposits/{request_id}/reject", dependencies=[Depends(get_admin_user)])
async def reject_forex_deposit(request_id: str, db: AsyncSession = Depends(get_db)):
    req = (await db.execute(
        select(DepositRequest).where(DepositRequest.id == request_id, DepositRequest.pool_type == "forex")
    )).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    req.status = "rejected"
    req.updated_at = datetime.utcnow()
    await db.commit()
    return {"status": "rejected"}


# ── Форекс выводы (пользователь) ──────────────────────────────────────────────

@router.post("/forex-withdrawals/request")
async def create_forex_withdrawal_request(
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
        
    forex_pool_pct = await _get_forex_pool_pnl_pct(db)
    from routers.auth import _get_pool_pnl_pct
    from routers.dashboard import _calc_referral_tree
    crypto_pool_pct = await _get_pool_pnl_pct(db)
    
    _, _, _, _, forex_ref, _ = await _calc_referral_tree(user.id, db, crypto_pool_pct, forex_pool_pct, fin, user.manual_status_override)
    
    fx_incr = forex_pool_pct - fin.forex_entry_pool_pnl_pct
    fx_gross = fin.forex_investment_usdt * (fx_incr / 100) if fx_incr > 0 else 0.0
    fx_pnl = round(fx_gross * get_investor_share(fin) + fin.locked_forex_pnl, 2)
    
    pending_reqs = (await db.execute(select(func.sum(WithdrawalRequest.amount)).where(WithdrawalRequest.user_id == user.id, WithdrawalRequest.status == "pending", WithdrawalRequest.pool_type == "forex"))).scalar() or 0.0
    
    max_available = round(fin.forex_investment_usdt + fx_pnl + forex_ref - pending_reqs, 2)
    if amount > max_available + 1: # небольшой запас на округление
        raise HTTPException(status_code=400, detail=f"Сумма превышает доступный баланс. Доступно (с учетом других заявок): ~{max_available} $")

    req = WithdrawalRequest(user_id=user.id, amount=amount, comment=comment, pool_type="forex")
    db.add(req)
    await db.commit()
    return {"status": "ok", "message": "Заявка принята. Будет обработана в течение суток."}


@router.get("/forex-withdrawals/my")
async def my_forex_withdrawal_requests(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(WithdrawalRequest)
        .where(WithdrawalRequest.user_id == user.id, WithdrawalRequest.pool_type == "forex")
        .order_by(WithdrawalRequest.created_at.desc()).limit(20)
    )).scalars().all()
    return [{"id": r.id, "amount": r.amount, "comment": r.comment,
             "status": r.status, "created_at": str(r.created_at)} for r in rows]


# ── Форекс выводы (admin) ─────────────────────────────────────────────────────

@router.get("/admin/forex-withdrawals", dependencies=[Depends(get_admin_user)])
async def list_forex_withdrawals(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(WithdrawalRequest).where(WithdrawalRequest.pool_type == "forex")
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


@router.post("/admin/forex-withdrawals/{request_id}/approve", dependencies=[Depends(get_admin_user)])
async def approve_forex_withdrawal(request_id: str, actual_amount: float, db: AsyncSession = Depends(get_db)):
    if actual_amount <= 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть больше нуля")
    req = (await db.execute(
        select(WithdrawalRequest).where(WithdrawalRequest.id == request_id, WithdrawalRequest.pool_type == "forex")
    )).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Заявка уже обработана")

    # Считаем PnL пула ДО вывода средств
    forex_snap = (await db.execute(
        select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()
    
    current_pnl_pct = 0.0
    if forex_snap:
        fx_net_inv = forex_snap.net_invested if forex_snap.net_invested > 0 else (forex_snap.real_start_balance if forex_snap.real_start_balance != 0.0 else forex_snap.hwm)
        if fx_net_inv > 0:
            # Прибавляем выведенную сумму обратно к пулу
            pool_total_before = forex_snap.balance_usdt + actual_amount
            current_pnl_pct = round((pool_total_before - fx_net_inv) / fx_net_inv * 100, 4)

    # АВТО-МИГРАЦИЯ PNL
    from routers.auth import _migrate_pnl_internal
    await _migrate_pnl_internal(db, override_forex_pct=current_pnl_pct)

    fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == req.user_id))).scalar_one_or_none()
    if fin:
        fin.forex_investment_usdt = max(fin.forex_investment_usdt - actual_amount, 0.0)
        fin.forex_withdrawal_usdt = round(fin.forex_withdrawal_usdt + actual_amount, 2)
        # Баг 3 fix: при полном выводе обнуляем locked_forex_pnl, иначе при новом депозите будет двойной счёт
        if fin.forex_investment_usdt <= 0:
            fin.locked_forex_pnl = 0.0
        fin.updated_at = datetime.utcnow()

    req.status = "approved"
    req.updated_at = datetime.utcnow()
    
    # ВАЖНО: Уменьшаем капитал пула
    snap = (await db.execute(
        select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()
    if snap:
        snap.net_invested -= actual_amount
        if snap.net_invested < 0:
            snap.net_invested = 0

    await db.commit()
    return {"status": "approved", "amount": actual_amount}


@router.post("/admin/forex-withdrawals/{request_id}/reject", dependencies=[Depends(get_admin_user)])
async def reject_forex_withdrawal(request_id: str, db: AsyncSession = Depends(get_db)):
    req = (await db.execute(
        select(WithdrawalRequest).where(WithdrawalRequest.id == request_id, WithdrawalRequest.pool_type == "forex")
    )).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    req.status = "rejected"
    req.updated_at = datetime.utcnow()
    await db.commit()
    return {"status": "rejected"}


# ── Служебные (admin) ─────────────────────────────────────────────────────────

@router.post("/admin/forex-cleanup-demo", dependencies=[Depends(get_admin_user)])
async def cleanup_forex_demo_snapshots(db: AsyncSession = Depends(get_db)):
    last_snap = (await db.execute(
        select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()

    deleted_snaps = 0
    if last_snap and last_snap.net_invested > 0:
        ref = last_snap.net_invested
        lo, hi = ref * 0.5, ref * 1.1
        bad_snaps = (await db.execute(
            select(ForexBotSnapshot).where(
                (ForexBotSnapshot.net_invested < lo) | (ForexBotSnapshot.net_invested > hi)
            )
        )).scalars().all()
        for s in bad_snaps:
            await db.delete(s)
        deleted_snaps = len(bad_snaps)

    # АВТО-МИГРАЦИЯ PNL: фиксируем форекс-прибыль всех инвесторов ДО сброса точек входа
    from routers.auth import _migrate_pnl_internal
    await _migrate_pnl_internal(db)

    all_fins = (await db.execute(select(UserFinancials))).scalars().all()
    for fin in all_fins:
        fin.forex_entry_pool_pnl_pct = 0.0
    reset_count = len(all_fins)

    await db.commit()
    return {
        "deleted_snapshots": deleted_snaps,
        "reset_investors": reset_count,
        "message": f"Удалено {deleted_snaps} форекс-снимков, сброшено точек входа: {reset_count}",
    }


@router.post("/admin/forex-adjust-net-invested", dependencies=[Depends(get_admin_user)])
async def adjust_forex_net_invested(add_amount: float, db: AsyncSession = Depends(get_db)):
    if add_amount == 0:
        raise HTTPException(status_code=400, detail="add_amount не может быть 0")
        
    from routers.auth import _migrate_pnl_internal
    snap = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
    if snap:
        from models import ForexPosition
        fx_positions = (await db.execute(select(ForexPosition).where(ForexPosition.snapshot_id == snap.id))).scalars().all()
        forex_pool_positions = sum(p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price) for p in fx_positions)
        pool_total = snap.balance_usdt + forex_pool_positions
        
        ref = snap.net_invested if snap.net_invested > 0 else (snap.real_start_balance if snap.real_start_balance != 0.0 else snap.hwm)
        current_pnl_pct = round((pool_total - ref) / ref * 100, 4) if ref > 0 else 0.0
        ref_post = ref + add_amount
        post_adjust_pct = round((pool_total - ref) / ref_post * 100, 4) if ref_post > 0 else 0.0
        
        await _migrate_pnl_internal(db, override_forex_pct=current_pnl_pct, final_forex_pct=post_adjust_pct)
    else:
        await _migrate_pnl_internal(db)
        
    snaps = (await db.execute(select(ForexBotSnapshot))).scalars().all()
    for s in snaps:
        s.net_invested = round(s.net_invested + add_amount, 4)
    await db.commit()
    return {
        "updated_snapshots": len(snaps),
        "add_amount": add_amount,
        "message": f"Форекс net_invested скорректирован на +{add_amount} $ в {len(snaps)} снимках",
    }


@router.post("/admin/forex-adjust-pool-capital", dependencies=[Depends(get_admin_user)])
async def forex_adjust_pool_capital(amount_usdt: float, db: AsyncSession = Depends(get_db)):
    if amount_usdt == 0:
        raise HTTPException(status_code=400, detail="Amount cannot be zero")
        
    snap = (await db.execute(
        select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()
    
    if not snap:
        raise HTTPException(status_code=404, detail="No snapshots found")
        
    snap.net_invested += amount_usdt
    # Optionally update hwm if it's a deposit so it doesn't immediately show as drawdown
    if amount_usdt > 0:
        snap.hwm += amount_usdt
        
    await db.commit()
    return {"status": "success", "new_net_invested": snap.net_invested}


@router.post("/admin/forex-set-exact-profit", dependencies=[Depends(get_admin_user)])
async def forex_set_exact_profit(target_profit: float, db: AsyncSession = Depends(get_db)):
    snap = (await db.execute(
        select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()
    
    if not snap:
        raise HTTPException(status_code=404, detail="No snapshots found")
        
    snap.net_invested = snap.balance_usdt - target_profit
    await db.commit()
    return {"status": "success", "new_net_invested": snap.net_invested, "new_profit": target_profit}

@router.post("/admin/forex-full-reset", dependencies=[Depends(get_admin_user)])
async def forex_full_reset(db: AsyncSession = Depends(get_db)):
    """Полный сброс форекс-пула: снапшоты, финансы пользователей, демо-счета."""
    # Удаляем все снапшоты (CASCADE: позиции, сделки, AI-фид)
    all_snaps = (await db.execute(select(ForexBotSnapshot))).scalars().all()
    for s in all_snaps:
        await db.delete(s)

    # Обнуляем форекс-поля у всех пользователей
    all_fins = (await db.execute(select(UserFinancials))).scalars().all()
    for fin in all_fins:
        fin.forex_investment_usdt = 0.0
        fin.forex_withdrawal_usdt = 0.0
        fin.forex_entry_pool_pnl_pct = 0.0
        fin.updated_at = datetime.utcnow()

    # Сбрасываем форекс виртуальные счета
    all_va = (await db.execute(select(ForexVirtualAccount))).scalars().all()
    for va in all_va:
        va.balance_usdt = 0.0
        va.start_balance = 0.0
        va.start_real_total = 0.0
        va.is_started = False
        va.updated_at = datetime.utcnow()
        # Удаляем все виртуальные сделки этого счёта
        trades = (await db.execute(
            select(ForexVirtualTrade).where(ForexVirtualTrade.user_id == va.user_id)
        )).scalars().all()
        for t in trades:
            await db.delete(t)

    await db.commit()
    return {
        "deleted_snapshots": len(all_snaps),
        "reset_investors": len(all_fins),
        "reset_demo_accounts": len(all_va),
        "message": f"Форекс сброшен: {len(all_snaps)} снапшотов удалено, {len(all_fins)} инвесторов обнулено, {len(all_va)} демо-счетов сброшено",
    }


@router.post("/admin/forex-import-from-crypto", dependencies=[Depends(get_admin_user)])
async def forex_import_from_crypto(db: AsyncSession = Depends(get_db)):
    """Сброс форекс-пула + перенос депозитов из крипто. Точка входа у всех с нуля (сегодня)."""
    # 1. Удаляем все снапшоты форекс (CASCADE: позиции, сделки, AI-фид)
    all_snaps = (await db.execute(select(ForexBotSnapshot))).scalars().all()
    for s in all_snaps:
        await db.delete(s)

    # 2. Сбрасываем форекс виртуальные счета
    all_va = (await db.execute(select(ForexVirtualAccount))).scalars().all()
    for va in all_va:
        va.balance_usdt = 0.0
        va.start_balance = 0.0
        va.start_real_total = 0.0
        va.is_started = False
        va.updated_at = datetime.utcnow()
        trades = (await db.execute(
            select(ForexVirtualTrade).where(ForexVirtualTrade.user_id == va.user_id)
        )).scalars().all()
        for t in trades:
            await db.delete(t)

    # 3. Переносим депозиты из крипто → форекс, точка входа = 0 (с сегодня)
    all_fins = (await db.execute(select(UserFinancials))).scalars().all()
    imported = 0
    for fin in all_fins:
        fin.forex_investment_usdt = fin.investment_usdt
        fin.forex_withdrawal_usdt = fin.withdrawal_usdt
        fin.forex_entry_pool_pnl_pct = 0.0
        fin.updated_at = datetime.utcnow()
        if fin.investment_usdt > 0:
            imported += 1

    await db.commit()
    return {
        "deleted_snapshots": len(all_snaps),
        "reset_demo_accounts": len(all_va),
        "imported_investors": imported,
        "message": f"Форекс сброшен и импортирован из крипто: {imported} инвесторов перенесено, точка входа у всех с нуля",
    }
