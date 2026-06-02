
import asyncio
from database import AsyncSessionLocal
from models import BotSnapshot, ForexBotSnapshot, Position, ForexPosition, User, UserFinancials
from sqlalchemy import select
from datetime import datetime
import json

async def run():
    async with AsyncSessionLocal() as db:
        users = (await db.execute(select(User))).scalars().all()
        fins = (await db.execute(select(UserFinancials))).scalars().all()
        crypto_snap = (await db.execute(select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        forex_snap = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        
        crypto_positions = []
        if crypto_snap:
            c_pos = (await db.execute(select(Position).where(Position.snapshot_id == crypto_snap.id))).scalars().all()
            crypto_positions = [{"symbol": p.symbol, "amount": p.amount, "avg_price": p.avg_price, "current_price": p.current_price} for p in c_pos]
            
        forex_positions = []
        if forex_snap:
            f_pos = (await db.execute(select(ForexPosition).where(ForexPosition.snapshot_id == forex_snap.id))).scalars().all()
            forex_positions = [{"symbol": p.symbol, "amount": p.amount, "avg_price": p.avg_price, "current_price": p.current_price} for p in f_pos]

        pool_crypto_data = None
        if crypto_snap:
            pool_crypto_data = {
                "balance_usdt": crypto_snap.balance_usdt,
                "net_invested": crypto_snap.net_invested,
                "hwm": crypto_snap.hwm,
                "real_start_balance": crypto_snap.real_start_balance,
                "timestamp": str(crypto_snap.timestamp),
                "positions": crypto_positions
            }
            
        pool_forex_data = None
        if forex_snap:
            pool_forex_data = {
                "balance_usdt": forex_snap.balance_usdt,
                "net_invested": forex_snap.net_invested,
                "hwm": forex_snap.hwm,
                "real_start_balance": forex_snap.real_start_balance,
                "timestamp": str(forex_snap.timestamp),
                "positions": forex_positions
            }

        res = {
            "timestamp": datetime.utcnow().isoformat(),
            "users_count": len(users),
            "pool_crypto": pool_crypto_data,
            "pool_forex": pool_forex_data,
        }
        print(json.dumps(res))

asyncio.run(run())

