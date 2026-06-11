with open('backend/routers/auth.py', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''        current_pnl_pct = round((pool_total - ref) / ref * 100, 4) if ref > 0 else 0.0'''
replacement = '''        # ВРЕМЕННЫЙ ФИКС: так как баланс уже обновился, вычитаем add_amount для получения старого процента
        current_pnl_pct = round(((pool_total - add_amount) - ref) / ref * 100, 4) if ref > 0 else 0.0'''

content = content.replace(target, replacement)
with open('backend/routers/auth.py', 'w', encoding='utf-8') as f:
    f.write(content)

with open('backend/routers/forex.py', 'r', encoding='utf-8') as f:
    content = f.read()

target2 = '''        current_pnl_pct = round((pool_total - ref) / ref * 100, 4) if ref > 0 else 0.0'''
replacement2 = '''        # ВРЕМЕННЫЙ ФИКС: так как баланс уже обновился, вычитаем add_amount для получения старого процента
        current_pnl_pct = round(((pool_total - add_amount) - ref) / ref * 100, 4) if ref > 0 else 0.0'''

content = content.replace(target2, replacement2)
with open('backend/routers/forex.py', 'w', encoding='utf-8') as f:
    f.write(content)
