from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, desc
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from ..database import get_db
import json
from ..models import ActionTask, ActionTaskTemplate, User, NhanSu, Customer, Transaction, HierarchyNode, TaskStateLog
from ..routers.auth import get_current_user
from ..services.potential_service import PotentialService
from ..services.scoping_service import ScopingService
from ..services.log_service import LogService
from ..services.sla_service import SLAService
from fastapi import Request

router = APIRouter(prefix="/api/actions", tags=["actions"])

def build_timeline_payload(
    db: Session,
    event_type: str,
    acted_by_user: User,
    action_source: str,
    from_staff_id: Optional[int],
    to_staff_id: Optional[int],
    previous_status: Optional[str],
    new_status: str,
    reason: str,
    evidence_text: str = ""
):
    from_staff_name = ""
    from_node = ""
    to_staff_name = ""
    to_node = ""
    
    if from_staff_id:
        fs = db.query(NhanSu).filter(NhanSu.id == from_staff_id).first()
        if fs:
            from_staff_name = f"{fs.full_name} ({fs.chuc_vu or 'Nhân viên'})"
            if fs.point:
                from_node = fs.point.name
                
    if to_staff_id:
        ts = db.query(NhanSu).filter(NhanSu.id == to_staff_id).first()
        if ts:
            to_staff_name = f"{ts.full_name} ({ts.chuc_vu or 'Nhân viên'})"
            if ts.point:
                to_node = ts.point.name

    return {
        "event_type": event_type,
        "acted_by_user_id": acted_by_user.id,
        "action_by": acted_by_user.full_name or "System",
        "action_source": action_source,
        "from_staff_id": from_staff_id,
        "from_staff_name": from_staff_name,
        "to_staff_id": to_staff_id,
        "to_staff_name": to_staff_name,
        "from_node": from_node,
        "to_node": to_node,
        "previous_status": previous_status,
        "new_status": new_status,
        "reason": reason,
        "evidence_text": evidence_text,
        "created_at": datetime.now().isoformat()
    }
@router.get("/templates")
async def get_templates(
    loai_doi_tuong: str = None, 
    nhom_kh: str = None, 
    db: Session = Depends(get_db)
):
    # Minimal compatibility adapter for Phase 4C-2
    mapped_nhom_kh = nhom_kh
    if loai_doi_tuong == "HienHuu" and nhom_kh in ["new_pop", "active", "recovered"]:
        mapped_nhom_kh = "new"
        
    query = db.query(ActionTaskTemplate)
    if loai_doi_tuong:
        query = query.filter(ActionTaskTemplate.loai_doi_tuong == loai_doi_tuong)
    if mapped_nhom_kh:
        query = query.filter(ActionTaskTemplate.nhom_kh == mapped_nhom_kh)
        
    templates = query.all()
    return [{"id": t.id, "tieu_de": t.tieu_de, "noi_dung_mau": t.noi_dung_mau, "nhom_kh": t.nhom_kh, "loai_doi_tuong": t.loai_doi_tuong} for t in templates]

class AssignTaskPayload(BaseModel):
    target_id: str
    loai_doi_tuong: str # HienHuu hoặc TiemNang
    staff_id: int
    noi_dung: str
    deadline: Optional[str] = None
    template_id: Optional[int] = None
    phan_loai_giao_viec: Optional[str] = "Giao Lead"
    pipeline_stage: Optional[str] = "B1" # B1-B5
    task_contact_at: Optional[str] = None # YYYY-MM-DD HH:MM
    assignment_mode: Optional[str] = "DIRECT"
    action_source: Optional[str] = "CUSTOMERS"

@router.post("/assign")
async def assign_task(
    request: Request,
    payload: AssignTaskPayload, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    deadline_dt = None
    if payload.deadline:
        deadline_dt = datetime.fromisoformat(payload.deadline.replace('Z', '+00:00'))
    
    contact_dt = datetime.now()
    if payload.task_contact_at:
        try:
            contact_dt = datetime.fromisoformat(payload.task_contact_at.replace('Z', '+00:00'))
            # DRIFT LIMIT: Không cho phép lùi quá 24h
            if (datetime.now() - contact_dt).total_seconds() > 86400: # 24h
                 raise HTTPException(status_code=400, detail="Thời điểm tiếp xúc không được lùi quá 24 giờ so với hiện tại")
        except HTTPException as e:
            raise e
        except:
            pass

    # Check for Collaboration Mode (Soft Control)
    cross_point_flag = False
    orig_p_id = None
    orig_s_id = None
    
    # --- CROSS-CENTER SCOPE LOCK ---
    from ..services.scoping_service import ScopingService
    user_scope_ids = ScopingService.get_effective_scope_ids(db, current_user)
    if user_scope_ids is not None: # Not ADMIN
        target_staff = db.query(NhanSu).filter(NhanSu.id == payload.staff_id).first()
        if not target_staff or target_staff.point_id not in user_scope_ids:
            raise HTTPException(status_code=403, detail="Bạn không có quyền giao việc cho nhân sự thuộc trung tâm/nhánh khác.")
    
    # Kiểm tra giao trùng khách hàng đang active
    active_task = db.query(ActionTask).filter(
        ActionTask.target_id == payload.target_id,
        ActionTask.loai_doi_tuong == payload.loai_doi_tuong,
        ActionTask.trang_thai.notin_(["Hoàn thành", "Thất bại", "Hủy"])
    ).first()
    if active_task:
        raise HTTPException(status_code=400, detail="Khách hàng này đang có nhiệm vụ chưa hoàn thành, không thể giao trùng.")

    # Tìm vết cũ của khách hàng này trong hệ thống Task
    old_task = db.query(ActionTask).filter(
        ActionTask.target_id == payload.target_id,
        ActionTask.loai_doi_tuong == payload.loai_doi_tuong
    ).order_by(desc(ActionTask.created_at)).first()
    
    if old_task:
        # Lấy point_id của người được giao cũ
        old_staff = db.query(NhanSu).filter(NhanSu.id == old_task.staff_id).first()
        new_staff = db.query(NhanSu).filter(NhanSu.id == payload.staff_id).first()
        
        if old_staff and new_staff and old_staff.point_id != new_staff.point_id:
            cross_point_flag = True
            orig_p_id = old_staff.point_id
            orig_s_id = old_task.staff_id

    new_task = ActionTask(
        target_id=payload.target_id,
        loai_doi_tuong=payload.loai_doi_tuong,
        phan_loai_giao_viec=payload.phan_loai_giao_viec,
        pipeline_stage=payload.pipeline_stage,
        task_contact_at=contact_dt,
        staff_id=payload.staff_id,
        template_id=payload.template_id,
        noi_dung=payload.noi_dung,
        deadline=deadline_dt,
        trang_thai="Mới",
        cross_point_flag=cross_point_flag,
        original_point_id=orig_p_id,
        original_staff_id=orig_s_id
    )
    
    # HARD LOCK: Nếu là Khách hiện hữu -> Khóa cho nhân viên này
    if payload.loai_doi_tuong == "KhachHang":
        customer = db.query(Customer).filter(Customer.ma_crm_cms == payload.target_id).first()
        if customer:
            customer.assigned_staff_id = payload.staff_id

    db.add(new_task)
    
    # Neu la HienHuu -> update luon thong tin assign trong bang Customer
    if payload.loai_doi_tuong == "HienHuu":
        customer = db.query(Customer).filter(Customer.ma_crm_cms == payload.target_id).first()
        if customer:
            customer.assigned_staff_id = payload.staff_id
            
    db.commit()
    db.refresh(new_task)
    
    # Timeline Hook
    event_type = "DELEGATED" if payload.assignment_mode == "DELEGATION" else "ASSIGN_STAFF"
    evidence = build_timeline_payload(
        db=db,
        event_type=event_type,
        acted_by_user=current_user,
        action_source=payload.action_source,
        from_staff_id=current_user.nhan_su_id,
        to_staff_id=payload.staff_id,
        previous_status=None,
        new_status="Mới",
        reason=payload.phan_loai_giao_viec,
        evidence_text=payload.noi_dung
    )
    state_log = TaskStateLog(
        task_id=new_task.id,
        previous_status=None,
        new_status="Mới",
        changed_by=current_user.id,
        action_type=event_type,
        reason=payload.phan_loai_giao_viec,
        evidence_snapshot_json=json.dumps(evidence, ensure_ascii=False)
    )
    db.add(state_log)
    db.commit()

    # Ghi Log Hệ thống
    LogService.log_action(
        db=db,
        user_id=current_user.id,
        action="ASSIGN_TASK",
        resource=payload.loai_doi_tuong,
        details=f"Giao việc cho nhân sự ID {payload.staff_id} tiếp cận {payload.target_id}. Nội dung: {payload.noi_dung[:100]}...",
        ip_address=request.client.host
    )
    
    return {"message": "Đã tạo task thành công", "task_id": new_task.id}

@router.get("/summary")
async def get_action_summary(
    loai_doi_tuong: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    node_code: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from datetime import datetime
    now = datetime.now()
    
    query = db.query(ActionTask).options(
        joinedload(ActionTask.staff),
        joinedload(ActionTask.template)
    )
    # ... logic for summary stats including upcoming_overdue_count, stale_task_count, and staff_stats ...

@router.get("/tasks")
async def get_tasks(
    status: str = None,
    loai_doi_tuong: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    node_code: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from datetime import datetime
    now = datetime.now()
    
    query = db.query(ActionTask).options(
        joinedload(ActionTask.staff),
        joinedload(ActionTask.template)
    )
    
    role_name = (current_user.role.name if current_user.role else "").strip().upper()
    
    if role_name == "STAFF" and current_user.nhan_su_id:
        query = query.filter(ActionTask.staff_id == current_user.nhan_su_id)
    else:
        # Leader scoping
        scope_ids = ScopingService.get_effective_scope_ids(db, current_user, node_code)
        if scope_ids is not None:
            # Get staff IDs within scope
            staff_ids = [s.id for s in db.query(NhanSu.id).filter(NhanSu.point_id.in_(scope_ids)).all()]
            query = query.filter(ActionTask.staff_id.in_(staff_ids))
    
    if start_date and start_date.strip():
        query = query.filter(ActionTask.created_at >= start_date)
    if end_date and end_date.strip():
        query = query.filter(ActionTask.created_at <= f"{end_date} 23:59:59")
    
    if status:
        query = query.filter(ActionTask.trang_thai == status)
    
    if loai_doi_tuong:
        query = query.filter(ActionTask.loai_doi_tuong == loai_doi_tuong)
        
    query = query.order_by(desc(ActionTask.created_at))
    tasks = query.all()
    
    task_ids = [t.id for t in tasks]
    logs = db.query(TaskStateLog).options(joinedload(TaskStateLog.user)).filter(TaskStateLog.task_id.in_(task_ids)).all() if task_ids else []
    logs_by_task = {}
    for log in logs:
        if log.task_id not in logs_by_task:
            logs_by_task[log.task_id] = []
        logs_by_task[log.task_id].append(log)
    
    result = []
    for t in tasks:
        ten_kh = t.target_id
        if t.loai_doi_tuong == 'HienHuu':
            cus = db.query(Customer).filter(Customer.ma_crm_cms == t.target_id).first()
            if cus:
                ten_kh = f"{cus.ten_kh} ({t.target_id})"
        elif t.loai_doi_tuong == 'TiemNang':
            ten_kh = f"{t.target_id} (Vãng lai)"
        
        staff_name = t.staff.full_name if t.staff else "Chưa gán"
        
        upcoming_sla = SLAService.is_upcoming_sla(t, hours=24, now=now)
        
        t_logs = sorted(logs_by_task.get(t.id, []), key=lambda x: x.timestamp, reverse=True)
        last_activity_time = t_logs[0].timestamp if t_logs else (t.updated_at or t.created_at)
        
        # --- START WRAP SAFE SEMANTIC FIELDS ---
        assigner_name = "-"
        assigned_time_display = "-"
        last_activity_time_display = "-"
        task_age_seconds = 0
        stuck_duration_seconds = 0
        stale_days = 0
        assigned_time = t.created_at

        assign_logs = [log for log in t_logs if log.action_type in ['ASSIGN', 'ASSIGNED', 'ASSIGN_STAFF', 'REASSIGNED', 'DELEGATED', 'CREATE', 'AUTO_ASSIGN']]
        
        assigner_name_temp = None
        if assign_logs:
            latest_assign = assign_logs[0]
            assigned_time = latest_assign.timestamp
            if latest_assign.user:
                if getattr(latest_assign.user, "username", "") == "admin":
                    assigner_name_temp = "admin"
                else:
                    assigner_name_temp = latest_assign.user.full_name
        else:
            assigned_time = t.created_at

        # Fallbacks cho assigner_name
        if not assigner_name_temp:
            if getattr(t, "created_by", None):
                cb = getattr(t, "created_by")
                assigner_name_temp = getattr(cb, "full_name", None) or getattr(cb, "username", None)
            if not assigner_name_temp:
                assigner_name_temp = getattr(t, "created_by_name", None)
            if not assigner_name_temp:
                assigner_name_temp = "Hệ thống"
        
        assigner_name = assigner_name_temp

        task_age_seconds = max(0, (now - assigned_time).total_seconds()) if assigned_time else 0
        stuck_duration_seconds = max(0, (now - last_activity_time).total_seconds()) if last_activity_time else 0
        stale_days = stuck_duration_seconds / 86400
        
        # Display logic
        assigned_time_display = assigned_time.strftime("%H:%M %d/%m/%Y") if assigned_time else "-"
        
        if last_activity_time:
            if stuck_duration_seconds < 3600:
                last_activity_time_display = f"{int(max(1, stuck_duration_seconds/60))} phút trước"
            elif stuck_duration_seconds < 86400:
                last_activity_time_display = f"{int(stuck_duration_seconds/3600)} giờ trước"
            else:
                last_activity_time_display = last_activity_time.strftime("%H:%M %d/%m/%Y")
        # --- END WRAP SAFE ---

        result.append({
            "id": t.id,
            "target_id": t.target_id,
            "ten_kh_display": ten_kh,
            "loai_doi_tuong": t.loai_doi_tuong,
            "pipeline_stage": t.pipeline_stage,
            "phan_loai_giao_viec": t.phan_loai_giao_viec,
            "staff_id": t.staff_id,
            "staff_name": staff_name,
            "template_id": t.template_id,
            "tieu_de": t.template.tieu_de if t.template else "Giao việc thủ công",
            "noi_dung": t.noi_dung,
            "deadline": t.deadline.strftime("%Y-%m-%d %H:%M") if t.deadline else None,
            "overdue_at": t.overdue_at.strftime("%Y-%m-%d %H:%M") if t.overdue_at else None,
            "upcoming_sla": upcoming_sla,
            "stale_days": int(stale_days),
            "trang_thai": t.trang_thai,
            "verified": t.verified,
            "converted_ma_kh": t.converted_ma_kh,
            "cross_point_flag": t.cross_point_flag,
            "original_point_name": t.original_point.name if t.original_point else None,
            "original_staff_name": t.original_staff.full_name if t.original_staff else None,
            "bao_cao_ket_qua": t.bao_cao_ket_qua,
            "kenh_tiep_can": t.kenh_tiep_can,
            "ket_qua": t.ket_qua,
            "is_stale": t.trang_thai in ["Mới", "Đang xử lý", "CHỜ CHỈ ĐẠO"] and stuck_duration_seconds > 48 * 3600,
            "assigner_name": assigner_name,
            "assigned_time": assigned_time.strftime("%Y-%m-%d %H:%M") if assigned_time else None,
            "assigned_time_display": assigned_time_display,
            "last_activity_time": last_activity_time.strftime("%Y-%m-%d %H:%M") if last_activity_time else None,
            "last_activity_time_display": last_activity_time_display,
            "task_age_seconds": task_age_seconds,
            "stuck_duration_seconds": stuck_duration_seconds,
            "ngay_hoan_thanh": t.ngay_hoan_thanh.strftime("%Y-%m-%d %H:%M") if t.ngay_hoan_thanh else None,
            "created_at": t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else None
        })
        
    return {"items": result, "total": len(result)}

class ReportTaskPayload(BaseModel):
    trang_thai: str
    bao_cao_ket_qua: str
    pipeline_stage: Optional[str] = None
    kenh_tiep_can: Optional[str] = None
    ket_qua: Optional[str] = None
    converted_ma_kh: Optional[str] = None
    so_dien_thoai: Optional[str] = None
    dia_chi_chi_tiet: Optional[str] = None

@router.patch("/tasks/{task_id}/report")
async def report_task(
    request: Request,
    task_id: int, 
    payload: ReportTaskPayload, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    task = db.query(ActionTask).filter(ActionTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhiệm vụ")
        
    # Validation for STAFF: Only staff assigned to the task can report it
    role_name = current_user.role.name if current_user.role else ""
    if role_name == "STAFF":
        if task.staff_id != current_user.nhan_su_id:
            raise HTTPException(status_code=403, detail="Bạn không có quyền báo cáo cho nhiệm vụ này")
            
    # ENRICHMENT CHECK: Bắt buộc có SĐT hoặc Địa chỉ chi tiết khi lên B3
    if payload.pipeline_stage == "B3":
        # Tìm thông tin cũ trong PC table nếu chưa có trong payload
        from ..utils.normalization import normalize_name
        existing_pc = db.query(PotentialCustomer).filter(
            PotentialCustomer.ten_canonical == normalize_name(task.target_id),
            PotentialCustomer.point_id == (current_user.nhan_su.point_id if current_user.nhan_su else None)
        ).first()
        
        has_enrichment = payload.so_dien_thoai or payload.dia_chi_chi_tiet or (existing_pc and existing_pc.so_dien_thoai)
        if not has_enrichment:
            raise HTTPException(status_code=400, detail="Bắt buộc bổ sung SĐT hoặc Địa chỉ chi tiết để xác thực chuyển đổi B3")

    # STAGE-GATE SLA: Chỉ cập nhật updated_at khi có thay đổi Stage hoặc Status
    is_meaningful = (payload.trang_thai != task.trang_thai) or (payload.pipeline_stage and payload.pipeline_stage != task.pipeline_stage)
    
    old_status = task.trang_thai
    
    task.bao_cao_ket_qua = payload.bao_cao_ket_qua
    task.pipeline_stage = payload.pipeline_stage or task.pipeline_stage
    task.kenh_tiep_can = payload.kenh_tiep_can or task.kenh_tiep_can
    task.ket_qua = payload.ket_qua or task.ket_qua
    task.converted_ma_kh = payload.converted_ma_kh or task.converted_ma_kh
    
    # PENDING VERIFY RULE
    proposed_status = payload.trang_thai
    if proposed_status in ["Hoàn thành", "Thất bại"]:
        needs_verify = False
        
        # 1. overdue_at != null
        if task.overdue_at is not None:
            needs_verify = True
        # 2. VIP task
        elif task.phan_loai_giao_viec == "VIP" or task.loai_doi_tuong == "VIP":
            needs_verify = True
        # 3. report quá ngắn
        elif not payload.bao_cao_ket_qua or len(payload.bao_cao_ket_qua.strip()) < 20:
            needs_verify = True
        # 4. reopen >= 2 lần
        elif db.query(TaskStateLog).filter(TaskStateLog.task_id == task_id, TaskStateLog.new_status == "Đang xử lý").count() >= 2:
            needs_verify = True
        # 5. task thất bại
        elif proposed_status == "Thất bại":
            needs_verify = True
            
        if needs_verify:
            task.trang_thai = "PENDING_VERIFY"
            task.verified = False
        else:
            task.trang_thai = proposed_status
    else:
        task.trang_thai = proposed_status

    if is_meaningful:
        task.updated_at = datetime.now()

    # DATA ENRICHMENT: Lưu thông tin SĐT/Địa chỉ nếu có
    if task.loai_doi_tuong == "TiemNang" and (payload.so_dien_thoai or payload.dia_chi_chi_tiet):
        # Lấy point_id từ nhân sự được giao
        staff_node = db.query(NhanSu).filter(NhanSu.id == task.staff_id).first()
        if staff_node:
            PotentialService.enrich_potential_data(
                db=db,
                ten_kh=task.target_id,
                dia_chi_full="", # Chúng ta có thể lấy từ Transaction nếu cần, hoặc để trống
                point_id=staff_node.point_id,
                phone=payload.so_dien_thoai,
                detail_address=payload.dia_chi_chi_tiet
            )

    if payload.trang_thai in ["Hoàn thành", "Thất bại"]:
        task.ngay_hoan_thanh = datetime.now()
        
    # SEMANTIC PATCH: KHÔNG AUTO UNLOCK KHÁCH HÀNG KỂ CẢ KHI THẤT BẠI
    # Quyền thu hồi (Reassign) phụ thuộc vào Leader.
        
    db.commit()
    
    # Timeline Hook
    if old_status == "PENDING_VERIFY" and payload.trang_thai == "Đang xử lý":
        event_type = "REOPENED"
        reason = "Yêu cầu làm lại"
    elif old_status == "PENDING_VERIFY" and payload.trang_thai in ["Hoàn thành", "Thất bại"]:
        event_type = "VERIFIED"
        reason = "Đã duyệt báo cáo"
    else:
        event_type = "COMPLETED" if payload.trang_thai in ["Hoàn thành", "Thất bại"] else "REPORTED"
        reason = "Báo cáo tiến độ"

    evidence = build_timeline_payload(
        db=db,
        event_type=event_type,
        acted_by_user=current_user,
        action_source="ACTION_CENTER",
        from_staff_id=current_user.nhan_su_id,
        to_staff_id=current_user.nhan_su_id,
        previous_status=old_status,
        new_status=task.trang_thai,
        reason=reason,
        evidence_text=payload.bao_cao_ket_qua
    )
    state_log = TaskStateLog(
        task_id=task.id,
        previous_status=old_status,
        new_status=task.trang_thai,
        changed_by=current_user.id,
        action_type=event_type,
        reason=reason,
        evidence_snapshot_json=json.dumps(evidence, ensure_ascii=False)
    )
    db.add(state_log)
    db.commit()

    # Ghi Log Hệ thống
    LogService.log_action(
        db=db,
        user_id=current_user.id,
        action="REPORT_TASK",
        resource=task.loai_doi_tuong,
        details=f"Báo cáo kết quả Task ID {task_id}: {payload.trang_thai}. Nội dung: {payload.bao_cao_ket_qua[:100]}...",
        ip_address=request.client.host
    )
    
    return {"message": "Đã cập nhật báo cáo thành công", "status": task.trang_thai}

@router.post("/tasks/{task_id}/accept")
async def accept_task(
    request: Request,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(ActionTask).filter(ActionTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhiệm vụ")
    
    if current_user.nhan_su_id != task.staff_id:
        raise HTTPException(status_code=403, detail="Chỉ người đang chịu trách nhiệm nhiệm vụ này mới được thao tác.")
        
    old_status = task.trang_thai
    task.trang_thai = "Đang xử lý"
    task.updated_at = datetime.now()
    
    evidence = build_timeline_payload(
        db=db,
        event_type="ACCEPTED",
        acted_by_user=current_user,
        action_source="ACTION_CENTER",
        from_staff_id=current_user.nhan_su_id,
        to_staff_id=current_user.nhan_su_id,
        previous_status=old_status,
        new_status="Đang xử lý",
        reason="Nhận xử lý nhiệm vụ",
        evidence_text="Xác nhận nhận việc"
    )
    
    state_log = TaskStateLog(
        task_id=task.id,
        previous_status=old_status,
        new_status="Đang xử lý",
        changed_by=current_user.id,
        action_type="ACCEPTED",
        reason="Nhận xử lý",
        evidence_snapshot_json=json.dumps(evidence, ensure_ascii=False)
    )
    db.add(state_log)
    db.commit()
    
    LogService.log_action(
        db=db,
        user_id=current_user.id,
        action="ACCEPT_TASK",
        resource=task.loai_doi_tuong,
        details=f"Nhận xử lý Task ID {task_id}",
        ip_address=request.client.host
    )
    
    return {"message": "Đã nhận xử lý thành công", "status": "Đang xử lý"}

class ForwardTaskPayload(BaseModel):
    staff_id: int
    noi_dung: Optional[str] = None
    
@router.post("/tasks/{task_id}/forward")
async def forward_task(
    request: Request,
    task_id: int,
    payload: ForwardTaskPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # [SEMANTIC PATCH] FORWARD API ĐÃ BỊ XÓA BỎ HOÀN TOÀN
    raise HTTPException(status_code=410, detail="Tính năng Điều phối tiếp (Forward) đã bị xóa bỏ theo Hiến pháp. Chỉ Leader mới được phép Reassign.")

@router.patch("/tasks/{task_id}/reassign")
async def reassign_task(
    request: Request,
    task_id: int,
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(ActionTask).filter(ActionTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhiệm vụ")
    
    # Kiem tra quyen: Chi nguoi giao moi duoc reassign (Dua tren log assign)
    assign_log = db.query(TaskStateLog).filter(TaskStateLog.task_id == task.id, TaskStateLog.action_type == 'ASSIGN').first()
    if assign_log and assign_log.changed_by != current_user.id:
        if current_user.role and current_user.role.name not in ["ADMIN", "SYSTEM_ADMIN"]:
            raise HTTPException(status_code=403, detail="Chỉ người giao việc mới được quyền Reassign hoặc Thu hồi.")
            
    # --- CROSS-CENTER SCOPE LOCK ---
    from ..services.scoping_service import ScopingService
    user_scope_ids = ScopingService.get_effective_scope_ids(db, current_user)
    if user_scope_ids is not None:
        target_staff = db.query(NhanSu).filter(NhanSu.id == staff_id).first()
        if not target_staff or target_staff.point_id not in user_scope_ids:
            raise HTTPException(status_code=403, detail="Bạn không có quyền điều phối việc cho nhân sự thuộc trung tâm/nhánh khác.")
    
    old_staff_id = task.staff_id
    task.staff_id = staff_id
    
    # [SEMANTIC PATCH] REASSIGN là hành động DUY NHẤT đổi Owner Khách hàng
    if task.loai_doi_tuong == "HienHuu":
        customer = db.query(Customer).filter(Customer.ma_crm_cms == task.target_id).first()
        if customer:
            customer.assigned_staff_id = staff_id
    
    # Timeline Hook
    evidence = build_timeline_payload(
        db=db,
        event_type="REASSIGNED",
        acted_by_user=current_user,
        action_source="ACTION_CENTER",
        from_staff_id=old_staff_id,
        to_staff_id=staff_id,
        previous_status=task.trang_thai,
        new_status=task.trang_thai,
        reason="Điều phối lại nhân sự",
        evidence_text=f"Giao lại nhiệm vụ từ nhân sự ID {old_staff_id} sang ID {staff_id}"
    )
    state_log = TaskStateLog(
        task_id=task.id,
        previous_status=task.trang_thai,
        new_status=task.trang_thai,
        changed_by=current_user.id,
        action_type="REASSIGNED",
        reason="Điều phối lại nhân sự",
        evidence_snapshot_json=json.dumps(evidence, ensure_ascii=False)
    )
    db.add(state_log)
    db.commit()
    
    LogService.log_action(
        db=db,
        user_id=current_user.id,
        action="REASSIGN_TASK",
        resource=task.loai_doi_tuong,
        details=f"Giao lại Task ID {task_id} cho nhân sự ID {staff_id}",
        ip_address=request.client.host
    )
    return {"message": "Đã điều phối nhân sự thành công"}

class BulkActionPayload(BaseModel):
    task_ids: List[int]
    action: str  # ASSIGN, VERIFY, REJECT, COMPLETE
    staff_id: Optional[int] = None
    reason: Optional[str] = None

@router.post("/bulk")
async def bulk_actions(
    request: Request,
    payload: BulkActionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not payload.task_ids:
        raise HTTPException(status_code=400, detail="Không có task nào được chọn")

    from ..services.scoping_service import ScopingService
    user_scope_ids = ScopingService.get_effective_scope_ids(db, current_user)

    success_count = 0
    now = datetime.now()

    for task_id in payload.task_ids:
        task = db.query(ActionTask).filter(ActionTask.id == task_id).first()
        if not task:
            continue

        old_status = task.trang_thai

        if payload.action == "ASSIGN":
            if not payload.staff_id:
                continue
            # Scoping lock
            if user_scope_ids is not None:
                target_staff = db.query(NhanSu).filter(NhanSu.id == payload.staff_id).first()
                if not target_staff or target_staff.point_id not in user_scope_ids:
                    continue # Skip without raising error for bulk

            old_staff_id = task.staff_id
            task.staff_id = payload.staff_id
            
            if task.loai_doi_tuong == "HienHuu":
                customer = db.query(Customer).filter(Customer.ma_crm_cms == task.target_id).first()
                if customer:
                    customer.assigned_staff_id = payload.staff_id

            evidence = build_timeline_payload(
                db=db,
                event_type="REASSIGNED" if old_staff_id else "ASSIGN",
                acted_by_user=current_user,
                action_source="ACTION_CENTER",
                from_staff_id=old_staff_id,
                to_staff_id=payload.staff_id,
                previous_status=task.trang_thai,
                new_status=task.trang_thai,
                reason=payload.reason or "Điều phối hàng loạt",
                evidence_text=f"Giao nhiệm vụ cho nhân sự ID {payload.staff_id}"
            )
            state_log = TaskStateLog(
                task_id=task.id,
                previous_status=task.trang_thai,
                new_status=task.trang_thai,
                changed_by=current_user.id,
                action_type="REASSIGNED" if old_staff_id else "ASSIGN",
                reason=payload.reason or "Điều phối hàng loạt",
                evidence_snapshot_json=json.dumps(evidence, ensure_ascii=False)
            )
            db.add(state_log)
            success_count += 1

        elif payload.action == "VERIFY":
            if old_status != "PENDING_VERIFY":
                continue
            task.trang_thai = "Hoàn thành"
            task.updated_at = now
            task.ngay_hoan_thanh = now
            
            evidence = build_timeline_payload(
                db=db, event_type="VERIFIED", acted_by_user=current_user, action_source="ACTION_CENTER",
                from_staff_id=task.staff_id, to_staff_id=task.staff_id,
                previous_status=old_status, new_status="Hoàn thành",
                reason=payload.reason or "Duyệt nhanh hàng loạt", evidence_text="Duyệt nhanh"
            )
            db.add(TaskStateLog(
                task_id=task.id, previous_status=old_status, new_status="Hoàn thành",
                changed_by=current_user.id, action_type="VERIFIED", reason=payload.reason or "Duyệt nhanh",
                evidence_snapshot_json=json.dumps(evidence, ensure_ascii=False)
            ))
            success_count += 1

        elif payload.action == "REJECT":
            if old_status != "PENDING_VERIFY":
                continue
            task.trang_thai = "Đang xử lý"
            task.updated_at = now
            
            evidence = build_timeline_payload(
                db=db, event_type="REOPENED", acted_by_user=current_user, action_source="ACTION_CENTER",
                from_staff_id=task.staff_id, to_staff_id=task.staff_id,
                previous_status=old_status, new_status="Đang xử lý",
                reason=payload.reason or "Từ chối hàng loạt", evidence_text="Yêu cầu làm lại"
            )
            db.add(TaskStateLog(
                task_id=task.id, previous_status=old_status, new_status="Đang xử lý",
                changed_by=current_user.id, action_type="REOPENED", reason=payload.reason or "Từ chối",
                evidence_snapshot_json=json.dumps(evidence, ensure_ascii=False)
            ))
            success_count += 1

        elif payload.action == "COMPLETE":
            if old_status != "Đang xử lý":
                continue
            task.trang_thai = "Hoàn thành"
            task.updated_at = now
            task.ngay_hoan_thanh = now
            
            evidence = build_timeline_payload(
                db=db, event_type="COMPLETED", acted_by_user=current_user, action_source="ACTION_CENTER",
                from_staff_id=current_user.nhan_su_id, to_staff_id=current_user.nhan_su_id,
                previous_status=old_status, new_status="Hoàn thành",
                reason=payload.reason or "Hoàn thành nhanh", evidence_text="Báo cáo hoàn thành hàng loạt"
            )
            db.add(TaskStateLog(
                task_id=task.id, previous_status=old_status, new_status="Hoàn thành",
                changed_by=current_user.id, action_type="COMPLETED", reason=payload.reason or "Hoàn thành nhanh",
                evidence_snapshot_json=json.dumps(evidence, ensure_ascii=False)
            ))
            success_count += 1

    db.commit()

    LogService.log_action(
        db=db, user_id=current_user.id, action="BULK_ACTION", resource="ActionTask",
        details=f"Bulk {payload.action} on {len(payload.task_ids)} tasks (Success: {success_count})",
        ip_address=request.client.host
    )
    return {"message": f"Thao tác thành công {success_count}/{len(payload.task_ids)} nhiệm vụ."}


@router.get("/summary")
async def get_action_summary(
    start_date: str = Query(None),
    end_date: str = Query(None),
    loai_doi_tuong: Optional[str] = None,
    node_code: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    now = datetime.now()
    query = db.query(ActionTask).options(joinedload(ActionTask.staff))
    
    role_name = (current_user.role.name if current_user.role else "").strip().upper()
    if role_name == "STAFF" and current_user.nhan_su_id:
        query = query.filter(ActionTask.staff_id == current_user.nhan_su_id)
    else:
        # Leader scoping
        scope_ids = ScopingService.get_effective_scope_ids(db, current_user, node_code)
        if scope_ids is not None:
            staff_ids = [s.id for s in db.query(NhanSu.id).filter(NhanSu.point_id.in_(scope_ids)).all()]
            query = query.filter(ActionTask.staff_id.in_(staff_ids))
        
    if start_date and start_date.strip():
        query = query.filter(ActionTask.created_at >= start_date)
    if end_date and end_date.strip():
        query = query.filter(ActionTask.created_at <= f"{end_date} 23:59:59")
    
    if loai_doi_tuong:
        query = query.filter(ActionTask.loai_doi_tuong == loai_doi_tuong)
        
    tasks = query.all()
    
    task_ids = [t.id for t in tasks]
    logs = db.query(TaskStateLog).filter(TaskStateLog.task_id.in_(task_ids)).all() if task_ids else []
    logs_by_task = {}
    for log in logs:
        if log.task_id not in logs_by_task:
            logs_by_task[log.task_id] = []
        logs_by_task[log.task_id].append(log)
    
    staff_map = {}
    upcoming_count = 0
    stale_count = 0
    vip_overdue_count = 0
    global_overdue_count = 0
    
    for t in tasks:
        if SLAService.is_task_active(t):
            if SLAService.is_upcoming_sla(t, hours=24, now=now):
                upcoming_count += 1
                
            t_logs = sorted(logs_by_task.get(t.id, []), key=lambda x: x.timestamp, reverse=True)
            last_activity_time = t_logs[0].timestamp if t_logs else (t.updated_at or t.created_at)
            
            is_stuck = (now - last_activity_time).total_seconds() > 48 * 3600
            if is_stuck:
                stale_count += 1
            
            is_ov = SLAService.is_overdue(t, now=now)
            if is_ov:
                global_overdue_count += 1
                if (t.phan_loai_giao_viec == "VIP" or t.loai_doi_tuong == "VIP"):
                    vip_overdue_count += 1
            
            s_name = t.staff.full_name if t.staff else "Chưa gán"
            if s_name not in staff_map:
                staff_map[s_name] = {"pending": 0, "overdue": 0, "stuck": 0}
            staff_map[s_name]["pending"] += 1
            
            if is_stuck:
                staff_map[s_name]["stuck"] += 1
            
            if is_ov:
                staff_map[s_name]["overdue"] += 1

    staff_stats = []
    for s_name, data in staff_map.items():
        staff_stats.append({
            "staff_name": s_name,
            "pending": data["pending"],
            "overdue": data["overdue"],
            "stuck": data["stuck"],
            "severity_score": data["overdue"] * 2 + data["stuck"]
        })
    
    staff_stats.sort(key=lambda x: x["severity_score"], reverse=True)

    stats = {
        "total": len(tasks),
        "new": sum(1 for t in tasks if t.trang_thai == "Mới"),
        "processing": sum(1 for t in tasks if t.trang_thai == "Đang xử lý"),
        "waiting_direction": sum(1 for t in tasks if t.trang_thai == "CHỜ CHỈ ĐẠO"),
        "pending_verify": sum(1 for t in tasks if t.trang_thai == "PENDING_VERIFY"),
        "completed": sum(1 for t in tasks if t.trang_thai == "Hoàn thành"),
        "completed_today": sum(1 for t in tasks if t.trang_thai == "Hoàn thành" and t.ngay_hoan_thanh and t.ngay_hoan_thanh.date() == now.date()),
        "failed": sum(1 for t in tasks if t.trang_thai == "Thất bại"),
        "cancelled": sum(1 for t in tasks if t.trang_thai == "Hủy"),
        "overdue_count": global_overdue_count,
        "overdue_rate": round((global_overdue_count / len(tasks)) * 100, 2) if tasks else 0,
        "upcoming_overdue_count": upcoming_count,
        "stale_task_count": stale_count,
        "vip_overdue_count": vip_overdue_count,
        "staff_stats": staff_stats[:5] # Top 5 staff có nhiều backlog/overdue nhất
    }
    return stats

class EscalatePayload(BaseModel):
    target_id: str
    loai_doi_tuong: str  # HienHuu hoặc TiemNang
    reason: str

@router.post("/escalate")
async def escalate_to_cluster(
    request: Request,
    payload: EscalatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Báo cáo Leader xin hướng xử lý - KHÔNG tạo task mới, giữ nguyên Owner."""
    # Tìm task hiện tại của nhân viên
    task = db.query(ActionTask).filter(
        ActionTask.target_id == payload.target_id,
        ActionTask.loai_doi_tuong == payload.loai_doi_tuong,
        ActionTask.staff_id == current_user.nhan_su_id,
        ActionTask.trang_thai.in_(["Mới", "Đang xử lý"])
    ).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhiệm vụ hiện tại để xin chỉ đạo")
        
    old_status = task.trang_thai
    task.trang_thai = "CHỜ CHỈ ĐẠO"
    task.updated_at = datetime.now()
    
    # Nội dung xin chỉ đạo
    escalation_content = f"🚨 YÊU CẦU CHỈ ĐẠO: {payload.reason}"
    
    # Timeline Hook
    evidence = {
        "event_type": "TASK_ESCALATED",
        "action_by": current_user.full_name or "System",
        "previous_status": old_status,
        "new_status": "CHỜ CHỈ ĐẠO",
        "created_at": datetime.now().isoformat(),
        "reason": payload.reason,
        "evidence_text": escalation_content
    }
    state_log = TaskStateLog(
        task_id=task.id,
        previous_status=old_status,
        new_status="CHỜ CHỈ ĐẠO",
        changed_by=current_user.id,
        action_type="ESCALATE",
        reason=payload.reason,
        evidence_snapshot_json=json.dumps(evidence, ensure_ascii=False)
    )
    db.add(state_log)
    db.commit()

    # Ghi Log Hệ thống
    LogService.log_action(
        db=db,
        user_id=current_user.id,
        action="ESCALATE_TASK",
        resource=payload.loai_doi_tuong,
        details=f"Yêu cầu chỉ đạo cho Task ID {task.id}. Lý do: {payload.reason[:100]}...",
        ip_address=request.client.host
    )
    
    return {
        "message": "Đã gửi yêu cầu xin chỉ đạo lên Leader",
        "task_id": task.id
    }

@router.post("/{task_id}/overdue")
async def mark_task_overdue(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Đánh dấu nhiệm vụ quá hạn (OVERDUE) và gửi cảnh báo đỏ theo luật 7 ngày."""
    task = db.query(ActionTask).filter(ActionTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhiệm vụ")
    
    if task.trang_thai in ["Hoàn thành", "Thất bại", "Hủy"]:
        raise HTTPException(status_code=400, detail="Trạng thái hiện tại không thể đánh dấu quá hạn")
        
    # Không update trang_thai thành OVERDUE, chỉ ghi nhận overdue_at
    if not task.overdue_at:
        task.overdue_at = datetime.now()
    
    # Timeline Hook
    evidence = {
        "event_type": "TASK_OVERDUE",
        "action_by": "System Engine",
        "previous_status": task.trang_thai,
        "new_status": task.trang_thai,
        "created_at": datetime.now().isoformat(),
        "reason": "Quá 7 ngày không cập nhật",
        "evidence_text": "Hệ thống tự động đánh dấu quá hạn và gửi cảnh báo đỏ cho người giao việc"
    }
    state_log = TaskStateLog(
        task_id=task.id,
        previous_status=task.trang_thai,
        new_status=task.trang_thai,
        changed_by=None,
        action_type="OVERDUE",
        reason="Quá 7 ngày",
        evidence_snapshot_json=json.dumps(evidence, ensure_ascii=False)
    )
    db.add(state_log)
    db.commit()
    
    return {"message": "Đã chuyển nhiệm vụ sang trạng thái OVERDUE an toàn"}

@router.get("/{task_id}/timeline")
async def get_task_timeline(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy danh sách sự kiện timeline (TaskStateLog) của một task cụ thể."""
    task = db.query(ActionTask).filter(ActionTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhiệm vụ")

    logs = db.query(TaskStateLog).filter(TaskStateLog.task_id == task_id).order_by(TaskStateLog.created_at.asc()).all()
    
    timeline = []
    for log in logs:
        evidence = {}
        if log.evidence_snapshot_json:
            try:
                evidence = json.loads(log.evidence_snapshot_json)
            except:
                pass
                
        # Nếu chưa có JSON, build một fallback evidence dựa trên log
        if not evidence:
            evidence = {
                "event_type": "UNKNOWN",
                "action_by": "Hệ thống",
                "previous_status": log.previous_status,
                "new_status": log.new_status,
                "created_at": log.created_at.isoformat(),
                "reason": log.reason or "",
                "evidence_text": "Bản ghi cũ không có JSON"
            }
            
        timeline.append(evidence)
        
    return timeline

@router.get("/history/{target_id}")
async def get_task_history(
    target_id: str,
    loai_doi_tuong: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy toàn bộ lịch sử tương tác (Tasks) của một khách hàng."""
    query = db.query(ActionTask).options(
        joinedload(ActionTask.staff)
    ).filter(ActionTask.target_id == target_id)
    
    if loai_doi_tuong:
        query = query.filter(ActionTask.loai_doi_tuong == loai_doi_tuong)
        
    tasks = query.order_by(desc(ActionTask.created_at)).all()
    
    history = []
    for t in tasks:
        history.append({
            "id": t.id,
            "created_at": t.created_at.strftime("%Y-%m-%d %H:%M"),
            "staff_name": t.staff.full_name if t.staff else "BOT / Hệ thống",
            "phan_loai": t.phan_loai_giao_viec,
            "tieu_de": t.template.tieu_de if t.template else "Giao việc thủ công",
            "noi_dung": t.noi_dung,
            "trang_thai": t.trang_thai,
            "bao_cao": t.bao_cao_ket_qua,
            "ngay_hoan_thanh": t.ngay_hoan_thanh.strftime("%Y-%m-%d %H:%M") if t.ngay_hoan_thanh else None
        })
        
    return history
