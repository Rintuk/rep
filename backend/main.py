from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import bot, auth, dashboard, demo, forex

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        from sqlalchemy import text
        for sql in [
            "ALTER TABLE virtual_accounts ADD COLUMN IF NOT EXISTS is_started BOOLEAN DEFAULT FALSE",
            "ALTER TABLE virtual_accounts ADD COLUMN IF NOT EXISTS start_real_total FLOAT DEFAULT 0",
            "ALTER TABLE bot_snapshots ADD COLUMN IF NOT EXISTS real_start_balance FLOAT DEFAULT 0",
            "ALTER TABLE positions ADD COLUMN IF NOT EXISTS current_price FLOAT DEFAULT 0",
            "ALTER TABLE user_financials ADD COLUMN IF NOT EXISTS entry_pool_pnl_pct FLOAT DEFAULT 0",
            "ALTER TABLE user_financials ADD COLUMN IF NOT EXISTS forex_investment_usdt FLOAT DEFAULT 0",
            "ALTER TABLE user_financials ADD COLUMN IF NOT EXISTS forex_withdrawal_usdt FLOAT DEFAULT 0",
            "ALTER TABLE user_financials ADD COLUMN IF NOT EXISTS forex_entry_pool_pnl_pct FLOAT DEFAULT 0",
            "ALTER TABLE deposit_requests ADD COLUMN IF NOT EXISTS pool_type VARCHAR DEFAULT 'crypto'",
            "ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS pool_type VARCHAR DEFAULT 'crypto'",
            """CREATE TABLE IF NOT EXISTS deposit_requests (
                id TEXT PRIMARY KEY,
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                amount FLOAT NOT NULL,
                comment TEXT DEFAULT '',
                status TEXT DEFAULT 'pending',
                pool_type TEXT DEFAULT 'crypto',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )""",
            """CREATE TABLE IF NOT EXISTS withdrawal_requests (
                id TEXT PRIMARY KEY,
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                amount FLOAT NOT NULL,
                comment TEXT DEFAULT '',
                status TEXT DEFAULT 'pending',
                pool_type TEXT DEFAULT 'crypto',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )""",
            """CREATE TABLE IF NOT EXISTS forex_bot_snapshots (
                id TEXT PRIMARY KEY,
                bot_id TEXT,
                timestamp TIMESTAMP,
                balance_usdt FLOAT,
                mode TEXT,
                hwm FLOAT,
                drawdown_pct FLOAT,
                real_start_balance FLOAT DEFAULT 0,
                net_invested FLOAT DEFAULT 0
            )""",
            """CREATE TABLE IF NOT EXISTS forex_positions (
                id TEXT PRIMARY KEY,
                snapshot_id TEXT REFERENCES forex_bot_snapshots(id) ON DELETE CASCADE,
                symbol TEXT,
                amount FLOAT,
                avg_price FLOAT,
                current_price FLOAT DEFAULT 0
            )""",
            """CREATE TABLE IF NOT EXISTS forex_trades (
                id TEXT PRIMARY KEY,
                snapshot_id TEXT REFERENCES forex_bot_snapshots(id) ON DELETE CASCADE,
                symbol TEXT,
                action TEXT,
                amount FLOAT,
                price FLOAT,
                pnl FLOAT,
                timestamp TEXT
            )""",
            """CREATE TABLE IF NOT EXISTS forex_ai_feed (
                id TEXT PRIMARY KEY,
                snapshot_id TEXT REFERENCES forex_bot_snapshots(id) ON DELETE CASCADE,
                timestamp TEXT,
                action TEXT,
                symbol TEXT,
                reason TEXT
            )""",
            """CREATE TABLE IF NOT EXISTS forex_virtual_accounts (
                id TEXT PRIMARY KEY,
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                balance_usdt FLOAT DEFAULT 0,
                start_balance FLOAT DEFAULT 0,
                start_real_total FLOAT DEFAULT 0,
                is_started BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )""",
            """CREATE TABLE IF NOT EXISTS forex_virtual_trades (
                id TEXT PRIMARY KEY,
                user_id TEXT REFERENCES forex_virtual_accounts(user_id) ON DELETE CASCADE,
                symbol TEXT,
                action TEXT,
                amount FLOAT,
                price FLOAT,
                pnl FLOAT,
                timestamp TEXT
            )""",
        ]:
            try:
                await conn.execute(text(sql))
            except Exception:
                pass
    yield

app = FastAPI(title="Makler API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bot.router)
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(demo.router)
app.include_router(forex.router)

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/debug/register-test")
async def debug_register():
    import traceback
    from database import AsyncSessionLocal
    from models import User
    from security import hash_password
    try:
        async with AsyncSessionLocal() as session:
            from sqlalchemy import text
            await session.execute(text("SELECT 1"))
            return {"db": "ok"}
    except Exception as e:
        return {"db": "error", "detail": str(e), "trace": traceback.format_exc()}
