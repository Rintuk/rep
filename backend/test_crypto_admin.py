import asyncio
import sys
sys.path.append('backend')
from database import AsyncSessionLocal
from routers.auth import admin_overview, list_deposit_requests, list_withdrawal_requests, admin_notebook

async def main():
    async with AsyncSessionLocal() as db:
        print("Testing admin_overview...")
        await admin_overview(db)
        print("admin_overview OK")
        
        print("Testing list_deposit_requests...")
        await list_deposit_requests(db)
        print("list_deposit_requests OK")
        
        print("Testing list_withdrawal_requests...")
        await list_withdrawal_requests(db)
        print("list_withdrawal_requests OK")
        
        print("Testing admin_notebook...")
        await admin_notebook(db)
        print("admin_notebook OK")

if __name__ == "__main__":
    asyncio.run(main())
