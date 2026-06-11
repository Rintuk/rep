from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from database import engine, Base, get_db
from fastapi.middleware.cors import CORSMiddleware
from routers import bot, auth, dashboard, demo, forex, support

@asynccontextmanager
async def lifespan(app: FastAPI):
    from database import AsyncSessionLocal
    from routers.auth import _get_pool_pnl_pct
    from models import UserFinancials
    from sqlalchemy.future import select
    try:
        async with AsyncSessionLocal() as s_db:
            pct = await _get_pool_pnl_pct(s_db)
            fins = (await s_db.execute(select(UserFinancials))).scalars().all()
            for f in fins:
                if f.investment_usdt > 0:
                    f.entry_pool_pnl_pct = pct
            await s_db.commit()
    except Exception as e:
        print("EMERGENCY FIX ERROR:", e)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    from sqlalchemy import text
    queries = [
        "ALTER TABLE virtual_accounts ADD COLUMN IF NOT EXISTS is_started BOOLEAN DEFAULT FALSE",
        "ALTER TABLE virtual_accounts ADD COLUMN IF NOT EXISTS start_real_total FLOAT DEFAULT 0",
        "ALTER TABLE bot_snapshots ADD COLUMN IF NOT EXISTS real_start_balance FLOAT DEFAULT 0",
        "ALTER TABLE positions ADD COLUMN IF NOT EXISTS current_price FLOAT DEFAULT 0",
        "ALTER TABLE user_financials ADD COLUMN IF NOT EXISTS entry_pool_pnl_pct FLOAT DEFAULT 0",
        "ALTER TABLE user_financials ADD COLUMN IF NOT EXISTS forex_investment_usdt FLOAT DEFAULT 0",
        "ALTER TABLE user_financials ADD COLUMN IF NOT EXISTS forex_withdrawal_usdt FLOAT DEFAULT 0",
        "ALTER TABLE user_financials ADD COLUMN IF NOT EXISTS forex_entry_pool_pnl_pct FLOAT DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS manual_status_override VARCHAR DEFAULT NULL",
        "ALTER TABLE user_financials ADD COLUMN IF NOT EXISTS locked_crypto_pnl FLOAT DEFAULT 0",
        "ALTER TABLE user_financials ADD COLUMN IF NOT EXISTS locked_forex_pnl FLOAT DEFAULT 0",
        "ALTER TABLE user_financials ADD COLUMN IF NOT EXISTS locked_crypto_ref_bonus FLOAT DEFAULT 0",
        "ALTER TABLE user_financials ADD COLUMN IF NOT EXISTS locked_forex_ref_bonus FLOAT DEFAULT 0",
        "ALTER TABLE user_financials ADD COLUMN IF NOT EXISTS crypto_ref_gross_offset FLOAT DEFAULT 0",
        "ALTER TABLE user_financials ADD COLUMN IF NOT EXISTS forex_ref_gross_offset FLOAT DEFAULT 0",
        "ALTER TABLE user_financials ADD COLUMN IF NOT EXISTS custom_investor_share FLOAT DEFAULT NULL",
        "UPDATE users SET referred_by = NULL WHERE email = 'alexander.v.solovev@gmail.com'",
        "UPDATE users SET referred_by = (SELECT id FROM users WHERE email = 'alexander.v.solovev@gmail.com') WHERE email = 'sanekkushnarenko777@gmail.com'",
        "ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP DEFAULT NULL",
        "ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS investor_read_at TIMESTAMP DEFAULT NULL",
        "ALTER TABLE deposit_requests ADD COLUMN IF NOT EXISTS pool_type VARCHAR DEFAULT 'crypto'",
        "ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS pool_type VARCHAR DEFAULT 'crypto'",
        "ALTER TABLE news_items ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR DEFAULT NULL",
        "UPDATE users SET nickname = email WHERE nickname IS NULL",
        "ALTER TABLE users ADD CONSTRAINT users_nickname_key UNIQUE (nickname)",
        "CREATE TABLE IF NOT EXISTS global_settings (id SERIAL PRIMARY KEY, maintenance_enabled BOOLEAN DEFAULT FALSE, maintenance_message TEXT DEFAULT 'Техобслуживание сайта. Скоро вернемся.')",
    ]
    for sql in queries:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(sql))
        except Exception as e:
            print(f"Migration error for {sql}:", e)
    
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
app.include_router(support.router)

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/debug-pool")
async def debug_pool(db: AsyncSession = Depends(get_db)):
    from models import BotSnapshot, UserFinancials, Position
    from sqlalchemy import select, func
    snap = (await db.execute(select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
    total_inv = (await db.execute(select(func.sum(UserFinancials.investment_usdt)))).scalar() or 0.0
    total_wd = (await db.execute(select(func.sum(UserFinancials.withdrawal_usdt)))).scalar() or 0.0
    positions = []
    if snap:
        positions = (await db.execute(select(Position).where(Position.snapshot_id == snap.id))).scalars().all()
    pool_total = (snap.balance_usdt if snap else 0.0) + sum(
        p.amount * (p.current_price if (p.current_price or 0) > 0 else p.avg_price)
        for p in positions
    )
    return {
        "snap_net_invested": snap.net_invested if snap else None,
        "snap_hwm": snap.hwm if snap else None,
        "snap_balance": snap.balance_usdt if snap else None,
        "snap_real_start": snap.real_start_balance if snap else None,
        "total_inv": total_inv,
        "total_wd": total_wd,
        "pool_total": pool_total
    }


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

@app.get("/debug/dashboard/{email}")
async def debug_dashboard(email: str):
    import traceback
    from database import AsyncSessionLocal
    from sqlalchemy.future import select
    from models import User
    from routers.dashboard import dashboard
    try:
        async with AsyncSessionLocal() as session:
            res = await session.execute(select(User).where(User.email == email))
            user = res.scalar_one_or_none()
            if not user:
                return {"error": "User not found"}
            dash_data = await dashboard(user=user, db=session)
            return {"status": "ok"}
    except Exception as e:
        return {"error": str(e), "trace": traceback.format_exc()}

