from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import BotSnapshot, Position, Trade, AIFeedEntry, UserFinancials, User
from schemas import DashboardOut, PositionOut, TradeOut, AIFeedOut
from security import get_current_user

router = APIRouter(prefix="/api", tags=["dashboard"])

ADMIN_FEE   = 0.17   # 17% — доход администратора
L1_REF_FEE  = 0.03   # 3%  — доход реферера L1
INVESTOR_SHARE = 1.0 - ADMIN_FEE - L1_REF_FEE  # 80%

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
            ref_bonus=0,
            positions=[], recent_trades=[], ai_feed=[],
        )

    positions = (await db.execute(
        select(Position).where(Position.snapshot_id == snap.id)
    )).scalars().all()

    from sqlalchemy import distinct, func
    # Дедупликация: берём уникальные сделки по (symbol, action, timestamp, price)
    seen = set()
    all_trades = (await db.execute(
        select(Trade).order_by(Trade.timestamp.desc()).limit(200)
    )).scalars().all()
    trades = []
    for t in all_trades:
        key = (t.symbol, t.action, t.timestamp, t.price)
        if key not in seen:
            seen.add(key)
            trades.append(t)
        if len(trades) >= 15:
            break

    ai_feed = (await db.execute(
        select(AIFeedEntry).order_by(AIFeedEntry.timestamp.desc()).limit(20)
    )).scalars().all()

    pool_positions_usdt = sum(p.amount * (p.current_price if p.current_price > 0 else p.avg_price) for p in positions)
    pool_total_usdt = snap.balance_usdt + pool_positions_usdt

    server_online = (datetime.utcnow() - snap.timestamp) < timedelta(minutes=30)

    # % роста пула от стартового баланса бота
    real_start = snap.real_start_balance if snap.real_start_balance > 0 else snap.hwm
    pool_pnl_pct = round((pool_total_usdt - real_start) / real_start * 100, 2) if real_start > 0 else round(snap.drawdown_pct, 2)

    # Чистый PnL инвестора: 80% от его доли роста пула
    gross_pnl = user_investment * (pool_pnl_pct / 100) if user_investment > 0 else 0.0
    user_pnl = round(gross_pnl * INVESTOR_SHARE, 2)
    user_pnl_pct = round(pool_pnl_pct * INVESTOR_SHARE, 2)

    # Реферальный доход: 3% от прибыли каждого приглашённого
    ref_bonus = 0.0
    if pool_pnl_pct > 0:
        referrals = (await db.execute(
            select(User).where(User.referred_by == user.id, User.is_active == True)
        )).scalars().all()
        for ref in referrals:
            ref_fin = (await db.execute(
                select(UserFinancials).where(UserFinancials.user_id == ref.id)
            )).scalar_one_or_none()
            ref_inv = ref_fin.investment_usdt if ref_fin else 0.0
            ref_bonus += ref_inv * (pool_pnl_pct / 100) * L1_REF_FEE
    ref_bonus = round(ref_bonus, 2)

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
        ref_bonus=ref_bonus,
        positions=[PositionOut(symbol=p.symbol, amount=p.amount, avg_price=p.avg_price) for p in positions],
        recent_trades=[TradeOut(symbol=t.symbol, action=t.action, amount=t.amount,
                                price=t.price, pnl=t.pnl, timestamp=t.timestamp) for t in trades],
        ai_feed=[AIFeedOut(timestamp=a.timestamp, action=a.action,
                           symbol=a.symbol, reason=a.reason) for a in ai_feed],
    )
