from sqlalchemy.orm import Session
from sqlalchemy import func, exists
from ..models import MonthlyAnalyticsSummary, Customer, Transaction
from .lifecycle_engine import LifecycleEngine
import logging

logger = logging.getLogger(__name__)

class LifecycleService:
    @staticmethod
    def get_customer_lifecycle_stats(db: Session, month_str: str = None, scope_point_ids: list = None):
        """
        [GOVERNANCE] Centralized Lifecycle Count Resolver (SSOT).
        Unifies counting logic for Dashboard Cards, Customer Module Buttons, and Reports.
        
        Strategy:
        1. Try to fetch from MonthlyAnalyticsSummary (Performance Layer).
        2. If summary is missing/incomplete for the month, trigger LifecycleEngine (Calculation Layer).
        """
        if not month_str:
            # Anchor to latest transaction month
            max_ts = db.query(func.max(Transaction.ngay_chap_nhan)).scalar()
            month_str = max_ts[:7] if max_ts else "1970-01"

        # 1. Attempt Summary Fetch
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
        
        # Mapping to normalized keys (Frontend Slug Compatibility)
        stage_map = {
            "active": "active",
            "new": "new",
            "rebuy": "recovered",
            "reactivated": "recovered",
            "at_risk": "at_risk",
            "churned": "churned"
        }
        
        results = {
            "active": 0, "new": 0, "recovered": 0, "at_risk": 0, "churned": 0, "total": 0
        }

        if summary_rows:
            logger.info(f"SSOT: Lifecycle stats resolved via MonthlyAnalyticsSummary for {month_str}")
            for stage, count in summary_rows:
                if not stage: continue
                target_key = stage_map.get(stage.lower(), stage.lower())
                if target_key in results:
                    results[target_key] += int(count or 0)
        else:
            # 2. Fallback to Live Calculation (Calculation Layer)
            # This ensures that even if Summary hasn't run yet, we don't return 0/Stale counts.
            logger.warning(f"SSOT: Summary missing for {month_str}. Falling back to Live Calculation...")
            live_results = LifecycleEngine.process_month_summary(month_str)
            
            # Filter by scope if needed
            if scope_point_ids is not None:
                live_results = [r for r in live_results if r['point_id'] in scope_point_ids]
            
            for r in live_results:
                target_key = stage_map.get(r['state'].lower(), r['state'].lower())
                if target_key in results:
                    results[target_key] += 1
        
        results["total"] = sum(v for k, v in results.items() if k != "total")
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
