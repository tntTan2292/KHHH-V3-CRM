from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
import re
from datetime import datetime

from ..database import get_db
from ..models import Transaction, User
from ..services.province_matcher import remove_accents
from ..services.scoping_service import ScopingService
from .auth import get_current_user
from ..core.config_segments import (
    THRESHOLD_DIAMOND_REV, THRESHOLD_GOLD_REV, THRESHOLD_BRONZE_REV,
    THRESHOLD_DIAMOND_SHIP, THRESHOLD_GOLD_SHIP, THRESHOLD_BRONZE_SHIP
)
from ..services.potential_service import PotentialService

router = APIRouter(prefix="/api/potential", tags=["potential"])

def normalize_name(name: str) -> str:
    if not name:
        return ""
    name = re.sub(r'\s+', ' ', name.strip())
    return remove_accents(name)

@router.get("")
async def get_potential_customers(
    start_date: str = None,
    end_date: str = None,
    min_days: int = 3,
    sort_by: str = "tong_doanh_thu",
    order: str = "desc",
    page: int = 1,
    page_size: int = 50,
    node_code: str = None,
    rfm_segment: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Sử dụng Service để lấy dữ liệu (Elite RBAC 3.0)
    items, total, summary_counts, applied_dates = PotentialService.get_potential_data(
        db=db,
        current_user=current_user,
        start_date=start_date,
        end_date=end_date,
        min_days=min_days,
        sort_by=sort_by,
        order=order,
        page=page,
        page_size=page_size,
        node_code=node_code,
        rfm_segment=rfm_segment
    )

    return {
        "items": items,
        "total": total,
        "summary": summary_counts,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 1,
        "applied_dates": applied_dates
    }
