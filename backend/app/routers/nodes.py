from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..services.hierarchy_service import HierarchyService
from ..services.scoping_service import ScopingService
from .auth import get_current_user

router = APIRouter(prefix="/api/nodes", tags=["hierarchy"])

@router.get("/tree")
async def get_tree(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Determine the root node for the tree based on user scope
    root_node_id = current_user.scope_node_id
    
    # If user has no scope_node_id, they are likely an ADMIN (see all)
    # unless scoping service says otherwise.
    if not root_node_id:
        if current_user.role and current_user.role.name in ("ADMIN", "SUPERADMIN", "MANAGER"):
            return HierarchyService.get_node_tree(db)
        return []
        
    return HierarchyService.get_node_tree(db, root_node_id)

@router.get("/children")
async def get_root_children(db: Session = Depends(get_db)):
    return HierarchyService.get_children(db)

@router.get("/{node_code}/children")
async def get_node_children(node_code: str, db: Session = Depends(get_db)):
    return HierarchyService.get_children(db, node_code)

@router.get("/{node_code}/descendants")
async def get_descendants(node_code: str, db: Session = Depends(get_db)):
    return HierarchyService.get_descendant_ids(db, node_code)
