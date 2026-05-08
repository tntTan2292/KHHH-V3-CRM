from sqlalchemy.orm import Session
from .kpi_rollup_service import KPIRollupService
from .kpi_scoring_service import KPIScoringService
from ..core.kpi_governance import KPIRegistry
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class ExecutiveHealthService:
    """
    [GOVERNANCE] Executive Health Engine.
    Calculates dynamic operational health scores based on weighted KPI performance.
    Treats results as derived operational intelligence, not canonical KPIs.
    """

    # Governed Health Weights (Total: 100%)
    HEALTH_WEIGHTS = {
        "REVENUE": 0.35,
        "ACTIVE_CUSTOMERS": 0.20,
        "REVENUE_GROWTH": 0.15,
        "VOLUME": 0.10,
        "CHURN_CUSTOMERS": 0.10,
        "NEW_CUSTOMERS": 0.05,
        "POTENTIAL_LEADS": 0.05
    }

    @staticmethod
    def get_previous_month(period_key: str) -> str:
        """Utility to get previous YYYY-MM period."""
        try:
            year, month = map(int, period_key.split('-'))
            dt = datetime(year, month, 1) - timedelta(days=1)
            return dt.strftime('%Y-%m')
        except:
            return ""

    @staticmethod
    def calculate_health_score(db: Session, entity_type: str, entity_id: str, period_key: str):
        """
        Calculates dynamic health score for a specific entity and period.
        Supports hierarchy nodes and staff.
        """
        # 1. Fetch Current Month KPIs
        # Note: We assume entity_id is numeric ID for HIERARCHY_NODE if entity_type matches
        current_kpis = {}
        if entity_type == 'HIERARCHY_NODE':
            current_kpis = KPIRollupService.aggregate_node_kpis(db, int(entity_id), period_key)
        elif entity_type == 'STAFF':
            # Need date range for staff rollup
            year, month = map(int, period_key.split('-'))
            start_date = datetime(year, month, 1)
            end_date = (start_date + timedelta(days=32)).replace(day=1) - timedelta(seconds=1)
            current_kpis = KPIRollupService.aggregate_staff_kpis(db, int(entity_id), start_date, end_date)
        
        # 2. Calculate Growth (MoM)
        prev_month = ExecutiveHealthService.get_previous_month(period_key)
        prev_kpis = {}
        if prev_month:
            if entity_type == 'HIERARCHY_NODE':
                prev_kpis = KPIRollupService.aggregate_node_kpis(db, int(entity_id), prev_month)
            # Staff growth logic can be added here if needed
        
        current_rev = current_kpis.get("REVENUE", 0.0)
        prev_rev = prev_kpis.get("REVENUE", 0.0)
        
        growth_rate = 0.0
        if prev_rev > 0:
            growth_rate = ((current_rev - prev_rev) / prev_rev) * 100
        
        current_kpis["REVENUE_GROWTH"] = growth_rate

        # 3. Normalize and Weight
        total_weighted_score = 0.0
        details = []

        for kpi_code, weight in ExecutiveHealthService.HEALTH_WEIGHTS.items():
            raw_value = current_kpis.get(kpi_code, 0.0)
            
            # Normalize using Scoring Engine
            normalized_score = KPIScoringService.calculate_normalized_score(kpi_code, raw_value)
            weighted_score = normalized_score * weight
            
            total_weighted_score += weighted_score
            details.append({
                "kpi_code": kpi_code,
                "display_name": KPIRegistry.get_kpi(kpi_code).display_name if KPIRegistry.get_kpi(kpi_code) else kpi_code,
                "raw_value": raw_value,
                "normalized_score": normalized_score,
                "weight": weight,
                "weighted_score": round(weighted_score, 2)
            })

        # 4. Map to Executive Status
        status = ExecutiveHealthService.get_health_status(total_weighted_score)

        return {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "period_key": period_key,
            "operational_health_score": round(total_weighted_score, 2),
            "status": status,
            "metrics_breakdown": details,
            "timestamp": datetime.now().isoformat()
        }

    @staticmethod
    def get_health_status(score: float) -> str:
        """Governed status mapping."""
        if score >= 90: return "HEALTHY"
        if score >= 70: return "STABLE"
        if score >= 40: return "WARNING"
        return "CRITICAL"

    @staticmethod
    def get_hierarchy_health(db: Session, node_id: int, period_key: str):
        """
        Gets health for a node and summary of its children.
        """
        # Node Health
        node_health = ExecutiveHealthService.calculate_health_score(db, 'HIERARCHY_NODE', str(node_id), period_key)
        
        # Child Health (Immediate only for visibility)
        from ..models import HierarchyNode
        children = db.query(HierarchyNode).filter(HierarchyNode.parent_id == node_id).all()
        
        child_health_summaries = []
        for child in children:
            try:
                # Lightweight health calculation for children
                c_health = ExecutiveHealthService.calculate_health_score(db, 'HIERARCHY_NODE', str(child.id), period_key)
                child_health_summaries.append({
                    "id": child.id,
                    "code": child.code,
                    "name": child.name,
                    "score": c_health["operational_health_score"],
                    "status": c_health["status"]
                })
            except Exception as e:
                logger.error(f"Failed to calculate child health for {child.code}: {str(e)}")
        
        return {
            "node": node_health,
            "children": child_health_summaries
        }
