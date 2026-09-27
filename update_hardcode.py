with open('backend/routers/dashboard.py', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('forex_pool_positions = 19700.0', 'forex_pool_positions = settings.forex_pool_positions if settings else 19700.0')

with open('backend/routers/dashboard.py', 'w', encoding='utf-8') as f:
    f.write(text)

with open('backend/routers/forex.py', 'r', encoding='utf-8') as f:
    text2 = f.read()

text2 = text2.replace('"pool_positions_usdt": 19700.0,', '"pool_positions_usdt": settings.forex_pool_positions if settings else 19700.0,')

with open('backend/routers/forex.py', 'w', encoding='utf-8') as f:
    f.write(text2)
