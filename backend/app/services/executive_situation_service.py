from sqlalchemy.orm import Session
from .executive_health_service import ExecutiveHealthService
from .operational_risk_service import OperationalRiskService
from ..models import SystemEvent, EscalationRecord
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class ExecutiveSituationService:
    """
    [GOVERNANCE] Executive Situation Room Service.
    Purely READ-ONLY aggregation of Health, Risk, Alerts, and Escalations.
    Deterministic severity mapping: CRITICAL > DEGRADED > WATCHLIST > NORMAL.
    """

    @staticmethod
    def get_situation_overview(db: Session, entity_type: str, entity_id: str, period_key: str):
        """
        Calculates the governed operational situation for an entity.
        """
        # 1. Consume Governed Outputs (Read-Only)
        health = ExecutiveHealthService.calculate_health_score(db, entity_type, entity_id, period_key)
        risk = OperationalRiskService.calculate_risk_score(db, entity_type, entity_id, period_key)
        
        # 2. Fetch Evidence (Read-Only)
        critical_alerts_count = risk["risk_signals"]["critical_alerts"]
        active_escalations_count = risk["risk_signals"]["active_escalations"]
        degradation_penalty = risk["risk_signals"]["degradation_penalty"]
        
        # 3. Deterministic Severity Evaluation
        situation_status = "NORMAL"
        
        # Rule 1: CRITICAL (Highest Priority)
        if (health["status"] == "CRITICAL" or 
            risk["status"] == "CRITICAL" or 
            active_escalations_count > 0):
            situation_status = "CRITICAL"
        
        # Rule 2: DEGRADED
        elif (risk["status"] == "HIGH" or 
              health["status"] == "WARNING" or 
              degradation_penalty > 0):
            situation_status = "DEGRADED"
            
        # Rule 3: WATCHLIST
        elif (risk["status"] == "ELEVATED" or 
              critical_alerts_count > 0):
            situation_status = "WATCHLIST"
            
        # Rule 4: NORMAL (Default)
        else:
            situation_status = "NORMAL"

        # 4. Aggregate Top Operational Concerns
        concerns = []
        if active_escalations_count > 0:
            concerns.append(f"Detected {active_escalations_count} unresolved escalations requiring immediate attention.")
        if critical_alerts_count > 0:
            concerns.append(f"Entity has {critical_alerts_count} active critical alerts.")
        if health["status"] == "CRITICAL":
            concerns.append("Operational health has dropped to critical levels.")
        if degradation_penalty > 0:
            concerns.append("KPI degradation detected in key performance metrics.")

        return {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "period_key": period_key,
            "situation_status": situation_status,
            "health": {
                "score": health["operational_health_score"],
                "status": health["status"]
            },
            "risk": {
                "score": risk["operational_risk_score"],
                "status": risk["status"]
            },
            "signals": {
                "critical_alerts": critical_alerts_count,
                "active_escalations": active_escalations_count,
                "degradation_detected": degradation_penalty > 0
            },
            "top_concerns": concerns,
            "timestamp": datetime.now().isoformat()
        }

    @staticmethod
    def get_hierarchy_situation(db: Session, node_id: int, period_key: str):
        """
        Provides situation overview for a node and its children.
        """
        node_situation = ExecutiveSituationService.get_situation_overview(db, 'HIERARCHY_NODE', str(node_id), period_key)
        
        from ..models import HierarchyNode
        children = db.query(HierarchyNode).filter(HierarchyNode.parent_id == node_id).all()
        
        child_situation_summaries = []
        for child in children:
            try:
                c_sit = ExecutiveSituationService.get_situation_overview(db, 'HIERARCHY_NODE', str(child.id), period_key)
                child_situation_summaries.append({
                    "id": child.id,
                    "code": child.code,
                    "name": child.name,
                    "status": c_sit["situation_status"],
                    "health_status": c_sit["health"]["status"],
                    "risk_status": c_sit["risk"]["status"]
                })
            except Exception as e:
                logger.error(f"Failed to calculate child situation for {child.code}: {str(e)}")
        
        return {
            "node": node_situation,
            "children": child_situation_summaries
        }
