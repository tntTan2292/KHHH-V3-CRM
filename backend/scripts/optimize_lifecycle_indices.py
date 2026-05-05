import sqlite3
import os
import time

DB_PATH = r"d:\Antigravity - Project\DATA_MASTER\khhh.db"

def optimize():
    print(f"Bat dau toi uu hoa CSDL: {DB_PATH}")
    start_time = time.time()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # 1. Index tong hop cho logic Lifecycle (ma_kh -> date -> doanh thu)
        # Giup SQLite Aggregations khong phai scan toan bo record sau khi loc theo khach hang
        print("[1/3] Dang tao Index idx_trans_lifecycle_optimized...")
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_trans_lifecycle_optimized 
            ON transactions(ma_kh, ngay_chap_nhan, doanh_thu)
        """)
        
        # 2. Index cho dải thời gian (Analytics trend)
        print("[2/3] Dang tao Index idx_trans_ngay_dt...")
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_trans_ngay_dt 
            ON transactions(ngay_chap_nhan, doanh_thu)
        """)

        # 3. Analyze de SQL Engine biet ve phan bo du lieu moi sau khi backfill
        print("[3/3] Dang chay ANALYZE...")
        cursor.execute("ANALYZE")
        
        conn.commit()
        duration = time.time() - start_time
        print(f"Hoan tat toi uu hoa trong {duration:.2f} giay!")
        
    except Exception as e:
        print(f"LOI: {str(e)}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    optimize()
