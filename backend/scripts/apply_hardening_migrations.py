import sys
import os

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, Base
from app.models import *

print("Applying database migrations (Enterprise Hardening)...")
try:
    Base.metadata.create_all(bind=engine)
    print("Successfully applied migrations and created indexes.")
except Exception as e:
    print(f"Error applying migrations: {e}")
