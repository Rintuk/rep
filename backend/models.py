import uuid
from datetime import datetime
from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id:             Mapped[str]  = mapped_column(String, primary_key=True, default=gen_uuid)
    email:          Mapped[str]  = mapped_column(String, unique=True, index=True)
    password_hash:  Mapped[str]  = mapped_column(String)
    is_admin:       Mapped[bool] = mapped_column(Boolean, default=False)
    is_active:      Mapped[bool] = mapped_column(Boolean, default=False)
    referral_code:  Mapped[str]  = mapped_column(String, unique=True, default=gen_uuid)
    referred_by:    Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    referral_limit: Mapped[int]  = mapped_column(Integer, default=3)
    created_at:     Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    referrals:             Mapped[list["User"]]                  = relationship("User", foreign_keys=[referred_by])
    financials:            Mapped["UserFinancials | None"]        = relationship("UserFinancials", back_populates="user", uselist=False)
    virtual_account:       Mapped["VirtualAccount | None"]        = relationship("VirtualAccount", back_populates="user", uselist=False)
    forex_virtual_account: Mapped["ForexVirtualAccount | None"]   = relationship("ForexVirtualAccount", back_populates="user", uselist=False)


class UserFinancials(Base):
    __tablename__ = "user_financials"

    user_id:                Mapped[str]   = mapped_column(String, ForeignKey("users.id"), primary_key=True)
    # Крипто пул
    investment_usdt:        Mapped[float] = mapped_column(Float, default=0.0)
    withdrawal_usdt:        Mapped[float] = mapped_column(Float, default=0.0)
    entry_pool_pnl_pct:     Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    # Форекс пул
    forex_investment_usdt:  Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    forex_withdrawal_usdt:  Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    forex_entry_pool_pnl_pct: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")

    note:       Mapped[str]      = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="financials")


DEMO_START_BALANCE = 1000.0


class VirtualAccount(Base):
    __tablename__ = "virtual_accounts"

    user_id:          Mapped[str]   = mapped_column(String, ForeignKey("users.id"), primary_key=True)
    balance_usdt:     Mapped[float] = mapped_column(Float, default=0.0)
    start_balance:    Mapped[float] = mapped_column(Float, default=0.0)
    start_real_total: Mapped[float] = mapped_column(Float, default=0.0)
    is_started:       Mapped[bool]  = mapped_column(Boolean, default=False)
    created_at:       Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:       Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user:   Mapped["User"]              = relationship("User", back_populates="virtual_account")
    trades: Mapped[list["VirtualTrade"]] = relationship("VirtualTrade", back_populates="account", cascade="all, delete-orphan")


class VirtualTrade(Base):
    __tablename__ = "virtual_trades"

    id:        Mapped[str]        = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id:   Mapped[str]        = mapped_column(String, ForeignKey("virtual_accounts.user_id"))
    symbol:    Mapped[str]        = mapped_column(String)
    action:    Mapped[str]        = mapped_column(String)
    amount:    Mapped[float]      = mapped_column(Float)
    price:     Mapped[float]      = mapped_column(Float)
    pnl:       Mapped[float|None] = mapped_column(Float, nullable=True)
    timestamp: Mapped[str]        = mapped_column(String)

    account: Mapped["VirtualAccount"] = relationship("VirtualAccount", back_populates="trades")


class ForexVirtualAccount(Base):
    __tablename__ = "forex_virtual_accounts"

    user_id:          Mapped[str]   = mapped_column(String, ForeignKey("users.id"), primary_key=True)
    balance_usdt:     Mapped[float] = mapped_column(Float, default=0.0)
    start_balance:    Mapped[float] = mapped_column(Float, default=0.0)
    start_real_total: Mapped[float] = mapped_column(Float, default=0.0)
    is_started:       Mapped[bool]  = mapped_column(Boolean, default=False)
    created_at:       Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:       Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user:   Mapped["User"]                   = relationship("User", back_populates="forex_virtual_account")
    trades: Mapped[list["ForexVirtualTrade"]] = relationship("ForexVirtualTrade", back_populates="account", cascade="all, delete-orphan")


class ForexVirtualTrade(Base):
    __tablename__ = "forex_virtual_trades"

    id:        Mapped[str]        = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id:   Mapped[str]        = mapped_column(String, ForeignKey("forex_virtual_accounts.user_id"))
    symbol:    Mapped[str]        = mapped_column(String)
    action:    Mapped[str]        = mapped_column(String)
    amount:    Mapped[float]      = mapped_column(Float)
    price:     Mapped[float]      = mapped_column(Float)
    pnl:       Mapped[float|None] = mapped_column(Float, nullable=True)
    timestamp: Mapped[str]        = mapped_column(String)

    account: Mapped["ForexVirtualAccount"] = relationship("ForexVirtualAccount", back_populates="trades")


class DepositRequest(Base):
    __tablename__ = "deposit_requests"

    id:         Mapped[str]      = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id:    Mapped[str]      = mapped_column(String, ForeignKey("users.id"))
    amount:     Mapped[float]    = mapped_column(Float)
    comment:    Mapped[str]      = mapped_column(Text, default="")
    status:     Mapped[str]      = mapped_column(String, default="pending")
    pool_type:  Mapped[str]      = mapped_column(String, default="crypto", server_default="crypto")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User")


class WithdrawalRequest(Base):
    __tablename__ = "withdrawal_requests"

    id:         Mapped[str]      = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id:    Mapped[str]      = mapped_column(String, ForeignKey("users.id"))
    amount:     Mapped[float]    = mapped_column(Float)
    comment:    Mapped[str]      = mapped_column(Text, default="")
    status:     Mapped[str]      = mapped_column(String, default="pending")
    pool_type:  Mapped[str]      = mapped_column(String, default="crypto", server_default="crypto")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User")


class BotSnapshot(Base):
    __tablename__ = "bot_snapshots"

    id:                 Mapped[str]      = mapped_column(String, primary_key=True, default=gen_uuid)
    bot_id:             Mapped[str]      = mapped_column(String, index=True)
    timestamp:          Mapped[datetime] = mapped_column(DateTime, index=True)
    balance_usdt:       Mapped[float]    = mapped_column(Float)
    mode:               Mapped[str]      = mapped_column(String)
    hwm:                Mapped[float]    = mapped_column(Float)
    drawdown_pct:       Mapped[float]    = mapped_column(Float)
    real_start_balance: Mapped[float]    = mapped_column(Float, default=0.0)
    net_invested:       Mapped[float]    = mapped_column(Float, default=0.0, server_default="0")

    positions: Mapped[list["Position"]]    = relationship("Position",    back_populates="snapshot", cascade="all, delete-orphan")
    trades:    Mapped[list["Trade"]]       = relationship("Trade",       back_populates="snapshot", cascade="all, delete-orphan")
    ai_feed:   Mapped[list["AIFeedEntry"]] = relationship("AIFeedEntry", back_populates="snapshot", cascade="all, delete-orphan")


class Position(Base):
    __tablename__ = "positions"

    id:            Mapped[str]   = mapped_column(String, primary_key=True, default=gen_uuid)
    snapshot_id:   Mapped[str]   = mapped_column(String, ForeignKey("bot_snapshots.id"))
    symbol:        Mapped[str]   = mapped_column(String)
    amount:        Mapped[float] = mapped_column(Float)
    avg_price:     Mapped[float] = mapped_column(Float)
    current_price: Mapped[float] = mapped_column(Float, default=0.0)

    snapshot: Mapped["BotSnapshot"] = relationship("BotSnapshot", back_populates="positions")


class Trade(Base):
    __tablename__ = "trades"

    id:          Mapped[str]        = mapped_column(String, primary_key=True, default=gen_uuid)
    snapshot_id: Mapped[str]        = mapped_column(String, ForeignKey("bot_snapshots.id"))
    symbol:      Mapped[str]        = mapped_column(String)
    action:      Mapped[str]        = mapped_column(String)
    amount:      Mapped[float]      = mapped_column(Float)
    price:       Mapped[float]      = mapped_column(Float)
    pnl:         Mapped[float|None] = mapped_column(Float, nullable=True)
    timestamp:   Mapped[str]        = mapped_column(String)

    snapshot: Mapped["BotSnapshot"] = relationship("BotSnapshot", back_populates="trades")


class AIFeedEntry(Base):
    __tablename__ = "ai_feed"

    id:          Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    snapshot_id: Mapped[str] = mapped_column(String, ForeignKey("bot_snapshots.id"))
    timestamp:   Mapped[str] = mapped_column(String)
    action:      Mapped[str] = mapped_column(String)
    symbol:      Mapped[str] = mapped_column(String)
    reason:      Mapped[str] = mapped_column(Text)

    snapshot: Mapped["BotSnapshot"] = relationship("BotSnapshot", back_populates="ai_feed")


# ── Форекс пул ────────────────────────────────────────────────────────────────

class ForexBotSnapshot(Base):
    __tablename__ = "forex_bot_snapshots"

    id:                 Mapped[str]      = mapped_column(String, primary_key=True, default=gen_uuid)
    bot_id:             Mapped[str]      = mapped_column(String, index=True)
    timestamp:          Mapped[datetime] = mapped_column(DateTime, index=True)
    balance_usdt:       Mapped[float]    = mapped_column(Float)
    mode:               Mapped[str]      = mapped_column(String)
    hwm:                Mapped[float]    = mapped_column(Float)
    drawdown_pct:       Mapped[float]    = mapped_column(Float)
    real_start_balance: Mapped[float]    = mapped_column(Float, default=0.0)
    net_invested:       Mapped[float]    = mapped_column(Float, default=0.0)

    positions: Mapped[list["ForexPosition"]]    = relationship("ForexPosition",    back_populates="snapshot", cascade="all, delete-orphan")
    trades:    Mapped[list["ForexTrade"]]       = relationship("ForexTrade",       back_populates="snapshot", cascade="all, delete-orphan")
    ai_feed:   Mapped[list["ForexAIFeedEntry"]] = relationship("ForexAIFeedEntry", back_populates="snapshot", cascade="all, delete-orphan")


class ForexPosition(Base):
    __tablename__ = "forex_positions"

    id:            Mapped[str]   = mapped_column(String, primary_key=True, default=gen_uuid)
    snapshot_id:   Mapped[str]   = mapped_column(String, ForeignKey("forex_bot_snapshots.id"))
    symbol:        Mapped[str]   = mapped_column(String)
    amount:        Mapped[float] = mapped_column(Float)
    avg_price:     Mapped[float] = mapped_column(Float)
    current_price: Mapped[float] = mapped_column(Float, default=0.0)

    snapshot: Mapped["ForexBotSnapshot"] = relationship("ForexBotSnapshot", back_populates="positions")


class ForexTrade(Base):
    __tablename__ = "forex_trades"

    id:          Mapped[str]        = mapped_column(String, primary_key=True, default=gen_uuid)
    snapshot_id: Mapped[str]        = mapped_column(String, ForeignKey("forex_bot_snapshots.id"))
    symbol:      Mapped[str]        = mapped_column(String)
    action:      Mapped[str]        = mapped_column(String)
    amount:      Mapped[float]      = mapped_column(Float)
    price:       Mapped[float]      = mapped_column(Float)
    pnl:         Mapped[float|None] = mapped_column(Float, nullable=True)
    timestamp:   Mapped[str]        = mapped_column(String)

    snapshot: Mapped["ForexBotSnapshot"] = relationship("ForexBotSnapshot", back_populates="trades")


class ForexAIFeedEntry(Base):
    __tablename__ = "forex_ai_feed"

    id:          Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    snapshot_id: Mapped[str] = mapped_column(String, ForeignKey("forex_bot_snapshots.id"))
    timestamp:   Mapped[str] = mapped_column(String)
    action:      Mapped[str] = mapped_column(String)
    symbol:      Mapped[str] = mapped_column(String)
    reason:      Mapped[str] = mapped_column(Text)

    snapshot: Mapped["ForexBotSnapshot"] = relationship("ForexBotSnapshot", back_populates="ai_feed")
