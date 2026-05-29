from sqlalchemy import create_engine, text

engine = create_engine('postgresql://postgres:WvVpTjRydwDqINaJkQCLYhLhNrtGqBIs@autorack.proxy.rlwy.net:45887/railway')
with engine.connect() as conn:
    res = conn.execute(text('SELECT u.email, f.forex_investment_usdt FROM user_financials f JOIN users u ON u.id = f.user_id WHERE f.forex_investment_usdt > 0'))
    for row in res.fetchall():
        print(f"{row[0]}: {row[1]}")
