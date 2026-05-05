from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from ..database import get_db
from ..models import HierarchyNode
from ..services.hierarchy_service import HierarchyService
from ..auth.permissions import check_permission
from ..routers.auth import get_current_user
from ..models import User

router = APIRouter(prefix="/api/admin/hierarchy", tags=["admin-hierarchy"])

class NodeCreate(BaseModel):
    code: str
    name: str
    type: str # CENTER, UNIT, CLUSTER, WARD, POINT
    parent_id: Optional[int] = None

class NodeUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None
    type: Optional[str] = None

@router.get("/nodes", response_model=List[dict])
async def get_all_nodes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_tree")
    nodes = db.query(HierarchyNode).all()
    return [{"id": n.id, "code": n.code, "name": n.name, "type": n.type, "parent_id": n.parent_id} for n in nodes]

@router.post("/nodes")
async def create_node(
    node_in: NodeCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_tree")
    # Check if code already exists
    existing = db.query(HierarchyNode).filter(HierarchyNode.code == node_in.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Mã node đã tồn tại")
    
    new_node = HierarchyNode(
        code=node_in.code,
        name=node_in.name,
        type=node_in.type,
        parent_id=node_in.parent_id
    )
    db.add(new_node)
    db.commit()
    db.refresh(new_node)
    return new_node

@router.patch("/nodes/{node_id}")
async def update_node(
    node_id: int, 
    node_in: NodeUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_tree")
    node = db.query(HierarchyNode).filter(HierarchyNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Không tìm thấy node")
    
    if node_in.name is not None:
        node.name = node_in.name
    if node_in.parent_id is not None:
        node.parent_id = node_in.parent_id
    if node_in.type is not None:
        node.type = node_in.type
        
    db.commit()
    db.refresh(node)
    return node

@router.delete("/nodes/{node_id}")
async def delete_node(
    node_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_tree")
    node = db.query(HierarchyNode).filter(HierarchyNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Không tìm thấy node")
    
    # Check if has children
    child_count = db.query(HierarchyNode).filter(HierarchyNode.parent_id == node_id).count()
    if child_count > 0:
        raise HTTPException(status_code=400, detail="Không thể xóa node đang có node con")
    
    db.delete(node)
    db.commit()
    return {"message": "Đã xóa thành công"}
