from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models import MonthlyAnalyticsSummary
import logging

logger = logging.getLogger(__name__)

class LifecycleService:
    @staticmethod
    def get_customer_lifecycle_stats(db: Session, don_vi: str = None, start_date: str = None, end_date: str = None, scope_point_ids: list = None):
        """
        Fetches lifecycle statistics from MonthlyAnalyticsSummary.
        This ensures SSOT and high performance.
        """
        # Convert start_date to month_str
        if not start_date:
            # Get latest month from summary
            latest_month = db.query(func.max(MonthlyAnalyticsSummary.year_month)).scalar()
            if not latest_month:
                return {}
            month_str = latest_month
        else:
            month_str = start_date[:7] # YYYY-MM
        
        query = db.query(
            MonthlyAnalyticsSummary.lifecycle_stage,
            func.sum(MonthlyAnalyticsSummary.total_customers).label("count")
        ).filter(MonthlyAnalyticsSummary.year_month == month_str)
        
        if scope_point_ids:
            query = query.filter(MonthlyAnalyticsSummary.point_id.in_(scope_point_ids))
        
        # Aggregate by stage
        # Note: We use ma_dv='ALL' to get unique customer counts
        query = query.filter(MonthlyAnalyticsSummary.ma_dv == 'ALL')
        
        stats_rows = query.group_by(MonthlyAnalyticsSummary.lifecycle_stage).all()
        
        full_stats = {
            "NEW": 0, "ACTIVE": 0, "AT_RISK": 0, 
            "CHURNED": 0, "REACTIVATED": 0,
            "BẠC": 0, "VÀNG": 0, "KIM CƯƠNG": 0, "THƯỜNG": 0
        }
        
        for stage, count in stats_rows:
            if stage in full_stats:
                full_stats[stage] = int(count)
        
        # Also fetch ranking stats (Leads)
        # In SummaryService, potential customer ranks are stored in lifecycle_stage
        # and identified customer stages are also there.
        # Ranks: KIM CƯƠNG, VÀNG, BẠC, THƯỜNG
        
        return full_stats

if __name__ == "__main__":
    pass
