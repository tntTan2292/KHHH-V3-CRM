from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models import MonthlyAnalyticsSummary, Transaction, HierarchyNode
from ..core.kpi_governance import KPIRegistry, AggregationType
from .hierarchy_service import HierarchyService
from typing import Dict, Any

class KPIRollupService:
    """
    [GOVERNANCE] Centralized KPI Hierarchy Rollup Engine.
    Standardizes how metrics are aggregated across any organizational scope.
    """

    @staticmethod
    def aggregate_node_kpis(db: Session, node_id: int, year_month: str) -> Dict[str, float]:
        """
        Aggregates KPIs for a specific Hierarchy Node and all its descendants.
        Source: MonthlyAnalyticsSummary (SSOT for Nodes)
        """
        # 1. Resolve full scope
        descendant_ids = HierarchyService.get_descendant_ids_by_id(db, node_id, include_children=True)
        
        # 2. Fetch Revenue & Volume (Sum across all services)
        rev_vol_query = db.query(
            func.sum(MonthlyAnalyticsSummary.total_revenue).label("revenue"),
            func.sum(MonthlyAnalyticsSummary.total_orders).label("volume")
        ).filter(
            MonthlyAnalyticsSummary.point_id.in_(descendant_ids),
            MonthlyAnalyticsSummary.year_month == year_month
        ).first()

        # 3. Fetch Customers (Use 'ALL' marker to avoid over-counting)
        cust_query = db.query(
            func.sum(MonthlyAnalyticsSummary.total_customers).label("customers")
        ).filter(
            MonthlyAnalyticsSummary.point_id.in_(descendant_ids),
            MonthlyAnalyticsSummary.year_month == year_month,
            MonthlyAnalyticsSummary.ma_dv == 'ALL'
        ).first()

        results = {
            "REVENUE": rev_vol_query.revenue or 0.0,
            "VOLUME": float(rev_vol_query.volume or 0),
            "ACTIVE_CUSTOMERS": float(cust_query.customers or 0)
        }
        
        # 4. Add specialized aggregations (e.g. Churn)
        churn_count = db.query(func.sum(MonthlyAnalyticsSummary.total_customers)).filter(
            MonthlyAnalyticsSummary.point_id.in_(descendant_ids),
            MonthlyAnalyticsSummary.year_month == year_month,
            MonthlyAnalyticsSummary.lifecycle_stage == 'churned',
            MonthlyAnalyticsSummary.ma_dv == 'ALL'
        ).scalar() or 0
        
        results["CHURN_CUSTOMERS"] = float(churn_count)
        
        # 5. Fetch New Customers
        new_count = db.query(func.sum(MonthlyAnalyticsSummary.total_customers)).filter(
            MonthlyAnalyticsSummary.point_id.in_(descendant_ids),
            MonthlyAnalyticsSummary.year_month == year_month,
            MonthlyAnalyticsSummary.lifecycle_stage == 'new',
            MonthlyAnalyticsSummary.ma_dv == 'ALL'
        ).scalar() or 0
        results["NEW_CUSTOMERS"] = float(new_count)

        # 6. Fetch Potential Leads
        potential_count = db.query(func.sum(MonthlyAnalyticsSummary.total_customers)).filter(
            MonthlyAnalyticsSummary.point_id.in_(descendant_ids),
            MonthlyAnalyticsSummary.year_month == year_month,
            MonthlyAnalyticsSummary.lifecycle_stage == 'potential', # Logic alignment with LeadTierEngine
            MonthlyAnalyticsSummary.ma_dv == 'ALL'
        ).scalar() or 0
        results["POTENTIAL_LEADS"] = float(potential_count)
        
        return results

    @staticmethod
    def aggregate_staff_kpis(db: Session, staff_id: int, start_date: Any, end_date: Any) -> Dict[str, float]:
        """
        Aggregates KPIs for a specific Staff member.
        Source: Transaction (Truth for Staff)
        """
        # 1. Fetch base metrics from Transactions
        trans_query = db.query(
            func.sum(Transaction.doanh_thu).label("revenue"),
            func.count(Transaction.id).label("volume")
        ).filter(
            Transaction.staff_id == staff_id,
            Transaction.ngay_chap_nhan >= start_date,
            Transaction.ngay_chap_nhan <= end_date
        ).first()

        results = {
            "REVENUE": trans_query.revenue or 0.0,
            "VOLUME": float(trans_query.volume or 0)
        }
        
        return results
