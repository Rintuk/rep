import os
import re

files = [
    'backend/routers/auth.py',
    'backend/routers/bot.py',
    'backend/routers/dashboard.py',
    'backend/routers/forex.py'
]

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = content.replace('real_start_balance > 0', 'real_start_balance != 0.0')
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
