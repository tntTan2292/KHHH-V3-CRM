from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func, desc, asc, text, case, literal
from datetime import datetime, timedelta
from ..database import get_db
from ..schemas import CustomerResponse, CustomerUpdate
from ..services.scoping_service import ScopingService
from ..routers.auth import get_current_user
from ..models import User, NhanSu, HierarchyNode, Customer, Transaction
from ..core.cache import cache_response
from ..services.customer_service import CustomerService

router = APIRouter(prefix="/api/customers", tags=["customers"])

@router.get("/filters")
@cache_response(ttl_hours=24)
async def get_filter_options(db: Session = Depends(get_db)):
    nhom_khs = [r[0] for r in db.query(Customer.nhom_kh).distinct().all() if r[0]]
    rfm_segments = [r[0] for r in db.query(Customer.rfm_segment).distinct().all() if r[0]]
    vip_tiers = ["DIAMOND", "PLATINUM", "GOLD", "SILVER", "BRONZE", "NORMAL"]
    vip_tiers = ["DIAMOND", "PLATINUM", "GOLD", "SILVER", "BRONZE", "NORMAL"]
    priority_levels = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    don_vis = [r[0] for r in db.query(Customer.don_vi).distinct().all() if r[0]]
    return {
        "nhom_kh": nhom_khs,
        "rfm_segment": rfm_segments,
        "vip_tier": vip_tiers,
        "priority_level": priority_levels,
        "don_vi": don_vis
    }

@router.get("")
@cache_response(ttl_hours=12)
async def get_customers(
    db: Session = Depends(get_db),
    page: int = 1,
    page_size: int = 50,
    search: str = None,
    lifecycle_status: str = None, 
    vip_tier: str = None,
    priority_level: str = None,
    rfm_segment: str = None,
    start_date: str = None,
    end_date: str = None,
    sort_by: str = "revenue",
    order: str = "desc",
    node_code: str = None,
    current_user: User = Depends(get_current_user)
):
    print(f"DEBUG_API: GET /api/customers | page={page}, ps={page_size}, status={lifecycle_status}, start={start_date}, end={end_date}, node={node_code}")
    # Sử dụng Service để lấy dữ liệu (Elite RBAC 3.0)
    items, total = CustomerService.get_customers_data(
        db=db,
        current_user=current_user,
        search=search,
        lifecycle_status=lifecycle_status,
        vip_tier=vip_tier,
        priority_level=priority_level,
        rfm_segment=rfm_segment,
        start_date=start_date,
        end_date=end_date,
        sort_by=sort_by,
        order=order,
        node_code=node_code,
        limit=page_size,
        offset=(page - 1) * page_size
    )

    # 1. Pre-fetch node names for the current batch to avoid N+1 queries
    point_codes = list(set(row.Customer.ma_bc_phu_trach for row in items if row.Customer and row.Customer.ma_bc_phu_trach))
    point_map = {}
    if point_codes:
        point_nodes = db.query(HierarchyNode.code, HierarchyNode.name).filter(HierarchyNode.code.in_(point_codes)).all()
        point_map = {p.code: p.name for p in point_nodes}

    # 2. Map to dict response (Elite RBAC 3.0 Standard)
    result_items = []
    for row in items:
        # row contains (Customer, dynamic_revenue, transaction_count, last_shipped_absolute, assigned_staff_name, snapshot_stage)
        c = row[0]
        if not c: continue
        
        # Governance: Priority given to Temporal Snapshot stage for list context
        snapshot_stage = row[5] if len(row) > 5 else None
        
        if snapshot_stage and snapshot_stage != "NONE":
            status_raw = snapshot_stage.lower()
        else:
            status_raw = (c.lifecycle_state or "ACTIVE").lower()
            
        status_map = {
            "rebuy": "recovered",
            "reactivated": "recovered",
            "active": "active",
            "new": "new",
            "at_risk": "at_risk",
            "churned": "churned"
        }
        status_final = status_map.get(status_raw, status_raw)
        
        result_items.append({
            "id": c.id,
            "ma_crm_cms": c.ma_crm_cms,
            "ten_kh": c.ten_kh or c.ma_crm_cms,
            "nhom_kh": status_final,
            "status_type": status_final,
            "vip_tier": c.vip_tier,
            "priority_score": c.priority_score,
            "priority_level": c.priority_level,
            "rfm_segment": c.rfm_segment or "Thường",
            "dynamic_revenue": float(row[1] or 0),
            "transaction_count": int(row[2] or 0),
            "growth_velocity": 0.0, # Removed dynamic calculation for performance, can be restored if needed
            "health_score": 100,
            "last_shipped": row[3].strftime("%Y-%m-%d") if row[3] else None,
            "assigned_staff_id": c.assigned_staff_id,
            "assigned_staff_name": row[4],
            "point_name": point_map.get(c.ma_bc_phu_trach, None),
            "point_code": c.ma_bc_phu_trach
        })

    return {
        "items": result_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 1
    }

@router.patch("/{ma_kh}/assign")
async def assign_staff(ma_kh: str, staff_id: int, db: Session = Depends(get_db)):
    from datetime import datetime
    import calendar
    
    customer = db.query(Customer).filter(Customer.ma_crm_cms == ma_kh).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")
    
    # 1. Update Customer
    customer.assigned_staff_id = staff_id
    
    # 2. Update Transactions in CURRENT MONTH
    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    _, last_day = calendar.monthrange(now.year, now.month)
    month_end = now.replace(day=last_day, hour=23, minute=59, second=59, microsecond=999999)
    
    db.query(Transaction).filter(
        Transaction.ma_kh == ma_kh,
        Transaction.ngay_chap_nhan.between(month_start, month_end)
    ).update({Transaction.staff_id: staff_id}, synchronize_session=False)
    
    db.commit()
    return {"message": f"Đã giao khách hàng {ma_kh} cho nhân sự ID {staff_id} trong tháng {now.month}/{now.year}"}

@router.get("/staff-options")
async def get_staff_options(
    target_id: str = Query(None, description="Mã KH hoặc Tên KH để lọc theo Cụm"),
    type: str = Query(None, description="HienHuu hoặc TiemNang"),
    username: str = Query(None, description="Username đang đăng nhập để xác định vai trò"),
    db: Session = Depends(get_db)
):
    """Lấy danh sách nhân sự đa cấp: WARD > POINT > STAFF. 
    Trả kèm thông tin vai trò người dùng để Frontend quyết định hiển thị."""
    from ..models import NhanSu, Transaction, HierarchyNode, User, Role
    from ..services.hierarchy_service import HierarchyService
    
    query = db.query(NhanSu)
    target_point_id = None
    
    if target_id and type == 'HienHuu':
        last_tx = db.query(Transaction).filter(Transaction.ma_kh == target_id).order_by(Transaction.ngay_chap_nhan.desc()).first()
        if last_tx and last_tx.point_id:
            target_point_id = last_tx.point_id
            
    elif target_id and type == 'TiemNang':
        last_tx = db.query(Transaction).filter(Transaction.ten_nguoi_gui == target_id).order_by(Transaction.ngay_chap_nhan.desc()).first()
        if last_tx and last_tx.point_id:
            target_point_id = last_tx.point_id

    wards_data = []
    points_data = []
    default_ward_id = None
    default_point_id = target_point_id
    
    # Xác định vai trò và WARD của user hiện tại
    user_role = "STAFF"
    user_ward_id = None
    if username:
        current_user = db.query(User).filter(User.username == username).first()
        if current_user and current_user.role:
            user_role = current_user.role.name
        # Tìm WARD mà user quản lý (qua nhan_su -> point -> parent WARD)
        if current_user and current_user.nhan_su_id:
            ns = db.query(NhanSu).filter(NhanSu.id == current_user.nhan_su_id).first()
            if ns and ns.point_id:
                point_node = db.query(HierarchyNode).filter(HierarchyNode.id == ns.point_id).first()
                if point_node:
                    if point_node.type == 'WARD':
                        user_ward_id = point_node.id
                    elif point_node.parent_id:
                        parent = db.query(HierarchyNode).filter(HierarchyNode.id == point_node.parent_id).first()
                        if parent and parent.type == 'WARD':
                            user_ward_id = parent.id

    if target_point_id:
        node = db.query(HierarchyNode).filter(HierarchyNode.id == target_point_id).first()
        if node:
            # Leo cây tìm WARD cha và CLUSTER cha
            ward_node = None
            cluster_node = None
            curr = node
            # Nếu node chính nó là POINT, tìm WARD cha
            while curr:
                if curr.type == 'WARD':
                    ward_node = curr
                elif curr.type == 'CLUSTER':
                    cluster_node = curr
                    break
                if curr.parent_id:
                    curr = db.query(HierarchyNode).filter(HierarchyNode.id == curr.parent_id).first()
                else:
                    break
            
            if ward_node:
                default_ward_id = ward_node.id
            
            if cluster_node:
                # Lấy tất cả WARD trong Cluster
                ward_nodes = db.query(HierarchyNode).filter(
                    HierarchyNode.parent_id == cluster_node.id,
                    HierarchyNode.type == 'WARD'
                ).all()
                wards_data = [{"id": w.id, "name": w.name, "code": w.code} for w in ward_nodes]
                
                # Lấy tất cả POINT thuộc các WARD đó
                ward_ids = [w.id for w in ward_nodes]
                point_nodes = db.query(HierarchyNode).filter(
                    HierarchyNode.parent_id.in_(ward_ids),
                    HierarchyNode.type == 'POINT'
                ).all()
                points_data = [{"id": p.id, "name": p.name, "code": p.code, "ward_id": p.parent_id} for p in point_nodes]
                
                # Cũng lấy các POINT con trực tiếp của Cluster (không qua WARD)
                direct_points = db.query(HierarchyNode).filter(
                    HierarchyNode.parent_id == cluster_node.id,
                    HierarchyNode.type == 'POINT'
                ).all()
                for dp in direct_points:
                    if dp.id not in [p["id"] for p in points_data]:
                        points_data.append({"id": dp.id, "name": dp.name, "code": dp.code, "ward_id": None})
                
                # Lọc staff theo cluster
                cluster_descendants = HierarchyService.get_descendant_ids_by_id(db, cluster_node.id)
                if cluster_descendants:
                    query = query.filter(NhanSu.point_id.in_(cluster_descendants))
                    
    staff = query.all()
    staff_data = [{"id": s.id, "name": s.full_name, "hr_id": s.hr_id, "chuc_vu": s.chuc_vu, "ma_bc": s.ma_bc, "point_id": s.point_id} for s in staff]
    
    return {
        "staff": staff_data,
        "wards": wards_data,
        "points": points_data,
        "default_ward_id": default_ward_id,
        "default_point_id": target_point_id,
        "user_role": user_role,
        "user_ward_id": user_ward_id
    }

@router.get("/{ma_crm}/details")
async def get_customer_details(ma_crm: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    customer = db.query(Customer).filter(Customer.ma_crm_cms == ma_crm).first()
    if not customer:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Customer not found")
        
    # Check Scope (Elite RBAC 3.0)
    from ..auth.permissions import check_scope
    # Map ma_bc_phu_trach back to node_id for check_scope
    node = db.query(HierarchyNode).filter(HierarchyNode.code == customer.ma_bc_phu_trach).first()
    if node:
        check_scope(db, current_user, node.id)
        
    from ..models import Transaction
    from sqlalchemy import extract
    
    # 1. Transactions Analysis
    transactions = db.query(Transaction).filter(Transaction.ma_kh == ma_crm).all()
    
    # 2. 12-Month Revenue Trend
    now = datetime.now()
    twelve_months_ago = now - timedelta(days=365)
    
    trend_query = db.query(
        func.strftime('%Y-%m', Transaction.ngay_chap_nhan).label('month'),
        func.sum(Transaction.doanh_thu).label('revenue')
    ).filter(
        Transaction.ma_kh == ma_crm,
        Transaction.ngay_chap_nhan >= twelve_months_ago
    ).group_by('month').order_by('month').all()
    
    trend_arr = [{"month": r[0], "revenue": r[1] or 0} for r in trend_query]
    
    # 3. Service & Scope Distribution
    trong_nuoc = 0
    quoc_te = 0
    services_dist = {}
    last_active = None
    
    for t in transactions:
        t_dt = t.doanh_thu or 0
        t_date = t.ngay_chap_nhan
        if not last_active or (t_date and t_date > last_active):
            last_active = t_date
            
        is_qt = str(t.trong_nuoc_quoc_te).strip() in ['Quốc tế', 'Quoc te'] or str(t.ma_dv).strip().upper() == 'L'
        
        if is_qt:
            quoc_te += t_dt
            svc_name = "L - Quốc tế"
        else:
            trong_nuoc += t_dt
            ma_dv = str(t.ma_dv).strip().upper() if t.ma_dv else "Khác"
            svc_map = {'C': 'C - Bưu kiện', 'E': 'E - EMS Chuyển phát nhanh', 'M': 'M - KT1', 'R': 'R - Bưu phẩm bảo đảm'}
            svc_name = svc_map.get(ma_dv, f"{ma_dv} - Dịch vụ khác")
            
        services_dist[svc_name] = services_dist.get(svc_name, 0) + t_dt
        
    services_arr = [{"name": k, "value": v} for k, v in services_dist.items() if v > 0]
    scope_arr = [
        {"name": "Trong nước", "value": trong_nuoc},
        {"name": "Quốc tế", "value": quoc_te}
    ]
    
    # 4. Churn Risk & Health Score (simplified version for modal)
    days_inactive = (now - last_active).days if last_active else 999
    total_revenue = sum((t.doanh_thu or 0) for t in transactions)
    total_transactions = len(transactions)

    # Fallback health score for modal when Customer table has no dedicated score column.
    revenue_score = min(100, (total_revenue / 10000000) * 100) if total_revenue > 0 else 0
    frequency_score = min(100, (total_transactions / 20) * 100) if total_transactions > 0 else 0
    health_score = int(round(revenue_score * 0.7 + frequency_score * 0.3))

    customer_payload = {
        "id": customer.id,
        "ma_crm_cms": customer.ma_crm_cms,
        "ten_kh": customer.ten_kh,
        "ten_bc_vhx": customer.ten_bc_vhx,
        "don_vi": customer.don_vi,
        "nhom_kh": customer.nhom_kh,
        "loai_kh": customer.loai_kh,
        "vip_tier": customer.vip_tier,
        "priority_score": customer.priority_score,
        "priority_level": customer.priority_level,
        "rfm_segment": customer.rfm_segment,
        "tong_doanh_thu": customer.tong_doanh_thu or 0,
        "doanh_thu_luy_ke": total_revenue,
        "is_churn": customer.is_churn or 0,
        "assigned_staff_id": customer.assigned_staff_id,
        "dia_chi": customer.dia_chi,
        "dien_thoai": customer.dien_thoai,
        "nguoi_lien_he": customer.nguoi_lien_he,
        "so_hop_dong": customer.so_hop_dong,
        "thoi_han_hop_dong": customer.thoi_han_hop_dong,
        "thoi_han_ket_thuc": customer.thoi_han_ket_thuc
    }
    
    return {
        "customer": customer_payload,
        "services": sorted(services_arr, key=lambda x: x['value'], reverse=True),
        "scope": scope_arr,
        "trend": trend_arr,
        "total_transactions": total_transactions,
        "last_active": last_active.strftime("%d/%m/%Y") if last_active else "N/A",
        "days_inactive": days_inactive,
        "health_score": health_score
    }

@router.patch("/{ma_kh}")
async def patch_customer(
    ma_kh: str, 
    payload: CustomerUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    customer = db.query(Customer).filter(Customer.ma_crm_cms == ma_kh).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")
    
    # Update fields
    if payload.dia_chi is not None: customer.dia_chi = payload.dia_chi
    if payload.dien_thoai is not None: customer.dien_thoai = payload.dien_thoai
    if payload.nguoi_lien_he is not None: customer.nguoi_lien_he = payload.nguoi_lien_he
    if payload.so_hop_dong is not None: customer.so_hop_dong = payload.so_hop_dong
    if payload.thoi_han_hop_dong is not None: customer.thoi_han_hop_dong = payload.thoi_han_hop_dong
    if payload.thoi_han_ket_thuc is not None: customer.thoi_han_ket_thuc = payload.thoi_han_ket_thuc
    
    db.commit()
    return {"message": "Đã cập nhật thông tin khách hàng thành công", "ma_kh": ma_kh}
