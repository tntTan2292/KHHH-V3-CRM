from sqlalchemy.orm import Session
from sqlalchemy import func, exists, or_, and_
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
        max_month_str = max_ts[:7] if isinstance(max_ts, str) else (max_ts.strftime("%Y-%m") if max_ts else None)
        
        # System Today context
        from datetime import datetime
        today_str = datetime.now().strftime("%Y-%m")
        
        if not month_str and start_date:
            month_str = start_date[:7]
        if not month_str:
            month_str = max_month_str or today_str

        is_latest_month = (month_str == max_month_str or month_str == today_str)
        
        # Determine if we need dynamic transition calculation
        is_partial = False
        if start_date and end_date:
            from datetime import timedelta
            s_dt = datetime.strptime(start_date, "%Y-%m-%d")
            e_dt = datetime.strptime(end_date, "%Y-%m-%d")
            if not (s_dt.day == 1 and (e_dt + timedelta(days=1)).day == 1):
                is_partial = True

        logger.info(f"SSOT: Resolving Lifecycle. Month={month_str}, MaxMonth={max_month_str}, Today={today_str}, IsLatest={is_latest_month}, IsPartial={is_partial}")

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
            "new": "new_pop",
            "new_pop": "new_pop",
            "recovered": "recovered_pop",
            "recovered_pop": "recovered_pop",
            "active": "active",
            "at_risk": "at_risk",
            "churned": "churn_pop",
            "churn_pop": "churn_pop",
            
            # TRANSITION Metrics (Events)
            "new_transition": "new_event",
            "new_event": "new_event",
            "recovered_transition": "recovered_event",
            "recovered_event": "recovered_event",
            "churn_transition": "churn_event",
            "churn_event": "churn_event"
        }
        
        results = {
            "active": 0, 
            "new_event": 0, "new_pop": 0, 
            "recovered_event": 0, "recovered_pop": 0, 
            "at_risk": 0, 
            "churn_event": 0, "churn_pop": 0, 
            "total": 0
        }

        for stage, count in summary_rows:
            if not stage: continue
            clean_stage = stage.strip().lower()
            target_key = stage_map.get(clean_stage, "discard")
            if target_key in results:
                results[target_key] += int(count or 0)
            else:
                logger.warning(f"SSOT: Unmapped lifecycle stage detected: '{clean_stage}'")

        # 3. RF5C-HOTFIX: Dynamic Recalculation (Realtime)
        # Use SSOT logic from LifecycleEngine to ensure parity across Dashboard and Table.
        if (is_latest_month or is_partial) and start_date and end_date:
            from sqlalchemy import text
            target_date = end_date
            
            logger.info(f"SSOT: Partial or Latest range detected ({start_date} to {end_date}). Recalculating Realtime metrics from LifecycleEngine SSOT...")

            # --- POPULATION LAYER ---
            pop_keys = {
                'active': 'active',
                'new_pop': 'new_pop',
                'recovered_pop': 'recovered_pop',
                'at_risk': 'at_risk',
                'churn_pop': 'churn_pop'
            }
            
            for res_key, engine_key in pop_keys.items():
                sql_fragment = LifecycleEngine.get_lifecycle_sql_logic(target_date, engine_key)
                if sql_fragment:
                    query = db.query(func.count(Customer.id)).filter(text(sql_fragment))
                    if scope_point_ids: 
                        query = query.filter(Customer.point_id.in_(scope_point_ids))
                    results[res_key] = query.scalar() or 0

            # --- EVENT LAYER ---
            event_keys = {
                'new_event': 'new_event',
                'recovered_event': 'recovered_event',
                'churn_event': 'churn_event'
            }
            
            for res_key, engine_key in event_keys.items():
                sql_fragment = LifecycleEngine.get_event_sql_logic(start_date, end_date, engine_key)
                if sql_fragment:
                    query = db.query(func.count(Customer.id)).filter(text(sql_fragment))
                    if scope_point_ids: 
                        query = query.filter(Customer.point_id.in_(scope_point_ids))
                    results[res_key] = query.scalar() or 0

        # TOTAL KHÁCH HÀNG - [RF5F] Unified Universe (Month-Bounded)
        total_universe_query = db.query(func.count(Customer.id)).filter(
            exists().where(
                and_(
                    Transaction.ma_kh == Customer.ma_crm_cms,
                    Transaction.ngay_chap_nhan <= end_date
                )
            )
        )
        if scope_point_ids: 
            total_universe_query = total_universe_query.filter(Customer.point_id.in_(scope_point_ids))
        
        results["total"] = total_universe_query.scalar() or 0
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
