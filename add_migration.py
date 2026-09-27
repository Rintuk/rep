import re

with open('backend/main.py', 'r', encoding='utf-8') as f:
    text = f.read()

old = '"ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS forex_pool_base_offset FLOAT DEFAULT 0.0",'
new = '"ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS forex_pool_base_offset FLOAT DEFAULT 0.0",\n        "ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS forex_pool_positions FLOAT DEFAULT 19700.0",'

text = text.replace(old, new)

with open('backend/main.py', 'w', encoding='utf-8') as f:
    f.write(text)
