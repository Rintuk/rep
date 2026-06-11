with open('backend/routers/auth.py', 'r', encoding='utf-8') as f:
    content = f.read()

# For deposit_from_pool (Crypto)
target_crypto = '''        # PnL пула ПОСЛЕ регистрации депозита (ref вырастет на payload.amount, pool_total не меняется).
        # Передаём в миграцию как final_pct: только инвесторы с положительной прибылью
        # получат этот entry_pct — остальных не трогаем, чтобы не скрыть их убытки.
        ref_post = ref + payload.amount
        post_deposit_pct = round((pool_total - ref_post) / ref_post * 100, 4) if ref_post > 0 else 0.0
    else:
        current_pnl_pct = 0.0
        post_deposit_pct = 0.0

    # Фиксируем прибыль существующих инвесторов.
    # Прибыль считается по current_pnl_pct (до депозита),
    # entry_pct выставляется в post_deposit_pct (после) — только для тех у кого profit > 0.
    await _migrate_pnl_internal(
        db,
        override_crypto_pct=current_pnl_pct,
        final_crypto_pct=post_deposit_pct,
    )'''

replacement_crypto = '''        # Так как мы компенсируем рост total_inv вычитанием из real_start_balance,
        # процент пула НЕ изменится. post_deposit_pct равен current_pnl_pct.
        post_deposit_pct = current_pnl_pct
    else:
        current_pnl_pct = 0.0
        post_deposit_pct = 0.0

    # Нам больше не нужно мигрировать всех инвесторов, так как процент пула не падает.'''

content = content.replace(target_crypto, replacement_crypto)

# For forex_deposit_from_pool
target_forex = '''        # PnL ПОСЛЕ регистрации: fx_ref вырастет на payload.amount, баланс не изменится.
        fx_ref_post = fx_ref + payload.amount
        post_deposit_forex_pct = round((forex_snap.balance_usdt - fx_ref_post) / fx_ref_post * 100, 4) if fx_ref_post > 0 else 0.0
    else:
        current_forex_pct = 0.0
        post_deposit_forex_pct = 0.0

    # Фиксируем прибыль форекс-инвесторов.
    # Только те у кого profit > 0 получат обновлённый entry_pct = post_deposit_forex_pct.
    # Инвесторы с убытком не затрагиваются — формула дашборда отразит изменение сама.
    await _migrate_pnl_internal(
        db,
        override_forex_pct=current_forex_pct,
        final_forex_pct=post_deposit_forex_pct,
    )'''

replacement_forex = '''        # Так как мы компенсируем рост forex_investment вычитанием из real_start_balance,
        # процент пула НЕ изменится. post_deposit_forex_pct равен current_forex_pct.
        post_deposit_forex_pct = current_forex_pct
    else:
        current_forex_pct = 0.0
        post_deposit_forex_pct = 0.0

    # Нам больше не нужно мигрировать всех инвесторов, так как процент пула не падает.'''

content = content.replace(target_forex, replacement_forex)

with open('backend/routers/auth.py', 'w', encoding='utf-8') as f:
    f.write(content)
