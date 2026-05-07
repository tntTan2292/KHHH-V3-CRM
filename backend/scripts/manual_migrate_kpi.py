import sqlite3
import os

db_path = r"d:\Antigravity - Project\KHHH - Antigravity - V3.0\data\database\khhh_v3.db"

def migrate():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        print("Adding formula_config_json to kpi_definitions...")
        cursor.execute("ALTER TABLE kpi_definitions ADD COLUMN formula_config_json TEXT;")
        conn.commit()
        print("Successfully added column.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
