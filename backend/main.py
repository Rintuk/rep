from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import bot, auth, dashboard

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
