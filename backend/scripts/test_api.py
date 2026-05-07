import requests
import json

def test_api():
    url = "http://localhost:8000/api/analytics/dashboard"
    params = {
        "start_date": "2025-01-01",
        "end_date": "2025-01-31"
    }
    response = requests.get(url, params=params)
    data = response.json()
    
    print(f"Status Code: {response.status_code}")
    print("Lifecycle Stats (Filtered by 2025-01 but should show Current):")
    print(json.dumps(data.get("lifecycle", {}), indent=2))
    
    # Check if 2026-05 values are present (e.g. AT_RISK should be ~361 across all points)
    # Note: the API sums them up.
    
if __name__ == "__main__":
    try:
        test_api()
    except Exception as e:
        print(f"Error: {e}")
