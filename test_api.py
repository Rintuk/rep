import urllib.request
try:
    res = urllib.request.urlopen('https://rep-production-cf90.up.railway.app/auth/public/settings')
    print(res.read().decode())
except Exception as e:
    print(e.read().decode())
