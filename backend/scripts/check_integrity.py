import sys
import os

# Add project root to path
sys.path.append(r"d:\Antigravity - Project\KHHH - Antigravity - V3.0")

from backend.app.database import SessionLocal
from backend.app.models import ActionTask, Customer, Transaction, MonthlyAnalyticsSummary, PotentialCustomer

def check_integrity():
    db = SessionLocal()
    try:
        print("=== DATA INTEGRITY REPORT ===")
        
        counts = {
            "ActionTask": db.query(ActionTask).count(),
            "Customer": db.query(Customer).count(),
            "Transaction": db.query(Transaction).count(),
            "MonthlyAnalyticsSummary": db.query(MonthlyAnalyticsSummary).count(),
            "PotentialCustomer": db.query(PotentialCustomer).count()
        }
        
        for table, count in counts.items():
            print(f"{table:25}: {count:,} records")
            
        print("\n--- Summary Check ---")
        latest_summary = db.query(MonthlyAnalyticsSummary).order_by(MonthlyAnalyticsSummary.year_month.desc()).first()
        if latest_summary:
            print(f"Latest Summary Month: {latest_summary.year_month}")
        else:
            print("SummaryMain table is EMPTY!")

        print("\n--- Task Verification Check ---")
        pending_verify = db.query(ActionTask).filter(ActionTask.trang_thai == "PENDING_VERIFY").count()
        verified = db.query(ActionTask).filter(ActionTask.verified == True).count()
        print(f"Pending Verify Tasks: {pending_verify}")
        print(f"Verified Tasks      : {verified}")

        print("\nSUCCESS: Integrity check completed.")
    except Exception as e:
        print(f"ERROR: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_integrity()
