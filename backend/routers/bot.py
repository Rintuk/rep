from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from datetime import datetime
from config import settings
from database import get_db
from constants import get_investor_share
from models import (BotSnapshot, Position, Trade, AIFeedEntry, VirtualAccount, VirtualTrade,
                    ForexBotSnapshot, ForexPosition, ForexTrade, ForexAIFeedEntry,
                    ForexVirtualAccount, ForexVirtualTrade, UserFinancials, User, DEMO_START_BALANCE, AdminProfitLog)
from schemas import BotUpdateIn

router = APIRouter(prefix="/api", tags=["bot"])

def verify_bot_key(x_api_key: str = Header(...)):
    if x_api_key != settings.BOT_API_KEY:
        raise HTTPException(status_code=403, detail="Неверный API ключ")

def verify_forex_bot_key(x_api_key: str = Header(...)):
    key = settings.FOREX_BOT_API_KEY or settings.BOT_API_KEY
    if x_api_key != key:
        raise HTTPException(status_code=403, detail="Неверный API ключ форекс")

@router.post("/bot-update", dependencies=[Depends(verify_bot_key)])
async def bot_update(payload: BotUpdateIn, db: AsyncSession = Depends(get_db)):
    import traceback as _tb
    try:
        return await _bot_update_impl(payload, db)
    except Exception as e:
        print(f"[bot-update ERROR] {e}\n{_tb.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/forex-bot-update", dependencies=[Depends(verify_forex_bot_key)])
async def forex_bot_update(payload: BotUpdateIn, db: AsyncSession = Depends(get_db)):
    import traceback as _tb
    try:
        return await _forex_bot_update_impl(payload, db)
    except Exception as e:
        print(f"[forex-bot-update ERROR] {e}\n{_tb.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


async def _bot_update_impl(payload: BotUpdateIn, db: AsyncSession):
    try:
        ts = datetime.fromisoformat(payload.timestamp.replace("Z", "+00:00"))
    except Exception:
        ts = datetime.utcnow()

    real_total_now = payload.balance_usdt + sum(
        p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price)
        for p in payload.positions
    )

    last_snap = (await db.execute(
        select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()
    
    actual_net_invested = last_snap.net_invested if last_snap and last_snap.net_invested > 0 else payload.net_invested
    actual_real_start = last_snap.real_start_balance if last_snap and last_snap.real_start_balance != 0.0 else payload.real_start_balance

    snapshot = BotSnapshot(
        bot_id=payload.bot_id, timestamp=ts,
        balance_usdt=payload.balance_usdt, mode=payload.mode,
        hwm=payload.hwm, drawdown_pct=payload.drawdown_pct,
        real_start_balance=actual_real_start, net_invested=actual_net_invested,
    )
    db.add(snapshot)
    await db.flush()

    for p in payload.positions:
        db.add(Position(snapshot_id=snapshot.id, symbol=p.symbol, amount=p.amount,
                        avg_price=p.avg_price, current_price=p.current_price if (p.current_price or 0) > 0 else p.avg_price))

    new_real_trades = []
    for t in payload.recent_trades:
        already = (await db.execute(
            select(Trade).where(and_(Trade.symbol == t.symbol, Trade.action == t.action,
                                     Trade.timestamp == t.timestamp, Trade.price == t.price))
        )).scalars().first()
        if already:
            continue
        db.add(Trade(snapshot_id=snapshot.id, symbol=t.symbol, action=t.action,
                     amount=t.amount, price=t.price, pnl=t.pnl, timestamp=t.timestamp))
        new_real_trades.append(t)

    
    # Calculate admin profit for new trades
    if new_real_trades and balance_usd > 0:
        all_fins = (await db.execute(select(UserFinancials))).scalars().all()
        # total_invested differs for crypto vs forex
        # Let's just calculate it dynamically below
        
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        stat = (await db.execute(select(AdminProfitLog).where(AdminProfitLog.date == today_str))).scalar_one_or_none()
        if not stat:
            stat = AdminProfitLog(date=today_str, crypto_profit=0.0, forex_profit=0.0)
            db.add(stat)

        # Use actual pool net_invested so admin's money is factored into the total pool size
        net_invested_pool = max(actual_net_invested, sum(fin.investment_usdt for fin in all_fins))

        for t in new_real_trades:
            if t.pnl is not None:
                pnl = t.pnl
                total_investor_profit = 0.0
                if net_invested_pool > 0:
                    for fin in all_fins:
                        share_of_pool = fin.investment_usdt / net_invested_pool
                        inv_gross = pnl * share_of_pool
                        inv_net = inv_gross * get_investor_share(fin) if inv_gross > 0 else inv_gross
                        total_investor_profit += inv_net
                
                # Log only performance fee, preventing admin own capital losses from appearing in notebook
                admin_fee = sum(pnl * (fin.investment_usdt / net_invested_pool) * get_pool_fee(fin) for fin in all_fins) if pnl > 0 else 0.0
                stat.crypto_profit += admin_fee

    for entry in payload.ai_feed:
        db.add(AIFeedEntry(snapshot_id=snapshot.id, timestamp=entry.timestamp,
                           action=entry.action, symbol=entry.symbol, reason=entry.reason))

    if real_total_now > 0:
        virtual_accounts = (await db.execute(
            select(VirtualAccount).where(VirtualAccount.is_started == True)
        )).scalars().all()
        for va in virtual_accounts:
            if va.start_real_total <= 0:
                va.start_real_total = real_total_now
                va.updated_at = datetime.utcnow()
                continue
            # Баланс меняется только при новых закрытых сделках
            scale = va.start_balance / va.start_real_total if va.start_real_total > 0 else 1.0
            for t in new_real_trades:
                exists = (await db.execute(
                    select(VirtualTrade).where(and_(
                        VirtualTrade.user_id == va.user_id, VirtualTrade.symbol == t.symbol,
                        VirtualTrade.action == t.action, VirtualTrade.timestamp == t.timestamp,
                        VirtualTrade.price == t.price,
                    ))
                )).scalars().first()
                if exists:
                    continue
                scaled_pnl = round(t.pnl * scale, 4) if t.pnl is not None else None
                if scaled_pnl is not None:
                    va.balance_usdt = round(va.balance_usdt + scaled_pnl, 4)
                db.add(VirtualTrade(user_id=va.user_id, symbol=t.symbol, action=t.action,
                                    amount=round((t.amount or 0) * scale, 6), price=t.price,
                                    pnl=scaled_pnl, timestamp=t.timestamp))
            va.updated_at = datetime.utcnow()

    await db.commit()

    KEEP_SNAPSHOTS = 100
    KEEP_VIRTUAL_TRADES = 500
    old_snapshots = (await db.execute(
        select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).offset(KEEP_SNAPSHOTS)
    )).scalars().all()
    for s in old_snapshots:
        await db.delete(s)

    va_users = (await db.execute(select(VirtualAccount.user_id))).scalars().all()
    for uid in va_users:
        old_vtrades = (await db.execute(
            select(VirtualTrade).where(VirtualTrade.user_id == uid)
            .order_by(VirtualTrade.id.desc()).offset(KEEP_VIRTUAL_TRADES)
        )).scalars().all()
        for vt in old_vtrades:
            await db.delete(vt)

    await db.commit()
    return {"status": "ok", "snapshot_id": snapshot.id}


async def _forex_bot_update_impl(payload: BotUpdateIn, db: AsyncSession):
    try:
        ts = datetime.fromisoformat(payload.timestamp.replace("Z", "+00:00"))
    except Exception:
        ts = datetime.utcnow()

    balance_usd      = payload.balance_usdt
    hwm_usd          = payload.hwm
    real_start_usd   = payload.real_start_balance
    net_invested_usd = payload.net_invested

    # Проверяем — первый ли это снапшот (пул только что сброшен/запущен)
    existing_count = (await db.execute(
        select(func.count()).select_from(ForexBotSnapshot)
    )).scalar_one()
    is_first_snapshot = existing_count == 0

    real_total_now = balance_usd + sum(
        p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price)
        for p in payload.positions
    )

    last_forex_snap = (await db.execute(
        select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()
    
    actual_fx_net = last_forex_snap.net_invested if last_forex_snap and last_forex_snap.net_invested > 0 else net_invested_usd
    actual_fx_start = last_forex_snap.real_start_balance if last_forex_snap and last_forex_snap.real_start_balance != 0.0 else real_start_usd

    snapshot = ForexBotSnapshot(
        bot_id=payload.bot_id, timestamp=ts,
        balance_usdt=balance_usd, mode=payload.mode,
        hwm=hwm_usd, drawdown_pct=payload.drawdown_pct,
        real_start_balance=actual_fx_start, net_invested=actual_fx_net,
    )
    db.add(snapshot)
    await db.flush()

    # При первом снапшоте калибруем точку входа всех инвесторов под текущий PnL пула,
    # чтобы incremental = 0 и прибыль у всех стартовала с нуля
    if is_first_snapshot and net_invested_usd > 0:
        current_pnl_pct = round((balance_usd - net_invested_usd) / net_invested_usd * 100, 4)
        all_fins = (await db.execute(select(UserFinancials))).scalars().all()
        for fin in all_fins:
            fin.forex_entry_pool_pnl_pct = current_pnl_pct

    for p in payload.positions:
        db.add(ForexPosition(snapshot_id=snapshot.id, symbol=p.symbol,
                             amount=p.amount,
                             avg_price=p.avg_price,
                             current_price=p.current_price if (p.current_price or 0) > 0 else p.avg_price))

    new_real_trades = []
    for t in payload.recent_trades:
        already = (await db.execute(
            select(ForexTrade).where(and_(ForexTrade.symbol == t.symbol, ForexTrade.action == t.action,
                                          ForexTrade.timestamp == t.timestamp, ForexTrade.price == t.price))
        )).scalars().first()
        if already:
            continue
        db.add(ForexTrade(snapshot_id=snapshot.id, symbol=t.symbol, action=t.action,
                          amount=t.amount, price=t.price,
                          pnl=t.pnl,
                          timestamp=t.timestamp))
        new_real_trades.append(t)

    
    # Calculate admin profit for new trades
    if new_real_trades and balance_usd > 0:
        all_fins = (await db.execute(select(UserFinancials))).scalars().all()
        # total_invested differs for crypto vs forex
        # Let's just calculate it dynamically below
        
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        stat = (await db.execute(select(AdminProfitLog).where(AdminProfitLog.date == today_str))).scalar_one_or_none()
        if not stat:
            stat = AdminProfitLog(date=today_str, crypto_profit=0.0, forex_profit=0.0)
            db.add(stat)

        # Use actual pool net_invested so admin's money is factored into the total pool size
        fx_net_invested_pool = max(actual_fx_net, sum(fin.forex_investment_usdt for fin in all_fins))

        for t in new_real_trades:
            if t.pnl is not None:
                pnl = t.pnl
                total_investor_profit = 0.0
                if fx_net_invested_pool > 0:
                    for fin in all_fins:
                        share_of_pool = fin.forex_investment_usdt / fx_net_invested_pool
                        inv_gross = pnl * share_of_pool
                        inv_net = inv_gross * get_investor_share(fin) if inv_gross > 0 else inv_gross
                        total_investor_profit += inv_net
                
                # Log only performance fee
                admin_fee = sum(pnl * (fin.forex_investment_usdt / fx_net_invested_pool) * get_pool_fee(fin) for fin in all_fins) if pnl > 0 else 0.0
                stat.forex_profit += admin_fee

    for entry in payload.ai_feed:
        db.add(ForexAIFeedEntry(snapshot_id=snapshot.id, timestamp=entry.timestamp,
                                action=entry.action, symbol=entry.symbol, reason=entry.reason))

    if balance_usd > 0:
        virtual_accounts = (await db.execute(
            select(ForexVirtualAccount).where(ForexVirtualAccount.is_started == True)
        )).scalars().all()
        for va in virtual_accounts:
            if va.start_real_total <= 0:
                va.start_real_total = balance_usd
                va.updated_at = datetime.utcnow()
                continue
            # Баланс меняется только при новых закрытых сделках
            scale = va.start_balance / va.start_real_total if va.start_real_total > 0 else 1.0
            for t in new_real_trades:
                exists = (await db.execute(
                    select(ForexVirtualTrade).where(and_(
                        ForexVirtualTrade.user_id == va.user_id, ForexVirtualTrade.symbol == t.symbol,
                        ForexVirtualTrade.action == t.action, ForexVirtualTrade.timestamp == t.timestamp,
                        ForexVirtualTrade.price == t.price,
                    ))
                )).scalars().first()
                if exists:
                    continue
                scaled_pnl = round(t.pnl * scale, 4) if t.pnl is not None else None
                if scaled_pnl is not None:
                    va.balance_usdt = round(va.balance_usdt + scaled_pnl, 4)
                db.add(ForexVirtualTrade(user_id=va.user_id, symbol=t.symbol, action=t.action,
                                         amount=round((t.amount or 0) * scale, 6), price=t.price,
                                         pnl=scaled_pnl, timestamp=t.timestamp))
            va.updated_at = datetime.utcnow()

    await db.commit()

    KEEP_SNAPSHOTS = 100
    KEEP_VIRTUAL_TRADES = 500
    old_snapshots = (await db.execute(
        select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).offset(KEEP_SNAPSHOTS)
    )).scalars().all()
    for s in old_snapshots:
        await db.delete(s)

    va_users = (await db.execute(select(ForexVirtualAccount.user_id))).scalars().all()
    for uid in va_users:
        old_vtrades = (await db.execute(
            select(ForexVirtualTrade).where(ForexVirtualTrade.user_id == uid)
            .order_by(ForexVirtualTrade.id.desc()).offset(KEEP_VIRTUAL_TRADES)
        )).scalars().all()
        for vt in old_vtrades:
            await db.delete(vt)

    await db.commit()
    return {"status": "ok", "snapshot_id": snapshot.id}
