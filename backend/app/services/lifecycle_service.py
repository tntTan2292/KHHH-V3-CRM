from sqlalchemy.orm import Session
from sqlalchemy import func, exists
from ..models import MonthlyAnalyticsSummary, Customer, Transaction
from .lifecycle_engine import LifecycleEngine
import logging

logger = logging.getLogger(__name__)

class LifecycleService:
    @staticmethod
    def get_customer_lifecycle_stats(db: Session, month_str: str = None, scope_point_ids: list = None, start_date: str = None, end_date: str = None):
        """
        [GOVERNANCE] Centralized Lifecycle Count Resolver (SSOT).
        Unifies counting logic for Dashboard Cards, Customer Module Buttons, and Reports.
        """
        # 1. Determine Boundary
        max_ts = db.query(func.max(Transaction.ngay_chap_nhan)).scalar()
        max_month_str = max_ts[:7] if isinstance(max_ts, str) else max_ts.strftime("%Y-%m")
        
        if not month_str and start_date:
            month_str = start_date[:7]
        if not month_str:
            month_str = max_month_str

        is_latest_month = (month_str == max_month_str)
        logger.info(f"SSOT-SEMANTIC-V2: Resolving Lifecycle. Month={month_str}, Latest={max_month_str}, IsLatest={is_latest_month}")
        
        # Determine if we need dynamic transition calculation
        is_partial = False
        if start_date and end_date:
            from datetime import datetime, timedelta
            s_dt = datetime.strptime(start_date, "%Y-%m-%d")
            e_dt = datetime.strptime(end_date, "%Y-%m-%d")
            if not (s_dt.day == 1 and (e_dt + timedelta(days=1)).day == 1):
                is_partial = True

        logger.info(f"SSOT: Resolving Lifecycle. Month={month_str}, Latest={max_month_str}, IsPartial={is_partial}")

        # 1. Attempt Summary Fetch (Base Layer)
        summary_res = db.query(
            MonthlyAnalyticsSummary.lifecycle_stage,
            func.sum(MonthlyAnalyticsSummary.total_customers).label("count")
        ).filter(
            MonthlyAnalyticsSummary.year_month == month_str,
            MonthlyAnalyticsSummary.ma_dv == 'ALL'
        )
        
        if scope_point_ids is not None:
            summary_res = summary_res.filter(MonthlyAnalyticsSummary.point_id.in_(scope_point_ids))
            
        summary_rows = summary_res.group_by(MonthlyAnalyticsSummary.lifecycle_stage).all()
        logger.info(f"SSOT: Summary Rows found for {month_str}: {len(summary_rows)}")
        
        stage_map = {
            # STATE Metrics (Population)
            "active": "active",
            "at_risk": "at_risk",
            "new": "active",             # 90-day New population is considered 'Active' in broad terms
            "recovered": "active",       # 90-day Recovered population is considered 'Active'
            "churned": "churned_snapshot",
            "churned_snapshot": "churned_snapshot",
            
            # TRANSITION Metrics (KPI Cards)
            "new_transition": "new",
            "recovered_transition": "recovered", 
            "churn_transition": "churned"
        }
        
        results = {
            "active": 0, "new": 0, "recovered": 0, "at_risk": 0, "churned": 0, "churned_snapshot": 0, "total": 0
        }

        for stage, count in summary_rows:
            if not stage: continue
            target_key = stage_map.get(stage.lower(), stage.lower())
            if target_key in results:
                results[target_key] += int(count or 0)

        # 3. RF5C-HOTFIX: Dynamic Recalculation for Transitions
        # Transitions (New, Recovered, Churned in period) are period-bound.
        # If the range is partial or it's the latest month, we recalculate to ensure integrity.
        if (is_latest_month or is_partial) and start_date and end_date:
            from datetime import datetime, timedelta
            s_dt = datetime.strptime(start_date, "%Y-%m-%d")
            e_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            
            logger.info(f"SSOT: Partial or Latest range detected ({start_date} to {end_date}). Recalculating Transitions...")
                
            # Dynamic NEW: First transaction ever falls within [start_date, end_date]
            new_count_query = db.query(func.count(Customer.id)).filter(
                exists().where(
                    (Transaction.ma_kh == Customer.ma_crm_cms) &
                    (Transaction.ngay_chap_nhan.between(s_dt, e_dt))
                ),
                ~exists().where(
                    (Transaction.ma_kh == Customer.ma_crm_cms) &
                    (Transaction.ngay_chap_nhan < s_dt)
                )
            )
            if scope_point_ids: new_count_query = new_count_query.filter(Customer.point_id.in_(scope_point_ids))
            results['new'] = new_count_query.scalar() or 0

            # Dynamic RECOVERED: Transaction in period, but none in previous 30 days
            recovered_query = db.query(func.count(Customer.id)).filter(
                exists().where(
                    (Transaction.ma_kh == Customer.ma_crm_cms) &
                    (Transaction.ngay_chap_nhan.between(s_dt, e_dt))
                ),
                ~exists().where(
                    (Transaction.ma_kh == Customer.ma_crm_cms) &
                    (Transaction.ngay_chap_nhan.between(s_dt - timedelta(days=30), s_dt - timedelta(seconds=1)))
                ),
                exists().where(
                    (Transaction.ma_kh == Customer.ma_crm_cms) &
                    (Transaction.ngay_chap_nhan < s_dt - timedelta(days=30))
                )
            )
            if scope_point_ids: recovered_query = recovered_query.filter(Customer.point_id.in_(scope_point_ids))
            results['recovered'] = recovered_query.scalar() or 0

            # Dynamic CHURNED (Last transaction reached 90 days ago during this period)
            churn_query = db.query(func.count(Customer.id)).filter(
                exists().where((Transaction.ma_kh == Customer.ma_crm_cms) & (Transaction.ngay_chap_nhan <= e_dt)),
                ~exists().where((Transaction.ma_kh == Customer.ma_crm_cms) & (Transaction.ngay_chap_nhan.between(e_dt - timedelta(days=90), e_dt)))
            )
            # Ensure they were not already churned at the start of the period to count "Transition"
            churn_query = churn_query.filter(
                exists().where((Transaction.ma_kh == Customer.ma_crm_cms) & (Transaction.ngay_chap_nhan.between(s_dt - timedelta(days=90), s_dt)))
            )
            if scope_point_ids: churn_query = churn_query.filter(Customer.point_id.in_(scope_point_ids))
            results['churned'] = churn_query.scalar() or 0
        
        results["total"] = results["active"] + results["at_risk"]
        return results

    @staticmethod
    def get_raw_table_counts(db: Session, scope_codes: list = None):
        """
        [DEBUG/AUDIT] Returns the raw count from the Customer table columns.
        Used to detect Drift during health checks.
        """
        query = db.query(
            Customer.lifecycle_state,
            func.count(Customer.id)
        )
        if scope_codes:
            query = query.filter(Customer.ma_bc_phu_trach.in_(scope_codes))
            
        rows = query.group_by(Customer.lifecycle_state).all()
        return {str(r[0]).lower(): r[1] for r in rows if r[0]}
