from fastapi import APIRouter, Depends, HTTPException, Query, status, File, UploadFile, Request
from fastapi.responses import StreamingResponse
import io
import pandas as pd
from ..services.log_service import LogService
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_
from typing import List, Optional
from pydantic import BaseModel
from ..database import get_db
from ..models import NhanSu, HierarchyNode, User
from ..services.hierarchy_service import HierarchyService
from ..auth.permissions import check_permission
from ..routers.auth import get_current_user
from ..services.scoping_service import ScopingService
from ..core.security import get_password_hash

router = APIRouter(prefix="/api/admin/personnel", tags=["admin-personnel"])
users_router = APIRouter(prefix="/api/users", tags=["users"])

class NhanSuCreate(BaseModel):
    hr_id: str
    full_name: str
    username_app: Optional[str] = None
    point_id: Optional[int] = None
    chuc_vu: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

class NhanSuUpdate(BaseModel):
    full_name: Optional[str] = None
    username_app: Optional[str] = None
    point_id: Optional[int] = None
    chuc_vu: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

def serialize_staff_row(db: Session, staff: NhanSu):
    user = db.query(User).filter(User.nhan_su_id == staff.id).first()
    node = db.query(HierarchyNode).filter(HierarchyNode.id == staff.point_id).first() if staff.point_id else None
    return {
        "id": staff.id,
        "hr_id": staff.hr_id,
        "full_name": staff.full_name,
        "username_app": staff.username_app,
        "chuc_vu": staff.chuc_vu,
        "point_id": staff.point_id,
        "point_name": node.name if node else "Chưa gán",
        "email": staff.email,
        "phone": staff.phone,
        "is_active": user.is_active if user else False,
        "has_account": True if user else False,
        "user_id": user.id if user else None
    }

def normalize_code(value):
    if value is None:
        return None
    value = str(value).strip()
    if value.endswith(".0"):
        value = value[:-2]
    return value

def get_scope_codes_for_node(db: Session, node_id: int, include_children: bool):
    scope_ids = HierarchyService.get_descendant_ids_by_id(db, node_id, include_children=include_children)
    if not scope_ids:
        return None, [], []

    scope_nodes = db.query(HierarchyNode).filter(HierarchyNode.id.in_(scope_ids)).all()
    node_map = {node.id: node for node in scope_nodes}
    root_node = node_map.get(node_id)
    if not root_node:
        return None, [], []

    ward_codes = [normalize_code(node.code) for node in scope_nodes if node.type == "WARD" and normalize_code(node.code)]
    point_codes = [normalize_code(node.code) for node in scope_nodes if node.type == "POINT" and normalize_code(node.code)]
    return root_node, ward_codes, point_codes

@router.get("/staff", response_model=List[dict])
async def get_staff(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_staff")
    
    # Elite Scoping 3.0
    query = db.query(NhanSu)
    query = ScopingService.apply_scope_filter(query, NhanSu, db, current_user)
    
    staff = query.all()
    return [serialize_staff_row(db, s) for s in staff]

@users_router.get("/staff", response_model=List[dict])
async def get_users_staff(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy danh sách nhân sự trong phạm vi (Dùng cho giao việc, không cần quyền quản lý)"""
    query = db.query(NhanSu)
    query = ScopingService.apply_scope_filter(query, NhanSu, db, current_user)
    staff = query.all()
    
    return [{
        "id": s.id,
        "hr_id": s.hr_id,
        "full_name": s.full_name,
        "chuc_vu": s.chuc_vu,
        "username_app": s.username_app
    } for s in staff]

@users_router.get("/by-node", response_model=List[dict])
async def get_users_by_node(
    node_id: int = Query(..., description="Hierarchy node ID"),
    include_children: bool = Query(False, description="Include descendant nodes"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_staff")
    # Lấy danh sách ID các node
    scope_ids = HierarchyService.get_descendant_ids_by_id(db, node_id, include_children=include_children)
    
    if not scope_ids:
        return []

    # Lọc nhân sự với joinedload
    staff_list = db.query(NhanSu).options(
        joinedload(NhanSu.point)
    ).filter(NhanSu.point_id.in_(scope_ids)).all()
    
    # Pre-fetch users for mapping with roles and scope nodes
    staff_ids = [s.id for s in staff_list]
    users = db.query(User).options(
        joinedload(User.role),
        joinedload(User.scope_node)
    ).filter(User.nhan_su_id.in_(staff_ids)).all()
    user_map = {u.nhan_su_id: u for u in users}
    
    result = []
    for s in staff_list:
        u = user_map.get(s.id)
        result.append({
            "id": s.id,
            "hr_id": s.hr_id,
            "full_name": s.full_name,
            "username_app": s.username_app,
            "chuc_vu": s.chuc_vu,
            "point_id": s.point_id,
            "point_name": s.point.name if s.point else "Chưa gán",
            "email": s.email,
            "phone": s.phone,
            "is_active": u.is_active if u else False,
            "has_account": True if u else False,
            "username": u.username if u else None,
            "user_id": u.id if u else None,
            "role_id": u.role_id if u else None,
            "role_name": u.role.name if u and u.role else "Chưa gán",
            "scope_node_id": u.scope_node_id if u else None,
            "scope_node_name": u.scope_node.name if u and u.scope_node else "Toàn tỉnh"
        })
    return result

@router.post("/staff/{staff_id}/toggle-active")
async def toggle_staff_active(
    staff_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_staff")
    user = db.query(User).filter(User.nhan_su_id == staff_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Nhân sự này chưa có tài khoản hệ thống")
    
    user.is_active = not user.is_active
    db.commit()
    return {"is_active": user.is_active}

@router.post("/staff")
async def create_staff(
    staff_in: NhanSuCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_staff")
    existing = db.query(NhanSu).filter(NhanSu.hr_id == staff_in.hr_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Mã nhân viên đã tồn tại")
    
    new_staff = NhanSu(
        hr_id=staff_in.hr_id,
        full_name=staff_in.full_name,
        username_app=staff_in.username_app,
        point_id=staff_in.point_id,
        chuc_vu=staff_in.chuc_vu,
        email=staff_in.email,
        phone=staff_in.phone
    )
    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)
    return new_staff

@router.patch("/staff/{staff_id}")
async def update_staff(
    staff_id: int, 
    staff_in: NhanSuUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_staff")
    staff = db.query(NhanSu).filter(NhanSu.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên")
    
    update_data = staff_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(staff, key, value)
        
    db.commit()
    db.refresh(staff)
    return staff

@router.delete("/staff/{staff_id}")
async def delete_staff(
    staff_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_staff")
    staff = db.query(NhanSu).filter(NhanSu.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên")
    
    # Check if linked to user
    user = db.query(User).filter(User.nhan_su_id == staff_id).first()
    if user:
        raise HTTPException(status_code=400, detail="Nhân viên đang liên kết với tài khoản người dùng, không thể xóa")
        
    db.delete(staff)
    db.commit()
    return {"message": "Đã xóa thành công"}

@router.get("/mapping/unlinked-usernames")
async def get_unlinked_usernames(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_staff")
    """Lấy danh sách các username trong giao dịch chưa được map với nhân sự nào"""
    from ..models import Transaction
    from sqlalchemy import distinct
    
    # Lay tat ca username tu transaction
    all_usernames = db.query(distinct(Transaction.username)).filter(Transaction.username.isnot(None)).all()
    all_usernames = [u[0] for u in all_usernames]
    
    # Lay các username đã được map
    mapped_usernames = db.query(NhanSu.username_app).filter(NhanSu.username_app.isnot(None)).all()
    mapped_usernames = [u[0] for u in mapped_usernames]
    
    unlinked = [u for u in all_usernames if u not in mapped_usernames]
    return unlinked

@router.get("/export-excel")
async def export_staff_excel(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_staff")
    try:
        # Sử dụng joinedload để tránh N+1 queries
        staff_list = db.query(NhanSu).options(
            joinedload(NhanSu.point)
        ).all()
        
        # Lấy map user để tra cứu nhanh
        users = db.query(User).all()
        user_map = {u.nhan_su_id: u.is_active for u in users if u.nhan_su_id}
        
        data = []
        for s in staff_list:
            node = s.point
            is_active = user_map.get(s.id, 0)
            
            data.append({
                "Ma_NS": s.hr_id,
                "Ho_ten": s.full_name,
                "Chuc_vu": s.chuc_vu,
                "Username_App": s.username_app or "",
                "Ma_Don_Vi": s.ma_don_vi or "",
                "Ma_BC": s.ma_bc or "",
                "Ma_Hierarchy": node.code if node else "",
                "Ten_Don_Vi": node.name if node else "Chưa gán",
                "Trang_Thai": 1 if is_active else 0
            })
        
        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='NhanSu')
        output.seek(0)
        
        headers = {
            'Content-Disposition': 'attachment; filename="NhanSu_Mapping.xlsx"',
            'Access-Control-Expose-Headers': 'Content-Disposition'
        }
        return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    except Exception as e:
        print(f"Error in export_excel: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/import-excel")
async def import_staff_excel(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_staff")
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents), dtype={'Ma_NS': str, 'Ma_Hierarchy': str})
        
        # Mapping hierarchy
        nodes = db.query(HierarchyNode).all()
        node_map = {str(n.code).replace('.0', '').strip(): n.id for n in nodes}
        
        updated = 0
        created = 0
        
        for _, row in df.iterrows():
            ma_ns = str(row.get('Ma_NS', '')).strip()
            if not ma_ns or ma_ns == 'nan': continue
            
            ho_ten = row.get('Ho_ten', '')
            chuc_vu = row.get('Chuc_vu', '')
            username_app = row.get('Username_App', '')
            ma_hierarchy = str(row.get('Ma_Hierarchy', '')).replace('.0', '').strip()
            trang_thai = int(row.get('Trang_Thai', 0))
            
            p_id = node_map.get(ma_hierarchy)
            
            staff = db.query(NhanSu).filter(NhanSu.hr_id == ma_ns).first()
            if staff:
                staff.full_name = ho_ten
                staff.chuc_vu = chuc_vu
                staff.username_app = username_app
                staff.point_id = p_id
                updated += 1
            else:
                staff = NhanSu(
                    hr_id=ma_ns,
                    full_name=ho_ten,
                    chuc_vu=chuc_vu,
                    username_app=username_app,
                    point_id=p_id
                )
                db.add(staff)
                db.flush()
                created += 1
            
            # 3. Automated Role & Scope Mapping (Elite RBAC 3.0)
            # Cơ chế Priority Mapping: Ưu tiên gán quyền cao nhất nếu kiêm nhiệm nhiều chức danh
            role_id = 5 # Mặc định là STAFF
            scope_id = p_id # Mặc định theo mã đơn vị của nhân sự
            chuc_vu_upper = str(chuc_vu).upper()
            
            # --- Tầng 1: Xác định ROLE (Quyền chức năng) ---
            # Lãnh đạo (không phải Admin hệ thống) luôn gán Role MANAGER (ID 2)
            if any(k in chuc_vu_upper for k in ["LÃNH ĐẠO", "GIÁM ĐỐC", "PHÓ GIÁM ĐỐC", "TRƯỞNG CỤM", "TRƯỞNG ĐẠI DIỆN", "QUẢN LÝ"]):
                # Kiểm tra loại trừ: Nếu là Giám đốc xã thì chỉ là LEADER (ID 3)
                if "XÃ" in chuc_vu_upper or "PHƯỜNG" in chuc_vu_upper or "GĐX" in chuc_vu_upper:
                    role_id = 3
                else:
                    role_id = 2 # Cấp Quản lý/Lãnh đạo
            elif any(k in chuc_vu_upper for k in ["TRƯỞNG BƯU CỤC", "TRƯỞNG CỤC"]):
                role_id = 4 # UNIT_HEAD
            
            # --- Tầng 2: Xác định SCOPE (Phạm vi dữ liệu) ---
            # Đặc cách cho Lãnh đạo cấp cao để "Khóa bộ lọc" theo trục
            if role_id == 2:
                if "BĐTP" in chuc_vu_upper or "TỈNH" in chuc_vu_upper:
                    scope_id = 1 # Toàn tỉnh (ROOT)
                elif "TTKD" in chuc_vu_upper or "KINH DOANH" in chuc_vu_upper:
                    scope_id = 3 # Trục TTKD
                elif "TTVH" in chuc_vu_upper or "VẬN HÀNH" in chuc_vu_upper:
                    scope_id = 2 # Trục TTVH
            
            # Sync User
            user = db.query(User).filter(User.username == ma_ns).first()
            if user:
                user.is_active = bool(trang_thai)
                user.full_name = ho_ten
                user.nhan_su_id = staff.id
                user.role_id = role_id
                user.scope_node_id = scope_id
            else:
                from ..core.security import get_password_hash
                user = User(
                    username=ma_ns,
                    hashed_password=get_password_hash("Vnpost@2026"),
                    full_name=ho_ten,
                    role_id=role_id,
                    nhan_su_id=staff.id,
                    scope_node_id=scope_id,
                    is_active=bool(trang_thai)
                )
                db.add(user)
        
        db.commit()
        return {"message": f"Thành công! Cập nhật: {updated}, Tạo mới: {created} (Đã tự động gán Quyền & Phạm vi)"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Lỗi khi import Excel: {str(e)}")

@users_router.post("/{user_id}/reset-password")
async def reset_password(
    request: Request,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_permission(db, current_user.id, "manage_staff")
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    
    # Mật khẩu mặc định Vnpost@2026
    default_pass = "Vnpost@2026"
    user.hashed_password = get_password_hash(default_pass)
    user.must_change_password = True # Bắt buộc đổi sau khi reset
    db.commit()
    
    LogService.log_action(
        db=db,
        user_id=current_user.id,
        action="RESET_PASSWORD",
        resource="User",
        details=f"Đã reset mật khẩu cho user {user.username} về mặc định.",
        ip_address=request.client.host
    )
    
    return {"message": f"Đã reset mật khẩu cho {user.username} về mặc định: {default_pass}"}
