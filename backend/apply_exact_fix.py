import os
import glob

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Fix current_price
    content = content.replace(
        "p.current_price if p.current_price > 0 else p.avg_price",
        "p.current_price if (p.current_price or 0) > 0 else p.avg_price"
    )

    # Replace ' | None' with ' = None' for schema default but better use Optional
    # Actually, let's just add 'from typing import Optional' and replace '| None' with 'Optional[...]'
    if "from typing import Optional" not in content and "| None" in content:
        content = "from typing import Optional\n" + content
    
    # We will use regex to replace 'Type | None' with 'Optional[Type]' safely
    import re
    content = re.sub(r'([A-Za-z0-9_\[\]]+) \| None', r'Optional[\1]', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Fixed {filepath}")

for root, _, files in os.walk('.'):
    for f in files:
        if f.endswith('.py') and f != 'apply_exact_fix.py':
            fix_file(os.path.join(root, f))
