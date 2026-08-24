import urllib.request

url = "http://127.0.0.1:5000/api/transactions"
req = urllib.request.Request(
    url, 
    headers={
        "Origin": "http://localhost:5174",
        "Access-Control-Request-Method": "GET"
    }
)

try:
    with urllib.request.urlopen(req, timeout=5) as response:
        print("Response Headers:")
        for key, val in response.headers.items():
            print(f" - {key}: {val}")
except Exception as e:
    print("Error:", str(e))
