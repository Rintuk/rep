from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime
from config import settings
from database import get_db
from models import BotSnapshot, Position, Trade, AIFeedEntry, VirtualAccount, VirtualTrade, User, DEMO_START_BALANCE
from schemas import BotUpdateIn

router = APIRouter(prefix="/api", tags=["bot"])

def verify_bot_key(x_api_key: str = Header(...)):
    if x_api_key != settings.BOT_API_KEY:
        raise HTTPException(status_code=403, detail="Неверный API ключ")

@router.post("/bot-update", dependencies=[Depends(verify_bot_key)])
async def bot_update(payload: BotUpdateIn, db: AsyncSession = Depends(get_db)):
    import traceback as _tb
    try:
        return await _bot_update_impl(payload, db)
    except Exception as e:
        print(f"[bot-update ERROR] {e}\n{_tb.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

async def _bot_update_impl(payload: BotUpdateIn, db: AsyncSession):
    try:
        ts = datetime.fromisoformat(payload.timestamp.replace("Z", "+00:00"))
    except Exception:
        ts = datetime.utcnow()

    # Предыдущий снимок для расчёта % изменения
    prev_snap = (await db.execute(
        select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()

    # Реальный итог текущего снимка (current_price как на дашборде, fallback avg_price)
    real_total_now = payload.balance_usdt + sum(
        p.amount * (p.current_price if p.current_price > 0 else p.avg_price)
        for p in payload.positions
    )

    # Сохраняем снимок
    snapshot = BotSnapshot(
        bot_id=payload.bot_id,
        timestamp=ts,
        balance_usdt=payload.balance_usdt,
        mode=payload.mode,
        hwm=payload.hwm,
        drawdown_pct=payload.drawdown_pct,
        real_start_balance=payload.real_start_balance,
        net_invested=payload.net_invested,
    )
    db.add(snapshot)
    await db.flush()

    for p in payload.positions:
        db.add(Position(snapshot_id=snapshot.id, symbol=p.symbol, amount=p.amount,
                        avg_price=p.avg_price, current_price=p.current_price if p.current_price > 0 else p.avg_price))

    new_real_trades = []
    for t in payload.recent_trades:
        already = (await db.execute(
            select(Trade).where(and_(
                Trade.symbol == t.symbol,
                Trade.action == t.action,
                Trade.timestamp == t.timestamp,
                Trade.price == t.price,
            ))
        )).scalars().first()
        if already:
            continue
        db.add(Trade(snapshot_id=snapshot.id, symbol=t.symbol, action=t.action,
                     amount=t.amount, price=t.price, pnl=t.pnl, timestamp=t.timestamp))
        new_real_trades.append(t)

    for entry in payload.ai_feed:
        db.add(AIFeedEntry(snapshot_id=snapshot.id, timestamp=entry.timestamp,
                           action=entry.action, symbol=entry.symbol, reason=entry.reason))

    # ── Обновляем виртуальные счета ──────────────────────────────
    if real_total_now > 0:
        virtual_accounts = (await db.execute(
            select(VirtualAccount).where(VirtualAccount.is_started == True)
        )).scalars().all()

        for va in virtual_accounts:
            if va.start_real_total <= 0:
                # Точка отсчёта не зафиксирована — фиксируем сейчас
                va.start_real_total = real_total_now
                va.start_balance = va.balance_usdt if va.balance_usdt > 0 else va.start_balance
                va.updated_at = datetime.utcnow()
                continue

            # Используем net_invested как базу — пополнения не искажают торговый PnL
            # Та же логика что на реальном дашборде: (pool_total - net_invested) / net_invested
            net_inv = snapshot.net_invested if snapshot.net_invested > 0 else va.start_real_total
            if net_inv > 0:
                pool_pnl_pct = (real_total_now - net_inv) / net_inv
                va.balance_usdt = round(va.start_balance * (1 + pool_pnl_pct), 4)
            va.updated_at = datetime.utcnow()

            # Зеркалим только новые сделки (дедупликация по timestamp+symbol+action+price)
            scale = va.start_balance / va.start_real_total
            for t in new_real_trades:
                exists = (await db.execute(
                    select(VirtualTrade).where(and_(
                        VirtualTrade.user_id == va.user_id,
                        VirtualTrade.symbol == t.symbol,
                        VirtualTrade.action == t.action,
                        VirtualTrade.timestamp == t.timestamp,
                        VirtualTrade.price == t.price,
                    ))
                )).scalars().first()
                if exists:
                    continue
                db.add(VirtualTrade(
                    user_id=va.user_id,
                    symbol=t.symbol,
                    action=t.action,
                    amount=round((t.amount or 0) * scale, 6),
                    price=t.price,
                    pnl=round(t.pnl * scale, 4) if t.pnl is not None else None,
                    timestamp=t.timestamp,
                ))

    await db.commit()

    # ── Очистка старых данных ────────────────────────────────────
    KEEP_SNAPSHOTS = 100
    KEEP_VIRTUAL_TRADES = 500

    # Удаляем старые снимки (позиции/сделки/AI-лента удалятся каскадно)
    old_snapshots = (await db.execute(
        select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).offset(KEEP_SNAPSHOTS)
    )).scalars().all()
    for s in old_snapshots:
        await db.delete(s)

    # Удаляем старые виртуальные сделки сверх лимита на каждого пользователя
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
