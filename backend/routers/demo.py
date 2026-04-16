from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import VirtualAccount, VirtualTrade, BotSnapshot, Position
from security import get_current_user
from models import User

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.get("/account")
async def get_demo_account(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Возвращает демо-счёт. Если не запущен — возвращает is_started=False."""
    va = (await db.execute(select(VirtualAccount).where(VirtualAccount.user_id == user.id))).scalar_one_or_none()

    if not va or not va.is_started:
        return {
            "is_started": False,
            "balance_usdt": 0,
            "start_balance": 0,
            "pnl": 0,
            "pnl_pct": 0,
            "positions": [],
            "trades": [],
            "created_at": None,
            "updated_at": None,
        }

    # Последний снимок бота для позиций
    snap = (await db.execute(
        select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()

    positions = []
    if snap:
        real_positions = (await db.execute(
            select(Position).where(Position.snapshot_id == snap.id)
        )).scalars().all()

        real_total = snap.balance_usdt + sum(p.amount * p.avg_price for p in real_positions)
        if real_total > 0:
            scale = va.balance_usdt / real_total
            for p in real_positions:
                positions.append({
                    "symbol": p.symbol,
                    "amount": round(p.amount * scale, 6),
                    "avg_price": p.avg_price,
                    "value": round(p.amount * p.avg_price * scale, 2),
                })

    trades = (await db.execute(
        select(VirtualTrade)
        .where(VirtualTrade.user_id == user.id)
        .order_by(VirtualTrade.timestamp.desc())
        .limit(20)
    )).scalars().all()

    pnl = va.balance_usdt - va.start_balance
    pnl_pct = (pnl / va.start_balance * 100) if va.start_balance > 0 else 0

    return {
        "is_started": True,
        "balance_usdt": round(va.balance_usdt, 2),
        "start_balance": va.start_balance,
        "pnl": round(pnl, 2),
        "pnl_pct": round(pnl_pct, 2),
        "positions": positions,
        "trades": [
            {
                "symbol": t.symbol,
                "action": t.action,
                "amount": t.amount,
                "price": t.price,
                "pnl": t.pnl,
                "timestamp": t.timestamp,
            } for t in trades
        ],
        "created_at": va.created_at.isoformat(),
        "updated_at": va.updated_at.isoformat(),
    }


@router.post("/start")
async def start_demo_account(
    amount: float = Query(..., gt=0, description="Стартовый баланс в USDT"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Запускает демо-счёт с указанной суммой."""
    va = (await db.execute(select(VirtualAccount).where(VirtualAccount.user_id == user.id))).scalar_one_or_none()

    if not va:
        va = VirtualAccount(
            user_id=user.id,
            balance_usdt=amount,
            start_balance=amount,
            is_started=True,
        )
        db.add(va)
    else:
        va.balance_usdt = amount
        va.start_balance = amount
        va.is_started = True
        va.updated_at = datetime.utcnow()
        # Очищаем старую историю при перезапуске
        trades = (await db.execute(select(VirtualTrade).where(VirtualTrade.user_id == user.id))).scalars().all()
        for t in trades:
            await db.delete(t)

    await db.commit()
    return {"status": "ok", "balance": amount}


@router.post("/reset")
async def reset_demo_account(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Сбрасывает демо-счёт — возвращает в состояние «не запущен»."""
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
