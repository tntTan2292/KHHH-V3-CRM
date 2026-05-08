import sqlite3
import json
import uuid
import hashlib
from datetime import datetime, timedelta
import logging
import os

logger = logging.getLogger(__name__)

class EscalationEngineCore:
    VERSION = "1.1.0"
    PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    DB_PATH = os.path.join(PROJECT_ROOT, "data", "database", "khhh_v3.db")

    # GOVERNANCE: Strict Linear State Machine (Hardened Block 2)
    ALLOWED_TRANSITIONS = {
        'PENDING': ['ESCALATED'],
        'ESCALATED': ['ACKNOWLEDGED'],
        'ACKNOWLEDGED': ['RESOLVED'],
        'RESOLVED': ['CLOSED'],
        'CLOSED': [] 
    }

    @staticmethod
    def validate_transition(current_status, new_status):
        """
        Hardened Lifecycle Governance
        """
        allowed = EscalationEngineCore.ALLOWED_TRANSITIONS.get(current_status, [])
        if new_status not in allowed:
            raise Exception(f"CRITICAL ESCALATION GOVERNANCE FAILURE: Illegal transition from {current_status} to {new_status}")

    @staticmethod
    def _get_governed_now():
        """
        Hardened Block 3: Governed SLA Clock
        """
        return datetime.now()

    @staticmethod
    def get_connection():
        return sqlite3.connect(EscalationEngineCore.DB_PATH, isolation_level=None)

    @staticmethod
    def run_engine():
        """
        Flow 1: Engine Run Flow
        Tracks execution and provides idempotency.
        """
        run_id = str(uuid.uuid4())
        conn = EscalationEngineCore.get_connection()
        now = EscalationEngineCore._get_governed_now()
        
        # Start Engine Run Tracking
        run_hash = hashlib.sha256(f"ESCALATION_ENGINE_CORE:{now.strftime('%Y-%m-%d %H')}".encode()).hexdigest()
        
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM engine_runs WHERE run_hash = ? AND status = 'STARTED'", (run_hash,))
        if cursor.fetchone():
            print(f"Skipping overlapping Escalation Run for hash {run_hash}")
            return None

        cursor.execute("""
            INSERT INTO engine_runs (run_id, engine_name, status, run_hash, started_at)
            VALUES (?, 'ESCALATION_ENGINE_CORE', 'STARTED', ?, ?)
        """, (run_id, run_hash, now.strftime('%Y-%m-%d %H:%M:%S')))
        
        try:
            # Flow 2 & 3: Candidates & Evaluation
            candidates = EscalationEngineCore._collect_escalation_candidates(conn)
            
            processed_count = 0
            escalated_count = 0
            
            for event in candidates:
                processed_count += 1
                rules = EscalationEngineCore._get_matching_rules(conn, event['event_code'])
                
                for rule in rules:
                    if EscalationEngineCore._should_escalate(conn, event, rule, now):
                        success = EscalationEngineCore._process_escalation(conn, event, rule, run_id, now)
                        if success: escalated_count += 1
            
            # Complete Run
            cursor.execute("""
                UPDATE engine_runs 
                SET status = 'SUCCESS', completed_at = datetime('now'),
                    processed_entities_count = ?, generated_events_count = ?
                WHERE run_id = ?
            """, (processed_count, escalated_count, run_id))
            print(f"Escalation Engine {run_id} finished. Processed: {processed_count}, Escalated: {escalated_count}")
            
        except Exception as e:
            cursor.execute("""
                UPDATE engine_runs SET status = 'FAILED', completed_at = datetime('now') WHERE run_id = ?
            """, (run_id,))
            logger.error(f"Escalation Engine Failed: {e}")
            raise e
        finally:
            conn.close()

    @staticmethod
    def _collect_escalation_candidates(conn):
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM system_events 
            WHERE status NOT IN ('RESOLVED', 'SUPPRESSED', 'CLOSED')
        """)
        columns = [column[0] for column in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]

    @staticmethod
    def _get_matching_rules(conn, event_code):
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM escalation_rules WHERE event_code = ? AND is_enabled = 1 ORDER BY escalation_level ASC", (event_code,))
        columns = [column[0] for column in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]

    MAX_ESCALATION_LEVEL = 5
    COOLDOWN_MINUTES = 60

    @staticmethod
    def _should_escalate(conn, event, rule, now):
        """
        Flow 3: Governed Condition Detection with Anti-loop & Cooldown
        """
        # [GOVERNANCE] Anti-loop: Prevent escalation beyond Max Level
        if rule['escalation_level'] > EscalationEngineCore.MAX_ESCALATION_LEVEL:
            logger.warning(f"Governance Block: Max escalation level reached for Event {event['id']}")
            return False

        cursor = conn.cursor()
        
        # [GOVERNANCE] Check for duplicate level
        cursor.execute("""
            SELECT id FROM escalation_records 
            WHERE event_id = ? AND escalation_level = ? AND status != 'CLOSED'
        """, (event['id'], rule['escalation_level']))
        if cursor.fetchone(): return False 

        # [GOVERNANCE] Cooldown Protection: Check for recent escalation of ANY level for this event
        cursor.execute("""
            SELECT MAX(escalated_at) FROM escalation_records WHERE event_id = ?
        """, (event['id'],))
        last_esc_at_raw = cursor.fetchone()[0]
        if last_esc_at_raw:
            last_esc_at = datetime.strptime(last_esc_at_raw, '%Y-%m-%d %H:%M:%S')
            if (now - last_esc_at).total_seconds() < EscalationEngineCore.COOLDOWN_MINUTES * 60:
                # Still in cooldown
                return False

        triggered_at = datetime.strptime(event['first_triggered_at'], '%Y-%m-%d %H:%M:%S')
        elapsed_hours = (now - triggered_at).total_seconds() / 3600
        
        return elapsed_hours >= rule['wait_hours']

    @staticmethod
    def _process_escalation(conn, event, rule, run_id, now):
        """
        Flow 4: Routing & Coordination
        """
        # Snapshot (Auditability)
        snapshot = {
            "event_state": event['status'],
            "current_owner_id": event['assigned_user_id'],
            "triggered_at": event['first_triggered_at'],
            "rule_id": rule['id'],
            "escalation_level": rule['escalation_level'],
            "wait_hours": rule['wait_hours']
        }
        snapshot_json = json.dumps(snapshot)
        
        record_id = EscalationEngineCore._create_escalation_record(conn, event['id'], rule, run_id, snapshot_json, now)
        
        if rule['action_type'] == 'TRANSFER_OWNERSHIP':
            EscalationEngineCore._transfer_ownership(conn, event['id'], rule)
            
        return True

    @staticmethod
    def _create_escalation_record(conn, event_id, rule, run_id, snapshot_json, now):
        cursor = conn.cursor()
        due_at = (now + timedelta(hours=rule['wait_hours'])).strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.execute("""
            INSERT INTO escalation_records (
                event_id, run_id, rule_id, escalation_level,
                is_ownership_transfer, status, escalation_snapshot_json,
                escalation_reason_code, current_coordinator_team,
                escalated_at, due_at
            ) VALUES (?, ?, ?, ?, ?, 'ESCALATED', ?, ?, ?, ?, ?)
        """, (
            event_id, run_id, rule['id'], rule['escalation_level'],
            1 if rule['action_type'] == 'TRANSFER_OWNERSHIP' else 0,
            snapshot_json, rule['trigger_condition_type'], rule['target_team'],
            now.strftime('%Y-%m-%d %H:%M:%S'), due_at
        ))
        return cursor.lastrowid

    @staticmethod
    def _transfer_ownership(conn, event_id, rule):
        """
        Flow 5: Ownership Transfer with Auditability
        """
        cursor = conn.cursor()
        
        # 1. Update the event
        cursor.execute("""
            UPDATE system_events 
            SET ownership_status = 'ESCALATED', 
                assigned_role = ?, 
                assigned_team = ?
            WHERE id = ?
        """, (rule['target_role'], rule['target_team'], event_id))

        # 2. Add an entry to event history if available, or update notes
        # For simplicity in this refactor, we update event notes to include the escalation trace
        audit_note = f" --- OWNERSHIP ESCALATED to {rule['target_role']} (Level {rule['escalation_level']}) by Rule {rule['id']}"
        cursor.execute("""
            UPDATE system_events 
            SET notes = COALESCE(notes, '') || ?
            WHERE id = ?
        """, (audit_note, event_id))
        
        logger.info(f"Ownership transferred for Event {event_id} to {rule['target_role']}")

if __name__ == "__main__":
    EscalationEngineCore.run_engine()
