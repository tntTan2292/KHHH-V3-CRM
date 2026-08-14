import requests
import json

base_url = "http://localhost:8000"

print("1. Authenticating to UAT...")
try:
    login_res = requests.post(f"{base_url}/api/auth/login", data={"username": "admin", "password": "1"})
    login_data = login_res.json()
    token = login_data.get("access_token")
    if not token:
        print("Failed to get token:", login_res.text)
        exit(1)
        
    print("2. Fetching customer C020202188 details...")
    headers = {"Authorization": f"Bearer {token}"}
    res = requests.get(f"{base_url}/api/customers/C020202188/details", headers=headers)
    
    print("\n--- HTTP STATUS ---")
    print(res.status_code)
    
    print("\n--- RESPONSE HEADERS ---")
    for k, v in res.headers.items():
        print(f"{k}: {v}")
        
    print("\n--- RESPONSE BODY ---")
    try:
        print(json.dumps(res.json(), indent=2, ensure_ascii=False))
    except:
        print(res.text)

except Exception as e:
    print("Error connecting to UAT server:", e)
