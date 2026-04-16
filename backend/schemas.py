from pydantic import BaseModel, EmailStr
from datetime import datetime


# ── Бот → сервер ──────────────────────────────────────────────
class PositionIn(BaseModel):
    symbol: str
    amount: float
    avg_price: float

class TradeIn(BaseModel):
    symbol: str
    action: str
    amount: float
    price: float
    pnl: float | None = None
    timestamp: str

class AIFeedEntryIn(BaseModel):
    timestamp: str
    action: str
    symbol: str
    reason: str

class BotUpdateIn(BaseModel):
    bot_id: str
    timestamp: str
    balance_usdt: float
    positions: list[PositionIn] = []
    recent_trades: list[TradeIn] = []
    ai_feed: list[AIFeedEntryIn] = []
    mode: str = "NORMAL"
    hwm: float = 0.0
    drawdown_pct: float = 0.0


# ── Авторизация ────────────────────────────────────────────────
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    referral_code: str | None = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Дашборд ────────────────────────────────────────────────────
class PositionOut(BaseModel):
    symbol: str
    amount: float
    avg_price: float

class TradeOut(BaseModel):
    symbol: str
    action: str
    amount: float
    price: float
    pnl: float | None
    timestamp: str

class AIFeedOut(BaseModel):
    timestamp: str
    action: str
    symbol: str
    reason: str

class DashboardOut(BaseModel):
    # Пул (весь бот)
    balance_usdt: float
    pool_total_usdt: float
    pool_positions_usdt: float
    mode: str
    hwm: float
    drawdown_pct: float
    server_online: bool
    last_updated: str | None
    # Данные пользователя
    user_investment: float
    user_pnl: float
    user_pnl_pct: float
    positions: list[PositionOut]
    recent_trades: list[TradeOut]
    ai_feed: list[AIFeedOut]
