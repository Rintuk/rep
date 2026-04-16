from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from config import settings
from database import get_db
from models import BotSnapshot, Position, Trade, AIFeedEntry
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

    for t in payload.recent_trades:
        db.add(Trade(snapshot_id=snapshot.id, symbol=t.symbol, action=t.action,
                     amount=t.amount, price=t.price, pnl=t.pnl, timestamp=t.timestamp))

    for entry in payload.ai_feed:
        db.add(AIFeedEntry(snapshot_id=snapshot.id, timestamp=entry.timestamp,
                           action=entry.action, symbol=entry.symbol, reason=entry.reason))

    await db.commit()
    return {"status": "ok", "snapshot_id": snapshot.id}
