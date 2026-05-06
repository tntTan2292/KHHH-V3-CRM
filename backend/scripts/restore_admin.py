import sys
import os

# Add project root to path
sys.path.append(r"d:\Antigravity - Project\KHHH - Antigravity - V3.0")

from backend.app.database import SessionLocal
from backend.app.models import User
from backend.app.core.security import get_password_hash

def restore_admin_access():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            print("Creating new admin user...")
            # Note: You might need to adjust role_id based on your DB
            admin = User(
                username="admin",
                full_name="System Administrator",
                role_id=6, # SUPERADMIN
                is_active=True,
                must_change_password=True
            )
            db.add(admin)
        
        print("Resetting admin password to 'admin123@'...")
        admin.hashed_password = get_password_hash("admin123@")
        admin.failed_login_attempts = 0
        admin.locked_until = None
        admin.is_active = True
        
        db.commit()
        print("SUCCESS: Admin password reset to 'admin123@'")
    except Exception as e:
        print(f"ERROR: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    restore_admin_access()
