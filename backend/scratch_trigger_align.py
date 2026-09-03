import time
import requests

def trigger_align():
    url = "https://rep-production-cf90.up.railway.app/auth/admin/align-db"
    
    for i in range(15):  # Try for up to 2.5 minutes
        try:
            res = requests.post(url)
            print(f"Try {i+1}: {res.status_code} - {res.text}")
            if res.status_code == 200 and "status" in res.json() and res.json()["status"] == "ok":
                print("Alignment successful!")
                return
        except Exception as e:
            print(f"Error: {e}")
        time.sleep(10)
        
if __name__ == "__main__":
    trigger_align()
