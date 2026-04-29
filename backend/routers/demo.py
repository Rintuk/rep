from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import (VirtualAccount, VirtualTrade, BotSnapshot, Position,
                    ForexVirtualAccount, ForexVirtualTrade, ForexBotSnapshot, ForexPosition)
from security import get_current_user
from models import User
from constants import INVESTOR_SHARE

router = APIRouter(prefix="/api/demo", tags=["demo"])


# ── Крипто демо ───────────────────────────────────────────────────────────────

@router.get("/account")
async def get_demo_account(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    va = (await db.execute(select(VirtualAccount).where(VirtualAccount.user_id == user.id))).scalar_one_or_none()

    if not va or not va.is_started:
        return {"is_started": False, "balance_usdt": 0, "start_balance": 0,
                "pnl": 0, "pnl_pct": 0, "positions": [], "trades": [],
                "created_at": None, "updated_at": None}

    snap = (await db.execute(
        select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()

    positions = []
    if snap and va.start_real_total > 0:
        real_positions = (await db.execute(
            select(Position).where(Position.snapshot_id == snap.id)
        )).scalars().all()
        scale = va.start_balance / va.start_real_total
        for p in real_positions:
            cur_price = p.current_price if p.current_price > 0 else p.avg_price
            positions.append({"symbol": p.symbol, "amount": round(p.amount * scale, 6),
                               "avg_price": p.avg_price, "value": round(p.amount * cur_price * scale, 2)})

    trades = (await db.execute(
        select(VirtualTrade).where(VirtualTrade.user_id == user.id)
        .order_by(VirtualTrade.timestamp.desc()).limit(20)
    )).scalars().all()

    net_balance = round(va.balance_usdt, 2)
    net_pnl = round(net_balance - va.start_balance, 2)
    pnl_pct = round((net_pnl / va.start_balance * 100) if va.start_balance > 0 else 0, 2)
    return {
        "is_started": True, "balance_usdt": net_balance, "start_balance": va.start_balance,
        "pnl": net_pnl, "pnl_pct": pnl_pct, "positions": positions,
        "trades": [{"symbol": t.symbol, "action": t.action, "amount": t.amount, "price": t.price,
                    "pnl": t.pnl, "timestamp": t.timestamp} for t in trades],
        "created_at": va.created_at.isoformat(), "updated_at": va.updated_at.isoformat(),
    }


@router.post("/start")
async def start_demo_account(
    amount: float = Query(..., gt=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    snap = (await db.execute(
        select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()

    real_total = 0.0
    if snap:
        snap_positions = (await db.execute(
            select(Position).where(Position.snapshot_id == snap.id)
        )).scalars().all()
        real_total = snap.balance_usdt + sum(
            p.amount * (p.current_price if p.current_price > 0 else p.avg_price) for p in snap_positions
        )

    va = (await db.execute(select(VirtualAccount).where(VirtualAccount.user_id == user.id))).scalar_one_or_none()
    if not va:
        va = VirtualAccount(user_id=user.id, balance_usdt=amount, start_balance=amount,
                            start_real_total=real_total, is_started=True)
        db.add(va)
    else:
        va.balance_usdt = amount
        va.start_balance = amount
        va.start_real_total = real_total
        va.is_started = True
        va.updated_at = datetime.utcnow()
        trades = (await db.execute(select(VirtualTrade).where(VirtualTrade.user_id == user.id))).scalars().all()
        for t in trades:
            await db.delete(t)

    await db.commit()
    return {"status": "ok", "balance": amount, "start_real_total": real_total}


@router.post("/reset")
async def reset_demo_account(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    va = (await db.execute(select(VirtualAccount).where(VirtualAccount.user_id == user.id))).scalar_one_or_none()
    if va:
        va.balance_usdt = 0
        va.start_balance = 0
        va.is_started = False
        va.updated_at = datetime.utcnow()
        trades = (await db.execute(select(VirtualTrade).where(VirtualTrade.user_id == user.id))).scalars().all()
        for t in trades:
            await db.delete(t)
        await db.commit()
    return {"status": "ok"}


# ── Форекс демо ───────────────────────────────────────────────────────────────

@router.get("/forex/account")
async def get_forex_demo_account(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    va = (await db.execute(
        select(ForexVirtualAccount).where(ForexVirtualAccount.user_id == user.id)
    )).scalar_one_or_none()

    if not va or not va.is_started:
        return {"is_started": False, "balance_usdt": 0, "start_balance": 0,
                "pnl": 0, "pnl_pct": 0, "positions": [], "trades": [],
                "created_at": None, "updated_at": None}

    snap = (await db.execute(
        select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()

    positions = []
    pool_positions_pnl = 0.0

    if snap and va.start_real_total > 0:
        real_positions = (await db.execute(
            select(ForexPosition).where(ForexPosition.snapshot_id == snap.id)
        )).scalars().all()
        scale = va.start_balance / va.start_real_total
        for p in real_positions:
            cur_price = p.current_price if p.current_price > 0 else p.avg_price
            pool_positions_pnl += p.amount * scale
            positions.append({"symbol": p.symbol, "amount": round(p.amount * scale, 6),
                               "avg_price": p.avg_price, "value": round(p.amount * scale, 2)})

    net_balance = round(va.balance_usdt, 2)
    net_pnl = round(net_balance - va.start_balance, 2)

    trades = (await db.execute(
        select(ForexVirtualTrade).where(ForexVirtualTrade.user_id == user.id)
        .order_by(ForexVirtualTrade.timestamp.desc()).limit(20)
    )).scalars().all()

    pnl_pct = round((net_pnl / va.start_balance * 100) if va.start_balance > 0 else 0, 2)
    return {
        "is_started": True, "balance_usdt": net_balance, "start_balance": va.start_balance,
        "pnl": net_pnl, "pnl_pct": pnl_pct,
        "pool_positions_pnl": round(pool_positions_pnl, 2),
        "positions": positions,
        "trades": [{"symbol": t.symbol, "action": t.action, "amount": t.amount, "price": t.price,
                    "pnl": t.pnl, "timestamp": t.timestamp} for t in trades],
        "created_at": va.created_at.isoformat(), "updated_at": va.updated_at.isoformat(),
    }


@router.post("/forex/start")
async def start_forex_demo_account(
    amount: float = Query(..., gt=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    snap = (await db.execute(
        select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()

    real_total = snap.balance_usdt if snap else 0.0

    va = (await db.execute(
        select(ForexVirtualAccount).where(ForexVirtualAccount.user_id == user.id)
    )).scalar_one_or_none()
    if not va:
        va = ForexVirtualAccount(user_id=user.id, balance_usdt=amount, start_balance=amount,
                                  start_real_total=real_total, is_started=True)
        db.add(va)
    else:
        va.balance_usdt = amount
        va.start_balance = amount
        va.start_real_total = real_total
        va.is_started = True
        va.updated_at = datetime.utcnow()
        trades = (await db.execute(
            select(ForexVirtualTrade).where(ForexVirtualTrade.user_id == user.id)
        )).scalars().all()
        for t in trades:
            await db.delete(t)

    await db.commit()
    return {"status": "ok", "balance": amount, "start_real_total": real_total}


@router.post("/forex/reset")
async def reset_forex_demo_account(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    va = (await db.execute(
        select(ForexVirtualAccount).where(ForexVirtualAccount.user_id == user.id)
    )).scalar_one_or_none()
    if va:
        va.balance_usdt = 0
        va.start_balance = 0
        va.is_started = False
        va.updated_at = datetime.utcnow()
        trades = (await db.execute(
            select(ForexVirtualTrade).where(ForexVirtualTrade.user_id == user.id)
        )).scalars().all()
        for t in trades:
            await db.delete(t)
        await db.commit()
    return {"status": "ok"}
