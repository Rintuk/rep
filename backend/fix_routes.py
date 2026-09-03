import re

# Fix auth.py
with open("backend/routers/auth.py", "r", encoding="utf-8") as f:
    auth_content = f.read()

# The incorrect part is:
# @router.post("/admin/deposits/{request_id}/approve", dependencies=[Depends(get_admin_user)])
# 
# @router.post("/admin/deposits/{request_id}/approve-from-pool", dependencies=[Depends(get_admin_user)])
# async def approve_deposit_from_pool(request_id: str, actual_amount: float, db: AsyncSession = Depends(get_db)):

# We just remove the top decorator if it precedes approve_deposit_from_pool.
auth_content = re.sub(
    r"@router\.post\(\"/admin/deposits/\{request_id\}/approve\", dependencies=\[Depends\(get_admin_user\)\]\)\s+@router\.post\(\"/admin/deposits/\{request_id\}/approve-from-pool\", dependencies=\[Depends\(get_admin_user\)\]\)\s+async def approve_deposit_from_pool",
    r'@router.post("/admin/deposits/{request_id}/approve-from-pool", dependencies=[Depends(get_admin_user)])\nasync def approve_deposit_from_pool',
    auth_content,
    flags=re.MULTILINE
)

with open("backend/routers/auth.py", "w", encoding="utf-8") as f:
    f.write(auth_content)

# Fix forex.py
with open("backend/routers/forex.py", "r", encoding="utf-8") as f:
    forex_content = f.read()

forex_content = re.sub(
    r"@router\.post\(\"/admin/forex-deposits/\{request_id\}/approve\", dependencies=\[Depends\(get_admin_user\)\]\)\s+@router\.post\(\"/admin/deposits/\{request_id\}/forex-approve-from-pool\", dependencies=\[Depends\(get_admin_user\)\]\)\s+async def forex_approve_deposit_from_pool",
    r'@router.post("/admin/deposits/{request_id}/forex-approve-from-pool", dependencies=[Depends(get_admin_user)])\nasync def forex_approve_deposit_from_pool',
    forex_content,
    flags=re.MULTILINE
)

# And fix the decorator for approve_forex_deposit which might have been changed.
# Actually, the original route was /admin/forex-deposits/{request_id}/approve.
# Let's see what the new one is:
# @router.post("/admin/deposits/{request_id}/approve", dependencies=[Depends(get_admin_user)])
# async def approve_forex_deposit(request_id: str, actual_amount: float, db: AsyncSession = Depends(get_db)):
# Oh, I changed it to /admin/deposits/... which is WRONG for forex! It should be /admin/forex-deposits/
forex_content = re.sub(
    r"@router\.post\(\"/admin/deposits/\{request_id\}/approve\", dependencies=\[Depends\(get_admin_user\)\]\)\s+async def approve_forex_deposit",
    r'@router.post("/admin/forex-deposits/{request_id}/approve", dependencies=[Depends(get_admin_user)])\nasync def approve_forex_deposit',
    forex_content,
    flags=re.MULTILINE
)

with open("backend/routers/forex.py", "w", encoding="utf-8") as f:
    f.write(forex_content)

print("Fixed backend routes")
