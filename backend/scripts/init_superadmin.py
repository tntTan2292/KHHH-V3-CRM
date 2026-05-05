import sys
import os

# Thêm thư mục backend vào sys.path để có thể import app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal, engine
from app.models import Role, User

def check_roles():
    db = SessionLocal()
    roles = db.query(Role).all()
    print("--- ROLES IN DB ---")
    for r in roles:
        print(f"ID: {r.id}, Name: {r.name}")
    
    superadmin_role = db.query(Role).filter(Role.name == "SUPERADMIN").first()
    if not superadmin_role:
        print("--- [INFO] SUPERADMIN role not found. Creating it...")
        superadmin_role = Role(name="SUPERADMIN", description="Quyền quản trị tối cao của hệ thống")
        db.add(superadmin_role)
        db.commit()
        db.refresh(superadmin_role)
        print(f"--- [SUCCESS] Created SUPERADMIN role with ID: {superadmin_role.id}")
    else:
        print(f"--- [INFO] SUPERADMIN role already exists with ID: {superadmin_role.id}")

    # Optionally promote a specific user (Sếp)
    # seph_user = db.query(User).filter(User.username == 'ADMIN').first()
    # if seph_user:
    #     seph_user.role_id = superadmin_role.id
    #     db.commit()
    #     print(f"--- [SUCCESS] Promoted user '{seph_user.username}' to SUPERADMIN")

    db.close()

if __name__ == "__main__":
    check_roles()
