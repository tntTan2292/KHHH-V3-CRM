import sqlite3
import json
import uuid
import hashlib
from datetime import datetime
import logging
import os
import sys

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.append(PROJECT_ROOT)

from backend.app.database import SessionLocal
from backend.app.services.task_service import TaskService
from backend.app.services.sla_service import SLAService
from backend.app.models import SystemEvent, ActionTaskTemplate, Customer, ActionTask, SLATracker

logger = logging.getLogger(__name__)

class TaskOrchestratorEngine:
    VERSION = "1.1.0"
    DB_PATH = os.path.join(PROJECT_ROOT, "data", "database", "khhh_v3.db")

    @staticmethod
    def get_connection():
        return sqlite3.connect(TaskOrchestratorEngine.DB_PATH, isolation_level=None)

    @staticmethod
    def run_engine():
        """
        Main Engine Loop: Transform Events into Governed Tasks
        """
        run_id = str(uuid.uuid4())
        now = datetime.now()
        run_hash = hashlib.sha256(f"TASK_ORCHESTRATOR:{now.strftime('%Y-%m-%d %H')}".encode()).hexdigest()
        
        conn = TaskOrchestratorEngine.get_connection()
        cursor = conn.cursor()
        
        # 1. Idempotency Check
        cursor.execute("SELECT id FROM engine_runs WHERE run_hash = ? AND status = 'STARTED'", (run_hash,))
        if cursor.fetchone():
            print(f"Skipping overlapping Task Orchestrator Run for hash {run_hash}")
            conn.close()
            return None

        # 2. Start Run Tracking
        cursor.execute("""
            INSERT INTO engine_runs (run_id, engine_name, status, run_hash, started_at)
            VALUES (?, 'TASK_ORCHESTRATOR', 'STARTED', ?, ?)
        """, (run_id, run_hash, now.strftime('%Y-%m-%d %H:%M:%S')))
        
        db = SessionLocal()
        try:
            # 3. Collect Events without Tasks
            # We look for OPEN events that don't have a linked ActionTask
            cursor.execute("""
                SELECT e.* FROM system_events e
                LEFT JOIN action_tasks t ON e.id = t.source_event_id
                WHERE e.status = 'OPEN' AND t.id IS NULL
            """)
            columns = [column[0] for column in cursor.description]
            events = [dict(zip(columns, row)) for row in cursor.fetchall()]
            
            processed_count = 0
            tasks_created = 0
            
            for event in events:
                processed_count += 1
                # Find matching template
                template = db.query(ActionTaskTemplate).filter(
                    ActionTaskTemplate.trigger_event_code == event['event_code']
                ).first()
                
                if template:
                    # Determine staff_id from customer ownership if entity_type is CUSTOMER
                    staff_id = None
                    if event['entity_type'] == 'CUSTOMER':
                        customer = db.query(Customer).filter(Customer.ma_crm_cms == event['entity_id']).first()
                        if customer:
                            staff_id = customer.assigned_staff_id
                    
                    # Create Task
                    context = {
                        "event_title": event['title'],
                        "severity": event['severity'],
                        "triggered_at": event['first_triggered_at']
                    }
                    task = TaskService.create_task_from_template(
                        db, template.id, event['entity_id'], 
                        source_event_id=event['id'], 
                        staff_id=staff_id, 
                        context=context
                    )
                    if task:
                        tasks_created += 1
            
            # --- BLOCK 3: EXECUTION PROCESSING & SLA SYNC ---
            # 1. Handle Automatic Assignment (Mới -> Đã giao)
            new_tasks = db.query(ActionTask).filter(ActionTask.trang_thai == 'Mới', ActionTask.staff_id != None).all()
            for task in new_tasks:
                TaskService.update_task_status(db, task.id, 'Đã giao', 'AUTO_ASSIGN', reason="Orchestrator assigned staff")
            
            # 2. SLA Sync & Escalation Trigger
            # We look for tasks that have a linked SLATracker that has BREACHED
            breached_tasks = db.query(ActionTask).join(SLATracker).filter(
                ActionTask.trang_thai.in_(['Đã giao', 'Đã xác nhận', 'Đang xử lý']),
                SLATracker.status == 'BREACHED'
            ).all()
            
            for task in breached_tasks:
                # Trigger Escalation logic here
                # For now, we move the task to 'Escalation' state
                TaskService.update_task_status(
                    db, task.id, 'Escalation', 'SLA_BREACH', 
                    reason=f"SLA Breached (Tracker ID: {task.sla_tracker_id})"
                )
                # In a real scenario, we would also call EscalationService.trigger(...)
            
            # 4. Complete Run
            cursor.execute("""
                UPDATE engine_runs 
                SET status = 'SUCCESS', completed_at = datetime('now'),
                    processed_entities_count = ?, generated_events_count = ?
                WHERE run_id = ?
            """, (processed_count, tasks_created, run_id))
            
            print(f"Task Orchestrator {run_id} finished. Events: {processed_count}, Tasks Created: {tasks_created}")
            
        except Exception as e:
            cursor.execute("""
                UPDATE engine_runs SET status = 'FAILED', completed_at = datetime('now') WHERE run_id = ?
            """, (run_id,))
            logger.error(f"Task Orchestrator Failed: {e}")
            raise e
        finally:
            db.close()
            conn.close()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    TaskOrchestratorEngine.run_engine()
