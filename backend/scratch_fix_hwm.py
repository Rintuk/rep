import re

AUTH_FILE = r"c:\temp\maklersite\backend\routers\auth.py"

with open(AUTH_FILE, "r", encoding="utf-8") as f:
    content = f.read()

# Fix admin_overview crypto PnL calculation
crypto_replacement = '''
            locked_crypto_pnl = fin.locked_crypto_pnl if fin else 0.0
            
            if gross_pnl >= 0:
                floating_net = gross_pnl * get_investor_share(fin)
                admin_fee_from_floating = gross_pnl * get_pool_fee(fin)
            else:
                floating_net = gross_pnl
                admin_fee_from_floating = 0.0
                
            pnl = round(floating_net + locked_crypto_pnl, 2)

            locked_gross = locked_crypto_pnl / get_investor_share(fin) if get_investor_share(fin) > 0 else 0.0
            locked_admin_fee = locked_gross * get_pool_fee(fin)

            total_gross_pnl += (gross_pnl + locked_gross)
            total_investor_net_pnl += pnl
            total_admin_pnl += (admin_fee_from_floating + locked_admin_fee)
'''

content = re.sub(
    r"            locked_crypto_pnl = fin\.locked_crypto_pnl if fin else 0\.0\n            pnl = round\(gross_pnl \* get_investor_share\(fin\) \+ locked_crypto_pnl, 2\)\n\n            # Reconstruct historical gross profit that was locked during migration\n            locked_gross = locked_crypto_pnl / get_investor_share\(fin\) if get_investor_share\(fin\) > 0 else 0\.0\n\n            total_gross_pnl \+= \(gross_pnl \+ locked_gross\)\n            total_investor_net_pnl \+= pnl\n            # [^\n]+\n            total_admin_pnl \+= \(gross_pnl \+ locked_gross\) \* POOL_FEE",
    crypto_replacement.strip("\n"),
    content,
    flags=re.DOTALL
)

# Fix admin_overview forex PnL calculation
forex_replacement = '''
            fx_entry_pct = fin.forex_entry_pool_pnl_pct if fin else 0.0
            fx_incremental = forex_pool_pct - fx_entry_pct
            fx_gross_pnl = forex_inv * (fx_incremental / 100)
            fx_locked = fin.locked_forex_pnl if fin else 0.0
            
            if fx_gross_pnl >= 0:
                fx_floating_net = fx_gross_pnl * get_investor_share(fin)
            else:
                fx_floating_net = fx_gross_pnl
                
            forex_pnl = round(fx_floating_net + fx_locked, 2)
'''

content = re.sub(
    r"            fx_entry_pct = fin\.forex_entry_pool_pnl_pct if fin else 0\.0\n            fx_incremental = forex_pool_pct - fx_entry_pct\n            fx_gross_pnl = forex_inv \* \(fx_incremental / 100\) if fx_incremental > 0 else 0\.0\n            fx_locked = fin\.locked_forex_pnl if fin else 0\.0\n            forex_pnl = round\(fx_gross_pnl \* get_investor_share\(fin\) \+ fx_locked, 2\)",
    forex_replacement.strip("\n"),
    content,
    flags=re.DOTALL
)

# Fix _get_status_and_limits crypto PnL calculation
content = re.sub(
    r"            floating = f\.investment_usdt \* \(incr / 100\) \* get_investor_share\(f\) if incr > 0 else 0\.0\n            current_pnl = round\(floating \+ f\.locked_crypto_pnl, 2\)",
    '''            gross = f.investment_usdt * (incr / 100)
            floating = gross * get_investor_share(f) if gross >= 0 else gross
            current_pnl = round(floating + f.locked_crypto_pnl, 2)''',
    content,
    flags=re.DOTALL
)

# Fix _get_status_and_limits forex PnL calculation
content = re.sub(
    r"            floating = f\.forex_investment_usdt \* \(fx_incr / 100\) \* get_investor_share\(f\) if fx_incr > 0 else 0\.0\n            current_pnl = round\(floating \+ f\.locked_forex_pnl, 2\)",
    '''            fx_gross = f.forex_investment_usdt * (fx_incr / 100)
            floating = fx_gross * get_investor_share(f) if fx_gross >= 0 else fx_gross
            current_pnl = round(floating + f.locked_forex_pnl, 2)''',
    content,
    flags=re.DOTALL
)

# Fix my_overview crypto PnL calculation
content = re.sub(
    r"            floating = f\.investment_usdt \* \(incr / 100\) \* get_investor_share\(f\) if incr > 0 else 0\.0\n            total_profit = floating \+ f\.locked_crypto_pnl \+ f\.locked_crypto_ref_bonus",
    '''            gross = f.investment_usdt * (incr / 100)
            floating = gross * get_investor_share(f) if gross >= 0 else gross
            total_profit = floating + f.locked_crypto_pnl + f.locked_crypto_ref_bonus''',
    content,
    flags=re.DOTALL
)

# Fix my_overview forex PnL calculation
content = re.sub(
    r"            floating = f\.forex_investment_usdt \* \(fx_incr / 100\) \* get_investor_share\(f\) if fx_incr > 0 else 0\.0\n            total_profit = floating \+ f\.locked_forex_pnl \+ f\.locked_forex_ref_bonus",
    '''            fx_gross = f.forex_investment_usdt * (fx_incr / 100)
            floating = fx_gross * get_investor_share(f) if fx_gross >= 0 else fx_gross
            total_profit = floating + f.locked_forex_pnl + f.locked_forex_ref_bonus''',
    content,
    flags=re.DOTALL
)

# Fix user_overview crypto PnL calculation
content = re.sub(
    r"    gross = fin\.investment_usdt \* \(incr / 100\) if incr > 0 else 0\.0\n    pnl = round\(gross \* get_investor_share\(fin\) \+ fin\.locked_crypto_pnl, 2\)",
    '''    gross = fin.investment_usdt * (incr / 100)
    floating_net = gross * get_investor_share(fin) if gross >= 0 else gross
    pnl = round(floating_net + fin.locked_crypto_pnl, 2)''',
    content,
    flags=re.DOTALL
)

with open(AUTH_FILE, "w", encoding="utf-8") as f:
    f.write(content)

print("AUTH patched successfully")
