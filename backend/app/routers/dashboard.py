from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..services.dashboard_service import DashboardService
from ..auth.auth_service import get_current_user
from ..models import User

router = APIRouter(prefix="/api/dashboard", tags=["Executive Dashboard"])

@router.get("/executive-metrics")
async def get_executive_metrics(
    node_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    GOVERNANCE: Endpoint for Executive Command Center.
    Requires ADMIN or SUPERADMIN role for full overview.
    """
    # Authorization: Only higher roles can see the Executive Dashboard
    if current_user.role.name not in ["ADMIN", "SUPERADMIN", "CENTER_LEADER"]:
        raise HTTPException(status_code=403, detail="Permission denied for Executive Dashboard")
        
    return DashboardService.get_executive_metrics(db, node_id)

@router.get("/health-check")
async def dashboard_health():
    return {"status": "operational", "engine": "CommandCenter-v1.0"}
