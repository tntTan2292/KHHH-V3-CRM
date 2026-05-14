import sqlite3
import os

# Standard project path setup for CRM 3.0 scripts
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DB_PATH = os.path.join(PROJECT_ROOT, "data", "database", "khhh_v3.db")

def run_cleanup():
    """
    Executes Phase 3 Transaction Deduplication.
    Rule: (shbg, ngay_chap_nhan, doanh_thu)
    Action: Keep MIN(id), Delete others.
    """
    print(f"Connecting to: {DB_PATH}")
    if not os.path.exists(DB_PATH):
        print("ERROR: Database not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # 1. Audit before
        cursor.execute("SELECT SUM(doanh_thu) FROM transactions WHERE ngay_chap_nhan LIKE '2026-03%'")
        rev_before = cursor.fetchone()[0] or 0
        
        # 2. Identify and Delete
        delete_query = """
        DELETE FROM transactions
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM transactions
            GROUP BY shbg, ngay_chap_nhan, doanh_thu
        )
        """
        print("Executing cleanup query...")
        cursor.execute(delete_query)
        deleted_count = cursor.rowcount
        
        # 3. Audit after
        cursor.execute("SELECT SUM(doanh_thu) FROM transactions WHERE ngay_chap_nhan LIKE '2026-03%'")
        rev_after = cursor.fetchone()[0] or 0
        
        conn.commit()
        
        print("--- CLEANUP SUCCESSFUL ---")
        print(f"Records removed: {deleted_count}")
        print(f"March 2026 Revenue Change: {rev_after - rev_before:,.0f}")
        
    except Exception as e:
        conn.rollback()
        print(f"FATAL ERROR during cleanup: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    run_cleanup()
