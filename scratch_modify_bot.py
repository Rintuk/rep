import sys

with open('C:\\temp\\MaklerSite\\backend\\routers\\bot.py', 'r', encoding='utf-8') as f:
    c = f.read()

admin_calc = """
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
"""

crypto_calc = admin_calc + """
        total_invested = sum(fin.investment_usdt for fin in all_fins)
        admin_own_cap = snapshot.real_start_balance
        pool_total = balance_usd
        
        for t in new_real_trades:
            if t.pnl is not None:
                pnl = t.pnl
                admin_share = admin_own_cap / pool_total if pool_total > 0 else 0
                inv_share = total_invested / pool_total if pool_total > 0 else 0
                
                admin_trade_profit = pnl * admin_share
                if pnl > 0:
                    admin_trade_profit += pnl * inv_share * 0.20
                    
                stat.crypto_profit += admin_trade_profit
"""

forex_calc = admin_calc + """
        total_invested = sum(fin.forex_investment_usdt for fin in all_fins)
        admin_own_cap = snapshot.real_start_balance
        pool_total = balance_usd
        
        for t in new_real_trades:
            if t.pnl is not None:
                pnl = t.pnl
                admin_share = admin_own_cap / pool_total if pool_total > 0 else 0
                inv_share = total_invested / pool_total if pool_total > 0 else 0
                
                admin_trade_profit = pnl * admin_share
                if pnl > 0:
                    admin_trade_profit += pnl * inv_share * 0.20
                    
                stat.forex_profit += admin_trade_profit
"""

parts = c.split('for entry in payload.ai_feed:')
if len(parts) >= 3:
    # First part is crypto ai_feed loop
    new_c = parts[0] + crypto_calc + "\n    for entry in payload.ai_feed:" + parts[1] + forex_calc + "\n    for entry in payload.ai_feed:" + parts[2]
    with open('C:\\temp\\MaklerSite\\backend\\routers\\bot.py', 'w', encoding='utf-8') as f:
        f.write(new_c)
    print("Done")
else:
    print("Failed to find injection points")
