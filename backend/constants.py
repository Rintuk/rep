INVESTOR_SHARE     = 0.75   # 75% для инвестора
POOL_FEE           = 0.20   # 20% для платформы

def get_investor_share(fin) -> float:
    if fin and getattr(fin, "custom_investor_share", None) is not None:
        return float(fin.custom_investor_share)
    return INVESTOR_SHARE

def get_pool_fee(fin) -> float:
    if fin and getattr(fin, "custom_pool_fee", None) is not None:
        return float(fin.custom_pool_fee)
    return POOL_FEE

def get_ref_bonus(fin) -> float:
    if fin and getattr(fin, "custom_ref_bonus", None) is not None:
        return float(fin.custom_ref_bonus)
    inv_s = get_investor_share(fin)
    pool_f = get_pool_fee(fin)
    return max(0.0, 1.0 - inv_s - pool_f)

# Многоуровневые реферальные бонусы (Уровень: Процент)
REF_FEES = {
    1: 0.03,   # 3%
    2: 0.01,   # 1%
    3: 0.005,  # 0.5%
    4: 0.003,  # 0.3%
    5: 0.002   # 0.2%
}

# Пороги для статусов (Общий объем: личный депозит + все рефералы)
STATUS_THRESHOLDS = {
    "PARTNER": 0,
    "BRONZE": 3000,
    "SILVER": 3500,
    "GOLD": 4000,
    "VIP": 5000
}

# Лимиты на количество приглашенных (по статусам)
STATUS_INVITE_LIMITS = {
    "PARTNER": 3,
    "BRONZE": 5,
    "SILVER": 7,
    "GOLD": 10,
    "VIP": 9999
}
