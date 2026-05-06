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
    VERSION = "1.1.0" # Hardened Governance Version
    PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    DB_PATH = os.path.join(PROJECT_ROOT, "data", "database", "khhh_v3.db")

    @staticmethod
    def get_connection():
        return sqlite3.connect(NotificationEngineCore.DB_PATH, isolation_level=None)

    @staticmethod
    def run_engine(month_str):
        """
        Flow 1: Engine Run Flow
        Tracks the execution and ensures deterministic processing.
        """
        run_id = str(uuid.uuid4())
        conn = NotificationEngineCore.get_connection()
        
        # Start Engine Run Tracking
        NotificationEngineCore._start_run(conn, run_id, month_str)
        
        try:
            # Flow 2: Event Detection Flow
            # Consume ONLY from governed summaries
            signals = NotificationEngineCore._collect_signals(conn, month_str)
            
            processed_count = 0
            generated_count = 0
            
            for signal in signals:
                processed_count += 1
                # Flow 3, 4, 5: Processing, Dedup, Recurrence, Snapshot
                event_created = NotificationEngineCore._process_governed_signal(conn, signal, run_id, month_str)
                if event_created:
                    generated_count += 1
            
            NotificationEngineCore._complete_run(conn, run_id, processed_count, generated_count)
            print(f"Notification Engine run {run_id} SUCCESS. Month: {month_str}, Events: {generated_count}")
            
        except Exception as e:
            NotificationEngineCore._fail_run(conn, run_id, str(e))
            logger.error(f"Notification Engine failed: {e}")
            raise e
        finally:
            conn.close()

    @staticmethod
    def _collect_signals(conn, month_str):
        """
        Flow 2: Governed Detection
        Reads exclusively from monthly_analytics_summary (SSOT).
        """
        cursor = conn.cursor()
        # Find all critical/high priority segments already computed in the summary
        # We also filter by year_month to ensure temporal accuracy
        cursor.execute("""
            SELECT year_month, point_id, lifecycle_stage, growth_tag, vip_tier, priority_level, 
                   SUM(total_orders) as total_orders, SUM(total_revenue) as total_rev
            FROM monthly_analytics_summary
            WHERE year_month = ? AND priority_level IN ('CRITICAL', 'HIGH')
            GROUP BY year_month, point_id, lifecycle_stage, growth_tag, vip_tier, priority_level
        """, (month_str,))
        
        columns = [column[0] for column in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]

    @staticmethod
    def _process_governed_signal(conn, signal, run_id, month_str):
        """
        Flow 3, 4, 5: The Governance Processing Layer
        """
        # Event Code determination based on Governed Summary State
        event_code = f"{signal['vip_tier']}_{signal['priority_level']}_ALERT"
        
        # Load Governance Rules
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM notification_rules WHERE event_code = ? AND is_enabled = 1", (event_code,))
        rule_row = cursor.fetchone()
        
        # Default rule if specific one doesn't exist
        if not rule_row:
            # Fallback to general priority alert
            cursor.execute("SELECT * FROM notification_rules WHERE event_code = 'CRITICAL_REVENUE_DROP'", ())
            rule_row = cursor.fetchone()
            
        if not rule_row: return False
        rule = dict(zip([c[0] for c in cursor.description], rule_row))

        # Flow 3: Identity & Deduplication
        # Identity Key: same problem across time
        # For Summary-level alerts, identity is (event_code, point_id, aggregation_category)
        identity_key = f"{event_code}:{signal['point_id']}:{rule['aggregation_category']}"
        
        # Snapshotting (Flow 5): Capture immutable truth from the summary
        snapshot = {
            "source_summary": signal,
            "engine_version": NotificationEngineCore.VERSION,
            "rule_version": rule['version'],
            "triggered_at": datetime.now().isoformat()
        }
        snapshot_json = json.dumps(snapshot)
        
        # Dedup Hash (Technical Idempotency)
        # Prevents same data from being processed twice in same context
        dedup_raw = f"{identity_key}:{month_str}:{snapshot_json}"
        dedup_hash = hashlib.sha256(dedup_raw.encode()).hexdigest()

        # Recurrence & Lifecycle (Flow 4)
        cursor.execute("""
            SELECT id, status, last_reoccurred_at, occurrence_count 
            FROM system_events 
            WHERE identity_key = ?
        """, (identity_key,))
        existing = cursor.fetchone()

        if existing:
            event_id, status, last_reoccurred, count = existing
            
            # Idempotency check
            cursor.execute("SELECT id FROM system_events WHERE dedup_hash = ?", (dedup_hash,))
            if cursor.fetchone(): return False

            # Recurrence Logic
            cooldown_delta = timedelta(hours=rule['cooldown_hours'])
            last_dt = datetime.strptime(last_reoccurred, '%Y-%m-%d %H:%M:%S')
            
            if status == 'RESOLVED' and (datetime.now() - last_dt) > cooldown_delta:
                NotificationEngineCore._reopen_event(conn, event_id, status, snapshot_json, run_id, count + 1, dedup_hash)
                return True
            elif status in ('OPEN', 'ACKNOWLEDGED', 'REOPENED'):
                NotificationEngineCore._update_occurrence(conn, event_id, count + 1, snapshot_json, dedup_hash)
                return True
            return False
        else:
            # First time detection
            title = f"[{rule['aggregation_category']}] {event_code} - Point {signal['point_id']}"
            message = (f"Operational Alert for Point {signal['point_id']} in {month_str}. "
                       f"VIP: {signal['vip_tier']}, Priority: {signal['priority_level']}, "
                       f"State: {signal['lifecycle_stage']}, Growth: {signal['growth_tag']}.")
            
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
            identity_key, dedup_hash, event_code, rule['aggregation_category'], str(signal['point_id']),
            'NOTIFICATION_ENGINE_CORE', rule['default_severity'], 'OPEN', title, message,
            snapshot, rule['version'], NotificationEngineCore.VERSION, run_id,
            rule['default_assigned_team'], rule['default_assigned_role'], 'UNASSIGNED'
        ))
        event_id = cursor.lastrowid
        NotificationEngineCore._log_state_change(conn, event_id, None, 'OPEN', 'Governed summary detection', snapshot)

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
        run_hash = hashlib.sha256(f"{month_str}:NOTIFICATION_ENGINE_CORE".encode()).hexdigest()
        
        # Check if a started run exists with same context to avoid overlapping
        cursor.execute("SELECT id FROM engine_runs WHERE run_hash = ? AND status = 'STARTED'", (run_hash,))
        if cursor.fetchone():
            # In a real enterprise system, we might fail or wait. Here we log a warning.
            logger.warning(f"Overlapping run detected for {month_str}. Proceeding with new run ID.")

        cursor.execute("""
            INSERT INTO engine_runs (run_id, engine_name, status, run_hash, execution_context_json, started_at)
            VALUES (?, 'NOTIFICATION_ENGINE_CORE', 'STARTED', ?, ?, datetime('now'))
        """, (run_id, run_hash, ctx))

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
