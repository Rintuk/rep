import requests

url = "https://rep-production-cf90.up.railway.app"

def test_api():
    print("Testing API...")
    res = requests.post(f"{url}/auth/login", json={
        "email": "testc125@example.com",
        "password": "Password123!"
    })
    print("Login:", res.status_code, res.text)
    
    if res.status_code == 200:
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test my-overview
        res2 = requests.get(f"{url}/auth/me", headers=headers)
        print("auth/me:", res2.status_code, res2.text[:200])

        res3 = requests.get(f"{url}/api/dashboard", headers=headers)
        print("api/dashboard:", res3.status_code, res3.text[:200])

if __name__ == "__main__":
    test_api()
