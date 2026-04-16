from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import User, UserFinancials
from schemas import RegisterIn, LoginIn, TokenOut
from security import hash_password, verify_password, create_access_token, get_admin_user
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register")
async def register(data: RegisterIn, db: AsyncSession = Depends(get_db)):
    import traceback
    try:
        return await _register(data, db)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{str(e)} | {traceback.format_exc()}")

async def _register(data: RegisterIn, db: AsyncSession):
    # Проверяем уникальность email
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email уже используется")

    referred_by_id = None
    if data.referral_code:
        ref_user = await db.execute(select(User).where(User.referral_code == data.referral_code))
        ref_user = ref_user.scalar_one_or_none()
        if not ref_user:
            raise HTTPException(status_code=400, detail="Реферальный код не найден")
        # Проверяем лимит рефералов
        count = await db.execute(select(func.count()).where(User.referred_by == ref_user.id))
        if count.scalar() >= ref_user.referral_limit:
            raise HTTPException(status_code=400, detail="Реферальный лимит исчерпан")
        referred_by_id = ref_user.id

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        referred_by=referred_by_id,
        is_active=False,  # ждёт одобрения администратора
    )
    db.add(user)
    await db.commit()
    return {"status": "pending", "message": "Регистрация принята. Ожидайте одобрения администратора."}

@router.post("/login", response_model=TokenOut)
async def login(data: LoginIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Аккаунт ожидает одобрения администратора")
    return TokenOut(access_token=create_access_token(user.id))


# ── Админ: управление пользователями ──────────────────────────
@router.get("/admin/users", dependencies=[Depends(get_admin_user)])
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [{"id": u.id, "email": u.email, "is_active": u.is_active,
             "is_admin": u.is_admin, "referral_code": u.referral_code,
             "referral_limit": u.referral_limit, "created_at": str(u.created_at)} for u in users]

@router.post("/admin/approve/{user_id}", dependencies=[Depends(get_admin_user)])
async def approve_user(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.is_active = True
    await db.commit()
    return {"status": "approved", "email": user.email}

@router.post("/admin/reject/{user_id}", dependencies=[Depends(get_admin_user)])
async def reject_user(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    await db.delete(user)
    await db.commit()
    return {"status": "rejected"}

@router.patch("/admin/referral-limit/{user_id}", dependencies=[Depends(get_admin_user)])
async def set_referral_limit(user_id: str, limit: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.referral_limit = limit
    await db.commit()
    return {"status": "ok", "referral_limit": limit}


@router.get("/admin/users/{user_id}", dependencies=[Depends(get_admin_user)])
async def get_user_detail(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Рефералы
    refs = (await db.execute(select(User).where(User.referred_by == user_id))).scalars().all()

    # Финансы
    fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == user_id))).scalar_one_or_none()

    return {
        "id": user.id,
        "email": user.email,
        "is_active": user.is_active,
        "is_admin": user.is_admin,
        "referral_code": user.referral_code,
        "referral_limit": user.referral_limit,
        "referred_by": user.referred_by,
        "created_at": str(user.created_at),
        "investment_usdt": fin.investment_usdt if fin else 0.0,
        "withdrawal_usdt": fin.withdrawal_usdt if fin else 0.0,
        "note": fin.note if fin else "",
        "referrals": [
            {"id": r.id, "email": r.email, "is_active": r.is_active, "created_at": str(r.created_at)}
            for r in refs
        ],
    }


@router.patch("/admin/users/{user_id}/financials", dependencies=[Depends(get_admin_user)])
async def update_user_financials(
    user_id: str,
    investment_usdt: float = 0.0,
    withdrawal_usdt: float = 0.0,
    note: str = "",
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.id == user_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    fin = (await db.execute(select(UserFinancials).where(UserFinancials.user_id == user_id))).scalar_one_or_none()
    if fin:
        fin.investment_usdt = investment_usdt
        fin.withdrawal_usdt = withdrawal_usdt
        fin.note = note
        fin.updated_at = datetime.utcnow()
    else:
        db.add(UserFinancials(user_id=user_id, investment_usdt=investment_usdt,
                              withdrawal_usdt=withdrawal_usdt, note=note))
    await db.commit()
    return {"status": "ok"}


@router.delete("/admin/users/{user_id}", dependencies=[Depends(get_admin_user)])
async def delete_user(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.is_admin:
        raise HTTPException(status_code=403, detail="Нельзя удалить администратора")
    await db.delete(user)
    await db.commit()
    return {"status": "deleted"}
