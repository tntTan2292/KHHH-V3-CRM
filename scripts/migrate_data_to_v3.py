import sqlite3
import os

source_db = r"d:\Antigravity - Project\DATA_MASTER\khhh.db"
target_db = r"d:\Antigravity - Project\KHHH - Antigravity - V3.0\data\database\khhh_v3.db"

def migrate_data():
    if not os.path.exists(source_db):
        print(f"Source DB not found: {source_db}")
        return

    print(f"--- MIGRATING DATA FROM MASTER TO LOCAL V3.0 ---")
    print(f"Source: {source_db}")
    print(f"Target: {target_db}")

    s_conn = sqlite3.connect(source_db)
    t_conn = sqlite3.connect(target_db)
    
    tables = ["customers", "transactions", "nhan_su", "hierarchy_nodes", "sync_logs", "action_tasks"]
    
    for table in tables:
        print(f"Migrating table: {table}...")
        try:
            # Clear target table
            t_conn.execute(f"DELETE FROM {table}")
            
            # Get data from source
            cursor = s_conn.execute(f"SELECT * FROM {table}")
            columns = [description[0] for description in cursor.description]
            rows = cursor.fetchall()
            
            if rows:
                placeholders = ", ".join(["?"] * len(columns))
                col_names = ", ".join(columns)
                t_conn.executemany(f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})", rows)
                print(f"  OK: Migrated {len(rows)} records.")
            else:
                print(f"  - No data in {table}.")
            
            t_conn.commit()
        except Exception as e:
            print(f"  ERROR migrating {table}: {e}")

    s_conn.close()
    t_conn.close()
    print("--- DATA MIGRATION COMPLETE ---")

if __name__ == "__main__":
    migrate_data()
