import re

def fix():
    with open('backend/routers/auth.py', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Replace dynamic ref calculation
    pattern = r"start = snap\.real_start_balance if snap\.real_start_balance > 0 else snap\.hwm\s+total_inv = \(await db\.execute\(select\(func\.sum\(UserFinancials\.investment_usdt\)\)\)\)\.scalar\(\) or 0\.0\s+total_wd = \(await db\.execute\(select\(func\.sum\(UserFinancials\.withdrawal_usdt\)\)\)\)\.scalar\(\) or 0\.0\s+ref = start \+ total_inv \- total_wd\s+if ref <= 0:\s+ref = snap\.net_invested if snap\.net_invested > 0 else start"
    
    def repl(m):
        # We need to keep the indentation
        lines = m.group(0).split('\n')
        indent = lines[0][:len(lines[0]) - len(lines[0].lstrip())]
        return f"{indent}start = snap.real_start_balance if snap.real_start_balance > 0 else snap.hwm\n{indent}ref = snap.net_invested if snap.net_invested > 0 else start"
        
    content = re.sub(pattern, repl, content)
    
    # 2. Fix admin_overview (lines 498-501)
    pattern2 = r"net_invested_pool = real_start \+ total_invested \- total_withdrawn\s+if net_invested_pool <= 0:\s+net_invested_pool = snap\.net_invested if snap\.net_invested > 0 else real_start"
    def repl2(m):
        lines = m.group(0).split('\n')
        indent = lines[0][:len(lines[0]) - len(lines[0].lstrip())]
        return f"{indent}net_invested_pool = snap.net_invested if snap.net_invested > 0 else real_start"
    
    content = re.sub(pattern2, repl2, content)
    
    # 3. Remove snap.net_invested += payload.amount from deposit_from_pool
    # and forex_snap.net_invested += payload.amount from forex_deposit_from_pool
    content = re.sub(r"if snap:\s+snap\.net_invested \+\= payload\.amount", "if snap:\n        pass # No change to net_invested for internal transfer", content)
    content = re.sub(r"if forex_snap:\s+forex_snap\.net_invested \+\= payload\.amount", "if forex_snap:\n        pass # No change to net_invested for internal transfer", content)
    
    # 4. Add snap.net_invested -= actual_amount to approve_withdrawal
    # We find where it sets req.status = "approved" in approve_withdrawal
    
    with open('backend/routers/auth.py', 'w', encoding='utf-8') as f:
        f.write(content)
        
fix()
