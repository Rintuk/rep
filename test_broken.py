def run():
    inv = 205.0
    share = 0.8
    balance = 2000.0
    ref = 1000.0
    payload_amount = 509.0

    current_forex_pct = round((balance - ref) / ref * 100, 4)
    ref_post = ref + payload_amount
    post_deposit_forex_pct = round((balance - ref_post) / ref_post * 100, 4)
    entry_pct = current_forex_pct - (30.68 / share / inv * 100)

    # migrate_pnl_internal
    delta = post_deposit_forex_pct - current_forex_pct
    entry_pct += delta

    # The BROKEN code just sets entry_pct and increases inv
    entry_pct = post_deposit_forex_pct
    inv += payload_amount

    # Dashboard
    pool_pnl_pct = round((balance - ref_post) / ref_post * 100, 4)
    dash_incr = pool_pnl_pct - entry_pct
    dash_gross = inv * (dash_incr / 100)
    dash_pnl = round(dash_gross * share, 2)
    print(f"Dashboard PNL (Broken): {dash_pnl}")

run()
