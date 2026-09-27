with open('backend/main.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, l in enumerate(lines):
    if 'users_nickname_key UNIQUE' in l:
        lines.insert(i+1, '        "ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS forex_pnl_offset FLOAT DEFAULT 0.0",\n')
        lines.insert(i+2, '        "ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS crypto_pnl_offset FLOAT DEFAULT 0.0",\n')
        lines.insert(i+3, '        "ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS forex_pool_base_offset FLOAT DEFAULT 0.0",\n')
        break
with open('backend/main.py', 'w', encoding='utf-8') as f:
    f.writelines(lines)
