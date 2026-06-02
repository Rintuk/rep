def run():
    inv = 205.0
    share = 0.8
    balance = 2000.0
    ref = 1000.0
    payload_amount = 509.0

    current_forex_pct = round((balance - ref) / ref * 100, 4)
    print(f"current_forex_pct: {current_forex_pct}")

    ref_post = ref + payload_amount
    post_deposit_forex_pct = round((balance - ref_post) / ref_post * 100, 4)
    print(f"post_deposit_forex_pct: {post_deposit_forex_pct}")

    # Before migration, entry_pct
    entry_pct = current_forex_pct - (30.68 / share / inv * 100)
    print(f"Old entry_pct: {entry_pct}")

    # migrate_pnl_internal
    delta = post_deposit_forex_pct - current_forex_pct
    entry_pct += delta
    print(f"Shifted entry_pct: {entry_pct}")

    # My new code
    fx_incr = post_deposit_forex_pct - entry_pct
    gross = inv * (fx_incr / 100)
    user_profit = round(gross * share, 2)
    print(f"user_profit locked: {user_profit}")

    entry_pct = post_deposit_forex_pct
    inv += payload_amount

    # Dashboard
    pool_pnl_pct = round((balance - ref_post) / ref_post * 100, 4)
    dash_incr = pool_pnl_pct - entry_pct
    dash_gross = inv * (dash_incr / 100)
    dash_pnl = round(dash_gross * share + user_profit, 2)
    print(f"Dashboard PNL: {dash_pnl}")

run()
