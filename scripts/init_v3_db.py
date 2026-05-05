import sys
import os

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.database import engine, Base, DB_PATH
from app.models import * # Load all models

def init_db():
    print(f"--- INITIALIZING V3.0 LOCAL DATABASE ---")
    print(f"Target Path: {DB_PATH}")
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("✅ All tables created successfully (with full V3.0 schema).")

if __name__ == "__main__":
    init_db()
