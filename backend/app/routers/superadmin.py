from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
import os
import zipfile

from ..database import get_db, DB_PATH
from ..models import User, SystemLog, UserSession, Transaction, Customer, ActionTask
from ..auth.permissions import check_permission
from .auth import get_current_user

router = APIRouter(prefix="/api/superadmin", tags=["Superadmin"])

def check_superadmin(user: User):
    if not user.role or user.role.name.strip().upper() != "SUPERADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Quyền hạn tối cao (Superadmin) được yêu cầu cho thao tác này"
        )

@router.get("/logs")
async def get_system_logs(
    limit: int = 100,
    offset: int = 0,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    resource: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_superadmin(current_user)
    query = db.query(SystemLog)
    if user_id:
        query = query.filter(SystemLog.user_id == user_id)
    if action:
        if action == "LOGIN_ONLY":
            query = query.filter(SystemLog.action == "LOGIN")
        elif action == "TASKS_ONLY":
            query = query.filter(SystemLog.action.contains("TASK"))
        elif action == "SYSTEM_ONLY":
            # Show everything except login and tasks
            query = query.filter(~SystemLog.action.contains("TASK"), SystemLog.action != "LOGIN")
        else:
            query = query.filter(SystemLog.action == action)
    if resource:
        query = query.filter(SystemLog.resource == resource)
    
    if start_date:
        query = query.filter(SystemLog.timestamp >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        # Add 23:59:59 to include the whole end date
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        query = query.filter(SystemLog.timestamp <= end_dt)
    
    logs = query.order_by(SystemLog.timestamp.desc()).offset(offset).limit(limit).all()
    return logs

@router.get("/sessions")
async def get_active_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_superadmin(current_user)
    sessions = db.query(UserSession).filter(UserSession.is_active == True).all()
    result = []
    for s in sessions:
        user = db.query(User).get(s.user_id)
        result.append({
            "id": s.id,
            "username": user.username if user else "Unknown",
            "full_name": user.full_name if user else "Unknown",
            "ip_address": s.ip_address,
            "last_activity": s.last_activity,
            "user_agent": s.user_agent
        })
    return result

@router.post("/sessions/{session_id}/kick")
async def kick_user(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_superadmin(current_user)
    session = db.query(UserSession).get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên làm việc")
    
    session.is_active = False
    db.commit()
    return {"message": f"Đã ngắt kết nối phiên làm việc {session_id}"}

@router.get("/cleanup/stats")
async def get_cleanup_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_superadmin(current_user)
    
    # Debug: Print counts to console to verify
    log_count = db.query(SystemLog).count()
    task_count = db.query(ActionTask).count()
    test_cust_count = db.query(Customer).filter(Customer.ten_kh.like("%TEST%")).count()
    
    # Potential leads are transactions with empty ma_kh
    potential_count = db.query(func.count(func.distinct(Transaction.ten_nguoi_gui))).filter(
        (Transaction.ma_kh == '') | (Transaction.ma_kh == None)
    ).scalar() or 0

    stats = {
        "logs": {
            "total": log_count,
            "login": db.query(SystemLog).filter(SystemLog.action == "LOGIN").count(),
            "tasks": db.query(SystemLog).filter(SystemLog.action.like("%TASK%")).count(),
        },
        "tasks": {
            "total": task_count,
            "hien_huu": db.query(ActionTask).filter(ActionTask.loai_doi_tuong == "HienHuu").count(),
            "tiem_nang": db.query(ActionTask).filter(ActionTask.loai_doi_tuong == "TiemNang").count(),
        },
        "customers": {
            "test": test_cust_count
        },
        "potentials": {
            "total": potential_count
        }
    }
    print(f"Cleanup Stats Query: {stats}")
    return stats

@router.delete("/cleanup")
async def perform_cleanup(
    categories: str = Query(...), # Comma separated
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_superadmin(current_user)
    
    results = {}
    category_list = categories.split(",")
    
    start_dt = datetime.strptime(start_date, "%Y-%m-%d") if start_date else None
    end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59) if end_date else None

    if "SYSTEM_LOGS" in category_list:
        q = db.query(SystemLog)
        if start_dt: q = q.filter(SystemLog.timestamp >= start_dt)
        if end_dt: q = q.filter(SystemLog.timestamp <= end_dt)
        count = q.delete(synchronize_session=False)
        results["system_logs"] = count

    if "LOGIN_LOGS" in category_list:
        q = db.query(SystemLog).filter(SystemLog.action == "LOGIN")
        if start_dt: q = q.filter(SystemLog.timestamp >= start_dt)
        if end_dt: q = q.filter(SystemLog.timestamp <= end_dt)
        count = q.delete(synchronize_session=False)
        results["login_logs"] = count

    if "TASKS_5B" in category_list:
        q = db.query(ActionTask).filter(ActionTask.loai_doi_tuong == "TiemNang")
        if start_dt: q = q.filter(ActionTask.created_at >= start_dt)
        if end_dt: q = q.filter(ActionTask.created_at <= end_dt)
        count = q.delete(synchronize_session=False)
        results["tasks_5b"] = count

    if "TASKS_EXISTING" in category_list:
        q = db.query(ActionTask).filter(ActionTask.loai_doi_tuong == "HienHuu")
        if start_dt: q = q.filter(ActionTask.created_at >= start_dt)
        if end_dt: q = q.filter(ActionTask.created_at <= end_dt)
        count = q.delete(synchronize_session=False)
        results["tasks_existing"] = count

    if "TEST_CUSTOMERS" in category_list:
        count = db.query(Customer).filter(Customer.ten_kh.like("%TEST%")).delete(synchronize_session=False)
        results["test_customers"] = count

    if "POTENTIAL_LEADS" in category_list:
        # Xóa các giao dịch vãng lai (dùng để test potential)
        q = db.query(Transaction).filter((Transaction.ma_kh == '') | (Transaction.ma_kh == None))
        if start_dt: q = q.filter(Transaction.ngay_chap_nhan >= start_dt)
        if end_dt: q = q.filter(Transaction.ngay_chap_nhan <= end_dt)
        count = q.delete(synchronize_session=False)
        results["potential_leads"] = count

    db.commit()
    return {"message": "Dọn dẹp thành công", "details": results}

@router.delete("/cleanup/test-data")
async def cleanup_test_data_legacy(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_superadmin(current_user)
    deleted_customers = db.query(Customer).filter(Customer.ten_kh.like("%TEST%")).delete(synchronize_session=False)
    db.commit()
    return {"message": f"Đã dọn dẹp {deleted_customers} bản ghi thử nghiệm"}

@router.post("/backup")
async def trigger_backup(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_superadmin(current_user)
    try:
        backup_dir = os.path.join(os.path.dirname(DB_PATH), "backups")
        os.makedirs(backup_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = os.path.join(backup_dir, f"backup_{timestamp}.zip")
        
        with zipfile.ZipFile(backup_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(DB_PATH, os.path.basename(DB_PATH))
            
        return {"message": "Đã sao lưu thành công", "file": os.path.basename(backup_file)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi sao lưu: {str(e)}")
