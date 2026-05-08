from sqlalchemy.orm import Session
from .executive_health_service import ExecutiveHealthService
from .operational_risk_service import OperationalRiskService
from .executive_situation_service import ExecutiveSituationService
from .executive_trend_service import ExecutiveTrendService
from .executive_forecast_service import ExecutiveForecastService
from ..models import SystemEvent, EscalationRecord
import logging
from datetime import datetime
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class ExecutiveCommandService:
    """
    [GOVERNANCE] Executive Command Center Service.
    Aggregates all Executive Intelligence into a single Governed Payload.
    Strictly READ-ONLY, Summary-First, and Deterministic.
    """

    PAYLOAD_VERSION = "EXEC_COMMAND_V1"

    @staticmethod
    def build_executive_command_payload(db: Session, entity_type: str, entity_id: str, period_key: str):
        """
        Builds the unified executive payload.
        """
        # 1. Consume all Intelligence Layers
        health = ExecutiveHealthService.calculate_health_score(db, entity_type, entity_id, period_key)
        risk = OperationalRiskService.calculate_risk_score(db, entity_type, entity_id, period_key)
        situation = ExecutiveSituationService.get_situation_overview(db, entity_type, entity_id, period_key)
        trends = ExecutiveTrendService.analyze_trend(db, entity_type, entity_id, period_key)
        forecast = ExecutiveForecastService.get_executive_forecast(db, entity_type, entity_id, period_key)

        # 2. Executive Status Resolution (Deterministic Priority)
        executive_status = "NORMAL"
        
        # Rule 1: Situation Room Lock (CRITICAL)
        if situation["situation_status"] == "CRITICAL":
            executive_status = "CRITICAL"
        
        # Rule 2: Risk-based Criticality
        elif risk["status"] == "CRITICAL":
            executive_status = "CRITICAL"
            
        # Rule 3: DEGRADED logic
        elif (risk["status"] == "HIGH" or 
              trends.get("momentum", {}).get("REVENUE") == "CRITICAL_DECLINE" or 
              any(f.get("trend_status") == "CRITICAL_DECLINE" for f in forecast.get("forecast_summary", {}).values() if isinstance(f, dict))):
            executive_status = "DEGRADED"
            
        # Rule 4: WATCHLIST
        elif (risk["status"] == "ELEVATED" or 
              risk["risk_signals"]["critical_alerts"] > 0 or 
              any(a["type"] == "VOLATILITY_ALERT" for a in trends.get("anomaly_detection", []))):
            executive_status = "WATCHLIST"
        
        # 3. Aggregate and Deduplicate Insights
        all_concerns = situation.get("top_concerns", [])
        all_insights = forecast.get("executive_insights", [])
        
        # Add trend-based insights
        for anomaly in trends.get("anomaly_detection", []):
            all_concerns.append(f"Trend Alert: {anomaly['type']} detected for {anomaly['kpi']}.")

        unique_concerns = ExecutiveCommandService._deduplicate(all_concerns)
        unique_insights = ExecutiveCommandService._deduplicate(all_insights)

        # 4. Hierarchy Snapshot (Read-only aggregation)
        hierarchy_snapshot = {}
        if entity_type == 'HIERARCHY_NODE':
            hierarchy_snapshot = ExecutiveCommandService._build_hierarchy_snapshot(db, int(entity_id), period_key)

        # 5. Build Governed Payload
        return {
            "payload_version": ExecutiveCommandService.PAYLOAD_VERSION,
            "executive_status": executive_status,
            "period_key": period_key,
            "operational_health": health,
            "operational_risk": risk,
            "situation": situation,
            "trend_intelligence": trends,
            "forecast_intelligence": forecast,
            "top_operational_concerns": unique_concerns,
            "executive_insights": unique_insights,
            "hierarchy_snapshot": hierarchy_snapshot,
            "governance_metadata": {
                "generated_at": datetime.now().isoformat(),
                "deterministic": True,
                "summary_first": True,
                "read_only": True,
                "source_layers": ["HEALTH", "RISK", "SITUATION", "TREND", "FORECAST"]
            }
        }

    @staticmethod
    def _deduplicate(items: List[str]) -> List[str]:
        seen = set()
        return [x for x in items if not (x in seen or seen.add(x))]

    @staticmethod
    def _build_hierarchy_snapshot(db: Session, node_id: int, period_key: str):
        """Aggregates child statuses for overview."""
        from ..models import HierarchyNode
        children = db.query(HierarchyNode).filter(HierarchyNode.parent_id == node_id).all()
        
        counts = {"CRITICAL": 0, "DEGRADED": 0, "WATCHLIST": 0, "NORMAL": 0}
        critical_units = []
        declining_units = []

        for child in children:
            # Note: We use Situation Status as the anchor for hierarchy overview
            try:
                sit = ExecutiveSituationService.get_situation_overview(db, 'HIERARCHY_NODE', str(child.id), period_key)
                status = sit["situation_status"]
                counts[status] = counts.get(status, 0) + 1
                
                if status == "CRITICAL":
                    critical_units.append({"id": child.id, "code": child.code, "name": child.name})
                
                # Check for decline via trend
                trend = ExecutiveTrendService.analyze_trend(db, 'HIERARCHY_NODE', str(child.id), period_key)
                if trend.get("momentum", {}).get("REVENUE") == "CRITICAL_DECLINE":
                    declining_units.append({"id": child.id, "code": child.code, "name": child.name})
            except:
                continue

        return {
            "child_count": len(children),
            "status_distribution": counts,
            "critical_units": critical_units[:5], # Top 5
            "top_declining_units": declining_units[:5]
        }
