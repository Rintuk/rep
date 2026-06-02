from typing import Optional, List
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
    pnl: Optional[float] = None
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
    positions: List[PositionIn] = []
    recent_trades: List[TradeIn] = []
    ai_feed: List[AIFeedEntryIn] = []
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
    referral_code: Optional[str] = None

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
    pnl: Optional[float]
    timestamp: str

class AIFeedOut(BaseModel):
    timestamp: str
    action: str
    symbol: str
    reason: str

class ReferralInfo(BaseModel):
    id: str
    parent_id: Optional[str]
    email: str          # замаскированный email
    nickname: Optional[str] = None
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
    replies: List[SupportReplyOut] = []
    user_email: Optional[str] = None

class SupportTicketAdminOut(SupportTicketOut):
    user_email: str


class NewsItemCreate(BaseModel):
    title: str
    body: str
    pool_type: str = "all"  # "all", "crypto", "forex"
    image_url: Optional[str] = None

class NewsItemOut(BaseModel):
    id: str
    title: str
    body: str
    pool_type: str
    image_url: Optional[str] = None
    created_at: datetime


class DashboardOut(BaseModel):
    # Крипто пул
    balance_usdt: float
    pool_total_usdt: float
    email: str
    nickname: Optional[str] = None
    pool_positions_usdt: float
    mode: str
    hwm: float
    drawdown_pct: float
    server_online: bool
    last_updated: Optional[str]
    # Данные пользователя (крипто)
    user_investment: float
    user_pnl: float
    user_pnl_pct: float
    status: str = "PARTNER"
    total_volume_usdt: float = 0.0
    next_status_volume: Optional[float] = None
    ref_bonus: float = 0.0
    referral_code: Optional[str] = ""
    referrals: List[ReferralInfo] = []
    positions: List[PositionOut]
    recent_trades: List[TradeOut]
    ai_feed: List[AIFeedOut]
    # Форекс пул
    forex_pool_total: float = 0.0
    forex_pool_positions: float = 0.0
    forex_balance: float = 0.0
    forex_server_online: bool = False
    forex_last_updated: Optional[str] = None
    # Данные пользователя (форекс)
    forex_investment: float = 0.0
    forex_pnl: float = 0.0
    forex_pnl_pct: float = 0.0
    forex_ref_bonus: float = 0.0
    forex_positions: List[PositionOut] = []
    forex_recent_trades: List[TradeOut] = []
