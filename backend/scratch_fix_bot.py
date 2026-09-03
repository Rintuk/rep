import re

BOT_FILE = r"c:\temp\maklersite\backend\routers\bot.py"

with open(BOT_FILE, "r", encoding="utf-8") as f:
    content = f.read()

# Fix crypto admin profit log
crypto_replacement = '''
                        share_of_pool = fin.investment_usdt / net_invested_pool
                        inv_gross = pnl * share_of_pool
                        inv_net = inv_gross * get_investor_share(fin) if inv_gross > 0 else inv_gross
                        total_investor_profit += inv_net
                
                # Log only performance fee, preventing admin own capital losses from appearing in notebook
                admin_fee = sum(pnl * (fin.investment_usdt / net_invested_pool) * get_pool_fee(fin) for fin in all_fins) if pnl > 0 else 0.0
                stat.crypto_profit += admin_fee
'''

content = re.sub(
    r"                        share_of_pool = fin\.investment_usdt / net_invested_pool\n                        inv_gross = pnl \* share_of_pool\n                        inv_net = inv_gross \* get_investor_share\(fin\) if inv_gross > 0 else inv_gross\n                        total_investor_profit \+= inv_net\n                \n                admin_trade_profit = pnl - total_investor_profit\n                stat\.crypto_profit \+= admin_trade_profit",
    crypto_replacement.strip("\n"),
    content,
    flags=re.DOTALL
)

# Fix forex admin profit log
forex_replacement = '''
                        share_of_pool = fin.forex_investment_usdt / fx_net_invested_pool
                        inv_gross = pnl * share_of_pool
                        inv_net = inv_gross * get_investor_share(fin) if inv_gross > 0 else inv_gross
                        total_investor_profit += inv_net
                
                # Log only performance fee
                admin_fee = sum(pnl * (fin.forex_investment_usdt / fx_net_invested_pool) * get_pool_fee(fin) for fin in all_fins) if pnl > 0 else 0.0
                stat.forex_profit += admin_fee
'''

content = re.sub(
    r"                        share_of_pool = fin\.forex_investment_usdt / fx_net_invested_pool\n                        inv_gross = pnl \* share_of_pool\n                        inv_net = inv_gross \* get_investor_share\(fin\) if inv_gross > 0 else inv_gross\n                        total_investor_profit \+= inv_net\n                \n                admin_trade_profit = pnl - total_investor_profit\n                stat\.forex_profit \+= admin_trade_profit",
    forex_replacement.strip("\n"),
    content,
    flags=re.DOTALL
)

with open(BOT_FILE, "w", encoding="utf-8") as f:
    f.write(content)

print("BOT patched successfully")
