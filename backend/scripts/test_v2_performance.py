import time
import os
import sys

# Add backend dir to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal
from app.routers.customers import get_customers
from sqlalchemy import func
from app.models import Transaction

def test_performance():
    db = SessionLocal()
    try:
        print("--- Testing V2 API Performance ---")
        start_time = time.time()
        
        # Test default fetch (Page 1)
        result = get_customers(db=db, page=1, page_size=50)
        
        duration = time.time() - start_time
        print(f"Fetch Page 1 took: {duration:.4f} seconds")
        print(f"Total results found: {result['total']}")
        print(f"Items returned: {len(result['items'])}")
        
        # Test Filter Performance (Lifecycle: Khách hàng mới)
        start_time = time.time()
        result_new = get_customers(db=db, page=1, page_size=50, lifecycle_status="Khách hàng mới")
        duration = time.time() - start_time
        print(f"Filtered 'Khách hàng mới' took: {duration:.4f} seconds")
        print(f"Count: {result_new['total']}")

        # Test Potential
        start_time = time.time()
        result_pot = get_customers(db=db, page=1, page_size=50, lifecycle_status="Khách hàng tiềm năng")
        duration = time.time() - start_time
        print(f"Filtered 'Khách hàng tiềm năng' took: {duration:.4f} seconds")
        print(f"Count: {result_pot['total']}")
        
        if duration < 0.5:
            print("✅ Performance target met (< 0.5s)")
        else:
            print("❌ Performance target MISSED (> 0.5s)")

    finally:
        db.close()

if __name__ == "__main__":
    test_performance()
