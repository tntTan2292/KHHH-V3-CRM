import sys
import os
from sqlalchemy.orm import Session

# Add parent dir to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.services.hierarchy_service import HierarchyService
from app.services.lifecycle_service import LifecycleService
from app.routers.analytics import get_dashboard_stats

def test():
    db = SessionLocal()
    node_code = "TD01"
    
    print(f"--- TESTING BACKEND LOGIC FOR: {node_code} ---")
    
    # 1. Test Hierarchy Service
    ids = HierarchyService.get_descendant_ids(db, node_code)
    print(f"HierarchyService found {len(ids)} descendant IDs for {node_code}.")
    
    # 2. Test Lifecycle Service directly
    # Lay ngay thang mac dinh
    start_date = "2026-04-01"
    end_date = "2026-04-30"
    
    print(f"Calling LifecycleService for {start_date} to {end_date}...")
    stats = LifecycleService.get_customer_lifecycle_stats(db, None, start_date, end_date, ids)
    
    print("\nLIFECYCLE RESULTS:")
    for status, count in stats.items():
        print(f" - {status}: {count}")

    # 3. Test Full Router Function
    print("\nCalling get_dashboard_stats (Router level)...")
    try:
        full_result = get_dashboard_stats(
            start_date=start_date,
            end_date=end_date,
            node_code=node_code,
            db=db
        )
        print("\nROUTER FULL RESULT:")
        print(f" - Total Revenue: {full_result.get('tong_doanh_thu')}")
        print(f" - Total Customers: {full_result.get('tong_kh')}")
    except Exception as e:
        print(f"Router Error: {e}")

    db.close()

if __name__ == "__main__":
    test()
