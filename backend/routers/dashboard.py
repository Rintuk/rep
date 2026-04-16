from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import BotSnapshot, Position, Trade, AIFeedEntry
from schemas import DashboardOut, PositionOut, TradeOut, AIFeedOut
from auth import get_current_user
from models import User

router = APIRouter(prefix="/api", tags=["dashboard"])

@router.get("/dashboard", response_model=DashboardOut)
async def dashboard(_: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Берём последний снимок бота
    result = await db.execute(
        select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1)
    )
    snap = result.scalar_one_or_none()

    if not snap:
        return DashboardOut(balance_usdt=0, mode="N/A", hwm=0, drawdown_pct=0,
                            last_updated=None, positions=[], recent_trades=[], ai_feed=[])

    positions = (await db.execute(select(Position).where(Position.snapshot_id == snap.id))).scalars().all()
    trades = (await db.execute(
        select(Trade).order_by(Trade.timestamp.desc()).limit(15)
    )).scalars().all()
    ai_feed = (await db.execute(
        select(AIFeedEntry).order_by(AIFeedEntry.timestamp.desc()).limit(20)
    )).scalars().all()

    return DashboardOut(
        balance_usdt=snap.balance_usdt,
        mode=snap.mode,
        hwm=snap.hwm,
        drawdown_pct=snap.drawdown_pct,
        last_updated=snap.timestamp.isoformat(),
        positions=[PositionOut(symbol=p.symbol, amount=p.amount, avg_price=p.avg_price) for p in positions],
        recent_trades=[TradeOut(symbol=t.symbol, action=t.action, amount=t.amount,
                                price=t.price, pnl=t.pnl, timestamp=t.timestamp) for t in trades],
        ai_feed=[AIFeedOut(timestamp=a.timestamp, action=a.action,
                           symbol=a.symbol, reason=a.reason) for a in ai_feed],
    )
