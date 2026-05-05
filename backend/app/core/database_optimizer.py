import sqlite3
import os
import time

DB_PATH = r"d:\Antigravity - Project\DATA_MASTER\khhh.db"

def optimize_database():
    print(f"[Antigravity Team] Starting database optimization at: {DB_PATH}")
    
    if not os.path.exists(DB_PATH):
        print(f"Error: Database file not found at {DB_PATH}")
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        start_time = time.time()

        # 1. Create Index for ma_kh
        print("Creating INDEX for column 'ma_kh'...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_ma_kh ON transactions (ma_kh);")
        
        # 2. Create Index for ngay_chap_nhan
        print("Creating INDEX for column 'ngay_chap_nhan'...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_ngay_chap_nhan ON transactions (ngay_chap_nhan);")
        
        # 3. Create Index for doanh_thu
        print("Creating INDEX for column 'doanh_thu'...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_doanh_thu ON transactions (doanh_thu);")

        # 5. Analyze Database for Query Planner
        print("Running ANALYZE to update statistics...")
        cursor.execute("ANALYZE;")

        # 6. VACUUM to optimize storage
        print("Running VACUUM (this may take a few seconds)...")
        conn.execute("VACUUM;")

        conn.commit()
        conn.close()

        end_time = time.time()
        print(f"Optimization completed in {end_time - start_time:.2f} seconds!")
        print("---")
        print("Backend system can now query results much faster.")

    except sqlite3.Error as e:
        print(f"SQLite Error: {e}")
    except Exception as e:
        print(f"System Error: {e}")

if __name__ == "__main__":
    optimize_database()
