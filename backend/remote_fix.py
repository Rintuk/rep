import time
import requests

def fix_users():
    profits = [
        {"email": "maksimsegolev6@gmail.com", "exact_profit": 37.42},
        {"email": "aleko_k@inbox.ru", "exact_profit": 54.43},
        {"email": "juniorvasilva@gmail.com", "exact_profit": 13.95}
    ]
    
    url = "https://rep-production-cf90.up.railway.app/auth/admin/emergency-set-profit"
    
    for _ in range(12):  # Try for up to 1 minute to wait for deploy
        try:
            success = True
            for p in profits:
                res = requests.post(url, json=p)
                print(f"{p['email']}: {res.status_code} - {res.text}")
                if res.status_code != 200 or "success" not in res.text:
                    success = False
            if success:
                print("All fixed successfully!")
                return
        except Exception as e:
            print(f"Error: {e}")
        time.sleep(10)
        
if __name__ == "__main__":
    fix_users()
