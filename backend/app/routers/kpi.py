from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..services.kpi_service import KPIService
from ..auth.auth_service import get_current_user
from ..models import User

router = APIRouter(prefix="/api/kpi", tags=["KPI Engine"])

@router.get("/definitions")
async def get_kpi_definitions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return KPIService.get_definitions(db)

@router.post("/definitions")
async def create_kpi_definition(
    code: str,
    name: str,
    description: str,
    formula: str,
    target: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only Admin or Superadmin can define KPIs
    if current_user.role.name not in ["ADMIN", "SUPERADMIN"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    return KPIService.create_definition(db, code, name, description, formula, target)

@router.get("/scores")
async def get_kpi_scores(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    period_key: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return KPIService.get_scores(db, entity_type, entity_id, period_key)

@router.post("/calculate/{kpi_code}")
async def calculate_kpi(
    kpi_code: str,
    entity_type: str,
    entity_id: str,
    period_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role.name not in ["ADMIN", "SUPERADMIN"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    if kpi_code == 'SLA_COMPLIANCE_RATE':
        return KPIService.calculate_sla_compliance(db, entity_type, entity_id, period_key)
    else:
        raise HTTPException(status_code=400, detail="KPI Calculation not implemented for this code")

@router.get("/dashboard")
async def get_kpi_dashboard(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    period_key: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return KPIService.get_kpi_dashboard(db, entity_type, entity_id, period_key)
