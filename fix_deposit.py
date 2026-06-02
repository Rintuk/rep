with open('backend/routers/auth.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Crypto deposit from pool
target_crypto = '''    if snap:
        snap.net_invested += payload.amount'''
replacement_crypto = '''    if snap:
        if snap.real_start_balance == 0.0:
            snap.real_start_balance = snap.hwm
        snap.real_start_balance -= payload.amount
        # net_invested is explicitly NOT increased because it's an internal transfer'''

content = content.replace(target_crypto, replacement_crypto)

# Forex deposit from pool
target_forex = '''    if forex_snap:
        forex_snap.net_invested += payload.amount'''
replacement_forex = '''    if forex_snap:
        if forex_snap.real_start_balance == 0.0:
            forex_snap.real_start_balance = forex_snap.hwm
        forex_snap.real_start_balance -= payload.amount
        # net_invested is explicitly NOT increased because it's an internal transfer'''

content = content.replace(target_forex, replacement_forex)

with open('backend/routers/auth.py', 'w', encoding='utf-8') as f:
    f.write(content)
