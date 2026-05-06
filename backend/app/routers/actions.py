from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, desc
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from ..database import get_db
from ..models import ActionTask, ActionTaskTemplate, User, NhanSu, Customer, Transaction, HierarchyNode
from ..routers.auth import get_current_user
from ..services.potential_service import PotentialService
from ..services.scoping_service import ScopingService
from ..services.log_service import LogService
from fastapi import Request

router = APIRouter(prefix="/api/actions", tags=["actions"])

@router.get("/templates")
async def get_templates(
    loai_doi_tuong: str = None, 
    nhom_kh: str = None, 
    db: Session = Depends(get_db)
):
    query = db.query(ActionTaskTemplate)
    if loai_doi_tuong:
        query = query.filter(ActionTaskTemplate.loai_doi_tuong == loai_doi_tuong)
    if nhom_kh:
        query = query.filter(ActionTaskTemplate.nhom_kh == nhom_kh)
        
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
    
    # Ghi Log
    LogService.log_action(
        db=db,
        user_id=current_user.id,
        action="ASSIGN_TASK",
        resource=payload.loai_doi_tuong,
        details=f"Giao việc cho nhân sự ID {payload.staff_id} tiếp cận {payload.target_id}. Nội dung: {payload.noi_dung[:100]}...",
        ip_address=request.client.host
    )
    
    return {"message": "Đã tạo task thành công", "task_id": new_task.id}

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
    
    if start_date:
        query = query.filter(ActionTask.created_at >= start_date)
    if end_date:
        query = query.filter(ActionTask.created_at <= f"{end_date} 23:59:59")
    
    if status:
        query = query.filter(ActionTask.trang_thai == status)
    
    if loai_doi_tuong:
        query = query.filter(ActionTask.loai_doi_tuong == loai_doi_tuong)
        
    query = query.order_by(desc(ActionTask.created_at))
    tasks = query.all()
    
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
            "trang_thai": t.trang_thai,
            "verified": t.verified,
            "converted_ma_kh": t.converted_ma_kh,
            "cross_point_flag": t.cross_point_flag,
            "original_point_name": t.original_point.name if t.original_point else None,
            "original_staff_name": t.original_staff.full_name if t.original_staff else None,
            "bao_cao_ket_qua": t.bao_cao_ket_qua,
            "kenh_tiep_can": t.kenh_tiep_can,
            "ket_qua": t.ket_qua,
            "is_stale": (datetime.now() - (t.updated_at or t.created_at)).total_seconds() > 432000 if t.trang_thai in ["Mới", "Đang xử lý"] else False, # 5 days
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
    
    task.trang_thai = payload.trang_thai
    task.bao_cao_ket_qua = payload.bao_cao_ket_qua
    task.pipeline_stage = payload.pipeline_stage or task.pipeline_stage
    task.kenh_tiep_can = payload.kenh_tiep_can or task.kenh_tiep_can
    task.ket_qua = payload.ket_qua or task.ket_qua
    task.converted_ma_kh = payload.converted_ma_kh or task.converted_ma_kh
    
    # Nếu là B3 -> Chuyển sang chờ xác thực giao dịch
    if payload.pipeline_stage == "B3":
        task.trang_thai = "PENDING_VERIFY"
        task.verified = False

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
        
    # MỞ KHÓA (Unlock): Nếu task Thất bại hoặc Hủy -> Giải phóng khách hàng
    if payload.trang_thai in ["Thất bại", "Hủy"] and task.loai_doi_tuong == "KhachHang":
        customer = db.query(Customer).filter(Customer.ma_crm_cms == task.target_id).first()
        if customer:
            customer.assigned_staff_id = None
        
    db.commit()
    
    # Ghi Log
    LogService.log_action(
        db=db,
        user_id=current_user.id,
        action="REPORT_TASK",
        resource=task.loai_doi_tuong,
        details=f"Báo cáo kết quả Task ID {task_id}: {payload.trang_thai}. Nội dung: {payload.bao_cao_ket_qua[:100]}...",
        ip_address=request.client.host
    )
    
    return {"message": "Đã cập nhật báo cáo thành công", "status": task.trang_thai}

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
        
    task.staff_id = staff_id
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

@router.get("/summary")
async def get_action_summary(
    start_date: str = Query(None),
    end_date: str = Query(None),
    loai_doi_tuong: Optional[str] = None,
    node_code: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ActionTask)
    
    role_name = (current_user.role.name if current_user.role else "").strip().upper()
    if role_name == "STAFF" and current_user.nhan_su_id:
        query = query.filter(ActionTask.staff_id == current_user.nhan_su_id)
    else:
        # Leader scoping
        scope_ids = ScopingService.get_effective_scope_ids(db, current_user, node_code)
        if scope_ids is not None:
            staff_ids = [s.id for s in db.query(NhanSu.id).filter(NhanSu.point_id.in_(scope_ids)).all()]
            query = query.filter(ActionTask.staff_id.in_(staff_ids))
        
    if start_date:
        query = query.filter(ActionTask.created_at >= start_date)
    if end_date:
        query = query.filter(ActionTask.created_at <= end_date)
    
    if loai_doi_tuong:
        query = query.filter(ActionTask.loai_doi_tuong == loai_doi_tuong)
        
    tasks = query.all()
    
    stats = {
        "total": len(tasks),
        "new": sum(1 for t in tasks if t.trang_thai == "Mới"),
        "processing": sum(1 for t in tasks if t.trang_thai == "Đang xử lý"),
        "completed": sum(1 for t in tasks if t.trang_thai == "Hoàn thành"),
        "failed": sum(1 for t in tasks if t.trang_thai == "Thất bại"),
        "cancelled": sum(1 for t in tasks if t.trang_thai == "Hủy"),
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
    """GĐ Bưu điện P/X trả KH về Cụm — tạo thêm task hỗ trợ cho Trưởng Cụm."""
    from ..models import HierarchyNode, Role
    
    # Kiểm tra quyền: chỉ UNIT_HEAD mới được escalate
    role_name = current_user.role.name if current_user.role else ""
    if role_name != "UNIT_HEAD":
        raise HTTPException(status_code=403, detail="Chỉ GĐ Bưu điện P/X mới có quyền trả KH về Cụm")
    
    # Tìm WARD hiện tại của user
    user_point_id = None
    if current_user.nhan_su_id:
        ns = db.query(NhanSu).filter(NhanSu.id == current_user.nhan_su_id).first()
        if ns:
            user_point_id = ns.point_id
    
    if not user_point_id:
        raise HTTPException(status_code=400, detail="Không xác định được điểm giao dịch của bạn")
    
    # Leo cây: Point → WARD → CLUSTER
    curr = db.query(HierarchyNode).filter(HierarchyNode.id == user_point_id).first()
    cluster_node = None
    ward_name = ""
    while curr:
        if curr.type == 'WARD':
            ward_name = curr.name
        if curr.type == 'CLUSTER':
            cluster_node = curr
            break
        if curr.parent_id:
            curr = db.query(HierarchyNode).filter(HierarchyNode.id == curr.parent_id).first()
        else:
            break
    
    if not cluster_node:
        raise HTTPException(status_code=400, detail="Không tìm thấy Cụm quản lý")
    
    # Tìm Trưởng Cụm: user có scope_node_id = cluster_node.id hoặc role = REP_LEADER
    cluster_leader_user = db.query(User).filter(
        User.scope_node_id == cluster_node.id
    ).first()
    
    cluster_leader_ns_id = None
    cluster_leader_name = "Trưởng Cụm"
    if cluster_leader_user and cluster_leader_user.nhan_su_id:
        cluster_leader_ns_id = cluster_leader_user.nhan_su_id
        leader_ns = db.query(NhanSu).filter(NhanSu.id == cluster_leader_user.nhan_su_id).first()
        if leader_ns:
            cluster_leader_name = leader_ns.full_name
    
    # Nội dung task escalation
    escalation_content = (
        f"🚨 YÊU CẦU HỖ TRỢ TỪ {ward_name}\n\n"
        f"Người yêu cầu: {current_user.full_name}\n"
        f"Đối tượng: {payload.target_id} ({payload.loai_doi_tuong})\n"
        f"Lý do: {payload.reason}\n\n"
        f"Vui lòng điều phối giao KH này cho Bưu điện P/X khác trong Cụm."
    )
    
    # Tạo task escalation (task cũ giữ nguyên)
    new_task = ActionTask(
        target_id=payload.target_id,
        loai_doi_tuong=payload.loai_doi_tuong,
        staff_id=cluster_leader_ns_id,
        noi_dung=escalation_content,
        trang_thai="Escalation"
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    
    # Ghi Log
    LogService.log_action(
        db=db,
        user_id=current_user.id,
        action="ESCALATE_TASK",
        resource=payload.loai_doi_tuong,
        details=f"Yêu cầu hỗ trợ lên Cụm cho khách hàng {payload.target_id}. Lý do: {payload.reason[:100]}...",
        ip_address=request.client.host
    )
    
    return {
        "message": f"Đã gửi yêu cầu hỗ trợ lên {cluster_leader_name} ({cluster_node.name})",
        "task_id": new_task.id
    }

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
