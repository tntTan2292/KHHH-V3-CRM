from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from ..database import get_db
from ..models import User, Role, HierarchyNode, NhanSu, Permission, role_permissions, user_permissions
from ..auth.permissions import get_user_permissions, check_permission
from ..routers.auth import get_current_user

router = APIRouter(prefix="/api/admin/roles", tags=["admin-roles"])

class RoleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]

class UserRoleAssignment(BaseModel):
    user_id: int
    role_id: int
    scope_node_id: Optional[int]

class PermissionResponse(BaseModel):
    id: int
    name: str
    slug: str
    module: str
    description: Optional[str]

class RolePermissionsUpdate(BaseModel):
    role_id: int
    permission_ids: List[int]

class UserPermissionsUpdate(BaseModel):
    user_id: int
    permission_ids: List[int] # Quyền được cấp
    denied_ids: List[int]     # Quyền bị tước (chặn)


@router.get("/", response_model=List[RoleResponse])
async def get_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_roles")
    return db.query(Role).all()

# --- PERMISSIONS API ---

@router.get("/permissions", response_model=List[PermissionResponse])
async def get_all_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_roles")
    return db.query(Permission).all()

@router.get("/{role_id}/permissions", response_model=List[int])
async def get_role_permissions(role_id: int, db: Session = Depends(get_db)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return [p.id for p in role.permissions]

@router.post("/assign-to-role")
async def assign_permissions_to_role(
    update: RolePermissionsUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_roles")
    role = db.query(Role).filter(Role.id == update.role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Update permissions
    new_perms = db.query(Permission).filter(Permission.id.in_(update.permission_ids)).all()
    role.permissions = new_perms
    db.commit()
    return {"message": f"Successfully updated permissions for role {role.name}"}

@router.get("/user/{user_id}/permissions")
async def get_user_effective_permissions(
    user_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_roles")
    # Returns effective slugs
    slugs = get_user_permissions(db, user_id)
    # Also return raw overrides for UI
    overrides = db.query(user_permissions).filter(user_permissions.c.user_id == user_id).all()
    
    return {
        "effective_slugs": slugs,
        "overrides": [{"permission_id": o.permission_id, "is_granted": o.is_granted} for o in overrides]
    }

@router.get("/user_by_username/{username}/permissions")
async def get_user_permissions_by_username(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    slugs = get_user_permissions(db, user.id)
    return {
        "effective_slugs": slugs
    }

@router.post("/assign-to-user")
async def assign_permissions_to_user(
    update: UserPermissionsUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_roles")
    # 1. Clear existing overrides
    db.execute(user_permissions.delete().where(user_permissions.c.user_id == update.user_id))
    
    # 2. Add granted
    for pid in update.permission_ids:
        db.execute(user_permissions.insert().values(user_id=update.user_id, permission_id=pid, is_granted=True))
    
    # 3. Add denied
    for pid in update.denied_ids:
        db.execute(user_permissions.insert().values(user_id=update.user_id, permission_id=pid, is_granted=False))
        
    db.commit()
    return {"message": "Successfully updated user-specific permission overrides"}


@router.get("/users")
async def get_users_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_roles")
    users = db.query(User).options(
        joinedload(User.role),
        joinedload(User.scope_node),
        joinedload(User.nhan_su)
    ).all()
    
    result = []
    for u in users:
        result.append({
            "id": u.nhan_su.id if u.nhan_su else None, # NhanSu ID for consistency
            "user_id": u.id,
            "username": u.username,
            "username_app": u.nhan_su.username_app if u.nhan_su else None,
            "full_name": u.full_name or (u.nhan_su.full_name if u.nhan_su else None),
            "role_name": u.role.name if u.role else "Chưa gán",
            "role_id": u.role_id,
            "scope_node_name": u.scope_node.name if u.scope_node else "Toàn tỉnh",
            "scope_node_id": u.scope_node_id,
            "hr_id": u.nhan_su.hr_id if u.nhan_su else None,
            "is_active": u.is_active,
            "has_account": True
        })
    return result

@router.post("/assign")
async def assign_role(
    assignment: UserRoleAssignment, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_roles")
    user = db.query(User).filter(User.id == assignment.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.role_id = assignment.role_id
    user.scope_node_id = assignment.scope_node_id
    db.commit()
    return {"message": f"Successfully assigned role and scope to {user.username}"}
