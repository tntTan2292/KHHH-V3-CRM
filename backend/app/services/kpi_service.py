import json
import hashlib
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models import (
    KPIDefinition, KPIScore, KPIAuditSnapshot, User, NhanSu, 
    HierarchyNode, SystemEvent, SLATracker, ActionTask, EngineRun
)

class KPIService:
    """
    GOVERNANCE: Centralized KPI Orchestration Engine.
    Handles definition, calculation, persistence, and audit snapshots.
    """
    
    @staticmethod
    def _get_governed_now():
        """
        GOVERNANCE: Centralized time control for the KPI Engine.
        """
        return datetime.now()

    @staticmethod
    def start_engine_run(db: Session, kpi_code: str, period_key: str, entity_type: str, entity_id: str):
        """
        GOVERNANCE: Orchestrate a deterministic engine run for KPI calculation.
        """
        now = KPIService._get_governed_now()
        
        # 1. Deterministic Run Identity
        run_hash_input = f"KPI|{kpi_code}|{period_key}|{entity_type}|{entity_id}"
        run_hash = hashlib.sha256(run_hash_input.encode()).hexdigest()
        run_id = f"KPI-RUN-{run_hash[:12]}-{now.strftime('%Y%m%d%H%M')}"

        # 2. Overlap Protection (Prevent multiple active runs for same context)
        existing_active = db.query(EngineRun).filter(
            EngineRun.engine_name == f"KPI_ENGINE:{kpi_code}",
            EngineRun.run_hash == run_hash,
            EngineRun.status == 'STARTED'
        ).first()

        if existing_active:
            raise Exception(f"CRITICAL GOVERNANCE BLOCK: Active KPI run already exists for {run_hash_input}")

        # 3. Initialize Run
        engine_run = EngineRun(
            run_id=run_id,
            engine_name=f"KPI_ENGINE:{kpi_code}",
            status='STARTED',
            run_hash=run_hash,
            started_at=now,
            execution_context_json=json.dumps({
                "kpi_code": kpi_code,
                "period_key": period_key,
                "entity_type": entity_type,
                "entity_id": entity_id
            })
        )
        db.add(engine_run)
        db.commit()
        db.refresh(engine_run)
        return engine_run

    @staticmethod
    def end_engine_run(db: Session, engine_run: EngineRun, status: str = 'SUCCESS', count: int = 0):
        """
        GOVERNANCE: Finalize engine run with truth metrics.
        """
        engine_run.status = status
        engine_run.completed_at = KPIService._get_governed_now()
        engine_run.processed_entities_count = count
        db.commit()
    
    @staticmethod
    def get_definitions(db: Session):
        return db.query(KPIDefinition).all()

    @staticmethod
    def create_definition(db: Session, code: str, name: str, description: str, formula_desc: str, formula_config: dict = None, target: float = None):
        existing = db.query(KPIDefinition).filter(KPIDefinition.code == code).first()
        if existing:
            return existing
            
        definition = KPIDefinition(
            code=code,
            name=name,
            description=description,
            formula_description=formula_desc,
            formula_config_json=json.dumps(formula_config) if formula_config else None,
            target_value=target,
            created_at=KPIService._get_governed_now()
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

        now = KPIService._get_governed_now()

        # 1. Create the score record
        kpi_score = KPIScore(
            kpi_id=definition.id,
            entity_type=entity_type,
            entity_id=entity_id,
            period_type=period_type,
            period_key=period_key,
            score=score,
            raw_value=raw_value,
            calculated_at=now
        )
        db.add(kpi_score)
        db.flush() # Get ID

        # 2. Create the immutable audit snapshot
        snapshot = KPIAuditSnapshot(
            kpi_score_id=kpi_score.id,
            kpi_snapshot_json=json.dumps(evidence_json) if evidence_json else "{}",
            engine_version="3.1.0-KPI-HARDENED",
            sla_metrics_json=json.dumps(evidence_json.get("sla", {})) if evidence_json and "sla" in evidence_json else None,
            task_metrics_json=json.dumps(evidence_json.get("tasks", {})) if evidence_json and "tasks" in evidence_json else None,
            escalation_metrics_json=json.dumps(evidence_json.get("escalations", {})) if evidence_json and "escalations" in evidence_json else None,
            governed_at=now
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
        GOVERNANCE: Calculate SLA Compliance Rate with full EngineRun orchestration.
        """
        engine_run = KPIService.start_engine_run(db, 'SLA_COMPLIANCE_RATE', period_key, entity_type, entity_id)
        
        try:
            # Logic to parse period_key (e.g. '2026-05')
            year, month = map(int, period_key.split('-'))
            start_date = datetime(year, month, 1)
            if month == 12:
                end_date = datetime(year + 1, 1, 1)
            else:
                end_date = datetime(year, month + 1, 1)

            # 1. Base query for trackers
            query = db.query(SLATracker).filter(
                SLATracker.start_time >= start_date,
                SLATracker.start_time < end_date
            )

            # 2. Aggregation
            total_finished = query.filter(SLATracker.status.in_(['MET', 'BREACHED'])).all()
            met_count = len([t for t in total_finished if t.status == 'MET'])
            total_count = len(total_finished)
            
            compliance_rate = (met_count / total_count) if total_count > 0 else 1.0
            
            evidence = {
                "sla": {
                    "met_count": met_count,
                    "breached_count": total_count - met_count,
                    "total_count": total_count,
                    "period": period_key
                },
                "run_id": engine_run.run_id
            }
            
            score_record = KPIService.record_score(
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
            
            KPIService.end_engine_run(db, engine_run, status='SUCCESS', count=total_count)
            return score_record

        except Exception as e:
            KPIService.end_engine_run(db, engine_run, status='FAILED')
            raise e

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
