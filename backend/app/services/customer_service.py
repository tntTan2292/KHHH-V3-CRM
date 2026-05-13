from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func, desc, asc, text, case, literal, exists
from datetime import datetime, timedelta
import dateutil.relativedelta
from ..models import User, NhanSu, HierarchyNode, Customer, Transaction, CustomerMonthlySnapshot
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

        # 3. Build Shared Filters (Governance: Single Source of Truth for Queries)
        filters = []
        
        if lifecycle_status:
            status_val = lifecycle_status.lower()
            month_str = curr_start.strftime("%Y-%m")
            
            # RF5C-HOTFIX: Temporal Integrity check
            # Full month check (simplified)
            is_partial = not (curr_start.day == 1 and (curr_end + timedelta(seconds=1)).day == 1)
            
            # [RF5C] Determine if we should use Realtime vs Snapshot
            # Governance: Current Month or Partial Range MUST use Realtime to match Dashboard
            max_ts = db.query(func.max(Transaction.ngay_chap_nhan)).scalar()
            max_month_str = max_ts[:7] if isinstance(max_ts, str) else max_ts.strftime("%Y-%m")
            is_latest_month = (month_str == max_month_str)
            
            snapshot_exists = db.query(exists().where(CustomerMonthlySnapshot.year_month == month_str)).scalar()
            snapshot_sub = None
            
            # Use Realtime if snapshot missing OR if it's the current/partial month (to ensure consistency with Dashboard)
            use_realtime = (not snapshot_exists) or is_latest_month or is_partial
            
            if use_realtime:
                # REALTIME FALLBACK (Current Month) - MUST MATCH LifecycleService EXACTLY
                if status_val == 'new_event':
                    filters.append(exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan.between(curr_start, curr_end))
                    ))
                    filters.append(~exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan < curr_start)
                    ))
                elif status_val == 'recovered_event':
                    # Logic: Tx in period, NO Tx in last 30 days before period, HAD Tx before that
                    filters.append(exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan.between(curr_start, curr_end))
                    ))
                    filters.append(~exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan.between(curr_start - timedelta(days=30), curr_start - timedelta(seconds=1)))
                    ))
                    filters.append(exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan < curr_start - timedelta(days=30))
                    ))
                elif status_val == 'churn_event':
                    # CHURN EVENT (Realtime) - [RF5F] STRICT ALIGNMENT
                    # Logic: NO Tx in last 90 days, HAD Tx in the 90 days before that
                    # ALWAYS USE REALTIME FOR CURRENT MONTH TRANSITIONS
                    filters.append(~exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) & 
                        (Transaction.ngay_chap_nhan.between(curr_end - timedelta(days=90), curr_end))
                    ))
                    filters.append(exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) & 
                        (Transaction.ngay_chap_nhan.between(curr_start - timedelta(days=90), curr_start))
                    ))
                    use_realtime = True # FORCE REALTIME
                elif status_val == 'new_pop':
                    # [RF5I] NEW POPULATION (Active Probation)
                    # Logic: First Tx < 90 days ago AND NOT Silent (> 30 days)
                    filters.append(exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan.between(curr_end - timedelta(days=30), curr_end))
                    ))
                    filters.append(~exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan < curr_end - timedelta(days=90))
                    ))
                elif status_val == 'recovered_pop':
                    # [RF5I] RECOVERED POPULATION (Active Probation - 90 days)
                    # Logic: Returned < 90 days ago AND NOT Silent (> 30 days)
                    filters.append(exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan.between(curr_end - timedelta(days=30), curr_end))
                    ))
                    filters.append(exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan < curr_end - timedelta(days=180))
                    ))
                    filters.append(~exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan.between(curr_end - timedelta(days=180), curr_end - timedelta(days=90)))
                    ))
                elif status_val == 'active':
                    # [RF5H] Mature Active (Realtime): Tx in last 30 days AND Mature (First Tx < e_dt-90)
                    #        AND NOT in Recovered Probation (Had Tx in [e_dt-180, e_dt-90])
                    filters.append(exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan.between(curr_end - timedelta(days=30), curr_end))
                    ))
                    filters.append(exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan < curr_end - timedelta(days=90))
                    ))
                    filters.append(exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan.between(curr_end - timedelta(days=180), curr_end - timedelta(days=90)))
                    ))
                elif status_val == 'new_pop':
                    # NEW POPULATION (Probation): Joined < 90 days ago AND still active
                    filters.append(exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan.between(curr_end - timedelta(days=30), curr_end))
                    ))
                    filters.append(~exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan < curr_end - timedelta(days=90))
                    ))
                elif status_val == 'recovered_pop':
                    # RECOVERED POPULATION (Probation): Returned < 90 days ago AND still active
                    filters.append(exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan.between(curr_end - timedelta(days=30), curr_end))
                    ))
                    filters.append(exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan < curr_end - timedelta(days=180))
                    ))
                    filters.append(~exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan.between(curr_end - timedelta(days=180), curr_end - timedelta(days=90)))
                    ))
                elif status_val == 'churn_pop':
                    # CHURN POPULATION (Realtime) - [RF5F] STRICT ALIGNMENT
                    # Logic: No transactions in the last 90 days
                    filters.append(~exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan >= curr_end - timedelta(days=90))
                    ))
                    filters.append(exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan < curr_end - timedelta(days=90))
                    ))
                    use_realtime = True
                elif status_val == 'at_risk':
                    # [RF5I] AT RISK (Universal Risk)
                    # Logic: No Tx in last 30 days AND Has Tx in last 90 days
                    filters.append(exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan.between(curr_end - timedelta(days=90), curr_end - timedelta(days=30)))
                    ))
                    filters.append(~exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan > curr_end - timedelta(days=30))
                    ))
                elif status_val == 'total_pop':
                    # [RF5F] UNIVERSE: Everyone with at least one transaction (Distinct ma_kh)
                    filters.append(exists().where(Transaction.ma_kh == Customer.ma_crm_cms))
                    use_realtime = True # ALWAYS REALTIME
                else:
                    filters.append(func.lower(Customer.lifecycle_state) == status_val)
            else:
                # SNAPSHOT LOGIC (Historical Month)
                snapshot_sub = db.query(CustomerMonthlySnapshot).filter(CustomerMonthlySnapshot.year_month == month_str).subquery()
                
                if status_val == 'total_pop':
                    filters.append(snapshot_sub.c.lifecycle_state.in_(['ACTIVE', 'NEW', 'RECOVERED', 'AT_RISK']))
                elif status_val == 'new_event':
                    filters.append(snapshot_sub.c.is_new_transition == True)
                elif status_val == 'new_pop':
                    filters.append(snapshot_sub.c.lifecycle_state == 'NEW')
                elif status_val == 'recovered_event':
                    filters.append(snapshot_sub.c.is_recovered_transition == True)
                elif status_val == 'recovered_pop':
                    filters.append(snapshot_sub.c.lifecycle_state == 'RECOVERED')
                elif status_val == 'churn_event':
                    filters.append(snapshot_sub.c.is_churn_transition == True)
                elif status_val == 'churn_pop':
                    filters.append(snapshot_sub.c.lifecycle_state == 'CHURNED')
                elif status_val == 'active':
                    filters.append(snapshot_sub.c.lifecycle_state == 'ACTIVE')
                elif status_val == 'at_risk':
                    filters.append(snapshot_sub.c.lifecycle_state == 'AT_RISK')
                else:
                    filters.append(func.lower(Customer.lifecycle_state) == status_val)
                
                # Join with snapshot (Using filter for join integrity)
                filters.append(Customer.ma_crm_cms == snapshot_sub.c.ma_kh)
            
        if rfm_segment:
            filters.append(Customer.rfm_segment == rfm_segment)
            
        if vip_tier:
            filters.append(Customer.vip_tier == vip_tier.upper())

        if priority_level:
            filters.append(Customer.priority_level == priority_level.upper())

        if search:
            filters.append(
                or_(
                    Customer.ma_crm_cms.ilike(f"%{search}%"),
                    Customer.ten_kh.ilike(f"%{search}%")
                )
            )

        if scope_ids is not None:
            scope_nodes = db.query(HierarchyNode.code).filter(HierarchyNode.id.in_(scope_ids)).all()
            scope_codes = [n.code for n in scope_nodes]
            filters.append(Customer.ma_bc_phu_trach.in_(scope_codes))

        # 4. Total Count (Deterministic)
        # Use Outerjoin for snapshot to ensure population views don't collapse if some fields are null
        base_query = db.query(Customer)
        if lifecycle_status and not use_realtime:
            base_query = base_query.outerjoin(snapshot_sub, Customer.ma_crm_cms == snapshot_sub.c.ma_kh)
        
        base_query = base_query.filter(*filters)
        total = base_query.count()

        # 5. Metrics Subquery (Revenue month-locked)
        metrics_sub = db.query(
            Transaction.ma_kh.label("ma_kh"),
            func.sum(Transaction.doanh_thu).label("dynamic_revenue"),
            func.count(Transaction.id).label("transaction_count"),
            func.max(Transaction.ngay_chap_nhan).label("last_shipped_absolute")
        ).filter(
            Transaction.ngay_chap_nhan.between(curr_start, curr_end),
            Transaction.ma_kh.isnot(None)
        ).group_by(Transaction.ma_kh).subquery()

        # 6. Final Query Assembly
        # [GOVERNANCE] Ensure snapshot_stage fallback to Customer.lifecycle_state when not in snapshot mode
        final_query = db.query(
            Customer,
            func.coalesce(metrics_sub.c.dynamic_revenue, 0).label("dynamic_revenue"),
            func.coalesce(metrics_sub.c.transaction_count, 0).label("transaction_count"),
            metrics_sub.c.last_shipped_absolute,
            NhanSu.full_name.label("assigned_staff_name"),
            (snapshot_sub.c.lifecycle_state if (lifecycle_status and not use_realtime) else Customer.lifecycle_state).label("snapshot_stage")
        ).select_from(Customer)
        
        if lifecycle_status and not use_realtime:
            final_query = final_query.outerjoin(snapshot_sub, Customer.ma_crm_cms == snapshot_sub.c.ma_kh)
            
        final_query = final_query.outerjoin(metrics_sub, Customer.ma_crm_cms == metrics_sub.c.ma_kh)\
          .outerjoin(NhanSu, Customer.assigned_staff_id == NhanSu.id)\
          .filter(*filters)

        # 7. Sorting
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

        # 8. Execution (Deterministic Pagination)
        if include_all:
            results = final_query.all()
        else:
            results = final_query.offset(offset).limit(limit).all()

        return results, total
