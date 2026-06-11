"""
Скрипт восстановления из бэкапа + корректное пополнение пула на 2700.
Запускать из папки backend: python restore_and_adjust.py
"""
import asyncio
import json
import os
import sys

# Чтобы скрипт нашёл модули
sys.path.insert(0, os.path.dirname(__file__))

from database import AsyncSessionLocal
from models import UserFinancials, ForexBotSnapshot, ForexPosition
from sqlalchemy import select

BACKUP_FILE = r"C:\Users\admin\Downloads\backup_2026-06-05 (1).json"
ADD_AMOUNT = 2700.0  # Сколько добавил админ в пул


async def main():
    with open(BACKUP_FILE, "r", encoding="utf-8") as f:
        backup = json.load(f)

    async with AsyncSessionLocal() as db:

        # ── ШАГ 1: Восстанавливаем финансы всех инвесторов из бэкапа ──────────
        print("=== ШАГ 1: Восстанавливаем данные инвесторов из бэкапа ===")
        restored = 0
        for user in backup["data"]:
            fin_data = user.get("financials")
            if not fin_data:
                continue
            user_id = user["id"]
            fin = (await db.execute(
                select(UserFinancials).where(UserFinancials.user_id == user_id)
            )).scalar_one_or_none()
            if not fin:
                print(f"  [SKIP] Нет финансов в БД для {user['email']}")
                continue

            fin.investment_usdt           = float(fin_data.get("investment_usdt", fin.investment_usdt))
            fin.withdrawal_usdt           = float(fin_data.get("withdrawal_usdt", fin.withdrawal_usdt))
            fin.entry_pool_pnl_pct        = float(fin_data.get("entry_pool_pnl_pct", fin.entry_pool_pnl_pct))
            fin.locked_crypto_pnl         = float(fin_data.get("locked_crypto_pnl", fin.locked_crypto_pnl))
            fin.locked_crypto_ref_bonus   = float(fin_data.get("locked_crypto_ref_bonus", fin.locked_crypto_ref_bonus))
            fin.forex_investment_usdt     = float(fin_data.get("forex_investment_usdt", fin.forex_investment_usdt))
            fin.forex_withdrawal_usdt     = float(fin_data.get("forex_withdrawal_usdt", fin.forex_withdrawal_usdt))
            fin.forex_entry_pool_pnl_pct  = float(fin_data.get("forex_entry_pool_pnl_pct", fin.forex_entry_pool_pnl_pct))
            fin.locked_forex_pnl          = float(fin_data.get("locked_forex_pnl", fin.locked_forex_pnl))
            fin.locked_forex_ref_bonus    = float(fin_data.get("locked_forex_ref_bonus", fin.locked_forex_ref_bonus))
            cs = fin_data.get("custom_investor_share")
            fin.custom_investor_share     = float(cs) if cs is not None else None

            print(f"  [OK] {user['email']}: inv={fin.forex_investment_usdt}, locked={fin.locked_forex_pnl}, entry={fin.forex_entry_pool_pnl_pct}%")
            restored += 1

        await db.commit()
        print(f"  >>> Восстановлено {restored} инвесторов\n")

        # ── ШАГ 2: Обновляем net_invested во ВСЕХ снапшотах +2700 ──────────────
        print("=== ШАГ 2: Добавляем 2700 к net_invested во всех снапшотах ===")
        snaps = (await db.execute(select(ForexBotSnapshot))).scalars().all()
        for s in snaps:
            old = s.net_invested
            s.net_invested = round(old + ADD_AMOUNT, 4)
            print(f"  Снапшот {s.timestamp}: net_invested {old} → {s.net_invested}")
        await db.commit()
        print()

        # ── ШАГ 3: Считаем новый правильный процент по последнему снапшоту ───
        print("=== ШАГ 3: Считаем новый процент пула ===")
        snap = (await db.execute(
            select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1)
        )).scalar_one_or_none()
        if not snap:
            print("ОШИБКА: Нет снапшотов!")
            return

        fx_positions = (await db.execute(
            select(ForexPosition).where(ForexPosition.snapshot_id == snap.id)
        )).scalars().all()
        forex_pool_positions = sum(
            p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price)
            for p in fx_positions
        )
        pool_total = snap.balance_usdt + forex_pool_positions
        ref = snap.net_invested

        true_pct = round((pool_total - ref) / ref * 100, 4) if ref > 0 else 0.0

        print(f"  balance_usdt:       {snap.balance_usdt}")
        print(f"  forex_positions:    {forex_pool_positions:.4f}")
        print(f"  pool_total:         {pool_total:.4f}")
        print(f"  net_invested (ref): {ref}")
        print(f"  НОВЫЙ true_pct:     {true_pct}%\n")

        # ── ШАГ 4: Выставляем новый процент как точку входа всем инвесторам ──
        print("=== ШАГ 4: Обновляем точки входа инвесторов ===")
        fins = (await db.execute(select(UserFinancials))).scalars().all()
        count = 0
        for fin in fins:
            if fin.forex_investment_usdt > 0:
                old_entry = fin.forex_entry_pool_pnl_pct
                fin.forex_entry_pool_pnl_pct = true_pct
                print(f"  user_id={fin.user_id}: entry {old_entry}% → {true_pct}%")
                count += 1

        await db.commit()
        print(f"\n  >>> Обновлено {count} инвесторов")
        print("\n=== ГОТОВО! Всё восстановлено и скорректировано ===")


if __name__ == "__main__":
    asyncio.run(main())
