import sys
import os
import traceback
import json

sys.path.insert(0, os.path.abspath('backend'))
sys.path.insert(0, '.')

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User, Customer
from app.routers.auth import get_current_user

try:
    db = SessionLocal()
    user = db.query(User).filter(User.username == 'admin').first()
    app.dependency_overrides[get_current_user] = lambda: user
    
    client = TestClient(app)
    
    print("Testing GET /api/customers/C020202188/details...")
    res = client.get('/api/customers/C020202188/details')
    
    print("\n--- HTTP STATUS ---")
    print(res.status_code)
    
    print("\n--- RESPONSE HEADERS ---")
    for k, v in res.headers.items():
        print(f"{k}: {v}")
        
    print("\n--- RESPONSE BODY ---")
    try:
        print(json.dumps(res.json(), indent=2, ensure_ascii=False))
    except Exception:
        print(res.text)

except Exception as e:
    print("\n--- BACKEND STACKTRACE ---")
    print(traceback.format_exc())
