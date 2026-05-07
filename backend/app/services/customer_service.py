from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func, desc, asc, text, case, literal
from datetime import datetime, timedelta
import dateutil.relativedelta
from ..models import User, NhanSu, HierarchyNode, Customer, Transaction
from ..services.scoping_service import ScopingService
from ..core.config_segments import (
    MONTHS_UNTIL_CHURN, MONTHS_FOR_NEW, THRESHOLD_DIAMOND_REV, THRESHOLD_GOLD_REV, 
    THRESHOLD_BRONZE_REV, THRESHOLD_DIAMOND_SHIP, THRESHOLD_GOLD_SHIP, 
    THRESHOLD_BRONZE_SHIP, MIN_REVENUE_ACTIVE
)

class CustomerService:
    @staticmethod
    def get_customers_data(
        db: Session,
        current_user: User,
        search: str = None,
        lifecycle_status: str = None, 
        vip_tier: str = None,
        priority_level: str = None,
        rfm_segment: str = None, # Deprecated in V3
        start_date: str = None,
        end_date: str = None,
        sort_by: str = "revenue",
        order: str = "desc",
        node_code: str = None,
        limit: int = 50,
        offset: int = 0,
        include_all: bool = False # For Export
    ):
        # 1. Xác định mốc thời gian (Vẫn dùng Full History theo Hiến pháp)
        if not start_date or not end_date:
            max_date_raw = db.query(func.max(Transaction.ngay_chap_nhan)).scalar()
            if not max_date_raw:
                return [], 0
            
            from ..routers.analytics import parse_db_date
            curr_end = parse_db_date(max_date_raw)
            curr_start = curr_end.replace(day=1)
        else:
            curr_start = datetime.strptime(start_date, "%Y-%m-%d")
            curr_end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)

        prev_end = curr_start - timedelta(days=1)
        prev_3m_start = curr_start - dateutil.relativedelta.relativedelta(months=3)

        # 2. Scoping
        scope_ids = ScopingService.get_effective_scope_ids(db, current_user, node_code)
        if scope_ids is not None and not scope_ids:
            return [], 0

        # 3. Base Query - Driver là bảng Customer (Đã được Engine cập nhật trạng thái)
        # Việc dùng bảng Customer làm driver giúp tận dụng Index trên lifecycle_state, rfm_segment
        base_query = db.query(Customer)

        # 4. Áp dụng Filters (Governance: Sử dụng dữ liệu đã persist từ Engine)
        if lifecycle_status:
            status_val = lifecycle_status.lower()
            if status_val == 'recovered': status_val = 'rebuy'
            base_query = base_query.filter(func.lower(Customer.lifecycle_state) == status_val)
            
        if rfm_segment:
            base_query = base_query.filter(Customer.rfm_segment == rfm_segment)
            
        if vip_tier:
            base_query = base_query.filter(Customer.vip_tier == vip_tier.upper())

        if priority_level:
            base_query = base_query.filter(Customer.priority_level == priority_level.upper())

        if search:
            base_query = base_query.filter(
                or_(
                    Customer.ma_crm_cms.ilike(f"%{search}%"),
                    Customer.ten_kh.ilike(f"%{search}%")
                )
            )

        if scope_ids is not None:
            # Lấy list ma_bc từ scope_ids để filter
            scope_nodes = db.query(HierarchyNode.code).filter(HierarchyNode.id.in_(scope_ids)).all()
            scope_codes = [n.code for n in scope_nodes]
            base_query = base_query.filter(Customer.ma_bc_phu_trach.in_(scope_codes))

        # 5. Total Count (Lấy từ bảng Customer - Rất nhanh)
        total = base_query.count()

        # 6. Metrics Subquery - CHỈ tính cho tháng hiện tại (Dynamic Metrics)
        # Các trạng thái Lifecycle bền vững (SSOT) đã được Engine lưu vào bảng Customer
        metrics_sub = db.query(
            Transaction.ma_kh.label("ma_kh"),
            func.sum(Transaction.doanh_thu).label("dynamic_revenue"),
            func.count(Transaction.id).label("transaction_count"),
            func.max(Transaction.ngay_chap_nhan).label("last_shipped_absolute")
        ).filter(
            Transaction.ngay_chap_nhan.between(curr_start, curr_end),
            Transaction.ma_kh.isnot(None)
        ).group_by(Transaction.ma_kh).subquery()

        # 7. Final Query Assembly
        # Ta join Customer với metrics_sub để lấy số liệu động
        # Quan trọng: Phải giữ lại các filter từ base_query
        final_query = db.query(
            Customer,
            func.coalesce(metrics_sub.c.dynamic_revenue, 0).label("dynamic_revenue"),
            func.coalesce(metrics_sub.c.transaction_count, 0).label("transaction_count"),
            metrics_sub.c.last_shipped_absolute,
            NhanSu.full_name.label("assigned_staff_name")
        ).select_from(Customer)\
         .outerjoin(metrics_sub, Customer.ma_crm_cms == metrics_sub.c.ma_kh)\
         .outerjoin(NhanSu, Customer.assigned_staff_id == NhanSu.id)

        # Re-apply all filters from base_query to final_query
        # Thay vì tạo query mới, ta lấy các criteria từ base_query
        # Tuy nhiên trong SQLAlchemy cách sạch nhất là reuse logic filter
        if lifecycle_status:
            status_val = lifecycle_status.lower()
            if status_val == 'recovered': status_val = 'rebuy'
            final_query = final_query.filter(func.lower(Customer.lifecycle_state) == status_val)
            
        if rfm_segment:
            final_query = final_query.filter(Customer.rfm_segment == rfm_segment)
            
        if search:
            final_query = final_query.filter(
                or_(
                    Customer.ma_crm_cms.ilike(f"%{search}%"),
                    Customer.ten_kh.ilike(f"%{search}%")
                )
            )

        if scope_ids is not None:
            # Vì Customer không có point_id (Integer), ta dùng ma_bc_phu_trach (String) 
            # hoặc filter thông qua Transaction scope (Tuy nhiên Customer driver nên dùng ma_bc_phu_trach)
            # Lấy list ma_bc từ scope_ids
            scope_nodes = db.query(HierarchyNode.code).filter(HierarchyNode.id.in_(scope_ids)).all()
            scope_codes = [n.code for n in scope_nodes]
            final_query = final_query.filter(Customer.ma_bc_phu_trach.in_(scope_codes))

        # 8. Sorting
        sort_map = {
            "revenue": text("dynamic_revenue"),
            "dynamic_revenue": text("dynamic_revenue"),
            "transaction_count": text("transaction_count"),
            "ma_crm_cms": Customer.ma_crm_cms,
            "ten_kh": Customer.ten_kh
        }
        
        sort_field = sort_map.get(sort_by, text("dynamic_revenue"))
        
        if order == "asc":
            final_query = final_query.order_by(asc(sort_field))
        else:
            final_query = final_query.order_by(desc(sort_field))

        # 9. Execution (Deterministic Pagination)
        results = final_query.offset(offset).limit(limit).all()

        return results, total
