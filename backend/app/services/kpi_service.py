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
    
    # GOVERNANCE: Strict KPI Score Lifecycle
    ALLOWED_TRANSITIONS = {
        'DRAFT': ['FINALIZED', 'SUPERSEDED', 'NO_DATA'],
        'FINALIZED': ['SUPERSEDED'],
        'SUPERSEDED': [],
        'NO_DATA': ['FINALIZED', 'SUPERSEDED']
    }

    @staticmethod
    def validate_transition(current_status, new_status):
        """
        Hardened Lifecycle Governance
        """
        allowed = KPIService.ALLOWED_TRANSITIONS.get(current_status, [])
        if new_status not in allowed:
            raise Exception(f"CRITICAL KPI GOVERNANCE FAILURE: Illegal transition from {current_status} to {new_status}")
    
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
        db.flush() # Ensure run is tracked
        return engine_run

    @staticmethod
    def end_engine_run(db: Session, engine_run: EngineRun, status: str = 'SUCCESS', count: int = 0):
        """
        GOVERNANCE: Finalize engine run with truth metrics.
        """
        engine_run.status = status
        engine_run.completed_at = KPIService._get_governed_now()
        engine_run.processed_entities_count = count
    
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
    def record_score_transactional(
        db: Session, 
        kpi_code: str, 
        entity_type: str, 
        entity_id: str, 
        period_type: str, 
        period_key: str, 
        score: float, 
        status: str = 'FINALIZED',
        raw_value: float = None,
        evidence_json: dict = None
    ):
        """
        GOVERNANCE: Atomic transaction for Score + Snapshot + Supersede logic.
        """
        definition = db.query(KPIDefinition).filter(KPIDefinition.code == kpi_code).first()
        if not definition:
            raise ValueError(f"KPI Definition {kpi_code} not found.")

        now = KPIService._get_governed_now()

        # 1. Lifecycle Governance: Supersede previous records
        existing_active = db.query(KPIScore).filter(
            KPIScore.kpi_id == definition.id,
            KPIScore.entity_type == entity_type,
            KPIScore.entity_id == entity_id,
            KPIScore.period_key == period_key,
            KPIScore.status == 'FINALIZED'
        ).all()
        
        for old_score in existing_active:
            KPIService.validate_transition(old_score.status, 'SUPERSEDED')
            old_score.status = 'SUPERSEDED'

        # 2. Create the score record
        kpi_score = KPIScore(
            kpi_id=definition.id,
            entity_type=entity_type,
            entity_id=entity_id,
            period_type=period_type,
            period_key=period_key,
            score=score,
            raw_value=raw_value,
            calculated_at=now,
            status=status
        )
        db.add(kpi_score)
        db.flush() # Secure score ID

        # 3. Create the immutable audit snapshot (Deterministic Linkage)
        snapshot = KPIAuditSnapshot(
            kpi_score_id=kpi_score.id,
            kpi_snapshot_json=json.dumps({
                "score_context": {
                    "kpi_code": kpi_code,
                    "entity": f"{entity_type}:{entity_id}",
                    "period": f"{period_type}:{period_key}",
                    "governance_status": status
                },
                "formula_snapshot": definition.formula_config_json,
                "evidence": evidence_json
            }),
            engine_version="3.2.0-KPI-HARDENED-ATOMIC",
            sla_metrics_json=json.dumps(evidence_json.get("sla", {})) if evidence_json and "sla" in evidence_json else None,
            task_metrics_json=json.dumps(evidence_json.get("tasks", {})) if evidence_json and "tasks" in evidence_json else None,
            escalation_metrics_json=json.dumps(evidence_json.get("escalations", {})) if evidence_json and "escalations" in evidence_json else None,
            governed_at=now
        )
        db.add(snapshot)
        db.flush() # Secure snapshot ID
        
        # Link back
        kpi_score.snapshot_id = snapshot.id
        return kpi_score

    @staticmethod
    def get_scores(db: Session, entity_type: str = None, entity_id: str = None, period_key: str = None):
        query = db.query(KPIScore).filter(KPIScore.status == 'FINALIZED')
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
        GOVERNANCE: Hardened calculation with Atomic Transactions and No-Data awareness.
        """
        engine_run = KPIService.start_engine_run(db, 'SLA_COMPLIANCE_RATE', period_key, entity_type, entity_id)
        
        try:
            # 1. Period Parsing
            year, month = map(int, period_key.split('-'))
            start_date = datetime(year, month, 1)
            end_date = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)

            # 2. Metric Aggregation
            total_finished = db.query(SLATracker).filter(
                SLATracker.start_time >= start_date,
                SLATracker.start_time < end_date,
                SLATracker.status.in_(['MET', 'BREACHED'])
            ).all()

            met_count = len([t for t in total_finished if t.status == 'MET'])
            total_count = len(total_finished)
            
            # 3. No-Data Governance
            if total_count == 0:
                score_record = KPIService.record_score_transactional(
                    db, 
                    kpi_code='SLA_COMPLIANCE_RATE',
                    entity_type=entity_type,
                    entity_id=entity_id,
                    period_type='MONTHLY',
                    period_key=period_key,
                    score=None, # Explicit NULL
                    status='NO_DATA', # Explicit status
                    raw_value=0.0,
                    evidence_json={"info": "No SLA trackers found in this period", "run_id": engine_run.run_id}
                )
                KPIService.end_engine_run(db, engine_run, status='SUCCESS', count=0)
            else:
                compliance_rate = met_count / total_count
                score_record = KPIService.record_score_transactional(
                    db, 
                    kpi_code='SLA_COMPLIANCE_RATE',
                    entity_type=entity_type,
                    entity_id=entity_id,
                    period_type='MONTHLY',
                    period_key=period_key,
                    score=compliance_rate,
                    status='FINALIZED',
                    raw_value=float(met_count),
                    evidence_json={
                        "sla": {"met_count": met_count, "breached_count": total_count - met_count, "total_count": total_count},
                        "run_id": engine_run.run_id
                    }
                )
                KPIService.end_engine_run(db, engine_run, status='SUCCESS', count=total_count)
            
            db.commit() # ATOMIC BOUNDARY
            return score_record

        except Exception as e:
            db.rollback() # Ensure nothing dangles
            # Attempt to mark run as failed in separate transaction
            try:
                from ..database import SessionLocal
                db_fail = SessionLocal()
                run_fail = db_fail.query(EngineRun).filter(EngineRun.run_id == engine_run.run_id).first()
                if run_fail:
                    run_fail.status = 'FAILED'
                    db_fail.commit()
                db_fail.close()
            except: pass
            raise e

    @staticmethod
    def get_kpi_dashboard(db: Session, entity_type: str = None, entity_id: str = None, period_key: str = None):
        """
        GOVERNANCE: Executive Dashboard Data Retrieval Strategy.
        - Only reads 'FINALIZED' truth.
        - Avoids ambiguous latest-record logic.
        - Supports 'NO_DATA' awareness.
        """
        definitions = db.query(KPIDefinition).all()
        results = []
        
        for defn in definitions:
            latest_score = db.query(KPIScore).filter(
                KPIScore.kpi_id == defn.id,
                KPIScore.status == 'FINALIZED'
            )
            
            if entity_type:
                latest_score = latest_score.filter(KPIScore.entity_type == entity_type)
            if entity_id:
                latest_score = latest_score.filter(KPIScore.entity_id == entity_id)
            if period_key:
                latest_score = latest_score.filter(KPIScore.period_key == period_key)
                
            # Deterministic selection: The most recently calculated FINALIZED record
            # Note: Database uniqueness index idx_kpi_score_truth_uniqueness ensures only one per period
            latest_score = latest_score.order_by(KPIScore.calculated_at.desc()).first()
            
            results.append({
                "definition": defn,
                "latest_score": latest_score
            })
            
        return results

# ==============================================================================
# GOVERNANCE POLICY: KPI ORCHESTRATION ENGINE
# ==============================================================================
# 1. OFFICIAL TRUTH POLICY:
#    - Only records with status 'FINALIZED' are considered "Official Truth".
#    - Dashboard and Reporting layers MUST filter by status='FINALIZED'.
#
# 2. REPLAY & RECALCULATION STRATEGY:
#    - Re-running a calculation for the same period/entity will:
#      a. Mark previous 'FINALIZED' records as 'SUPERSEDED'.
#      b. Create a new 'FINALIZED' record within an Atomic Transaction.
#    - Database Index 'idx_kpi_score_truth_uniqueness' enforces this policy.
#
# 3. NO-DATA POLICY:
#    - "No data" is NOT equal to "100% Compliance".
#    - If no underlying metrics found, a record with status 'NO_DATA' and score NULL is created.
#    - This ensures auditable transparency of missing data periods.
#
# 4. ATOMICITY:
#    - Every calculation session is tracked by an EngineRun.
#    - Score + Snapshot + Linkage + Status updates are committed as a single transaction.
#    - Failures trigger a Rollback to prevent dangling metrics.
# ==============================================================================
