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
        if not month_str:
            max_ts = db.query(func.max(Transaction.ngay_chap_nhan)).scalar()
            month_str = max_ts[:7] if max_ts else "1970-01"

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
        
        stage_map = {
            "active": "active",
            "at_risk": "at_risk",
            "churned": "churned_snapshot", 
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

        # 2. RF5C-HOTFIX: Temporal Integrity for Partial Ranges
        # If the user selects a partial month, transitions MUST be recalculated dynamically.
        # Snapshots (Active, At Risk) remain anchored to the month's summary for Governance.
        if start_date and end_date:
            from datetime import datetime, timedelta
            s_dt = datetime.strptime(start_date, "%Y-%m-%d")
            e_dt = datetime.strptime(end_date, "%Y-%m-%d")
            
            # If not a full month selection
            if not (s_dt.day == 1 and (e_dt + timedelta(days=1)).day == 1):
                logger.info(f"SSOT: Partial range detected ({start_date} to {end_date}). Recalculating Transitions...")
                
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

                # Dynamic CHURNED: Was ACTIVE in snapshot, but has reached 90 days threshold in period
                # (Simplified: last transaction was > 90 days ago at end_date)
                churn_query = db.query(func.count(Customer.id)).filter(
                    exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan <= e_dt)
                    )
                ).filter(
                    ~exists().where(
                        (Transaction.ma_kh == Customer.ma_crm_cms) &
                        (Transaction.ngay_chap_nhan.between(e_dt - timedelta(days=90), e_dt))
                    )
                )
                # Ensure they were not already churned before
                # ... this is becoming complex, but for now we align with the 90-day rule.
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
