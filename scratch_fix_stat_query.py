with open('C:\\temp\\MaklerSite\\backend\\routers\\bot.py', 'r', encoding='utf-8') as f:
    c = f.read()

# Fix #1: Crypto stat query (line ~94) - wrong select(AdminProfitLog, GlobalSettings)
old1 = 'stat = (await db.execute(select(AdminProfitLog, GlobalSettings).where(AdminProfitLog.date == today_str))).scalar_one_or_none()\n        if not stat:\n            stat = AdminProfitLog(date=today_str, crypto_profit=0.0, forex_profit=0.0)\n            db.add(stat)\n\n        gs = (await db.execute(select(GlobalSettings))).scalar_one_or_none()\n        net_invested_pool = gs.net_invested_pool if gs else 0.0'

new1 = 'stat = (await db.execute(select(AdminProfitLog).where(AdminProfitLog.date == today_str))).scalar_one_or_none()\n        if not stat:\n            stat = AdminProfitLog(date=today_str, crypto_profit=0.0, forex_profit=0.0)\n            db.add(stat)\n\n        gs = (await db.execute(select(GlobalSettings))).scalar_one_or_none()\n        net_invested_pool = gs.net_invested_pool if gs else 0.0'

if old1 in c:
    c = c.replace(old1, new1)
    print("Fixed crypto stat query")
else:
    print("Crypto query block not found exactly, searching partial...")
    # Try replacing just the broken line
    bad = 'select(AdminProfitLog, GlobalSettings).where(AdminProfitLog.date == today_str))).scalar_one_or_none()'
    good = 'select(AdminProfitLog).where(AdminProfitLog.date == today_str))).scalar_one_or_none()'
    count = c.count(bad)
    print(f"Found {count} occurrences of bad query")
    c = c.replace(bad, good)
    print("Replaced all occurrences")

with open('C:\\temp\\MaklerSite\\backend\\routers\\bot.py', 'w', encoding='utf-8') as f:
    f.write(c)

print("Done")
