from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import VirtualAccount, VirtualTrade, BotSnapshot, Position, DEMO_START_BALANCE
from security import get_current_user
from models import User

router = APIRouter(prefix="/api/demo", tags=["demo"])

@router.get("/account")
async def get_demo_account(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Возвращает демо-счёт. Создаёт автоматически если не существует."""
    va = (await db.execute(select(VirtualAccount).where(VirtualAccount.user_id == user.id))).scalar_one_or_none()

    if not va:
        va = VirtualAccount(user_id=user.id, balance_usdt=DEMO_START_BALANCE, start_balance=DEMO_START_BALANCE)
        db.add(va)
        await db.commit()
        await db.refresh(va)

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

    # Последние виртуальные сделки
    trades = (await db.execute(
        select(VirtualTrade)
        .where(VirtualTrade.user_id == user.id)
        .order_by(VirtualTrade.timestamp.desc())
        .limit(20)
    )).scalars().all()

    pnl = va.balance_usdt - va.start_balance
    pnl_pct = (pnl / va.start_balance) * 100

    return {
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


@router.post("/reset")
async def reset_demo_account(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Сбрасывает демо-счёт до начального баланса."""
    va = (await db.execute(select(VirtualAccount).where(VirtualAccount.user_id == user.id))).scalar_one_or_none()
    if va:
        va.balance_usdt = DEMO_START_BALANCE
        from datetime import datetime
        va.updated_at = datetime.utcnow()
        # Удаляем историю виртуальных сделок
        trades = (await db.execute(select(VirtualTrade).where(VirtualTrade.user_id == user.id))).scalars().all()
        for t in trades:
            await db.delete(t)
        await db.commit()
    return {"status": "ok", "balance": DEMO_START_BALANCE}
