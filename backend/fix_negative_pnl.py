import asyncio
import json
from sqlalchemy import select, update
from database import AsyncSessionLocal
from models import UserFinancials, User

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(UserFinancials, User).join(User, User.id == UserFinancials.user_id))
        rows = result.all()
        
        backup_data = []
        updates_made = False
        
        for fin, user in rows:
            if fin.locked_forex_pnl < 0 or fin.locked_crypto_pnl < 0:
                print(f"Found negative PNL for user {user.email}: Crypto={fin.locked_crypto_pnl}, Forex={fin.locked_forex_pnl}")
                backup_data.append({
                    "user_id": fin.user_id,
                    "email": user.email,
                    "locked_crypto_pnl": fin.locked_crypto_pnl,
                    "locked_forex_pnl": fin.locked_forex_pnl
                })
                
                fin.locked_crypto_pnl = max(0.0, fin.locked_crypto_pnl)
                fin.locked_forex_pnl = max(0.0, fin.locked_forex_pnl)
                updates_made = True
                
        if backup_data:
            with open("negative_pnl_backup.json", "w", encoding="utf-8") as f:
                json.dump(backup_data, f, ensure_ascii=False, indent=4)
            print("Backup saved to backend/negative_pnl_backup.json")
            
        if updates_made:
            await db.commit()
            print("Successfully updated negative PNLs to 0.0.")
        else:
            print("No users with negative PNL found.")

if __name__ == "__main__":
    asyncio.run(main())
