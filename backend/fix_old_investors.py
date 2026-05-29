import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from constants import INVESTOR_SHARE

DATABASE_URL = "postgresql+asyncpg://postgres:WvVpTjRydwDqINaJkQCLYhLhNrtGqBIs@autorack.proxy.rlwy.net:45887/railway"

async def main():
    engine = create_async_engine(DATABASE_URL, echo=False, connect_args={"ssl": False})
    async with engine.begin() as conn:
        # Get current pool pct
        res = await conn.execute(text("SELECT balance_usdt, net_invested, hwm, real_start_balance FROM forex_bot_snapshots ORDER BY timestamp DESC LIMIT 1"))
        snap = res.fetchone()
        
        balance = snap.balance_usdt
        net_invested = snap.net_invested if snap.net_invested > 0 else (snap.real_start_balance if snap.real_start_balance > 0 else snap.hwm)
        current_pool_pct = ((balance - net_invested) / net_invested * 100) if net_invested > 0 else 0.0
        
        print(f"Current pool pct: {current_pool_pct}%")
        
        # Get all users
        res = await conn.execute(text("""
            SELECT u.email, f.user_id, f.forex_investment_usdt, f.forex_entry_pool_pnl_pct, f.locked_forex_pnl
            FROM user_financials f
            JOIN users u ON u.id = f.user_id
            WHERE f.forex_investment_usdt > 0
        """))
        users = res.fetchall()
        
        new_emails = ['kushnar080868@mail.ru', 'sanekkushnarenko777@gmail.com']
        
        total_old_investment = sum(u.forex_investment_usdt for u in users if u.email not in new_emails)
        
        print(f"Total old investment: {total_old_investment}")
        
        TOTAL_PROFIT = 290.0
        
        for u in users:
            if u.email in new_emails:
                continue
                
            # Идеальная чистая прибыль для старого инвестора
            ideal_net_profit = (u.forex_investment_usdt / total_old_investment) * TOTAL_PROFIT * INVESTOR_SHARE
            
            # Текущая отображаемая прибыль (потому что у них entry_pct = 0.0)
            current_net_profit = u.forex_investment_usdt * (current_pool_pct / 100) * INVESTOR_SHARE
            
            # Сколько не хватает
            missing_profit = ideal_net_profit - current_net_profit
            
            if missing_profit > 0:
                print(f"Fixing {u.email}: ideal {ideal_net_profit:.2f}, current {current_net_profit:.2f}, missing {missing_profit:.2f}")
                await conn.execute(text("UPDATE user_financials SET locked_forex_pnl = locked_forex_pnl + :missing WHERE user_id = :uid"), 
                                   {"missing": missing_profit, "uid": u.user_id})

if __name__ == "__main__":
    asyncio.run(main())
