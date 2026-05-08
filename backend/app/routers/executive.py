from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..services.executive_health_service import ExecutiveHealthService
from ..services.operational_risk_service import OperationalRiskService
from ..services.executive_situation_service import ExecutiveSituationService
from ..services.executive_trend_service import ExecutiveTrendService
from ..services.executive_forecast_service import ExecutiveForecastService
from ..services.executive_command_service import ExecutiveCommandService
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

@router.get("/risk")
async def get_executive_risk(
    node_id: Optional[int] = None,
    period_key: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    GOVERNANCE: Endpoint for Operational Risk Engine.
    Provides dynamic operational risk scores for the requested scope.
    """
    target_node_id = node_id or current_user.scope_node_id
    
    if not target_node_id:
        from ..models import HierarchyNode
        root_node = db.query(HierarchyNode).filter(HierarchyNode.parent_id == None).first()
        if root_node:
            target_node_id = root_node.id
        else:
            raise HTTPException(status_code=400, detail="No hierarchy context found.")

    target_period = period_key or datetime.now().strftime('%Y-%m')

    try:
        risk_data = OperationalRiskService.get_hierarchy_risk(db, target_node_id, target_period)
        return risk_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Operational Risk Engine Error: {str(e)}")

@router.get("/situation")
async def get_executive_situation(
    node_id: Optional[int] = None,
    period_key: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    GOVERNANCE: Endpoint for Executive Situation Room.
    Provides aggregated operational situation overview.
    """
    target_node_id = node_id or current_user.scope_node_id
    
    if not target_node_id:
        from ..models import HierarchyNode
        root_node = db.query(HierarchyNode).filter(HierarchyNode.parent_id == None).first()
        if root_node:
            target_node_id = root_node.id
        else:
            raise HTTPException(status_code=400, detail="No hierarchy context found.")

    target_period = period_key or datetime.now().strftime('%Y-%m')

    try:
        situation_data = ExecutiveSituationService.get_hierarchy_situation(db, target_node_id, target_period)
        return situation_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Executive Situation Room Error: {str(e)}")

@router.get("/trends")
async def get_executive_trends(
    node_id: Optional[int] = None,
    period_key: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    GOVERNANCE: Endpoint for Executive Trend Intelligence.
    Provides foresight into operational momentum and anomalies.
    """
    target_node_id = node_id or current_user.scope_node_id
    
    if not target_node_id:
        from ..models import HierarchyNode
        root_node = db.query(HierarchyNode).filter(HierarchyNode.parent_id == None).first()
        if root_node:
            target_node_id = root_node.id
        else:
            raise HTTPException(status_code=400, detail="No hierarchy context found.")

    target_period = period_key or datetime.now().strftime('%Y-%m')

    try:
        trend_data = ExecutiveTrendService.analyze_trend(db, 'HIERARCHY_NODE', str(target_node_id), target_period)
        return trend_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Executive Trend Engine Error: {str(e)}")

@router.get("/forecast")
async def get_executive_forecast_api(
    node_id: Optional[int] = None,
    period_key: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    GOVERNANCE: Endpoint for Executive Forecast Intelligence.
    Provides operational projections for 1-3 months.
    """
    target_node_id = node_id or current_user.scope_node_id
    
    if not target_node_id:
        from ..models import HierarchyNode
        root_node = db.query(HierarchyNode).filter(HierarchyNode.parent_id == None).first()
        if root_node:
            target_node_id = root_node.id
        else:
            raise HTTPException(status_code=400, detail="No hierarchy context found.")

    target_period = period_key or datetime.now().strftime('%Y-%m')

    try:
        forecast_data = ExecutiveForecastService.get_executive_forecast(db, 'HIERARCHY_NODE', str(target_node_id), target_period)
        return forecast_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Executive Forecast Engine Error: {str(e)}")

@router.get("/command-center")
async def get_executive_command_center(
    node_id: Optional[int] = None,
    period_key: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    GOVERNANCE: Unified Endpoint for Executive Command Center.
    Aggregates all Executive Intelligence into a single Governed Payload.
    """
    target_node_id = node_id or current_user.scope_node_id
    
    if not target_node_id:
        from ..models import HierarchyNode
        root_node = db.query(HierarchyNode).filter(HierarchyNode.parent_id == None).first()
        if root_node:
            target_node_id = root_node.id
        else:
            raise HTTPException(status_code=400, detail="No hierarchy context found.")

    target_period = period_key or datetime.now().strftime('%Y-%m')

    try:
        command_payload = ExecutiveCommandService.build_executive_command_payload(db, 'HIERARCHY_NODE', str(target_node_id), target_period)
        return command_payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Executive Command Center Error: {str(e)}")
