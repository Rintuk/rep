import sys

with open('C:\\temp\\MaklerSite\\backend\\routers\\bot.py', 'r', encoding='utf-8') as f:
    c = f.read()

# Add GlobalSettings to imports
if 'GlobalSettings' not in c:
    c = c.replace('AdminProfitLog)', 'AdminProfitLog, GlobalSettings)')
    
# Add get_investor_share to imports
if 'from constants import' not in c:
    # Let's insert it near the top
    c = c.replace('from database import get_db', 'from database import get_db\nfrom constants import get_investor_share')
elif 'get_investor_share' not in c:
    c = c.replace('from constants import ', 'from constants import get_investor_share, ')


# Crypto Replacement
old_crypto = '''        total_invested = sum(fin.investment_usdt for fin in all_fins)
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
                    
                stat.crypto_profit += admin_trade_profit'''

new_crypto = '''        gs = (await db.execute(select(GlobalSettings))).scalar_one_or_none()
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

if old_crypto in c:
    c = c.replace(old_crypto, new_crypto)
else:
    print("Crypto block not found! Mismatch.")


# Forex Replacement
old_forex = '''        total_invested = sum(fin.forex_investment_usdt for fin in all_fins)
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
                    
                stat.forex_profit += admin_trade_profit'''

new_forex = '''        gs = (await db.execute(select(GlobalSettings))).scalar_one_or_none()
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

if old_forex in c:
    c = c.replace(old_forex, new_forex)
else:
    print("Forex block not found! Mismatch.")

with open('C:\\temp\\MaklerSite\\backend\\routers\\bot.py', 'w', encoding='utf-8') as f:
    f.write(c)
print('Done fixing bot.py')
