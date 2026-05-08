import logging
import json
import hashlib
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from ..models import SystemEvent, HierarchyNode
from ..core.kpi_governance import KPIRegistry
from .kpi_rollup_service import KPIRollupService
from .kpi_scoring_service import KPIScoringService

logger = logging.getLogger(__name__)

class KPIAlertService:
    """
    [GOVERNANCE] Centralized KPI Alert Engine.
    Translates performance degradation into formal System Events.
    """

    @staticmethod
    def evaluate_node_performance(db: Session, node_id: int, year_month: str) -> List[SystemEvent]:
        """
        Evaluates all governed KPIs for a node and generates alerts if thresholds are breached.
        """
        node = db.query(HierarchyNode).filter(HierarchyNode.id == node_id).first()
        if not node:
            return []

        # 1. Aggregate current performance
        performance = KPIRollupService.aggregate_node_kpis(db, node_id, year_month)
        
        alerts = []
        for kpi_code, raw_value in performance.items():
            kpi_def = KPIRegistry.get_kpi(kpi_code)
            if not kpi_def or not kpi_def.can_escalate:
                continue

            # 2. Calculate score & status
            score = KPIScoringService.calculate_normalized_score(kpi_code, raw_value)
            status = KPIScoringService.get_performance_status(kpi_code, score)

            # 3. Trigger alert for Warning/Critical
            if status in ["WARNING", "CRITICAL"]:
                event = KPIAlertService._generate_kpi_event(
                    db, node, kpi_code, raw_value, score, status, year_month
                )
                if event:
                    alerts.append(event)
        
        return alerts

    @staticmethod
    def _generate_kpi_event(
        db: Session, 
        node: HierarchyNode, 
        kpi_code: str, 
        raw_value: float, 
        score: float, 
        status: str,
        year_month: str
    ) -> Any:
        """
        Creates a SystemEvent for a KPI breach with Enterprise Lock (Deduplication).
        """
        kpi_def = KPIRegistry.get_kpi(kpi_code)
        
        # 1. Create Identity Key & Dedup Hash
        identity_key = f"KPI_ALERT:{node.id}:{kpi_code}:{year_month}"
        dedup_hash = hashlib.md5(identity_key.encode()).hexdigest()

        # 2. Check for existing active event (Enterprise Lock)
        existing = db.query(SystemEvent).filter(
            SystemEvent.identity_key == identity_key,
            SystemEvent.status.notin_(["RESOLVED", "SUPPRESSED"])
        ).first()

        if existing:
            # Update occurrence count if still active
            existing.occurrence_count += 1
            db.commit()
            return existing

        # 3. Create new Event
        severity = "HIGH" if status == "CRITICAL" else "MEDIUM"
        unit = kpi_def.unit if kpi_def else ""
        
        title = f"Alert: Performance {status} - {kpi_def.display_name if kpi_def else kpi_code}"
        message = (
            f"Organizational node {node.name} ({node.code}) has reached {status} performance level. "
            f"Current Value: {raw_value:,.2f} {unit} | Target: {kpi_def.target_value:,.2f} {unit} | "
            f"Normalized Score: {score:.2f}"
        )

        new_event = SystemEvent(
            identity_key=identity_key,
            dedup_hash=dedup_hash,
            event_code="KPI_PERFORMANCE_ALERT",
            aggregation_category="KPI_GOVERNANCE",
            entity_type="HIERARCHY_NODE",
            entity_id=str(node.id),
            source_engine="KPIAlertService",
            severity=severity,
            status="OPEN",
            title=title,
            message=message,
            event_input_snapshot_json=json.dumps({
                "kpi_code": kpi_code,
                "raw_value": raw_value,
                "score": score,
                "status": status,
                "year_month": year_month,
                "node_code": node.code
            }),
            rule_version=1,
            engine_version="1.0"
        )

        db.add(new_event)
        try:
            db.commit()
            db.refresh(new_event)
            return new_event
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create KPI alert event: {e}")
            return None
