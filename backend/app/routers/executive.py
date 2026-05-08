from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..services.executive_health_service import ExecutiveHealthService
from ..auth.auth_service import get_current_user
from ..models import User
from datetime import datetime

router = APIRouter(prefix="/api/executive", tags=["Executive Engine"])

@router.get("/health")
async def get_executive_health(
    node_id: Optional[int] = None,
    period_key: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    GOVERNANCE: Endpoint for Executive Health Engine.
    Provides dynamic operational health scores for the requested scope.
    """
    # 1. Scope Governance
    # If node_id not provided, use user's scope node
    target_node_id = node_id or current_user.scope_node_id
    
    if not target_node_id:
        # Fallback to ROOT if user has no scope (e.g. Superadmin)
        from ..models import HierarchyNode
        root_node = db.query(HierarchyNode).filter(HierarchyNode.parent_id == None).first()
        if root_node:
            target_node_id = root_node.id
        else:
            raise HTTPException(status_code=400, detail="No hierarchy context found.")

    # 2. Period Governance
    # If period_key not provided, use current month
    target_period = period_key or datetime.now().strftime('%Y-%m')

    # 3. Calculate Health
    try:
        health_data = ExecutiveHealthService.get_hierarchy_health(db, target_node_id, target_period)
        return health_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Executive Health Engine Error: {str(e)}")
