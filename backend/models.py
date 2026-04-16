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
    is_active:      Mapped[bool] = mapped_column(Boolean, default=False)  # False пока не одобрен
    referral_code:  Mapped[str]  = mapped_column(String, unique=True, default=gen_uuid)
    referred_by:    Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    referral_limit: Mapped[int]  = mapped_column(Integer, default=3)
    created_at:     Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    referrals: Mapped[list["User"]] = relationship("User", foreign_keys=[referred_by])


class BotSnapshot(Base):
    """Снимок состояния бота — сохраняется каждый цикл сканирования."""
    __tablename__ = "bot_snapshots"

    id:           Mapped[str]   = mapped_column(String, primary_key=True, default=gen_uuid)
    bot_id:       Mapped[str]   = mapped_column(String, index=True)
    timestamp:    Mapped[datetime] = mapped_column(DateTime, index=True)
    balance_usdt: Mapped[float] = mapped_column(Float)
    mode:         Mapped[str]   = mapped_column(String)
    hwm:          Mapped[float] = mapped_column(Float)
    drawdown_pct: Mapped[float] = mapped_column(Float)

    positions:    Mapped[list["Position"]] = relationship("Position", back_populates="snapshot", cascade="all, delete-orphan")
    trades:       Mapped[list["Trade"]]    = relationship("Trade",    back_populates="snapshot", cascade="all, delete-orphan")
    ai_feed:      Mapped[list["AIFeedEntry"]] = relationship("AIFeedEntry", back_populates="snapshot", cascade="all, delete-orphan")


class Position(Base):
    __tablename__ = "positions"

    id:          Mapped[str]   = mapped_column(String, primary_key=True, default=gen_uuid)
    snapshot_id: Mapped[str]   = mapped_column(String, ForeignKey("bot_snapshots.id"))
    symbol:      Mapped[str]   = mapped_column(String)
    amount:      Mapped[float] = mapped_column(Float)
    avg_price:   Mapped[float] = mapped_column(Float)

    snapshot: Mapped["BotSnapshot"] = relationship("BotSnapshot", back_populates="positions")


class Trade(Base):
    __tablename__ = "trades"

    id:          Mapped[str]   = mapped_column(String, primary_key=True, default=gen_uuid)
    snapshot_id: Mapped[str]   = mapped_column(String, ForeignKey("bot_snapshots.id"))
    symbol:      Mapped[str]   = mapped_column(String)
    action:      Mapped[str]   = mapped_column(String)   # BUY / SELL
    amount:      Mapped[float] = mapped_column(Float)
    price:       Mapped[float] = mapped_column(Float)
    pnl:         Mapped[float | None] = mapped_column(Float, nullable=True)
    timestamp:   Mapped[str]   = mapped_column(String)

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
