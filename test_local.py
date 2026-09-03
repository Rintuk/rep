import urllib.request
try:
    res = urllib.request.urlopen('http://127.0.0.1:8002/auth/public/settings')
    print("SUCCESS", res.read().decode())
except Exception as e:
    print("ERROR", e.read().decode())
