from fastapi import HTTPException, Depends, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Permission, role_permissions, user_permissions, HierarchyNode
from ..services.hierarchy_service import HierarchyService
from typing import List

def get_user_permissions(db: Session, user_id: int) -> List[str]:
    # 1. Get permissions from Role
    # Shortcut for Superadmin
    user = db.query(User).get(user_id)
    if user and user.role and user.role.name == "SUPERADMIN":
        # Return all permission slugs
        return [p.slug for p in db.query(Permission).all()]

    role_perms = db.query(Permission.slug).join(
        role_permissions, Permission.id == role_permissions.c.permission_id
    ).join(
        User, User.role_id == role_permissions.c.role_id
    ).filter(User.id == user_id).all()
    
    perms = {p[0] for p in role_perms}
    
    # 2. Apply Overrides from user_permissions
    overrides = db.query(Permission.slug, user_permissions.c.is_granted).join(
        user_permissions, Permission.id == user_permissions.c.permission_id
    ).filter(user_permissions.c.user_id == user_id).all()
    
    for slug, is_granted in overrides:
        if is_granted:
            perms.add(slug)
        else:
            perms.discard(slug)
            
    print(f"DEBUG: Calculated perms for user {user_id}: {perms}")
    return list(perms)

def check_permission(db: Session, user_id: int, required_slug: str):
    perms = get_user_permissions(db, user_id)
    with open("debug_access_log.txt", "a", encoding="utf-8") as f:
        import datetime
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        f.write(f"[{now}] User {user_id} requesting {required_slug}. perms: {perms}\n")
        if required_slug not in perms:
            f.write(f"[{now}] ACCESS DENIED for user {user_id} on {required_slug}\n")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Bạn không có quyền thực hiện hành động này ({required_slug})"
            )
        f.write(f"[{now}] ACCESS GRANTED for user {user_id} on {required_slug}\n")
    return True

def check_scope(db: Session, user: User, target_node_id: int):
    """
    Kiểm tra xem target_node_id có nằm trong phạm vi (Scope) của user hay không.
    Sử dụng cho các hành động can thiệp vào node cụ thể.
    """
    if not user.scope_node_id:
        if user.role and user.role.name in ["ADMIN", "SUPERADMIN"]:
            return True
        return False
    
    # Superadmin can see everything regardless of node_id
    if user.role and user.role.name == "SUPERADMIN":
        return True
        
    scope_ids = HierarchyService.get_descendant_ids_by_id(db, user.scope_node_id, include_children=True)
    if target_node_id not in scope_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền truy cập dữ liệu ngoài phạm vi được giao."
        )
    return True
