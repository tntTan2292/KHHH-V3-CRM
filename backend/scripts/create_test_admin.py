import sys
import os

# Add project root to path
sys.path.append(r"d:\Antigravity - Project\KHHH - Antigravity - V3.0")

from backend.app.database import SessionLocal
from backend.app.models import User
from backend.app.core.security import get_password_hash

def create_test_admin():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "testadmin").first()
        if not user:
            user = User(
                username="testadmin",
                full_name="Test Admin",
                role_id=6, # SUPERADMIN
                is_active=True
            )
            db.add(user)
        
        user.hashed_password = get_password_hash("admin123")
        db.commit()
        print("User 'testadmin' created with password 'admin123'")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_admin()
