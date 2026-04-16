from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
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
    try:
        ts = datetime.fromisoformat(payload.timestamp.replace("Z", "+00:00"))
    except Exception:
        ts = datetime.utcnow()

    # Предыдущий снимок для расчёта % изменения
    prev_snap = (await db.execute(
        select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1)
    )).scalar_one_or_none()

    # Реальный итог текущего снимка
    real_total_now = payload.balance_usdt + sum(p.amount * p.avg_price for p in payload.positions)

    # Сохраняем снимок
    snapshot = BotSnapshot(
        bot_id=payload.bot_id,
        timestamp=ts,
        balance_usdt=payload.balance_usdt,
        mode=payload.mode,
        hwm=payload.hwm,
        drawdown_pct=payload.drawdown_pct,
    )
    db.add(snapshot)
    await db.flush()

    for p in payload.positions:
        db.add(Position(snapshot_id=snapshot.id, symbol=p.symbol, amount=p.amount, avg_price=p.avg_price))

    new_real_trades = []
    for t in payload.recent_trades:
        db.add(Trade(snapshot_id=snapshot.id, symbol=t.symbol, action=t.action,
                     amount=t.amount, price=t.price, pnl=t.pnl, timestamp=t.timestamp))
        new_real_trades.append(t)

    for entry in payload.ai_feed:
        db.add(AIFeedEntry(snapshot_id=snapshot.id, timestamp=entry.timestamp,
                           action=entry.action, symbol=entry.symbol, reason=entry.reason))

    # ── Обновляем виртуальные счета ──────────────────────────────
    if prev_snap and real_total_now > 0:
        prev_positions = (await db.execute(
            select(Position).where(Position.snapshot_id == prev_snap.id)
        )).scalars().all()
        real_total_prev = prev_snap.balance_usdt + sum(p.amount * p.avg_price for p in prev_positions)

        if real_total_prev > 0:
            change_pct = (real_total_now - real_total_prev) / real_total_prev

            # Все виртуальные счета
            virtual_accounts = (await db.execute(select(VirtualAccount))).scalars().all()
            for va in virtual_accounts:
                old_balance = va.balance_usdt
                va.balance_usdt = round(old_balance * (1 + change_pct), 4)
                va.updated_at = datetime.utcnow()

                # Зеркалим новые сделки в виртуальный счёт (масштабированные)
                scale = old_balance / real_total_prev if real_total_prev > 0 else 1.0
                for t in new_real_trades:
                    if t.pnl is not None:
                        db.add(VirtualTrade(
                            user_id=va.user_id,
                            symbol=t.symbol,
                            action=t.action,
                            amount=round((t.amount or 0) * scale, 6),
                            price=t.price,
                            pnl=round(t.pnl * scale, 4),
                            timestamp=t.timestamp,
                        ))

    await db.commit()
    return {"status": "ok", "snapshot_id": snapshot.id}
