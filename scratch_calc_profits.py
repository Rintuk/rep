import json, math

# Backup data
backup = {
  "timestamp": "2026-06-11T19:30:01.306197",
  "users_count": 20,
  "pool_crypto": None,
  "pool_forex": {
    "balance_usdt": 25377.86,
    "net_invested": 24467.33,
    "hwm": 25335.84,
    "real_start_balance": 1345.2700202759238,
    "drawdown_pct": 0.7086,
    "timestamp": "2026-06-11 19:26:59",
    "positions": [
      {"symbol": "EURUSD.mm", "amount": -221.55, "avg_price": 1.15594, "current_price": 1}
    ]
  },
  "data": [
    {"id": "5391d5b0-4483-45c8-b106-3061a869cf91", "email": "kushnar080868@mail.ru", "financials": {"investment_usdt": 0, "withdrawal_usdt": 0, "entry_pool_pnl_pct": 0, "locked_crypto_pnl": 0, "locked_crypto_ref_bonus": 0, "forex_investment_usdt": 1096.82, "forex_withdrawal_usdt": 0, "forex_entry_pool_pnl_pct": 0, "locked_forex_pnl": 0, "locked_forex_ref_bonus": 0, "custom_investor_share": 0.7, "note": ""}},
    {"id": "94eda08b-2a15-4c25-ae24-2dc7c30b1f35", "email": "burangulov.renat@gmail.com", "financials": None},
    {"id": "866fa88d-3381-4e43-86f2-1130f2035644", "email": "gostplay891@gmail.com", "financials": None},
    {"id": "61bfe237-36f1-44f7-be74-f4a8e24697b5", "email": "Burangulov.renat@gmail.com", "financials": {"investment_usdt": 0, "withdrawal_usdt": 0, "entry_pool_pnl_pct": 0, "locked_crypto_pnl": 0, "locked_crypto_ref_bonus": 0, "forex_investment_usdt": 0, "forex_withdrawal_usdt": 0, "forex_entry_pool_pnl_pct": 7.0577, "locked_forex_pnl": 0, "locked_forex_ref_bonus": 0, "custom_investor_share": None, "note": ""}},
    {"id": "56f42e69-8213-4f4a-9cfd-a0205a31d199", "email": "maksimsegolev6@gmail.com", "financials": {"investment_usdt": 0, "withdrawal_usdt": 0, "entry_pool_pnl_pct": 0, "locked_crypto_pnl": 0, "locked_crypto_ref_bonus": 0, "forex_investment_usdt": 660.47, "forex_withdrawal_usdt": 0, "forex_entry_pool_pnl_pct": 0, "locked_forex_pnl": 0, "locked_forex_ref_bonus": 0, "custom_investor_share": None, "note": ""}},
    {"id": "0dafbba8-3237-41b5-929b-8c2c5996d657", "email": "complete.complete@mail.ru", "financials": None},
    {"id": "9b3d8aca-96ba-482b-a925-bbce375f012f", "email": "aleko_k@inbox.ru", "financials": {"investment_usdt": 0, "withdrawal_usdt": 0, "entry_pool_pnl_pct": 0, "locked_crypto_pnl": 0, "locked_crypto_ref_bonus": 0, "forex_investment_usdt": 957.85, "forex_withdrawal_usdt": 0, "forex_entry_pool_pnl_pct": 0, "locked_forex_pnl": 0, "locked_forex_ref_bonus": 0, "custom_investor_share": None, "note": ""}},
    {"id": "e3ff7b8d-2a2e-4707-9506-5b1cf1a38b4b", "email": "krechner.maxim@gmail.com", "financials": None},
    {"id": "b1780c66-98b2-4932-b24e-04c7df85ef7b", "email": "juniorvasilva@gmail.com", "financials": {"investment_usdt": 0, "withdrawal_usdt": 0, "entry_pool_pnl_pct": 0, "locked_crypto_pnl": 0, "locked_crypto_ref_bonus": 0, "forex_investment_usdt": 779.49, "forex_withdrawal_usdt": 0, "forex_entry_pool_pnl_pct": 0, "locked_forex_pnl": 0, "locked_forex_ref_bonus": 0, "custom_investor_share": None, "note": ""}},
    {"id": "b54b41cc-6a4d-4895-9c87-7e1d97237153", "email": "elenabyrangylova@gmail.com", "financials": None},
    {"id": "17467030-1cda-4b0b-9de6-8444cbb787f0", "email": "baburinvov@gmail.com", "financials": None},
    {"id": "bc4f96cd-078a-4780-b53e-cd6c62397cd2", "email": "anatoliiterekhov048@gmail.com", "financials": {"investment_usdt": 0, "withdrawal_usdt": 0, "entry_pool_pnl_pct": 0, "locked_crypto_pnl": 0, "locked_crypto_ref_bonus": 0, "forex_investment_usdt": 1130.55, "forex_withdrawal_usdt": 0, "forex_entry_pool_pnl_pct": 0, "locked_forex_pnl": 0, "locked_forex_ref_bonus": 0, "custom_investor_share": 0.75, "note": ""}},
    {"id": "6cacd783-0cb3-40c8-b30b-ebf61f01862a", "email": "rintuk@mail.ru", "financials": None},
    {"id": "8b1c219e-e385-4f41-a2bf-937c8e873779", "email": "lanavasilevskaya@gmail.com", "financials": None},
    {"id": "ffc4411b-61c6-434e-97d9-9a6dc50063f9", "email": "melyarus085@gmail.com", "financials": {"investment_usdt": 0, "withdrawal_usdt": 0, "entry_pool_pnl_pct": 0, "locked_crypto_pnl": 0, "locked_crypto_ref_bonus": 0, "forex_investment_usdt": 1012.2, "forex_withdrawal_usdt": 0, "forex_entry_pool_pnl_pct": 0, "locked_forex_pnl": 0, "locked_forex_ref_bonus": 0, "custom_investor_share": None, "note": ""}},
    {"id": "41bd8270-aeec-4441-95f9-a04ae37c04b9", "email": "testuser_1780256689142@test.com", "financials": None},
    {"id": "b6556c92-3405-4a00-b739-a81122bb6834", "email": "spirit712@mail.ru", "financials": {"investment_usdt": 0, "withdrawal_usdt": 0, "entry_pool_pnl_pct": 0, "locked_crypto_pnl": 0, "locked_crypto_ref_bonus": 0, "forex_investment_usdt": 12755, "forex_withdrawal_usdt": 0, "forex_entry_pool_pnl_pct": 2.1497, "locked_forex_pnl": 198.62, "locked_forex_ref_bonus": 0, "custom_investor_share": 0.75, "note": ""}},
    {"id": "cb8557b7-c60a-4415-8bea-a01cfab52a56", "email": "rut.drobot@mail.ru", "financials": {"investment_usdt": 0, "withdrawal_usdt": 0, "entry_pool_pnl_pct": 0, "locked_crypto_pnl": 0, "locked_crypto_ref_bonus": 0, "forex_investment_usdt": 1021, "forex_withdrawal_usdt": 0, "forex_entry_pool_pnl_pct": 2.5902, "locked_forex_pnl": 0, "locked_forex_ref_bonus": 0, "custom_investor_share": None, "note": ""}},
    {"id": "17b15651-c896-49f0-b63a-59f1281bcfc3", "email": "alexander.v.solovev@gmail.com", "financials": {"investment_usdt": 0, "withdrawal_usdt": 0, "entry_pool_pnl_pct": 0, "locked_crypto_pnl": 0, "locked_crypto_ref_bonus": 0, "forex_investment_usdt": 33, "forex_withdrawal_usdt": 0, "forex_entry_pool_pnl_pct": 0, "locked_forex_pnl": 0, "locked_forex_ref_bonus": 25.56, "custom_investor_share": 0.75, "note": ""}},
    {"id": "21403a7d-7c46-42ac-9337-340d3d7d46a4", "email": "sanekkushnarenko777@gmail.com", "financials": {"investment_usdt": 0, "withdrawal_usdt": 0, "entry_pool_pnl_pct": 0, "locked_crypto_pnl": 0, "locked_crypto_ref_bonus": 0, "forex_investment_usdt": 3326.67, "forex_withdrawal_usdt": 0, "forex_entry_pool_pnl_pct": 0, "locked_forex_pnl": 0, "locked_forex_ref_bonus": 0, "custom_investor_share": 0.6, "note": ""}},
  ]
}

DEFAULT_INVESTOR_SHARE = 0.80

# Расчёт PnL% форекс пула на момент бэкапа
pf = backup["pool_forex"]
positions = pf["positions"]
pool_total = pf["balance_usdt"] + sum(
    p["amount"] * (p["current_price"] if (p["current_price"] or 0) > 0 else p["avg_price"])
    for p in positions
)
ref = pf["net_invested"]
forex_pool_pct = round((pool_total - ref) / ref * 100, 4) if ref > 0 else 0.0
print(f"Форекс пул PnL% на момент бэкапа: {forex_pool_pct}%")
print(f"pool_total = {pool_total:.2f}, ref = {ref:.2f}")
print()

# Считаем прибыль каждого инвестора
print(f"{'Email':<45} {'Инвест':>10} {'Прибыль':>10}")
print("-" * 70)

result_data = []
for user in backup["data"]:
    fin = user.get("financials")
    if not fin:
        result_data.append(user)
        continue

    share = fin["custom_investor_share"] if fin["custom_investor_share"] is not None else DEFAULT_INVESTOR_SHARE
    inv = fin["forex_investment_usdt"]
    entry_pct = fin["forex_entry_pool_pnl_pct"]
    locked = fin["locked_forex_pnl"]

    if inv > 0:
        incr = forex_pool_pct - entry_pct
        gross = inv * (incr / 100) if incr > 0 else 0.0
        floating_profit = round(gross * share, 2)
        total_profit = round(floating_profit + locked, 2)
    else:
        total_profit = locked

    print(f"{user['email']:<45} {inv:>10.2f} {total_profit:>10.2f}")

    # Создаём обновлённые финансы:
    # - locked_forex_pnl = полная прибыль на момент бэкапа
    # - forex_entry_pool_pnl_pct = текущий PnL пула (чтобы плавающая прибыль = 0)
    new_fin = dict(fin)
    new_fin["locked_forex_pnl"] = total_profit
    new_fin["forex_entry_pool_pnl_pct"] = forex_pool_pct  # обнуляем плавающую прибыль

    new_user = dict(user)
    new_user["financials"] = new_fin
    result_data.append(new_user)

# Формируем финальный бэкап для загрузки
output = dict(backup)
output["data"] = result_data
output["timestamp"] = "2026-06-15T14:55:00.000000"

out_path = "C:\\temp\\MaklerSite\\restored_backup.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print()
print(f"✅ Готово! Файл сохранён: {out_path}")
print("Загрузите его через кнопку 'Восстановить из бэкапа' в админ-панели.")
