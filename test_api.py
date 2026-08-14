import sys
import os
import traceback
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
    customers = db.query(Customer).all()
    
    app.dependency_overrides[get_current_user] = lambda: user
    client = TestClient(app)
    
    failed = False
    with open('test_output.txt', 'w', encoding='utf-8') as f:
        for cust in customers:
            res = client.get(f'/api/customers/{cust.ma_crm_cms}/details')
            if res.status_code != 200:
                f.write(f'Customer: {cust.ma_crm_cms}\n')
                f.write(f'Status: {res.status_code}\n')
                f.write(f'Response: {res.text}\n')
                f.write('-'*50 + '\n')
                failed = True
                break
        
        if not failed:
            f.write(f"All {len(customers)} customers passed with 200 OK!\n")
except Exception as e:
    with open('test_output.txt', 'w', encoding='utf-8') as f:
        f.write(traceback.format_exc())
