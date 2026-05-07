import json
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models import KPIDefinition, KPIScore, KPIAuditSnapshot, User, NhanSu, HierarchyNode, SystemEvent, SLATracker, ActionTask

class KPIService:
    """
    GOVERNANCE: Centralized KPI Orchestration Engine.
    Handles definition, calculation, persistence, and audit snapshots.
    """
    
    @staticmethod
    def get_definitions(db: Session):
        return db.query(KPIDefinition).all()

    @staticmethod
    def create_definition(db: Session, code: str, name: str, description: str, formula: str, target: float = None):
        existing = db.query(KPIDefinition).filter(KPIDefinition.code == code).first()
        if existing:
            return existing
            
        definition = KPIDefinition(
            code=code,
            name=name,
            description=description,
            formula_description=formula,
            target_value=target
        )
        db.add(definition)
        db.commit()
        db.refresh(definition)
        return definition

    @staticmethod
    def record_score(
        db: Session, 
        kpi_code: str, 
        entity_type: str, 
        entity_id: str, 
        period_type: str, 
        period_key: str, 
        score: float, 
        raw_value: float = None,
        evidence_json: dict = None
    ):
        """
        GOVERNANCE: Record a KPI score with an immutable truth snapshot.
        """
        definition = db.query(KPIDefinition).filter(KPIDefinition.code == kpi_code).first()
        if not definition:
            raise ValueError(f"KPI Definition {kpi_code} not found.")

        # 1. Create the score record
        kpi_score = KPIScore(
            kpi_id=definition.id,
            entity_type=entity_type,
            entity_id=entity_id,
            period_type=period_type,
            period_key=period_key,
            score=score,
            raw_value=raw_value
        )
        db.add(kpi_score)
        db.flush() # Get ID

        # 2. Create the immutable audit snapshot
        snapshot = KPIAuditSnapshot(
            kpi_score_id=kpi_score.id,
            kpi_snapshot_json=json.dumps(evidence_json) if evidence_json else "{}",
            engine_version="3.0.0-KPI-FOUNDATION",
            sla_metrics_json=json.dumps(evidence_json.get("sla", {})) if evidence_json and "sla" in evidence_json else None,
            task_metrics_json=json.dumps(evidence_json.get("tasks", {})) if evidence_json and "tasks" in evidence_json else None,
            escalation_metrics_json=json.dumps(evidence_json.get("escalations", {})) if evidence_json and "escalations" in evidence_json else None
        )
        db.add(snapshot)
        
        # Link back
        kpi_score.snapshot_id = snapshot.id
        
        db.commit()
        db.refresh(kpi_score)
        return kpi_score

    @staticmethod
    def get_scores(db: Session, entity_type: str = None, entity_id: str = None, period_key: str = None):
        query = db.query(KPIScore)
        if entity_type:
            query = query.filter(KPIScore.entity_type == entity_type)
        if entity_id:
            query = query.filter(KPIScore.entity_id == entity_id)
        if period_key:
            query = query.filter(KPIScore.period_key == period_key)
        return query.order_by(KPIScore.calculated_at.desc()).all()
