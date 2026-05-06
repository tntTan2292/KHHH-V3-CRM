import sys
import os
import sqlite3
from datetime import datetime

# Add project root to path
sys.path.append(r"d:\Antigravity - Project\KHHH - Antigravity - V3.0")

from backend.app.services.summary_service import SummaryService

def rebuild_full_summary():
    print("=== STARTING FULL SUMMARY REBUILD ===")
    
    # 1. Initialize auxiliary tables (First order, Last active)
    # This might take a while for 1.7M records
    # SummaryService.initialize_auxiliary_tables()
    
    # 2. Get all distinct months from transactions
    conn = sqlite3.connect(SummaryService.DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT substr(ngay_chap_nhan, 1, 7) as m FROM transactions WHERE ngay_chap_nhan IS NOT NULL ORDER BY m")
    all_months = [row[0] for row in cursor.fetchall() if row[0]]
    conn.close()
    
    print(f"Detected {len(all_months)} months: {all_months}")
    
    # 3. Rebuild summary for each month
    # We use incremental logic but pass all months
    SummaryService.refresh_summary_incremental(target_months=all_months)
    
    print("\n=== FULL SUMMARY REBUILD COMPLETED ===")

if __name__ == "__main__":
    rebuild_full_summary()
