from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import BotSnapshot, Position, Trade, AIFeedEntry, UserFinancials
from schemas import DashboardOut, PositionOut, TradeOut, AIFeedOut
from security import get_current_user
from models import User

router = APIRouter(prefix="/api", tags=["dashboard"])

@router.get("/dashboard", response_model=DashboardOut)
async def dashboard(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    snap = (await db.execute(
        select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()

    # Финансы пользователя
    fin = (await db.execute(
        select(UserFinancials).where(UserFinancials.user_id == user.id)
    )).scalar_one_or_none()
    user_investment = fin.investment_usdt if fin else 0.0

    if not snap:
        return DashboardOut(
            balance_usdt=0, pool_total_usdt=0, pool_positions_usdt=0,
            mode="OFFLINE", hwm=0, drawdown_pct=0, server_online=False,
            last_updated=None,
            user_investment=user_investment, user_pnl=0, user_pnl_pct=0,
            positions=[], recent_trades=[], ai_feed=[],
        )

    positions = (await db.execute(
        select(Position).where(Position.snapshot_id == snap.id)
    )).scalars().all()

    trades = (await db.execute(
        select(Trade).order_by(Trade.timestamp.desc()).limit(15)
    )).scalars().all()

    ai_feed = (await db.execute(
        select(AIFeedEntry).order_by(AIFeedEntry.timestamp.desc()).limit(20)
    )).scalars().all()

    pool_positions_usdt = sum(p.amount * p.avg_price for p in positions)
    pool_total_usdt = snap.balance_usdt + pool_positions_usdt

    # Сервер онлайн если последний снимок не старше 30 минут
    server_online = (datetime.utcnow() - snap.timestamp) < timedelta(minutes=30)

    # PnL пользователя: пропорционально drawdown_pct бота
    user_pnl = round(user_investment * (snap.drawdown_pct / 100), 2) if user_investment > 0 else 0.0
    user_pnl_pct = round(snap.drawdown_pct, 2)

    return DashboardOut(
        balance_usdt=snap.balance_usdt,
        pool_total_usdt=round(pool_total_usdt, 2),
        pool_positions_usdt=round(pool_positions_usdt, 2),
        mode=snap.mode,
        hwm=snap.hwm,
        drawdown_pct=snap.drawdown_pct,
        server_online=server_online,
        last_updated=snap.timestamp.isoformat(),
        user_investment=user_investment,
        user_pnl=user_pnl,
        user_pnl_pct=user_pnl_pct,
        positions=[PositionOut(symbol=p.symbol, amount=p.amount, avg_price=p.avg_price) for p in positions],
        recent_trades=[TradeOut(symbol=t.symbol, action=t.action, amount=t.amount,
                                price=t.price, pnl=t.pnl, timestamp=t.timestamp) for t in trades],
        ai_feed=[AIFeedOut(timestamp=a.timestamp, action=a.action,
                           symbol=a.symbol, reason=a.reason) for a in ai_feed],
    )
