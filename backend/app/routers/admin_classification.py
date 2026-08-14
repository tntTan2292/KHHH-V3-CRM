from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List

from ..database import get_db
from ..models import User, Transaction, ServiceClassification
from .auth import get_current_user

router = APIRouter(prefix="/api/admin", tags=["Admin Classification"])

def check_admin(user: User):
    if not user.role or user.role.name.strip().upper() not in ["ADMIN", "SUPERADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yêu cầu quyền Admin hoặc Superadmin"
        )

@router.get("/unknown-classifications")
async def get_unknown_classifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin(current_user)
    
    # SSOT Lookup: LEFT JOIN service_classifications sc ON t.dich_vu_chinh = sc.ma_dv WHERE sc.ma_dv IS NULL
    query = db.query(
        Transaction.dich_vu_chinh.label("code"),
        func.count(Transaction.id).label("transaction_count"),
        func.sum(Transaction.doanh_thu).label("total_revenue"),
        func.max(Transaction.ngay_chap_nhan).label("latest_date")
    ).outerjoin(
        ServiceClassification, Transaction.dich_vu_chinh == ServiceClassification.ma_dv
    ).filter(
        ServiceClassification.ma_dv == None,
        Transaction.dich_vu_chinh != None,
        Transaction.dich_vu_chinh != ""
    ).group_by(
        Transaction.dich_vu_chinh
    ).order_by(
        func.sum(Transaction.doanh_thu).desc()
    ).all()
    
    return [
        {
            "code": r.code,
            "transaction_count": r.transaction_count,
            "total_revenue": float(r.total_revenue or 0),
            "latest_date": r.latest_date.isoformat() if r.latest_date else None
        }
        for r in query
    ]

class AssignRequest(BaseModel):
    dich_vu_chinh: str
    loai_dich_vu: str

def backfill_classification_job(dich_vu_chinh: str, loai_dich_vu: str):
    from ..database import SessionLocal
    db = SessionLocal()
    try:
        # Update Scope Protection: Only touch NULL or Khác
        db.query(Transaction).filter(
            Transaction.dich_vu_chinh == dich_vu_chinh,
            (Transaction.loai_dich_vu == None) | (Transaction.loai_dich_vu == 'Khác')
        ).update(
            {"loai_dich_vu": loai_dich_vu},
            synchronize_session=False
        )
        db.commit()
    except Exception as e:
        print(f"Error in backfill job for {dich_vu_chinh}: {e}")
    finally:
        db.close()

@router.post("/assign-classification")
async def assign_classification(
    req: AssignRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin(current_user)
    
    # 1. Update SSOT
    svc = db.query(ServiceClassification).filter(ServiceClassification.ma_dv == req.dich_vu_chinh).first()
    if svc:
        svc.loai_dich_vu = req.loai_dich_vu
        svc.is_active = True
    else:
        svc = ServiceClassification(
            ma_dv=req.dich_vu_chinh,
            loai_dich_vu=req.loai_dich_vu,
            is_active=True
        )
        db.add(svc)
    db.commit()
    
    # 2. Trigger Background Backfill
    background_tasks.add_task(backfill_classification_job, req.dich_vu_chinh, req.loai_dich_vu)
    
    return {"success": True, "message": f"Đã gán {req.dich_vu_chinh} -> {req.loai_dich_vu}. Đang đồng bộ dữ liệu ngầm..."}
