import sys
import os

# Add the project path to sys.path
os_path = r'd:\Antigravity - Project\KHHH - Antigravity - V3.0'
sys.path.append(os_path)

from backend.app.database import SessionLocal
from backend.app.models import User, Role

def cleanup_governance():
    db = SessionLocal()
    try:
        # 1. Restore Primary Admin
        admin = db.query(User).filter(User.username == 'admin').first()
        super_role = db.query(Role).filter(Role.name == 'SUPERADMIN').first()
        
        if admin and super_role:
            admin.role_id = super_role.id
            admin.scope_node_id = None
            admin.failed_login_attempts = 0
            admin.locked_until = None
            admin.is_active = True
            db.add(admin)
            print(f"SUCCESS: 'admin' user restored to SUPERADMIN and UNLOCKED.")
        else:
            print("WARNING: Could not find 'admin' user or 'SUPERADMIN' role.")

        # 2. Remove Test Admin
        test_admin = db.query(User).filter(User.username == 'testadmin').first()
        if test_admin:
            db.delete(test_admin)
            print("SUCCESS: 'testadmin' removed to enforce Canonical Governance.")
        
        db.commit()
        print("Governance cleanup completed successfully.")
    except Exception as e:
        db.rollback()
        print(f"ERROR: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_governance()
