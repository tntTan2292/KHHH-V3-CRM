from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models import MonthlyAnalyticsSummary
import logging

logger = logging.getLogger(__name__)

class LifecycleService:
    @staticmethod
    def get_customer_lifecycle_stats(db: Session, don_vi: str = None, start_date: str = None, end_date: str = None, scope_point_ids: list = None):
        """
        Fetches lifecycle and VIP statistics from MonthlyAnalyticsSummary.
        This ensures SSOT and high performance by using the pre-calculated summary.
        """
        if not start_date:
            latest_month = db.query(func.max(MonthlyAnalyticsSummary.year_month)).scalar()
            if not latest_month:
                return {}
            month_str = latest_month
        else:
            month_str = start_date[:7] # YYYY-MM
        
        base_query = db.query(MonthlyAnalyticsSummary).filter(
            MonthlyAnalyticsSummary.year_month == month_str,
            MonthlyAnalyticsSummary.ma_dv == 'ALL'
        )
        
        if scope_point_ids:
            base_query = base_query.filter(MonthlyAnalyticsSummary.point_id.in_(scope_point_ids))
        
        # 1. Aggregate Lifecycle Stats
        lifecycle_stats = db.query(
            MonthlyAnalyticsSummary.lifecycle_stage,
            func.sum(MonthlyAnalyticsSummary.total_customers).label("count")
        ).filter(
            MonthlyAnalyticsSummary.year_month == month_str,
            MonthlyAnalyticsSummary.ma_dv == 'ALL'
        )
        if scope_point_ids: lifecycle_stats = lifecycle_stats.filter(MonthlyAnalyticsSummary.point_id.in_(scope_point_ids))
        lifecycle_rows = lifecycle_stats.group_by(MonthlyAnalyticsSummary.lifecycle_stage).all()

        # 2. Aggregate VIP Stats
        vip_stats = db.query(
            MonthlyAnalyticsSummary.vip_tier,
            func.sum(MonthlyAnalyticsSummary.total_customers).label("count")
        ).filter(
            MonthlyAnalyticsSummary.year_month == month_str,
            MonthlyAnalyticsSummary.ma_dv == 'ALL'
        )
        if scope_point_ids: vip_stats = vip_stats.filter(MonthlyAnalyticsSummary.point_id.in_(scope_point_ids))
        vip_rows = vip_stats.group_by(MonthlyAnalyticsSummary.vip_tier).all()
        
        # Merge results
        result = {
            "NEW": 0, "ACTIVE": 0, "AT_RISK": 0, "CHURNED": 0, "REACTIVATED": 0,
            "DIAMOND": 0, "PLATINUM": 0, "GOLD": 0, "SILVER": 0, "BRONZE": 0, "NORMAL": 0,
            "KIM CƯƠNG": 0, "VÀNG": 0, "BẠC": 0, "THƯỜNG": 0 # For Potential Lead Ranks
        }
        
        for stage, count in lifecycle_rows:
            if stage and stage.upper() in result:
                result[stage.upper()] = int(count)
        
        for tier, count in vip_rows:
            if tier and tier.upper() in result:
                result[tier.upper()] = int(count)
                
        return result

if __name__ == "__main__":
    pass
