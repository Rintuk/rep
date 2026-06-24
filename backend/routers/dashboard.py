from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import (BotSnapshot, Position, Trade, AIFeedEntry, UserFinancials, User,
                    ForexBotSnapshot, ForexPosition, ForexTrade, NewsItem)
from schemas import DashboardOut, PositionOut, TradeOut, AIFeedOut, ReferralInfo, NewsItemOut
from security import get_current_user
from constants import INVESTOR_SHARE, POOL_FEE, REF_FEES, STATUS_THRESHOLDS, get_investor_share

router = APIRouter(prefix="/api", tags=["dashboard"])

def _get_status_and_limits(total_volume: float, manual_override: Optional[str]):
    if manual_override and manual_override in STATUS_THRESHOLDS:
        status = manual_override
    else:
        status = "PARTNER"
        if total_volume >= STATUS_THRESHOLDS["VIP"]:
            status = "VIP"
        elif total_volume >= STATUS_THRESHOLDS["GOLD"]:
            status = "GOLD"
        elif total_volume >= STATUS_THRESHOLDS["SILVER"]:
            status = "SILVER"
        elif total_volume >= STATUS_THRESHOLDS["BRONZE"]:
            status = "BRONZE"
            
    next_vol = None
    if status == "PARTNER":  next_vol = STATUS_THRESHOLDS["BRONZE"]
    elif status == "BRONZE": next_vol = STATUS_THRESHOLDS["SILVER"]
    elif status == "SILVER": next_vol = STATUS_THRESHOLDS["GOLD"]
    elif status == "GOLD":   next_vol = STATUS_THRESHOLDS["VIP"]
    
    levels_allowed = 1
    if status == "BRONZE":   levels_allowed = 2
    elif status == "SILVER": levels_allowed = 2
    elif status == "GOLD":   levels_allowed = 3
    elif status == "VIP":    levels_allowed = 5
    
    return status, next_vol, levels_allowed

async def _calc_referral_tree(user_id: str, db: AsyncSession, crypto_pool_pct: float, forex_pool_pct: float, my_fin: Optional[UserFinancials], manual_override: Optional[str]):
    all_users = (await db.execute(select(User))).scalars().all()
    all_fins = (await db.execute(select(UserFinancials))).scalars().all()
    fins_map = {f.user_id: f for f in all_fins}
    
    children_map = {}
    for u in all_users:
        if u.referred_by:
            children_map.setdefault(u.referred_by, []).append(u)
            
    my_inv = my_fin.investment_usdt if my_fin else 0.0
    my_fx = my_fin.forex_investment_usdt if my_fin else 0.0
    total_volume = my_inv + my_fx
    
    queue = [(user_id, 1)]
    # BFS для подсчета total_volume
    q = [user_id]
    visited = {user_id}
    while q:
        curr = q.pop(0)
        for child in children_map.get(curr, []):
            if child.id not in visited:
                visited.add(child.id)
                if child.is_active:
                    f = fins_map.get(child.id)
                    if f:
                        total_volume += f.investment_usdt + f.forex_investment_usdt
                q.append(child.id)
                
    status, next_vol, levels_allowed = _get_status_and_limits(total_volume, manual_override)
    
    # BFS для подсчета реферальных до 5 уровней
    queue = [(user_id, 1)]
    crypto_bonus = 0.0
    forex_bonus = 0.0
    refs_info = []
    visited_queue = {user_id}

    while queue:
        curr, depth = queue.pop(0)
        if depth > 5:
            continue
            
        for child in children_map.get(curr, []):
            if child.id in visited_queue:
                continue
            visited_queue.add(child.id)
            # Always traverse children
            queue.append((child.id, depth + 1))
            
            f = fins_map.get(child.id)
            inv = f.investment_usdt if f else 0.0
            fx = f.forex_investment_usdt if f else 0.0

            # If inactive — show in tree (depth=1 only) but no bonuses
            if not child.is_active:
                if depth == 1:
                    refs_info.append(ReferralInfo(
                        id=child.id,
                        parent_id=curr,
                        email=child.email,
                        nickname=child.nickname,
                        investment_usdt=inv + fx,
                        bonus_usdt=0.0,
                        level=depth
                    ))
                continue
            
            # Crypto bonus
            cb = 0.0
            if inv > 0 and depth <= levels_allowed and depth in REF_FEES:
                ref_entry = f.entry_pool_pnl_pct if f else 0.0
                incr = crypto_pool_pct - ref_entry
                new_gross = inv * (incr / 100) if incr > 0 else 0.0
                locked_gross = f.locked_crypto_pnl / get_investor_share(f) if f and getattr(f, "locked_crypto_pnl", 0.0) > 0 else 0.0
                total_gross = new_gross + locked_gross
                if total_gross > 0:
                    cb = total_gross * REF_FEES[depth]
                    crypto_bonus += cb

            # Forex bonus
            fb = 0.0
            if fx > 0 and depth <= levels_allowed and depth in REF_FEES:
                fx_entry = f.forex_entry_pool_pnl_pct if f else 0.0
                fx_incr = forex_pool_pct - fx_entry
                new_fx_gross = fx * (fx_incr / 100) if fx_incr > 0 else 0.0
                locked_fx_gross = f.locked_forex_pnl / get_investor_share(f) if f and getattr(f, "locked_forex_pnl", 0.0) > 0 else 0.0
                total_fx_gross = new_fx_gross + locked_fx_gross
                if total_fx_gross > 0:
                    fb = total_fx_gross * REF_FEES[depth]
                    forex_bonus += fb

            # Add to refs_info (all active refs, all levels)
            refs_info.append(ReferralInfo(
                id=child.id,
                parent_id=curr,
                email=child.email,
                nickname=child.nickname,
                investment_usdt=inv + fx,
                bonus_usdt=cb + fb,
                level=depth
            ))
            
    return status, total_volume, next_vol, crypto_bonus, forex_bonus, refs_info


@router.get("/news", response_model=list[NewsItemOut])
async def get_news(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    items = (await db.execute(
        select(NewsItem).order_by(NewsItem.created_at.desc())
    )).scalars().all()
    return items


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
        # Крипто офлайн — всё равно считаем форекс ниже
        positions = []
        trades = []
        ai_feed = []
        pool_positions_usdt = 0.0
        pool_total_usdt = 0.0
        pool_pnl_pct = 0.0
        server_online = False
        user_pnl = 0.0
        user_pnl_pct = 0.0
        ref_bonus = 0.0
        referrals_info: list[ReferralInfo] = []
    else:
        positions = (await db.execute(
            select(Position).where(Position.snapshot_id == snap.id)
        )).scalars().all()

        seen = set()
        all_trades = (await db.execute(
            select(Trade).order_by(Trade.timestamp.desc()).limit(500)
        )).scalars().all()
        trades = []
        today_str = datetime.utcnow().date().isoformat()
        for t in all_trades:
            key = (t.symbol, t.action, t.timestamp, t.price)
            if key not in seen:
                seen.add(key)
                trades.append(t)
            if len(trades) >= 15 and t.timestamp[:10] < today_str:
                break

        ai_feed = (await db.execute(
            select(AIFeedEntry).order_by(AIFeedEntry.timestamp.desc()).limit(20)
        )).scalars().all()

        pool_positions_usdt = sum(p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price) for p in positions)
        pool_total_usdt = snap.balance_usdt + pool_positions_usdt
        server_online = (datetime.utcnow() - snap.timestamp) < timedelta(minutes=30)

        _start = snap.real_start_balance if snap.real_start_balance != 0.0 else snap.hwm
        _total_inv = (await db.execute(select(func.sum(UserFinancials.investment_usdt)))).scalar() or 0.0
        _total_wd = (await db.execute(select(func.sum(UserFinancials.withdrawal_usdt)))).scalar() or 0.0
        net_inv = _start + _total_inv - _total_wd
        if net_inv <= 0:
            net_inv = snap.net_invested if snap.net_invested > 0 else _start
        pool_pnl_pct = round((pool_total_usdt - net_inv) / net_inv * 100, 4) if net_inv > 0 else 0.0

        entry_pnl_pct = fin.entry_pool_pnl_pct if fin else 0.0
        incremental_pnl_pct = pool_pnl_pct - entry_pnl_pct
        gross_pnl = user_investment * (incremental_pnl_pct / 100) if user_investment > 0 else 0.0
        locked_crypto_pnl = fin.locked_crypto_pnl if fin else 0.0
        user_pnl = round(gross_pnl * get_investor_share(fin) + locked_crypto_pnl, 2)
        user_pnl_pct = round(incremental_pnl_pct * get_investor_share(fin), 2)

        # Бонусы посчитаем позже вместе с форексом

        ref_bonus = 0.0

    # ── Форекс пул ────────────────────────────────────────────────
    forex_snap = (await db.execute(
        select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()

    # Баг 6 fix: инициализируем forex_pool_pnl_pct до блока if forex_snap:
    # иначе если форекс-снапшота нет — NameError на строке 269
    forex_pool_pnl_pct = 0.0
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
            p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price) for p in fx_positions
        )
        forex_balance = forex_snap.balance_usdt
        forex_pool_total = forex_balance

        fx_net_inv = forex_snap.net_invested if forex_snap.net_invested > 0 else (
            forex_snap.real_start_balance if forex_snap.real_start_balance != 0.0 else forex_snap.hwm
        )
        forex_pool_pnl_pct = round((forex_balance - fx_net_inv) / fx_net_inv * 100, 4) if fx_net_inv > 0 else 0.0

        forex_entry_pct = fin.forex_entry_pool_pnl_pct if fin else 0.0
        forex_incremental = forex_pool_pnl_pct - forex_entry_pct
        forex_gross = forex_investment * (forex_incremental / 100) if forex_investment > 0 else 0.0
        locked_forex_pnl = fin.locked_forex_pnl if fin else 0.0
        forex_pnl = round(forex_gross * get_investor_share(fin) + locked_forex_pnl, 2)
        forex_pnl_pct = round(forex_incremental * get_investor_share(fin), 2)

        forex_positions_out = [
            PositionOut(symbol=p.symbol, amount=p.amount, avg_price=p.avg_price,
                        current_price=p.current_price if (p.current_price or 0) > 0 else p.avg_price)
            for p in fx_positions
        ]

        seen_fx = set()
        all_fx_trades = (await db.execute(
            select(ForexTrade).order_by(ForexTrade.timestamp.desc()).limit(500)
        )).scalars().all()
        today_str = datetime.utcnow().date().isoformat()
        for t in all_fx_trades:
            key = (t.symbol, t.action, t.timestamp, t.price)
            if key not in seen_fx:
                seen_fx.add(key)
                forex_trades_out.append(TradeOut(symbol=t.symbol, action=t.action,
                                                  amount=t.amount, price=t.price,
                                                  pnl=t.pnl, timestamp=t.timestamp))
            if len(forex_trades_out) >= 15 and t.timestamp[:10] < today_str:
                break

    # Расчет статусов и бонусов (общий для крипты и форекса)
    status, total_volume, next_vol, crypto_ref, forex_ref, refs_info = await _calc_referral_tree(
        user.id, db, pool_pnl_pct, forex_pool_pnl_pct, fin, user.manual_status_override
    )
    
    ref_bonus = round(crypto_ref, 2)
    forex_ref_bonus = round(forex_ref, 2)

    return DashboardOut(
        balance_usdt=snap.balance_usdt if snap else 0.0,
        pool_total_usdt=round(pool_total_usdt, 2),
        pool_positions_usdt=round(pool_positions_usdt, 2),
        mode=snap.mode if snap else "OFFLINE",
        hwm=snap.hwm if snap else 0.0,
        drawdown_pct=snap.drawdown_pct if snap else 0.0,
        server_online=server_online,
        last_updated=snap.timestamp.isoformat() if snap else None,
        user_investment=user_investment, user_pnl=user_pnl, user_pnl_pct=user_pnl_pct,
        status=status, total_volume_usdt=round(total_volume, 2), next_status_volume=next_vol,
        ref_bonus=ref_bonus, referral_code=user.referral_code, referrals=refs_info,
        positions=[PositionOut(symbol=p.symbol, amount=p.amount, avg_price=p.avg_price,
                               current_price=p.current_price if (p.current_price or 0) > 0 else p.avg_price)
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
        email=user.email,
        nickname=user.nickname,
    )
