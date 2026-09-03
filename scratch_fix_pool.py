with open('C:\\temp\\MaklerSite\\backend\\routers\\bot.py', 'r', encoding='utf-8') as f:
    c = f.read()

# Fix #1: Crypto block - remove gs query, calculate from all_fins directly
old1 = '''        gs = (await db.execute(select(GlobalSettings))).scalar_one_or_none()
        net_invested_pool = gs.net_invested_pool if gs else 0.0

        for t in new_real_trades:
            if t.pnl is not None:
                pnl = t.pnl
                total_investor_profit = 0.0
                if net_invested_pool > 0:
                    for fin in all_fins:
                        share_of_pool = fin.investment_usdt / net_invested_pool
                        inv_gross = pnl * share_of_pool
                        inv_net = inv_gross * get_investor_share(fin) if pnl > 0 else inv_gross
                        total_investor_profit += inv_net
                
                admin_trade_profit = pnl - total_investor_profit
                stat.crypto_profit += admin_trade_profit'''

new1 = '''        net_invested_pool = sum(fin.investment_usdt for fin in all_fins)

        for t in new_real_trades:
            if t.pnl is not None:
                pnl = t.pnl
                total_investor_profit = 0.0
                if net_invested_pool > 0:
                    for fin in all_fins:
                        share_of_pool = fin.investment_usdt / net_invested_pool
                        inv_gross = pnl * share_of_pool
                        inv_net = inv_gross * get_investor_share(fin) if pnl > 0 else inv_gross
                        total_investor_profit += inv_net
                
                admin_trade_profit = pnl - total_investor_profit
                stat.crypto_profit += admin_trade_profit'''

if old1 in c:
    c = c.replace(old1, new1)
    print("Fixed crypto block")
else:
    print("Crypto block not found exactly")

# Fix #2: Forex block
old2 = '''        gs = (await db.execute(select(GlobalSettings))).scalar_one_or_none()
        fx_net_invested_pool = gs.forex_net_invested_pool if gs else 0.0

        for t in new_real_trades:
            if t.pnl is not None:
                pnl = t.pnl
                total_investor_profit = 0.0
                if fx_net_invested_pool > 0:
                    for fin in all_fins:
                        share_of_pool = fin.forex_investment_usdt / fx_net_invested_pool
                        inv_gross = pnl * share_of_pool
                        inv_net = inv_gross * get_investor_share(fin) if pnl > 0 else inv_gross
                        total_investor_profit += inv_net
                
                admin_trade_profit = pnl - total_investor_profit
                stat.forex_profit += admin_trade_profit'''

new2 = '''        fx_net_invested_pool = sum(fin.forex_investment_usdt for fin in all_fins)

        for t in new_real_trades:
            if t.pnl is not None:
                pnl = t.pnl
                total_investor_profit = 0.0
                if fx_net_invested_pool > 0:
                    for fin in all_fins:
                        share_of_pool = fin.forex_investment_usdt / fx_net_invested_pool
                        inv_gross = pnl * share_of_pool
                        inv_net = inv_gross * get_investor_share(fin) if pnl > 0 else inv_gross
                        total_investor_profit += inv_net
                
                admin_trade_profit = pnl - total_investor_profit
                stat.forex_profit += admin_trade_profit'''

if old2 in c:
    c = c.replace(old2, new2)
    print("Fixed forex block")
else:
    print("Forex block not found exactly")

# Remove GlobalSettings from imports in bot.py since we no longer use it
if ', GlobalSettings)' in c:
    c = c.replace(', GlobalSettings)', ')')
    print("Removed GlobalSettings from import")

with open('C:\\temp\\MaklerSite\\backend\\routers\\bot.py', 'w', encoding='utf-8') as f:
    f.write(c)

print("Done")
