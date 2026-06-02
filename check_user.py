import sqlite3
conn = sqlite3.connect('backend/makler.db')
c = conn.cursor()
c.execute("SELECT u.email, f.forex_investment_usdt, f.forex_entry_pool_pnl_pct, f.locked_forex_pnl FROM users u JOIN user_financials f ON u.id = f.user_id WHERE u.email = 'juniorvasilva@gmail.com'")
print(c.fetchall())
conn.close()
