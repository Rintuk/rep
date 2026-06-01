import asyncio
import argparse
from sqlalchemy import select, func
from database import SessionLocal
from models import BotSnapshot, Position, UserFinancials, ForexBotSnapshot, ForexPosition

async def main():
    parser = argparse.ArgumentParser(description="Утилита для вывода прибыли админом без поломки статистики.")
    parser.add_argument("--pool", type=str, choices=["crypto", "forex"], required=True, help="Какой пул (crypto или forex)")
    parser.add_argument("--amount", type=float, required=True, help="Сумма вывода (USD)")
    args = parser.parse_args()

    pool_type = args.pool
    w = args.amount

    async with SessionLocal() as db:
        if pool_type == "crypto":
            # 1. Получаем текущий снапшот
            snap = (await db.execute(select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
            if not snap:
                print("Снапшот crypto пула не найден.")
                return

            positions = (await db.execute(select(Position).where(Position.snapshot_id == snap.id))).scalars().all()
            pool_total_usdt = snap.balance_usdt + sum(p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price) for p in positions)
            
            _start = snap.real_start_balance if snap.real_start_balance > 0 else snap.hwm
            _total_inv = (await db.execute(select(func.sum(UserFinancials.investment_usdt)))).scalar() or 0.0
            _total_wd = (await db.execute(select(func.sum(UserFinancials.withdrawal_usdt)))).scalar() or 0.0
            
            net_inv = _start + _total_inv - _total_wd
            if net_inv <= 0:
                net_inv = snap.net_invested if snap.net_invested > 0 else _start
            
            if net_inv <= 0 or pool_total_usdt <= 0:
                print("Ошибка: net_inv или pool_total <= 0")
                return

            pnl_pct = (pool_total_usdt - net_inv) / net_inv * 100
            
            # Математика: чтобы при уменьшении pool_total на W сохранить процент,
            # нужно уменьшить net_inv на W * (net_inv / pool_total_usdt)
            delta_n = w * (net_inv / pool_total_usdt)
            new_start = _start - delta_n

            print(f"--- CRYPTO POOL ---")
            print(f"Текущий капитал (T): {pool_total_usdt:.2f}")
            print(f"Чистые инвестиции (N): {net_inv:.2f}")
            print(f"Текущий PnL: {pnl_pct:.4f}%")
            print(f"Сумма вывода: {w}")
            print(f"Снижение базового капитала должно быть: {delta_n:.2f}")
            print(f"Новый real_start_balance: {new_start:.2f}")
            print(f"ВАЖНО: После выполнения скрипта, бот пришлет новый баланс (уменьшенный на {w}), и PnL останется {pnl_pct:.4f}%")

            confirm = input("Продолжить? (y/n): ")
            if confirm.lower() == 'y':
                snap.real_start_balance = new_start
                if snap.net_invested > 0:
                    snap.net_invested = snap.net_invested - delta_n
                await db.commit()
                print("Успешно! Теперь идите на биржу и выведите ровно эту сумму.")
            else:
                print("Отменено.")

        elif pool_type == "forex":
            snap = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
            if not snap:
                print("Снапшот forex пула не найден.")
                return

            fx_positions = (await db.execute(select(ForexPosition).where(ForexPosition.snapshot_id == snap.id))).scalars().all()
            forex_pool_positions = sum(p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price) for p in fx_positions)
            pool_total_usdt = snap.balance_usdt + forex_pool_positions

            net_inv = snap.net_invested if snap.net_invested > 0 else (snap.real_start_balance if snap.real_start_balance > 0 else snap.hwm)
            
            if net_inv <= 0 or pool_total_usdt <= 0:
                print("Ошибка: net_inv или pool_total <= 0")
                return

            pnl_pct = (pool_total_usdt - net_inv) / net_inv * 100
            delta_n = w * (net_inv / pool_total_usdt)
            new_net_inv = net_inv - delta_n

            print(f"--- FOREX POOL ---")
            print(f"Текущий капитал (T): {pool_total_usdt:.2f}")
            print(f"Чистые инвестиции (N): {net_inv:.2f}")
            print(f"Текущий PnL: {pnl_pct:.4f}%")
            print(f"Сумма вывода: {w}")
            print(f"Снижение net_invested должно быть: {delta_n:.2f}")
            print(f"Новый net_invested: {new_net_inv:.2f}")
            
            confirm = input("Продолжить? (y/n): ")
            if confirm.lower() == 'y':
                snap.net_invested = new_net_inv
                snap.real_start_balance = snap.real_start_balance - delta_n if snap.real_start_balance > 0 else 0
                await db.commit()
                print("Успешно! Теперь идите на биржу/брокера и выведите ровно эту сумму.")
            else:
                print("Отменено.")

if __name__ == "__main__":
    asyncio.run(main())
