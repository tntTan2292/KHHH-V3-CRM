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
        # 1a. Xác định phạm vi
        scope_ids = ScopingService.get_effective_scope_ids(db, current_user, node_code)
        if scope_ids is not None and not scope_ids:
            return [], 0

        # 1. Xác định mốc thời gian
        if not start_date or not end_date:
            max_date_raw = db.query(func.max(Transaction.ngay_chap_nhan)).scalar()
            if not max_date_raw:
                return [], 0
            
            from .analytics import parse_db_date
            curr_end = parse_db_date(max_date_raw)
            curr_start = curr_end.replace(day=1)
        else:
            curr_start = datetime.strptime(start_date, "%Y-%m-%d")
            curr_end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)

        prev_start = curr_start - dateutil.relativedelta.relativedelta(months=1)
        prev_end = curr_start - timedelta(days=1)
        scan_barrier = curr_start - dateutil.relativedelta.relativedelta(months=12)
        prev_3m_start = curr_start - dateutil.relativedelta.relativedelta(months=3)
        
        new_threshold_date = curr_start - dateutil.relativedelta.relativedelta(months=MONTHS_FOR_NEW - 1)
        new_threshold_date = new_threshold_date.replace(day=1)
        
        fifteen_days_threshold = curr_end - timedelta(days=15)
        churn_threshold_date = curr_start - dateutil.relativedelta.relativedelta(months=3)

        # 2. Logic Lifecycle SQL
        identified_metrics = db.query(
            Transaction.ma_kh.label("ma_kh"),
            func.sum(case((Transaction.ngay_chap_nhan.between(curr_start, curr_end), Transaction.doanh_thu), else_=0)).label("curr_rev"),
            func.count(case((Transaction.ngay_chap_nhan.between(curr_start, curr_end), Transaction.id), else_=None)).label("curr_count"),
            func.sum(case((Transaction.ngay_chap_nhan.between(prev_start, prev_end), Transaction.doanh_thu), else_=0)).label("prev_rev"),
            func.sum(case((Transaction.ngay_chap_nhan.between(prev_3m_start, prev_end), Transaction.doanh_thu), else_=0)).label("prev_3m_rev"),
            func.min(Transaction.ngay_chap_nhan).label("first_seen_all_time"),
            func.max(case((Transaction.ngay_chap_nhan < curr_start, Transaction.ngay_chap_nhan), else_=None)).label("last_shipped_before"),
            func.max(Transaction.ngay_chap_nhan).label("last_shipped_absolute"),
            func.max(Transaction.ten_nguoi_gui).label("last_known_name"),
            func.max(Transaction.point_id).label("point_id")
        ).filter(
            Transaction.ma_kh.isnot(None),
            Transaction.ma_kh != '',
            func.trim(Transaction.ma_kh) != '',
            ~Transaction.ma_kh.in_(['None', 'none', 'NULL', 'null', 'nan', 'NaN']),
            Transaction.ngay_chap_nhan >= scan_barrier
        )
        
        if scope_ids is not None:
            identified_metrics = identified_metrics.filter(Transaction.point_id.in_(scope_ids))
            
        identified_metrics = identified_metrics.group_by(Transaction.ma_kh).subquery()

        identified_status = case(
            (identified_metrics.c.first_seen_all_time >= new_threshold_date, 'new'),
            (and_(identified_metrics.c.curr_rev > 0, identified_metrics.c.prev_3m_rev == 0), 'recovered'),
            (identified_metrics.c.curr_rev > 0, 'active'),
            (identified_metrics.c.last_shipped_absolute <= churn_threshold_date, 'churned'),
            (identified_metrics.c.last_shipped_absolute <= fifteen_days_threshold, 'at_risk'),
            else_='active'
        ).label("status_type")

        rev_score = func.min(100, (func.coalesce(identified_metrics.c.curr_rev, 0) * 100 / THRESHOLD_DIAMOND_REV))
        freq_score = func.min(100, (func.coalesce(identified_metrics.c.curr_count, 0) * 100 / THRESHOLD_DIAMOND_SHIP))
        health_score = (rev_score * 0.7 + freq_score * 0.3).label("health_score")

        growth_velocity = case(
            (identified_metrics.c.prev_rev > 0, 
             (func.coalesce(identified_metrics.c.curr_rev, 0) - identified_metrics.c.prev_rev) * 100 / identified_metrics.c.prev_rev),
            (and_(identified_metrics.c.prev_rev == 0, identified_metrics.c.curr_rev > 0), 100.0),
            else_=0.0
        ).label("growth_velocity")

        base_query = db.query(
            Customer,
            Customer.ma_crm_cms,
            Customer.lifecycle_state.label("status_type"),
            Customer.vip_tier.label("vip_tier"),
            func.coalesce(identified_metrics.c.curr_rev, 0).label("dynamic_revenue"),
            func.coalesce(identified_metrics.c.curr_count, 0).label("transaction_count"),
            Customer.growth_tag.label("growth_velocity"), # Or map to a score
            health_score.label("health_score"),
            identified_metrics.c.point_id,
            NhanSu.full_name.label("assigned_staff_name")
        ).select_from(identified_metrics)\
         .outerjoin(Customer, Customer.ma_crm_cms == identified_metrics.c.ma_kh)\
         .outerjoin(NhanSu, Customer.assigned_staff_id == NhanSu.id)

        # 3. Final Filtering
        if search:
            base_query = base_query.filter(
                or_(
                    identified_metrics.c.ma_kh.ilike(f"%{search}%"),
                    Customer.ten_kh.ilike(f"%{search}%"),
                    identified_metrics.c.last_known_name.ilike(f"%{search}%")
                )
            )
        
        if lifecycle_status:
            base_query = base_query.filter(Customer.lifecycle_state == lifecycle_status.upper())
            
        if rfm_segment:
            base_query = base_query.filter(Customer.rfm_segment == rfm_segment)
            
        if vip_tier:
            base_query = base_query.filter(Customer.vip_tier == vip_tier.upper())

        # 4. Total Count
        total = base_query.count()

        # 5. Sorting
        sort_map = {
            "revenue": "dynamic_revenue",
            "dynamic_revenue": "dynamic_revenue",
            "transaction_count": "transaction_count",
            "health_score": "health_score",
            "growth_velocity": "growth_velocity",
            "vip_tier": "vip_tier",
            "ma_crm_cms": "ma_crm_cms",
            "ten_kh": "ten_kh"
        }
        
        sort_key = sort_map.get(sort_by, "dynamic_revenue")
        # Handle sorting based on subquery columns or customer columns
        if sort_key in ["dynamic_revenue", "transaction_count", "health_score", "growth_velocity"]:
             sort_field = text(sort_key)
        elif sort_key == "ma_crm_cms":
             sort_field = identified_metrics.c.ma_kh
        else:
             sort_field = Customer.ten_kh
        
        if order == "asc":
            base_query = base_query.order_by(asc(sort_field))
        else:
            base_query = base_query.order_by(desc(sort_field))

        # 6. Pagination or All
        if not include_all:
            results = base_query.offset(offset).limit(limit).all()
        else:
            results = base_query.all()

        return results, total
