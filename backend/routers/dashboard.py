from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import (BotSnapshot, Position, Trade, AIFeedEntry, UserFinancials, User,
                    ForexBotSnapshot, ForexPosition, ForexTrade)
from schemas import DashboardOut, PositionOut, TradeOut, AIFeedOut, ReferralInfo
from security import get_current_user
from constants import INVESTOR_SHARE, POOL_FEE, L1_REF_FEE, MIN_REF_INVESTMENT

router = APIRouter(prefix="/api", tags=["dashboard"])

@router.get("/dashboard", response_model=DashboardOut)
async def dashboard(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # ── Крипто пул ────────────────────────────────────────────────
    snap = (await db.execute(
        select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()

    fin = (await db.execute(
        select(UserFinancials).where(UserFinancials.user_id == user.id)
    )).scalar_one_or_none()
    user_investment = fin.investment_usdt if fin else 0.0

    if not snap:
        return DashboardOut(
            balance_usdt=0, pool_total_usdt=0, pool_positions_usdt=0,
            mode="OFFLINE", hwm=0, drawdown_pct=0, server_online=False, last_updated=None,
            user_investment=user_investment, user_pnl=0, user_pnl_pct=0,
            ref_bonus=0, referral_code=user.referral_code, referrals=[],
            positions=[], recent_trades=[], ai_feed=[],
        )

    positions = (await db.execute(
        select(Position).where(Position.snapshot_id == snap.id)
    )).scalars().all()

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

    net_inv = snap.net_invested if snap.net_invested > 0 else (
        snap.real_start_balance if snap.real_start_balance > 0 else snap.hwm
    )
    pool_pnl_pct = round((pool_total_usdt - net_inv) / net_inv * 100, 4) if net_inv > 0 else 0.0

    entry_pnl_pct = fin.entry_pool_pnl_pct if fin else 0.0
    incremental_pnl_pct = pool_pnl_pct - entry_pnl_pct
    gross_pnl = user_investment * (incremental_pnl_pct / 100) if user_investment > 0 else 0.0
    user_pnl = round(gross_pnl * INVESTOR_SHARE, 2)
    user_pnl_pct = round(incremental_pnl_pct * INVESTOR_SHARE, 2)

    ref_bonus = 0.0
    referrals_info: list[ReferralInfo] = []
    all_referrals = (await db.execute(
        select(User).where(User.referred_by == user.id, User.is_active == True)
    )).scalars().all()
    referrer_qualifies = user_investment >= MIN_REF_INVESTMENT
    for ref in all_referrals:
        ref_fin = (await db.execute(
            select(UserFinancials).where(UserFinancials.user_id == ref.id)
        )).scalar_one_or_none()
        ref_inv = ref_fin.investment_usdt if ref_fin else 0.0
        ref_entry_pct = ref_fin.entry_pool_pnl_pct if ref_fin else 0.0
        ref_incremental_pct = pool_pnl_pct - ref_entry_pct
        bonus = ref_inv * (ref_incremental_pct / 100) * L1_REF_FEE if (ref_incremental_pct > 0 and referrer_qualifies) else 0.0
        ref_bonus += bonus
        parts = ref.email.split("@")
        masked = parts[0][0] + "***@" + parts[1] if len(parts) == 2 and parts[0] else ref.email
        referrals_info.append(ReferralInfo(email=masked, investment_usdt=ref_inv, bonus_usdt=bonus))
    ref_bonus = round(ref_bonus, 2)

    # ── Форекс пул ────────────────────────────────────────────────
    forex_snap = (await db.execute(
        select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()

    forex_pool_total = forex_pool_positions = forex_balance = 0.0
    forex_server_online = False
    forex_last_updated = None
    forex_investment = fin.forex_investment_usdt if fin else 0.0
    forex_pnl = forex_pnl_pct = 0.0
    forex_positions_out: list[PositionOut] = []
    forex_trades_out: list[TradeOut] = []

    if forex_snap:
        forex_server_online = (datetime.utcnow() - forex_snap.timestamp) < timedelta(minutes=30)
        forex_last_updated = forex_snap.timestamp.isoformat()
        fx_positions = (await db.execute(
            select(ForexPosition).where(ForexPosition.snapshot_id == forex_snap.id)
        )).scalars().all()
        forex_pool_positions = sum(
            p.amount * (p.current_price if p.current_price > 0 else p.avg_price) for p in fx_positions
        )
        forex_balance = forex_snap.balance_usdt
        forex_pool_total = forex_balance + forex_pool_positions

        fx_net_inv = forex_snap.net_invested if forex_snap.net_invested > 0 else (
            forex_snap.real_start_balance if forex_snap.real_start_balance > 0 else forex_snap.hwm
        )
        forex_pool_pnl_pct = round((forex_pool_total - fx_net_inv) / fx_net_inv * 100, 4) if fx_net_inv > 0 else 0.0

        forex_entry_pct = fin.forex_entry_pool_pnl_pct if fin else 0.0
        forex_incremental = forex_pool_pnl_pct - forex_entry_pct
        forex_gross = forex_investment * (forex_incremental / 100) if forex_investment > 0 else 0.0
        forex_pnl = round(forex_gross * INVESTOR_SHARE, 2)
        forex_pnl_pct = round(forex_incremental * INVESTOR_SHARE, 2)

        forex_positions_out = [
            PositionOut(symbol=p.symbol, amount=p.amount, avg_price=p.avg_price,
                        current_price=p.current_price if p.current_price > 0 else p.avg_price)
            for p in fx_positions
        ]

        seen_fx = set()
        all_fx_trades = (await db.execute(
            select(ForexTrade).order_by(ForexTrade.timestamp.desc()).limit(100)
        )).scalars().all()
        for t in all_fx_trades:
            key = (t.symbol, t.action, t.timestamp, t.price)
            if key not in seen_fx:
                seen_fx.add(key)
                forex_trades_out.append(TradeOut(symbol=t.symbol, action=t.action,
                                                  amount=t.amount, price=t.price,
                                                  pnl=t.pnl, timestamp=t.timestamp))
            if len(forex_trades_out) >= 15:
                break

    forex_ref_bonus = 0.0
    if forex_snap and forex_investment >= MIN_REF_INVESTMENT:
        fx_net_inv = forex_snap.net_invested if forex_snap.net_invested > 0 else (
            forex_snap.real_start_balance if forex_snap.real_start_balance > 0 else forex_snap.hwm
        )
        if fx_net_inv > 0:
            fx_pool_pnl_pct = round((forex_pool_total - fx_net_inv) / fx_net_inv * 100, 4)
            all_forex_refs = (await db.execute(
                select(User).where(User.referred_by == user.id, User.is_active == True)
            )).scalars().all()
            for ref in all_forex_refs:
                ref_fin = (await db.execute(
                    select(UserFinancials).where(UserFinancials.user_id == ref.id)
                )).scalar_one_or_none()
                ref_inv = ref_fin.forex_investment_usdt if ref_fin else 0.0
                ref_entry = ref_fin.forex_entry_pool_pnl_pct if ref_fin else 0.0
                ref_incr = fx_pool_pnl_pct - ref_entry
                if ref_inv > 0 and ref_incr > 0:
                    forex_ref_bonus += ref_inv * (ref_incr / 100) * L1_REF_FEE
    forex_ref_bonus = round(forex_ref_bonus, 2)

    return DashboardOut(
        balance_usdt=snap.balance_usdt,
        pool_total_usdt=round(pool_total_usdt, 2),
        pool_positions_usdt=round(pool_positions_usdt, 2),
        mode=snap.mode, hwm=snap.hwm, drawdown_pct=snap.drawdown_pct,
        server_online=server_online, last_updated=snap.timestamp.isoformat(),
        user_investment=user_investment, user_pnl=user_pnl, user_pnl_pct=user_pnl_pct,
        ref_bonus=ref_bonus, referral_code=user.referral_code, referrals=referrals_info,
        positions=[PositionOut(symbol=p.symbol, amount=p.amount, avg_price=p.avg_price,
                               current_price=p.current_price if p.current_price > 0 else p.avg_price)
                   for p in positions],
        recent_trades=[TradeOut(symbol=t.symbol, action=t.action, amount=t.amount,
                                price=t.price, pnl=t.pnl, timestamp=t.timestamp) for t in trades],
        ai_feed=[AIFeedOut(timestamp=a.timestamp, action=a.action,
                           symbol=a.symbol, reason=a.reason) for a in ai_feed],
        # Форекс
        forex_pool_total=round(forex_pool_total, 2),
        forex_pool_positions=round(forex_pool_positions, 2),
        forex_balance=round(forex_balance, 2),
        forex_server_online=forex_server_online,
        forex_last_updated=forex_last_updated,
        forex_investment=forex_investment,
        forex_pnl=forex_pnl,
        forex_pnl_pct=forex_pnl_pct,
        forex_ref_bonus=forex_ref_bonus,
        forex_positions=forex_positions_out,
        forex_recent_trades=forex_trades_out,
    )
