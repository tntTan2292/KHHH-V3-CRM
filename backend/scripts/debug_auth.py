import sys
import os

# Add project root to path
sys.path.append(r"d:\Antigravity - Project\KHHH - Antigravity - V3.0")

from backend.app.database import SessionLocal
from backend.app.models import User
from backend.app.core.security import verify_password, get_password_hash

def debug_auth():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "testadmin").first()
        if user:
            print(f"User found: {user.username}")
            print(f"Stored Hash: {user.hashed_password}")
            
            # Test direct verify
            is_valid = verify_password("admin123", user.hashed_password)
            print(f"Verify 'admin123': {is_valid}")
            
            # Test new hash
            new_hash = get_password_hash("admin123")
            print(f"New Hash: {new_hash}")
            print(f"Verify new hash: {verify_password('admin123', new_hash)}")
        else:
            print("User not found")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    debug_auth()
