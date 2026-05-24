from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from database import get_db
from models import SupportTicket, SupportReply, User
from schemas import SupportTicketCreate, SupportTicketOut, SupportTicketAdminOut, SupportReplyOut
from security import get_current_user, get_admin_user

router = APIRouter(prefix="/auth", tags=["support"])


def _has_unread(ticket: SupportTicket) -> bool:
    if ticket.replied_at is None:
        return False
    if ticket.investor_read_at is None:
        return True
    return ticket.replied_at > ticket.investor_read_at


@router.post("/support/ticket", response_model=SupportTicketOut)
async def create_ticket(
    data: SupportTicketCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ticket = SupportTicket(user_id=user.id, subject=data.subject, message=data.message)
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return SupportTicketOut(id=ticket.id, subject=ticket.subject, message=ticket.message,
                            status=ticket.status, created_at=ticket.created_at,
                            has_unread=False, replies=[])


@router.get("/support/my-tickets", response_model=list[SupportTicketOut])
async def my_tickets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Пользователи видят только СВОИ тикеты.
    query = select(SupportTicket).where(SupportTicket.user_id == user.id).order_by(SupportTicket.created_at.desc())
    tickets = (await db.execute(query)).scalars().all()

    result = []
    for t in tickets:
        replies = (await db.execute(
            select(SupportReply).where(SupportReply.ticket_id == t.id)
            .order_by(SupportReply.created_at.asc())
        )).scalars().all()
        email = None
        if user.is_admin:
            owner = (await db.execute(select(User).where(User.id == t.user_id))).scalar_one_or_none()
            email = owner.email if owner else None
        result.append(SupportTicketOut(
            id=t.id, subject=t.subject, message=t.message,
            status=t.status, created_at=t.created_at,
            has_unread=_has_unread(t),
            replies=[SupportReplyOut(id=r.id, body=r.body, created_at=r.created_at) for r in replies],
            user_email=email,
        ))
    return result



@router.post("/support/mark-read")
async def mark_read(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tickets = (await db.execute(
        select(SupportTicket).where(SupportTicket.user_id == user.id)
    )).scalars().all()
    now = datetime.utcnow()
    for t in tickets:
        t.investor_read_at = now
    await db.commit()
    return {"status": "ok"}


@router.get("/admin/support", response_model=list[SupportTicketAdminOut])
async def admin_list_tickets(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    tickets = (await db.execute(
        select(SupportTicket).order_by(SupportTicket.created_at.desc())
    )).scalars().all()

    result = []
    for t in tickets:
        user = (await db.execute(select(User).where(User.id == t.user_id))).scalar_one_or_none()
        replies = (await db.execute(
            select(SupportReply).where(SupportReply.ticket_id == t.id)
            .order_by(SupportReply.created_at.asc())
        )).scalars().all()
        result.append(SupportTicketAdminOut(
            id=t.id, subject=t.subject, message=t.message,
            status=t.status, created_at=t.created_at,
            user_email=user.email if user else "—",
            replies=[SupportReplyOut(id=r.id, body=r.body, created_at=r.created_at) for r in replies],
        ))
    return result


@router.post("/admin/support/{ticket_id}/close")
async def admin_close_ticket(
    ticket_id: str,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    ticket = (await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))).scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Тикет не найден")
    ticket.status = "closed"
    await db.commit()
    return {"status": "closed"}


@router.post("/support/{ticket_id}/close")
async def investor_close_ticket(
    ticket_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ticket = (await db.execute(
        select(SupportTicket).where(SupportTicket.id == ticket_id, SupportTicket.user_id == user.id)
    )).scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Тикет не найден")
    ticket.status = "closed"
    await db.commit()
    return {"status": "closed"}


@router.post("/admin/support/{ticket_id}/reply", response_model=SupportTicketAdminOut)
async def admin_reply(
    ticket_id: str,
    body: str,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    ticket = (await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))).scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Тикет не найден")

    reply = SupportReply(ticket_id=ticket_id, body=body)
    db.add(reply)
    ticket.status = "answered"
    ticket.replied_at = datetime.utcnow()
    await db.commit()

    user = (await db.execute(select(User).where(User.id == ticket.user_id))).scalar_one_or_none()
    replies = (await db.execute(
        select(SupportReply).where(SupportReply.ticket_id == ticket_id)
        .order_by(SupportReply.created_at.asc())
    )).scalars().all()
    # \u0411\u0430\u0433 9 fix: \u044f\u0432\u043d\u043e \u0443\u0441\u0442\u0430\u043d\u0430\u0432\u043b\u0438\u0432\u0430\u0435\u043c has_unread (\u043f\u043e\u0441\u043b\u0435 \u043e\u0442\u0432\u0435\u0442\u0430 \u0430\u0434\u043c\u0438\u043d\u0430 \u0438\u043d\u0432\u0435\u0441\u0442\u043e\u0440 \u0435\u0449\u0451 \u043d\u0435 \u0447\u0438\u0442\u0430\u043b, \u0437\u043d\u0430\u0447\u0438\u0442 has_unread=True)
    return SupportTicketAdminOut(
        id=ticket.id, subject=ticket.subject, message=ticket.message,
        status=ticket.status, created_at=ticket.created_at,
        has_unread=True,
        user_email=user.email if user else "—",
        replies=[SupportReplyOut(id=r.id, body=r.body, created_at=r.created_at) for r in replies],
    )


@router.post("/admin/support/clear-all")
async def clear_all_tickets(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Удаляет все тикеты и все ответы к ним."""
    await db.execute(delete(SupportReply))
    await db.execute(delete(SupportTicket))
    await db.commit()
    return {"status": "ok", "message": "Вся история тикетов удалена"}
