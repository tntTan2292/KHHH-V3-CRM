import sqlite3
import os
import shutil

DB_PATH = r"d:\Antigravity - Project\DATA_MASTER\khhh.db"
CACHE_DIR = r"d:\Antigravity - Project\DATA_MASTER\cache"

def fix_data():
    print("--- START FIXING POINT_IDS ---")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. Map codes to IDs
    cursor.execute("SELECT code, id FROM hierarchy_nodes")
    point_map = {row[0]: row[1] for row in cursor.fetchall() if row[0]}
    print(f"Mapped {len(point_map)} unit codes.")

    # 2. Count missing
    cursor.execute("SELECT count(*) FROM transactions WHERE point_id IS NULL OR point_id = ''")
    to_fix = cursor.fetchone()[0]
    print(f"Transactions missing point_id: {to_fix}")
    
    if to_fix == 0:
        print("Data is already clean.")
    else:
        # 3. Update
        count = 0
        for code, node_id in point_map.items():
            cursor.execute(
                "UPDATE transactions SET point_id = ? WHERE ma_dv_chap_nhan = ? AND (point_id IS NULL OR point_id = '')",
                (node_id, code)
            )
            affected = cursor.rowcount
            if affected > 0:
                count += affected
                print(f"Fixed {affected} records for code {code}")
                conn.commit()

        print(f"TOTAL FIXED: {count}/{to_fix}")
    
    conn.close()

    # 4. CLEAR CACHE
    print("\n--- CLEARING SYSTEM CACHE ---")
    if os.path.exists(CACHE_DIR):
        for filename in os.listdir(CACHE_DIR):
            file_path = os.path.join(CACHE_DIR, filename)
            try:
                if os.path.isfile(file_path):
                    os.unlink(file_path)
            except Exception as e:
                print(f"Error deleting cache {filename}: {e}")
        print("Cache cleared successfully!")
    else:
        print("Cache directory not found.")

if __name__ == "__main__":
    fix_data()
