import asyncio
import json
from datetime import datetime
from database import SessionLocal
from sqlalchemy import select
from models import User, UserFinancials, BotSnapshot, Position, Trade, ForexBotSnapshot, ForexPosition, ForexTrade

async def make_full_backup():
    print("Начинаю создание полного бэкапа (Инвесторы + Пулы)...")
    async with SessionLocal() as db:
        # 1. Бэкап инвесторов (как в /admin/backup-db)
        users = (await db.execute(select(User))).scalars().all()
        fins = (await db.execute(select(UserFinancials))).scalars().all()
        fins_map = {f.user_id: f for f in fins}
        
        investors_data = []
        for u in users:
            f = fins_map.get(u.id)
            investors_data.append({
                "id": u.id, "email": u.email, "is_admin": u.is_admin, "referral_code": u.referral_code,
                "referred_by": u.referred_by, "is_active": u.is_active,
                "financials": {
                    "investment_usdt": f.investment_usdt if f else 0,
                    "entry_pool_pnl_pct": f.entry_pool_pnl_pct if f else 0,
                    "locked_crypto_pnl": f.locked_crypto_pnl if f else 0,
                    "forex_investment_usdt": f.forex_investment_usdt if f else 0,
                    "forex_entry_pool_pnl_pct": f.forex_entry_pool_pnl_pct if f else 0,
                    "locked_forex_pnl": f.locked_forex_pnl if f else 0
                } if f else None
            })

        # 2. Бэкап последнего состояния Крипто пула
        crypto_snap = (await db.execute(select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        crypto_data = None
        if crypto_snap:
            crypto_data = {
                "id": crypto_snap.id,
                "timestamp": crypto_snap.timestamp.isoformat(),
                "balance_usdt": crypto_snap.balance_usdt,
                "hwm": crypto_snap.hwm,
                "real_start_balance": crypto_snap.real_start_balance,
                "net_invested": crypto_snap.net_invested
            }

        # 3. Бэкап последнего состояния Форекс пула
        forex_snap = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        forex_data = None
        if forex_snap:
            forex_data = {
                "id": forex_snap.id,
                "timestamp": forex_snap.timestamp.isoformat(),
                "balance_usdt": forex_snap.balance_usdt,
                "hwm": forex_snap.hwm,
                "real_start_balance": forex_snap.real_start_balance,
                "net_invested": forex_snap.net_invested
            }

        # Собираем все вместе
        backup_file = {
            "backup_time": datetime.utcnow().isoformat(),
            "crypto_pool_status": crypto_data,
            "forex_pool_status": forex_data,
            "investors_count": len(users),
            "data": investors_data
        }

        filename = f"full_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(backup_file, f, indent=2, ensure_ascii=False)
            
        print(f"✅ Бэкап успешно сохранен в файл: {filename}")
        print(f"Сохранено пользователей: {len(users)}")
        if crypto_data:
            print(f"Сохранено состояние Crypto пула (Net Invested: {crypto_data['net_invested']})")
        if forex_data:
            print(f"Сохранено состояние Forex пула (Net Invested: {forex_data['net_invested']})")

if __name__ == "__main__":
    asyncio.run(make_full_backup())
