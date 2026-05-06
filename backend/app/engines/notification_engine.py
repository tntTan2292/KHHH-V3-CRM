import sqlite3
import json
import uuid
import hashlib
from datetime import datetime, timedelta
import logging
import os
from ..core.config_segments import *

logger = logging.getLogger(__name__)

class NotificationEngineCore:
    VERSION = "1.0.0"
    PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    DB_PATH = os.path.join(PROJECT_ROOT, "data", "database", "khhh_v3.db")

    @staticmethod
    def get_connection():
        return sqlite3.connect(NotificationEngineCore.DB_PATH, isolation_level=None)

    @staticmethod
    def run_engine(month_str):
        """
        Governed execution of the Notification Engine.
        """
        run_id = str(uuid.uuid4())
        conn = NotificationEngineCore.get_connection()
        
        # 1. Start Engine Run
        NotificationEngineCore._start_run(conn, run_id, month_str)
        
        try:
            # 2. Collect Signals (From Summaries and Engine Outputs)
            # For Phase 5.1, we focus on Priority and VIP signals
            signals = NotificationEngineCore._collect_signals(conn, month_str)
            
            processed_count = 0
            generated_count = 0
            
            for signal in signals:
                processed_count += 1
                event_created = NotificationEngineCore._process_signal(conn, signal, run_id)
                if event_created:
                    generated_count += 1
            
            # 3. Complete Run
            NotificationEngineCore._complete_run(conn, run_id, processed_count, generated_count)
            print(f"Notification Engine Core run {run_id} completed. Processed: {processed_count}, Generated/Updated: {generated_count}")
            
        except Exception as e:
            NotificationEngineCore._fail_run(conn, run_id, str(e))
            logger.error(f"Notification Engine Core failed: {e}")
            raise e
        finally:
            conn.close()

    @staticmethod
    def _collect_signals(conn, month_str):
        """
        Reads governed signals from Customer and Summary tables.
        """
        cursor = conn.cursor()
        # Get Customers with High Priority or Risk
        cursor.execute("""
            SELECT ma_crm_cms, vip_tier, priority_score, priority_level, lifecycle_state, growth_tag 
            FROM customers 
            WHERE priority_score >= ? OR vip_tier != 'NORMAL'
        """, (PRIORITY_THRESHOLD_MEDIUM,))
        
        columns = [column[0] for column in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]

    @staticmethod
    def _process_signal(conn, signal, run_id):
        """
        Governed event processing: Identify -> Rule -> Dedup -> Persist.
        """
        ma_kh = signal['ma_crm_cms']
        
        # Determine Event Code
        event_code = None
        if signal['priority_level'] == 'CRITICAL' and signal['vip_tier'] != 'NORMAL':
            event_code = 'VIP_CHURN_RISK'
        elif signal['priority_score'] >= PRIORITY_THRESHOLD_HIGH:
            event_code = 'CRITICAL_REVENUE_DROP'
        
        if not event_code:
            return False

        # Load Rule
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM notification_rules WHERE event_code = ? AND is_enabled = 1", (event_code,))
        rule_row = cursor.fetchone()
        if not rule_row:
            return False
            
        rule = dict(zip([c[0] for c in cursor.description], rule_row))
        
        # 1. Identity Key
        identity_key = f"{event_code}:{ma_kh}:{rule['aggregation_category']}"
        
        # 2. Input Snapshot (Immutable Truth)
        snapshot = {
            "signal": signal,
            "thresholds": {
                "critical": PRIORITY_THRESHOLD_CRITICAL,
                "high": PRIORITY_THRESHOLD_HIGH
            },
            "timestamp": datetime.now().isoformat()
        }
        snapshot_json = json.dumps(snapshot)
        
        # 3. Dedup Hash (Technical Idempotency)
        # Hash of identity + data + run_id (to prevent double processing in SAME run)
        dedup_raw = f"{identity_key}:{snapshot_json}"
        dedup_hash = hashlib.sha256(dedup_raw.encode()).hexdigest()

        # Check for existing event
        cursor.execute("SELECT id, status, last_reoccurred_at, occurrence_count FROM system_events WHERE identity_key = ?", (identity_key,))
        existing = cursor.fetchone()
        
        if existing:
            event_id, status, last_reoccurred, count = existing
            
            # Check for Dedup (Idempotency)
            cursor.execute("SELECT id FROM system_events WHERE dedup_hash = ?", (dedup_hash,))
            if cursor.fetchone():
                return False # Already processed this exact data
                
            # Recurrence Governance
            cooldown_delta = timedelta(hours=rule['cooldown_hours'])
            last_dt = datetime.strptime(last_reoccurred, '%Y-%m-%d %H:%M:%S')
            
            if status == 'RESOLVED' and (datetime.now() - last_dt) > cooldown_delta:
                # REOPEN
                NotificationEngineCore._reopen_event(conn, event_id, status, snapshot_json, run_id, count + 1, dedup_hash)
                return True
            elif status == 'OPEN' or status == 'REOPENED':
                # Update occurrence
                NotificationEngineCore._update_occurrence(conn, event_id, count + 1, snapshot_json, dedup_hash)
                return True
            else:
                return False # Still in cooldown or suppressed
        else:
            # New Event Minting
            title = f"[{rule['aggregation_category']}] {event_code} - {ma_kh}"
            message = f"Customer {ma_kh} ({signal['vip_tier']}) is at {signal['priority_level']} priority level. Reason: {signal['lifecycle_state']} - {signal['growth_tag']}."
            
            NotificationEngineCore._create_event(conn, identity_key, dedup_hash, event_code, rule, signal, snapshot_json, run_id, title, message)
            return True

    @staticmethod
    def _create_event(conn, identity_key, dedup_hash, event_code, rule, signal, snapshot, run_id, title, message):
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO system_events (
                identity_key, dedup_hash, event_code, aggregation_category, entity_id,
                source_engine, severity, status, title, message,
                event_input_snapshot_json, rule_version, engine_version, run_id,
                assigned_team, assigned_role, ownership_status,
                first_triggered_at, last_reoccurred_at, occurrence_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), 1)
        """, (
            identity_key, dedup_hash, event_code, rule['aggregation_category'], signal['ma_crm_cms'],
            'PRIORITY_ENGINE', rule['default_severity'], 'OPEN', title, message,
            snapshot, rule['version'], NotificationEngineCore.VERSION, run_id,
            rule['default_assigned_team'], rule['default_assigned_role'], 'UNASSIGNED'
        ))
        event_id = cursor.lastrowid
        NotificationEngineCore._log_state_change(conn, event_id, None, 'OPEN', 'Initial detection', snapshot)

    @staticmethod
    def _reopen_event(conn, event_id, old_status, snapshot, run_id, new_count, new_dedup):
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE system_events 
            SET status = 'REOPENED', reopened_at = datetime('now'), last_reoccurred_at = datetime('now'),
                occurrence_count = ?, event_input_snapshot_json = ?, dedup_hash = ?, run_id = ?
            WHERE id = ?
        """, (new_count, snapshot, new_dedup, run_id, event_id))
        NotificationEngineCore._log_state_change(conn, event_id, old_status, 'REOPENED', 'Recurrence after cooldown', snapshot)

    @staticmethod
    def _update_occurrence(conn, event_id, new_count, snapshot, new_dedup):
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE system_events 
            SET last_reoccurred_at = datetime('now'), occurrence_count = ?, 
                event_input_snapshot_json = ?, dedup_hash = ?
            WHERE id = ?
        """, (new_count, snapshot, new_dedup, event_id))

    @staticmethod
    def _log_state_change(conn, event_id, old_status, new_status, reason, snapshot):
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO event_state_logs (event_id, previous_status, new_status, reason, snapshot_at_change_json, timestamp)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        """, (event_id, old_status, new_status, reason, snapshot))

    @staticmethod
    def _start_run(conn, run_id, month_str):
        cursor = conn.cursor()
        ctx = json.dumps({"month": month_str})
        cursor.execute("""
            INSERT INTO engine_runs (run_id, engine_name, status, execution_context_json, started_at)
            VALUES (?, 'NOTIFICATION_ENGINE_CORE', 'STARTED', ?, datetime('now'))
        """, (run_id, ctx))

    @staticmethod
    def _complete_run(conn, run_id, processed, generated):
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE engine_runs 
            SET status = 'SUCCESS', completed_at = datetime('now'),
                processed_entities_count = ?, generated_events_count = ?
            WHERE run_id = ?
        """, (processed, generated, run_id))

    @staticmethod
    def _fail_run(conn, run_id, error):
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE engine_runs 
            SET status = 'FAILED', completed_at = datetime('now'),
                execution_context_json = execution_context_json || ?
            WHERE run_id = ?
        """, (f" | Error: {error}", run_id))

if __name__ == "__main__":
    pass
