from pydantic import BaseModel, EmailStr
from datetime import datetime


# ── Бот → сервер ──────────────────────────────────────────────
class PositionIn(BaseModel):
    symbol: str
    amount: float
    avg_price: float
    current_price: float = 0.0

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
    real_start_balance: float = 0.0
    net_invested: float = 0.0


# ── Авторизация ────────────────────────────────────────────────
class RegisterIn(BaseModel):
    email: EmailStr
    nickname: str
    password: str
    referral_code: str | None = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False

class UpdateNicknameIn(BaseModel):
    nickname: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_admin: bool = False


# ── Дашборд ────────────────────────────────────────────────────
class PositionOut(BaseModel):
    symbol: str
    amount: float
    avg_price: float
    current_price: float = 0.0

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

class ReferralInfo(BaseModel):
    id: str
    parent_id: str | None
    email: str          # замаскированный email
    nickname: str | None = None
    investment_usdt: float
    bonus_usdt: float   # сколько реферер зарабатывает с этого человека
    level: int = 1      # уровень вложенности

class SupportTicketCreate(BaseModel):
    subject: str
    message: str

class SupportReplyOut(BaseModel):
    id: str
    body: str
    created_at: datetime

class SupportTicketOut(BaseModel):
    id: str
    subject: str
    message: str
    status: str
    created_at: datetime
    has_unread: bool = False
    replies: list[SupportReplyOut] = []
    user_email: str | None = None

class SupportTicketAdminOut(SupportTicketOut):
    user_email: str


class NewsItemCreate(BaseModel):
    title: str
    body: str
    pool_type: str = "all"  # "all", "crypto", "forex"
    image_url: str | None = None

class NewsItemOut(BaseModel):
    id: str
    title: str
    body: str
    pool_type: str
    image_url: str | None = None
    created_at: datetime


class DashboardOut(BaseModel):
    # Крипто пул
    balance_usdt: float
    pool_total_usdt: float
    email: str
    nickname: str | None = None
    pool_positions_usdt: float
    mode: str
    hwm: float
    drawdown_pct: float
    server_online: bool
    last_updated: str | None
    # Данные пользователя (крипто)
    user_investment: float
    user_pnl: float
    user_pnl_pct: float
    status: str = "PARTNER"
    total_volume_usdt: float = 0.0
    next_status_volume: float | None = None
    ref_bonus: float = 0.0
    referral_code: str = ""
    referrals: list[ReferralInfo] = []
    positions: list[PositionOut]
    recent_trades: list[TradeOut]
    ai_feed: list[AIFeedOut]
    # Форекс пул
    forex_pool_total: float = 0.0
    forex_pool_positions: float = 0.0
    forex_balance: float = 0.0
    forex_server_online: bool = False
    forex_last_updated: str | None = None
    # Данные пользователя (форекс)
    forex_investment: float = 0.0
    forex_pnl: float = 0.0
    forex_pnl_pct: float = 0.0
    forex_ref_bonus: float = 0.0
    forex_positions: list[PositionOut] = []
    forex_recent_trades: list[TradeOut] = []
