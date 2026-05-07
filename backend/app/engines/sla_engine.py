import sqlite3
import json
import uuid
import hashlib
from datetime import datetime, timedelta
import logging
import os
import sys

# Thêm PROJECT_ROOT để import
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.append(PROJECT_ROOT)

logger = logging.getLogger(__name__)

class SLAEngineCore:
    VERSION = "1.1.0"
    DB_PATH = os.path.join(PROJECT_ROOT, "data", "database", "khhh_v3.db")

    # GOVERNANCE: Strict SLA Lifecycle State Machine
    ALLOWED_TRANSITIONS = {
        'ACTIVE': ['PAUSED', 'MET', 'BREACHED', 'CANCELLED'],
        'PAUSED': ['ACTIVE', 'CANCELLED'],
        'BREACHED': ['MET', 'CANCELLED'],
        'MET': [],
        'CANCELLED': []
    }

    @staticmethod
    def validate_transition(current_status, new_status):
        """
        Hardened Lifecycle Governance
        """
        allowed = SLAEngineCore.ALLOWED_TRANSITIONS.get(current_status, [])
        if new_status not in allowed:
            raise Exception(f"CRITICAL SLA ENGINE GOVERNANCE FAILURE: Illegal transition from {current_status} to {new_status}")

    @staticmethod
    def get_connection():
        return sqlite3.connect(SLAEngineCore.DB_PATH, isolation_level=None)

    @staticmethod
    def _get_governed_now():
        now = datetime.now()
        return now.replace(microsecond=0)

    @staticmethod
    def _parse_db_datetime(dt_str):
        if not dt_str: return None
        try:
            return datetime.strptime(dt_str, '%Y-%m-%d %H:%M:%S')
        except ValueError:
            # Handle cases with microseconds
            return datetime.strptime(dt_str, '%Y-%m-%d %H:%M:%S.%f')

    @staticmethod
    def run_engine():
        """
        Main Engine Loop: Deterministic SLA Ticking
        """
        run_id = str(uuid.uuid4())
        now = SLAEngineCore._get_governed_now()
        run_hash = hashlib.sha256(f"SLA_ENGINE_CORE:{now.strftime('%Y-%m-%d %H:%M')}".encode()).hexdigest()
        
        conn = SLAEngineCore.get_connection()
        cursor = conn.cursor()
        
        # 1. Idempotency Check
        cursor.execute("SELECT id FROM engine_runs WHERE run_hash = ? AND status = 'STARTED'", (run_hash,))
        if cursor.fetchone():
            print(f"Skipping overlapping SLA Run for hash {run_hash}")
            conn.close()
            return None

        # 2. Start Run Tracking
        cursor.execute("""
            INSERT INTO engine_runs (run_id, engine_name, status, run_hash, started_at)
            VALUES (?, 'SLA_ENGINE_CORE', 'STARTED', ?, ?)
        """, (run_id, run_hash, now.strftime('%Y-%m-%d %H:%M:%S')))
        
        try:
            # 3. Collect Active Trackers
            trackers = SLAEngineCore._collect_active_trackers(conn)
            
            processed_count = 0
            breached_count = 0
            
            for tracker in trackers:
                processed_count += 1
                state_changed, is_breached = SLAEngineCore._tick_tracker(conn, tracker, now, run_id)
                if is_breached:
                    breached_count += 1
            
            # 4. Complete Run
            cursor.execute("""
                UPDATE engine_runs 
                SET status = 'SUCCESS', completed_at = datetime('now'),
                    processed_entities_count = ?, generated_events_count = ?
                WHERE run_id = ?
            """, (processed_count, breached_count, run_id))
            
            print(f"SLA Engine {run_id} finished. Processed: {processed_count}, Breached: {breached_count}")
            
        except Exception as e:
            cursor.execute("""
                UPDATE engine_runs SET status = 'FAILED', completed_at = datetime('now') WHERE run_id = ?
            """, (run_id,))
            logger.error(f"SLA Engine Failed: {e}")
            raise e
        finally:
            conn.close()

    @staticmethod
    def _collect_active_trackers(conn):
        cursor = conn.cursor()
        # Join with policy to get target_hours and warning_threshold
        cursor.execute("""
            SELECT t.*, p.target_hours, p.warning_threshold_pct, p.code as policy_code
            FROM sla_trackers t
            JOIN sla_policies p ON t.policy_id = p.id
            WHERE t.status IN ('ACTIVE', 'PAUSED')
        """)
        columns = [column[0] for column in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]

    @staticmethod
    def _tick_tracker(conn, tracker, now, run_id):
        """
        Deterministic Tick for a single tracker
        """
        cursor = conn.cursor()
        status = tracker['status']
        start_time = SLAEngineCore._parse_db_datetime(tracker['start_time'])
        due_time = SLAEngineCore._parse_db_datetime(tracker['due_time'])
        total_paused = tracker['total_paused_hours'] or 0.0
        
        # Calculate current elapsed (Governed)
        if status == 'ACTIVE':
            elapsed = (now - start_time).total_seconds() / 3600 - total_paused
        else: # PAUSED
            # If paused, elapsed stays the same as of last_paused_at
            last_paused = SLAEngineCore._parse_db_datetime(tracker['last_paused_at'])
            elapsed = (last_paused - start_time).total_seconds() / 3600 - total_paused

        new_status = status
        state_changed = False
        is_breached = False

        # Breach Detection
        if status == 'ACTIVE' and now > due_time:
            new_status = 'BREACHED'
            SLAEngineCore.validate_transition(status, new_status)
            state_changed = True
            is_breached = True

        # Warning Detection
        is_warning = False
        if status == 'ACTIVE' and new_status == 'ACTIVE':
            warning_threshold_hours = tracker['target_hours'] * (tracker['warning_threshold_pct'] / 100.0)
            if elapsed >= warning_threshold_hours:
                is_warning = True
        
        # Update Tracker State
        cursor.execute("""
            UPDATE sla_trackers 
            SET current_elapsed_hours = ?, 
                last_ticked_at = ?,
                status = ?
            WHERE id = ?
        """, (elapsed, now.strftime('%Y-%m-%d %H:%M:%S'), new_status, tracker['id']))

        # Auditability: Record Snapshot on State Change or Warning Threshold Hit
        if state_changed or is_warning:
            event_type = 'BREACHED' if is_breached else ('WARNING' if is_warning else 'TICK')
            
            # Check if we already recorded a warning to avoid spamming
            cursor.execute("SELECT id FROM sla_snapshots WHERE tracker_id = ? AND event_type = 'WARNING' LIMIT 1", (tracker['id'],))
            already_warned = cursor.fetchone()
            
            if state_changed or (is_warning and not already_warned):
                SLAEngineCore._create_snapshot(conn, tracker['id'], event_type, new_status, elapsed, tracker, now)

        return state_changed, is_breached

    @staticmethod
    def _create_snapshot(conn, tracker_id, event_type, status, elapsed, tracker, now):
        cursor = conn.cursor()
        target_hours = tracker['target_hours']
        remaining = max(0, target_hours - elapsed)
        
        snapshot_data = {
            "policy_code": tracker['policy_code'],
            "target_type": tracker['target_type'],
            "target_id": tracker['target_id'],
            "engine_version": SLAEngineCore.VERSION,
            "governed_now": now.strftime('%Y-%m-%d %H:%M:%S'),
            "is_breach": 1 if event_type == 'BREACHED' else 0,
            "is_warning": 1 if event_type == 'WARNING' else 0
        }
        
        cursor.execute("""
            INSERT INTO sla_snapshots (
                tracker_id, event_type, status_at_snapshot, 
                elapsed_at_snapshot, remaining_at_snapshot, 
                snapshot_json, recorded_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            tracker_id, event_type, status, 
            elapsed, remaining, 
            json.dumps(snapshot_data), 
            now.strftime('%Y-%m-%d %H:%M:%S')
        ))
        
        # Update tracker with last_snapshot_id
        snapshot_id = cursor.lastrowid
        cursor.execute("UPDATE sla_trackers SET last_snapshot_id = ? WHERE id = ?", (snapshot_id, tracker_id))

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    SLAEngineCore.run_engine()
