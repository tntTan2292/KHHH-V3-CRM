import sqlite3
import os

DB_PATH = r"d:\Antigravity - Project\KHHH - Antigravity - V3.0\data\database\khhh_v3.db"

def reset_tasks():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("Cleaning up old test tasks for fresh start...")
    
    try:
        # Xóa toàn bộ task cũ
        cursor.execute("DELETE FROM action_tasks;")
        
        # Reset auto-increment nếu có
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='action_tasks';")
        
        conn.commit()
        print("SUCCESS: All task records purged. System is ready for fresh testing.")
        
    except Exception as e:
        print(f"ERROR: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    reset_tasks()
