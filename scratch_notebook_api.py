import sys

with open('C:\\temp\\MaklerSite\\backend\\routers\\auth.py', 'r', encoding='utf-8') as f:
    c = f.read()

notebook_code = """
from datetime import datetime, timedelta
from models import AdminProfitLog

@router.get("/admin/notebook", dependencies=[Depends(get_admin_user)])
async def admin_notebook(db: AsyncSession = Depends(get_db)):
    logs = (await db.execute(select(AdminProfitLog))).scalars().all()
    
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    yesterday_str = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
    
    today_crypto = sum(l.crypto_profit for l in logs if l.date == today_str)
    today_forex = sum(l.forex_profit for l in logs if l.date == today_str)
    
    yest_crypto = sum(l.crypto_profit for l in logs if l.date == yesterday_str)
    yest_forex = sum(l.forex_profit for l in logs if l.date == yesterday_str)
    
    week_start = (datetime.utcnow() - timedelta(days=datetime.utcnow().weekday())).strftime("%Y-%m-%d")
    week_crypto = sum(l.crypto_profit for l in logs if l.date >= week_start)
    week_forex = sum(l.forex_profit for l in logs if l.date >= week_start)
    
    month_start = datetime.utcnow().strftime("%Y-%m-01")
    month_crypto = sum(l.crypto_profit for l in logs if l.date >= month_start)
    month_forex = sum(l.forex_profit for l in logs if l.date >= month_start)
    
    total_crypto = sum(l.crypto_profit for l in logs)
    total_forex = sum(l.forex_profit for l in logs)
    
    return {
        "crypto": {
            "today": round(today_crypto, 2),
            "yesterday": round(yest_crypto, 2),
            "week": round(week_crypto, 2),
            "month": round(month_crypto, 2),
            "total": round(total_crypto, 2)
        },
        "forex": {
            "today": round(today_forex, 2),
            "yesterday": round(yest_forex, 2),
            "week": round(week_forex, 2),
            "month": round(month_forex, 2),
            "total": round(total_forex, 2)
        }
    }
"""

c = c + "\n" + notebook_code

with open('C:\\temp\\MaklerSite\\backend\\routers\\auth.py', 'w', encoding='utf-8') as f:
    f.write(c)

print("Done")
