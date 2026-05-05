import sqlite3
import os

DB_PATH = r"d:\Antigravity - Project\DATA_MASTER\khhh.db"

def migrate():
    print(f"--- BAT DAU NANG CAP CAU TRUC DATABASE (V3.0 MIGRATION) ---")
    print(f"Target: {DB_PATH}")
    
    if not os.path.exists(DB_PATH):
        print("Loi: Khong tim thay file database tại đường dẫn trên!")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # 1. Cap nhat bang customers
        print("[1/3] Dang kiem tra bang 'customers'...")
        cursor.execute("PRAGMA table_info(customers)")
        cols = [row[1] for row in cursor.fetchall()]
        
        if 'assigned_staff_id' not in cols:
            print("    + Them cot 'assigned_staff_id' vao bang customers...")
            cursor.execute("ALTER TABLE customers ADD COLUMN assigned_staff_id INTEGER")
        else:
            print("    - Cot 'assigned_staff_id' da ton tai.")
            
        # 2. Cap nhat bang transactions
        print("[2/3] Dang kiem tra bang 'transactions'...")
        cursor.execute("PRAGMA table_info(transactions)")
        cols_trans = [row[1] for row in cursor.fetchall()]
        
        if 'staff_id' not in cols_trans:
            print("    + Them cot 'staff_id' vao bang transactions...")
            cursor.execute("ALTER TABLE transactions ADD COLUMN staff_id INTEGER")
        
        if 'point_id' not in cols_trans:
            print("    + Them cot 'point_id' vao bang transactions...")
            cursor.execute("ALTER TABLE transactions ADD COLUMN point_id INTEGER")
            
        # 3. Tao cac bang moi neu chua co
        print("[3/3] Dang tao cac bang phu tro V3 (neu chua co)...")
        
        # Bang nhan_su
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS nhan_su (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hr_id TEXT UNIQUE,
                full_name TEXT,
                username_app TEXT,
                ma_don_vi TEXT,
                ma_bc TEXT,
                chuc_vu TEXT,
                email TEXT,
                phone TEXT,
                point_id INTEGER
            )
        """)
        
        # Bang hierarchy_nodes
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS hierarchy_nodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE,
                name TEXT,
                type TEXT,
                parent_id INTEGER
            )
        """)
        
        # Bang sync_attempts
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sync_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                folder_name TEXT,
                status TEXT,
                error_details TEXT,
                attempt_number INTEGER
            )
        """)
        
        # Bang action_tasks
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS action_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ma_crm_cms TEXT,
                loai_doi_tuong TEXT,
                trang_thai TEXT DEFAULT 'Mới',
                ghi_chu TEXT,
                ngay_cap_nhat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                nguoi_thuc_hien TEXT
            )
        """)

        conn.commit()
        print(f"--- HOAN TAT NANG CAP CAU TRUC DATABASE ---")
        
    except Exception as e:
        conn.rollback()
        print(f"Loi trong qua trinh migrate: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
