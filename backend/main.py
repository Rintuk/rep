from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import bot, auth, dashboard, demo

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/debug/make-admin")
async def make_admin(email: str):
    from database import AsyncSessionLocal
    from models import User
    from sqlalchemy import select
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            return {"error": "Пользователь не найден"}
        user.is_admin = True
        user.is_active = True
        await session.commit()
        return {"status": "ok", "email": user.email, "is_admin": True}

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
