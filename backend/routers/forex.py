from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import (User, UserFinancials, ForexBotSnapshot, ForexPosition, ForexTrade,
                    ForexAIFeedEntry, DepositRequest, WithdrawalRequest)
from security import get_admin_user, get_current_user
from datetime import datetime, timedelta
from constants import INVESTOR_SHARE, POOL_FEE, L1_REF_FEE, MIN_REF_INVESTMENT

router = APIRouter(prefix="/auth", tags=["forex"])


async def _get_forex_pool_pnl_pct(db: AsyncSession) -> float:
    snap = (await db.execute(
        select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()
    if not snap:
        return 0.0
    positions = (await db.execute(
        select(ForexPosition).where(ForexPosition.snapshot_id == snap.id)
    )).scalars().all()
    pool_total = snap.balance_usdt + sum(
        p.amount * (p.current_price if p.current_price > 0 else p.avg_price) for p in positions
    )
    ref = snap.net_invested if snap.net_invested > 0 else (
        snap.real_start_balance if snap.real_start_balance > 0 else snap.hwm
    )
    return round((pool_total - ref) / ref * 100, 4) if ref > 0 else 0.0


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
            p.amount * (p.current_price if p.current_price > 0 else p.avg_price)
            for p in snap_positions
        )
        pool_free = snap.balance_usdt
        pool_total = pool_free + pool_positions_usdt
        positions = [{"symbol": p.symbol, "amount": p.amount, "avg_price": p.avg_price,
                      "current_price": p.current_price if p.current_price > 0 else p.avg_price,
                      "value": round(p.amount * (p.current_price if p.current_price > 0 else p.avg_price), 2)}
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
            snap.real_start_balance if snap.real_start_balance > 0 else snap.hwm
        )
        real_start = snap.real_start_balance if snap.real_start_balance > 0 else snap.hwm
        if net_invested_pool > 0:
            pool_pnl_usdt = round(pool_total - net_invested_pool, 2)
            pool_pnl_pct = round((pool_total - net_invested_pool) / net_invested_pool * 100, 4)

    total_gross_pnl = total_admin_pnl = 0.0
    investors_table = []
    for u in investors:
        fin = fins_map.get(u.id)
        inv = fin.forex_investment_usdt if fin else 0.0
        refs_count = sum(1 for x in all_users if x.referred_by == u.id)
        pnl = 0.0
        if inv > 0 and snap and net_invested_pool > 0:
            entry_pct = fin.forex_entry_pool_pnl_pct if fin else 0.0
            incremental = pool_pnl_pct - entry_pct
            gross_pnl = inv * (incremental / 100)
            pnl = round(gross_pnl * INVESTOR_SHARE, 2)
            total_gross_pnl += gross_pnl
            has_referrer = u.referred_by is not None and any(
                x.id == u.referred_by and x.is_active and not x.is_admin
                and (fins_map[x.id].forex_investment_usdt if x.id in fins_map else 0.0) >= MIN_REF_INVESTMENT
                for x in all_users
            )
            admin_fee = POOL_FEE if has_referrer else POOL_FEE + L1_REF_FEE
            total_admin_pnl += gross_pnl * admin_fee
        ref_income = 0.0
        if inv >= MIN_REF_INVESTMENT and snap and net_invested_pool > 0:
            for ref_user in all_users:
                if ref_user.referred_by != u.id or not ref_user.is_active:
                    continue
                ref_fin = fins_map.get(ref_user.id)
                ref_inv = ref_fin.forex_investment_usdt if ref_fin else 0.0
                ref_entry = ref_fin.forex_entry_pool_pnl_pct if ref_fin else 0.0
                ref_incr = pool_pnl_pct - ref_entry
                if ref_inv > 0 and ref_incr > 0:
                    ref_income += ref_inv * (ref_incr / 100) * L1_REF_FEE
        investors_table.append({
            "id": u.id, "email": u.email, "created_at": str(u.created_at),
            "investment": inv, "withdrawal": fin.forex_withdrawal_usdt if fin else 0.0,
            "pnl": pnl, "referrals_count": refs_count,
            "ref_income": round(ref_income, 2),
        })

    admin_income = round(total_admin_pnl, 2) if total_admin_pnl > 0 else 0.0
    admin_own_capital = round(max(net_invested_pool - total_invested, 0.0), 2)
    admin_own_pnl = round(admin_own_capital * (pool_pnl_pct / 100), 2) if admin_own_capital > 0 else 0.0

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

    result = []
    for s in clean_snaps:
        positions = (await db.execute(
            select(ForexPosition).where(ForexPosition.snapshot_id == s.id)
        )).scalars().all()
        pool_positions = sum(p.amount * (p.current_price if p.current_price > 0 else p.avg_price) for p in positions)
        pool_total = round(s.balance_usdt + pool_positions, 2)
        pnl = round(pool_total - s.net_invested, 2)
        pnl_pct = round((pnl / s.net_invested) * 100, 2)
        result.append({"ts": s.timestamp.strftime("%d.%m %H:%M"), "pool_total": pool_total,
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

    current_pnl_pct = await _get_forex_pool_pnl_pct(db)
    fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == user_id))).scalar_one_or_none()

    if fin:
        old_inv = fin.forex_investment_usdt
        if forex_investment_usdt > 0 and old_inv != forex_investment_usdt:
            if old_inv <= 0:
                fin.forex_entry_pool_pnl_pct = current_pnl_pct
            elif forex_investment_usdt > old_inv:
                fin.forex_entry_pool_pnl_pct = round(
                    (old_inv * fin.forex_entry_pool_pnl_pct + (forex_investment_usdt - old_inv) * current_pnl_pct)
                    / forex_investment_usdt, 4
                )
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

    fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == req.user_id))).scalar_one_or_none()
    if fin:
        fin.forex_investment_usdt = max(fin.forex_investment_usdt - actual_amount, 0.0)
        fin.forex_withdrawal_usdt = round(fin.forex_withdrawal_usdt + actual_amount, 2)
        fin.updated_at = datetime.utcnow()

    req.status = "approved"
    req.updated_at = datetime.utcnow()
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
    snaps = (await db.execute(select(ForexBotSnapshot))).scalars().all()
    for s in snaps:
        s.net_invested = round(s.net_invested + add_amount, 4)
    await db.commit()
    return {
        "updated_snapshots": len(snaps),
        "add_amount": add_amount,
        "message": f"Форекс net_invested скорректирован на +{add_amount} $ в {len(snaps)} снимках",
    }
