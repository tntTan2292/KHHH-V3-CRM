import sys
import os
import sqlite3

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'database', 'khhh_v3.db'))

def migrate():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(transactions)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'source_folder' not in columns:
            print("Adding 'source_folder' to 'transactions' table...")
            cursor.execute("ALTER TABLE transactions ADD COLUMN source_folder VARCHAR(50)")
            cursor.execute("CREATE INDEX idx_trans_source_folder ON transactions(source_folder)")
            print("Migration successful.")
        else:
            print("Column 'source_folder' already exists.")
            
        conn.commit()
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
