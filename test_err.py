
import re
with open("backend/routers/auth.py", "r", encoding="utf-8") as f:
    text = f.read()
    
# Replace the entire backup_db function
new_func = """@router.get("/admin/backup-db")
async def backup_db(db: AsyncSession = Depends(get_db)):
    try:
        from models import BotSnapshot, ForexBotSnapshot, Position, ForexPosition
        users = (await db.execute(select(User))).scalars().all()
        fins = (await db.execute(select(UserFinancials))).scalars().all()
        
        backup_data = []
        fins_map = {f.user_id: f for f in fins}
        
        for u in users:
            f = fins_map.get(u.id)
            backup_data.append({
                "id": u.id, "email": u.email, "is_admin": u.is_admin, "referral_code": u.referral_code,
                "referred_by": u.referred_by, "is_active": u.is_active,
                "financials": {
                    "investment_usdt": f.investment_usdt if f else 0,
                    "entry_pool_pnl_pct": f.entry_pool_pnl_pct if f else 0,
                    "locked_crypto_pnl": f.locked_crypto_pnl if f else 0,
                    "forex_investment_usdt": f.forex_investment_usdt if f else 0,
                    "forex_entry_pool_pnl_pct": f.forex_entry_pool_pnl_pct if f else 0,
                    "locked_forex_pnl": f.locked_forex_pnl if f else 0
                } if f else None
            })
            
        crypto_snap = (await db.execute(select(BotSnapshot).order_by(BotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        forex_snap = (await db.execute(select(ForexBotSnapshot).order_by(ForexBotSnapshot.timestamp.desc()).limit(1))).scalar_one_or_none()
        
        crypto_positions = []
        if crypto_snap:
            c_pos = (await db.execute(select(Position).where(Position.snapshot_id == crypto_snap.id))).scalars().all()
            crypto_positions = [{"symbol": p.symbol, "amount": float(p.amount) if p.amount else 0.0, "avg_price": float(p.avg_price) if p.avg_price else 0.0, "current_price": float(p.current_price) if p.current_price else 0.0} for p in c_pos]
            
        forex_positions = []
        if forex_snap:
            f_pos = (await db.execute(select(ForexPosition).where(ForexPosition.snapshot_id == forex_snap.id))).scalars().all()
            forex_positions = [{"symbol": p.symbol, "amount": float(p.amount) if p.amount else 0.0, "avg_price": float(p.avg_price) if p.avg_price else 0.0, "current_price": float(p.current_price) if p.current_price else 0.0} for p in f_pos]

        pool_crypto_data = None
        if crypto_snap:
            pool_crypto_data = {
                "balance_usdt": crypto_snap.balance_usdt,
                "net_invested": crypto_snap.net_invested,
                "hwm": crypto_snap.hwm,
                "real_start_balance": getattr(crypto_snap, "real_start_balance", 0.0),
                "timestamp": str(crypto_snap.timestamp),
                "positions": crypto_positions
            }
            
        pool_forex_data = None
        if forex_snap:
            pool_forex_data = {
                "balance_usdt": forex_snap.balance_usdt,
                "net_invested": forex_snap.net_invested,
                "hwm": forex_snap.hwm,
                "real_start_balance": getattr(forex_snap, "real_start_balance", 0.0),
                "timestamp": str(forex_snap.timestamp),
                "positions": forex_positions
            }

        res = {
            "timestamp": datetime.utcnow().isoformat(),
            "users_count": len(users),
            "pool_crypto": pool_crypto_data,
            "pool_forex": pool_forex_data,
            "data": backup_data
        }
        return res
    except Exception as e:
        import traceback
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=500, content={"error": str(e), "traceback": traceback.format_exc()})
"""

# Replace everything from @router.get("/admin/backup-db") to the next @router
text = re.sub(r"@router\.get\(\"/admin/backup-db\"\).*?(?=\n\n@router)", new_func, text, flags=re.DOTALL)
with open("backend/routers/auth.py", "w", encoding="utf-8") as f:
    f.write(text)

