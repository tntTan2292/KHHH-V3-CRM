import sqlite3
import os

def migrate():
    # Correct path based on database.py
    db_path = os.path.join("data", "database", "khhh_v3.db")
    print(f"Connecting to: {db_path}")
    
    if not os.path.exists(db_path):
        print(f"Error: Database file not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    columns_to_add = [
        ("last_login_ip", "TEXT"),
        ("failed_login_attempts", "INTEGER DEFAULT 0"),
        ("locked_until", "DATETIME")
    ]
    
    for col_name, col_type in columns_to_add:
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type};")
            print(f"Added column: {col_name}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print(f"Column {col_name} already exists.")
            else:
                print(f"Error adding {col_name}: {e}")
            
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
