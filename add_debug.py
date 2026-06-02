
with open("backend/routers/auth.py", "r", encoding="utf-8") as f:
    text = f.read()

text += "\n\n@router.get(\"/admin/backup-db-debug\")\nasync def backup_db_debug(db: AsyncSession = Depends(get_db)):\n    return await backup_db(db)\n"
with open("backend/routers/auth.py", "w", encoding="utf-8") as f:
    f.write(text)

