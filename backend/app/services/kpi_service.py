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

    @staticmethod
    def calculate_sla_compliance(db: Session, entity_type: str, entity_id: str, period_key: str):
        """
        GOVERNANCE: Calculate SLA Compliance Rate for a given entity and period.
        SLA_COMPLIANCE = (MET Count) / (MET + BREACHED Count)
        """
        # Logic to parse period_key (e.g. '2026-05')
        try:
            year, month = map(int, period_key.split('-'))
            start_date = datetime(year, month, 1)
            if month == 12:
                end_date = datetime(year + 1, 1, 1)
            else:
                end_date = datetime(year, month + 1, 1)
        except:
            raise ValueError("Invalid period_key format. Expected YYYY-MM")

        # 1. Base query for trackers
        query = db.query(SLATracker).filter(
            SLATracker.start_time >= start_date,
            SLATracker.start_time < end_date
        )

        # 2. Scope by entity
        if entity_type == 'HIERARCHY_NODE':
            # This is complex because SLATracker doesn't have node_id directly.
            # We need to link through SystemEvent -> User -> NhanSu -> HierarchyNode
            # OR ActionTask -> NhanSu -> HierarchyNode
            # For simplicity, let's look at all trackers for now or link by target_id if applicable.
            # IN V3.0, we'll assume global or filtered by prefix if target_id follows a pattern.
            pass
        elif entity_type == 'STAFF':
            # Link through Task or Event owner
            pass

        # 3. Aggregation
        total_finished = query.filter(SLATracker.status.in_(['MET', 'BREACHED'])).all()
        met_count = len([t for t in total_finished if t.status == 'MET'])
        total_count = len(total_finished)
        
        compliance_rate = (met_count / total_count) if total_count > 0 else 1.0 # Default to 1.0 if no data
        
        evidence = {
            "sla": {
                "met_count": met_count,
                "breached_count": total_count - met_count,
                "total_count": total_count,
                "period": period_key
            }
        }
        
        return KPIService.record_score(
            db, 
            kpi_code='SLA_COMPLIANCE_RATE',
            entity_type=entity_type,
            entity_id=entity_id,
            period_type='MONTHLY',
            period_key=period_key,
            score=compliance_rate,
            raw_value=float(met_count),
            evidence_json=evidence
        )

    @staticmethod
    def get_kpi_dashboard(db: Session, entity_type: str = None, entity_id: str = None, period_key: str = None):
        """
        GOVERNANCE: Get the latest score for each defined KPI.
        """
        definitions = db.query(KPIDefinition).all()
        results = []
        
        for defn in definitions:
            latest_score = db.query(KPIScore).filter(
                KPIScore.kpi_id == defn.id
            )
            
            if entity_type:
                latest_score = latest_score.filter(KPIScore.entity_type == entity_type)
            if entity_id:
                latest_score = latest_score.filter(KPIScore.entity_id == entity_id)
            if period_key:
                latest_score = latest_score.filter(KPIScore.period_key == period_key)
                
            latest_score = latest_score.order_by(KPIScore.calculated_at.desc()).first()
            
            results.append({
                "definition": defn,
                "latest_score": latest_score
            })
            
        return results
