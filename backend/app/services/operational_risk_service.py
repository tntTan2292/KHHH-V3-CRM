from sqlalchemy.orm import Session
from sqlalchemy import func
from .executive_health_service import ExecutiveHealthService
from .kpi_rollup_service import KPIRollupService
from ..models import SystemEvent, EscalationRecord
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class OperationalRiskService:
    """
    [GOVERNANCE] Operational Risk Engine.
    Calculates dynamic risk scores based on health, alerts, and escalations.
    Treats results as governed executive semantics.
    """

    # Governed Risk Weights (Total: 100%)
    RISK_WEIGHTS = {
        "HEALTH_DEFICIT": 0.40,    # (100 - Health Score)
        "CRITICAL_ALERTS": 0.30,   # Active critical events
        "ACTIVE_ESCALATIONS": 0.20, # Active unresolved escalations
        "KPI_DEGRADATION": 0.10     # Month-over-month performance drop
    }

    @staticmethod
    def calculate_risk_score(db: Session, entity_type: str, entity_id: str, period_key: str):
        """
        Calculates dynamic risk score for a specific entity and period.
        """
        # 1. Health Deficit (40%)
        health_data = ExecutiveHealthService.calculate_health_score(db, entity_type, entity_id, period_key)
        health_score = health_data.get("operational_health_score", 100.0)
        health_deficit = 100.0 - health_score
        weighted_health_risk = (health_deficit / 100.0) * 100.0 * OperationalRiskService.RISK_WEIGHTS["HEALTH_DEFICIT"]

        # 2. Critical Alerts Risk (30%)
        # Count OPEN/REOPENED CRITICAL events for the entity
        critical_alerts_count = db.query(SystemEvent).filter(
            SystemEvent.entity_type == entity_type,
            SystemEvent.entity_id == entity_id,
            SystemEvent.severity == 'CRITICAL',
            SystemEvent.status.in_(['OPEN', 'REOPENED'])
        ).count()
        
        # Scoring: 1 alert = 20 points, 5+ alerts = 100 points (capped)
        alert_score = min(100.0, critical_alerts_count * 20.0)
        weighted_alert_risk = alert_score * OperationalRiskService.RISK_WEIGHTS["CRITICAL_ALERTS"]

        # 3. Active Escalations Risk (20%)
        # Count active unresolved escalations ONLY
        active_escalations_count = db.query(EscalationRecord).join(SystemEvent).filter(
            SystemEvent.entity_type == entity_type,
            SystemEvent.entity_id == entity_id,
            EscalationRecord.status.in_(['PENDING', 'ESCALATED', 'ACKNOWLEDGED'])
        ).count()
        
        # Scoring: 1 escalation = 50 points, 2+ = 100 points
        esc_score = min(100.0, active_escalations_count * 50.0)
        weighted_esc_risk = esc_score * OperationalRiskService.RISK_WEIGHTS["ACTIVE_ESCALATIONS"]

        # 4. KPI Degradation Risk (10%)
        # Detect MoM drop in Revenue and Active Customers
        prev_month = ExecutiveHealthService.get_previous_month(period_key)
        degradation_penalty = 0.0
        
        if prev_month:
            current_metrics = {}
            prev_metrics = {}
            if entity_type == 'HIERARCHY_NODE':
                current_metrics = KPIRollupService.aggregate_node_kpis(db, int(entity_id), period_key)
                prev_metrics = KPIRollupService.aggregate_node_kpis(db, int(entity_id), prev_month)
            
            # Check Revenue Drop
            if current_metrics.get("REVENUE", 0.0) < prev_metrics.get("REVENUE", 0.0):
                degradation_penalty += 50.0 # 50% of the degradation component
            
            # Check Active Customers Drop
            if current_metrics.get("ACTIVE_CUSTOMERS", 0.0) < prev_metrics.get("ACTIVE_CUSTOMERS", 0.0):
                degradation_penalty += 50.0
        
        weighted_degradation_risk = degradation_penalty * OperationalRiskService.RISK_WEIGHTS["KPI_DEGRADATION"]

        # 5. Total Risk Score
        total_risk_score = weighted_health_risk + weighted_alert_risk + weighted_esc_risk + weighted_degradation_risk
        total_risk_score = min(100.0, max(0.0, total_risk_score))

        # 6. Map to Risk Status
        status = OperationalRiskService.get_risk_status(total_risk_score)

        return {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "period_key": period_key,
            "operational_risk_score": round(total_risk_score, 2),
            "status": status,
            "risk_signals": {
                "health_deficit": round(health_deficit, 2),
                "critical_alerts": critical_alerts_count,
                "active_escalations": active_escalations_count,
                "degradation_penalty": degradation_penalty
            },
            "timestamp": datetime.now().isoformat()
        }

    @staticmethod
    def get_risk_status(score: float) -> str:
        """Governed risk status mapping."""
        if score < 20: return "LOW"
        if score < 40: return "GUARDED"
        if score < 60: return "ELEVATED"
        if score < 80: return "HIGH"
        return "CRITICAL"

    @staticmethod
    def get_hierarchy_risk(db: Session, node_id: int, period_key: str):
        """
        Gets risk for a node and summary of its children.
        """
        node_risk = OperationalRiskService.calculate_risk_score(db, 'HIERARCHY_NODE', str(node_id), period_key)
        
        from ..models import HierarchyNode
        children = db.query(HierarchyNode).filter(HierarchyNode.parent_id == node_id).all()
        
        child_risk_summaries = []
        for child in children:
            try:
                c_risk = OperationalRiskService.calculate_risk_score(db, 'HIERARCHY_NODE', str(child.id), period_key)
                child_risk_summaries.append({
                    "id": child.id,
                    "code": child.code,
                    "name": child.name,
                    "score": c_risk["operational_risk_score"],
                    "status": c_risk["status"]
                })
            except Exception as e:
                logger.error(f"Failed to calculate child risk for {child.code}: {str(e)}")
        
        return {
            "node": node_risk,
            "children": child_risk_summaries
        }
