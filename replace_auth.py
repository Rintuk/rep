import re

with open(r"backend\routers\auth.py", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update imports
content = content.replace(
    "from constants import INVESTOR_SHARE, POOL_FEE, REF_FEES, STATUS_THRESHOLDS",
    "from constants import INVESTOR_SHARE, POOL_FEE, REF_FEES, STATUS_THRESHOLDS, get_investor_share"
)

# Replace in get_admin_dashboard
content = content.replace("pnl = round(gross_pnl * INVESTOR_SHARE + locked_crypto_pnl, 2)", "pnl = round(gross_pnl * get_investor_share(fin) + locked_crypto_pnl, 2)")
content = content.replace("locked_gross = locked_crypto_pnl / INVESTOR_SHARE", "locked_gross = locked_crypto_pnl / get_investor_share(fin)")

# Find usages and replace
content = content.replace("from constants import INVESTOR_SHARE", "from constants import INVESTOR_SHARE, get_investor_share")

# fake_profit
content = content.replace("fake_profit = round(gross * INVESTOR_SHARE, 2)", "fake_profit = round(gross * get_investor_share(f), 2)")

# forex pools
content = content.replace("ideal_net_profit = (f.forex_investment_usdt / total_old) * TOTAL_PROFIT * INVESTOR_SHARE", "ideal_net_profit = (f.forex_investment_usdt / total_old) * TOTAL_PROFIT * get_investor_share(f)")
content = content.replace("current_net_profit = f.forex_investment_usdt * (current_pool_pct / 100) * INVESTOR_SHARE", "current_net_profit = f.forex_investment_usdt * (current_pool_pct / 100) * get_investor_share(f)")

content = content.replace("ideal_net_profit = (f.forex_investment_usdt / total_old) * payload.target_profit_usdt * INVESTOR_SHARE", "ideal_net_profit = (f.forex_investment_usdt / total_old) * payload.target_profit_usdt * get_investor_share(f)")
content = content.replace("current_net_profit = f.forex_investment_usdt * (pool_pnl_pct / 100) * INVESTOR_SHARE", "current_net_profit = f.forex_investment_usdt * (pool_pnl_pct / 100) * get_investor_share(f)")

# restore_ref_bonus
content = content.replace("user_profit = round(gross * INVESTOR_SHARE, 2)", "user_profit = round(gross * get_investor_share(f), 2)")
content = content.replace("fx_user_profit = round(fx_gross * INVESTOR_SHARE, 2)", "fx_user_profit = round(fx_gross * get_investor_share(f), 2)")

content = content.replace("from constants import INVESTOR_SHARE as _IS\n                        gross = child_db.locked_crypto_pnl / _IS", "gross = child_db.locked_crypto_pnl / get_investor_share(child_db)")
content = content.replace("from constants import INVESTOR_SHARE as _IS\n                        fx_gross = child_db.locked_forex_pnl / _IS", "fx_gross = child_db.locked_forex_pnl / get_investor_share(child_db)")

# get_crypto_dashboard
content = content.replace("pnl = round(gross * INVESTOR_SHARE + fin.locked_crypto_pnl, 2)", "pnl = round(gross * get_investor_share(fin) + fin.locked_crypto_pnl, 2)")

with open(r"backend\routers\auth.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated auth.py")
