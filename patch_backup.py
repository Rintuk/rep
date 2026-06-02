
import re
with open("backend/routers/auth.py", "r", encoding="utf-8") as f:
    text = f.read()

# Add try-except
new_func = """@router.get("/admin/backup-db")
async def backup_db(db: AsyncSession = Depends(get_db)):
    try:
"""
text = text.replace("@router.get(\"/admin/backup-db\")\nasync def backup_db(db: AsyncSession = Depends(get_db)):", new_func)

# Indent everything in the function
match = re.search(r\"\"\"(.*?)async def backup_db.*?try:\n(.*?)\n\n\n@router.post\(\"/admin/migrate-pnl\"\"\", text, re.DOTALL)
if match:
    pass # Wait, safer to just replace file content using Python script

