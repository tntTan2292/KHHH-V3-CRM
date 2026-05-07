import sys
import os
import logging

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.append(PROJECT_ROOT)

from sqlalchemy import text
from backend.app.database import engine, Base
from backend.app.models import ActionTaskTemplate, ActionTask, TaskStateLog

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def update_schema():
    logger.info("Hardening Task Governance Tables (Phase 7 Foundation)...")
    try:
        # Create missing tables
        TaskStateLog.__table__.create(engine, checkfirst=True)
        
        # Adding new columns manually via raw SQL for existing tables
        with engine.connect() as conn:
            # ActionTaskTemplate
            try:
                conn.execute(text("ALTER TABLE action_task_templates ADD COLUMN default_resolution_strategy VARCHAR(50) DEFAULT 'MANUAL_CONFIRM'"))
                conn.execute(text("ALTER TABLE action_task_templates ADD COLUMN resolution_config_json TEXT"))
                logger.info("Updated action_task_templates columns.")
            except Exception as e:
                logger.info(f"Columns in action_task_templates might already exist: {e}")

            # ActionTask
            columns_to_add = [
                ("source_event_id", "INTEGER"),
                ("sla_tracker_id", "INTEGER"),
                ("escalation_id", "INTEGER"),
                ("resolution_strategy", "VARCHAR(50) DEFAULT 'MANUAL_CONFIRM'"),
                ("resolution_config_json", "TEXT"),
                ("governance_snapshot_json", "TEXT")
            ]
            for col_name, col_type in columns_to_add:
                try:
                    conn.execute(text(f"ALTER TABLE action_tasks ADD COLUMN {col_name} {col_type}"))
                    logger.info(f"Added {col_name} to action_tasks.")
                except Exception as e:
                    logger.info(f"Column {col_name} might already exist: {e}")
            
            conn.commit()
            conn.close()
        
        logger.info("Task Governance Tables updated successfully.")
    except Exception as e:
        logger.error(f"Failed to update Task tables: {e}")
        sys.exit(1)

if __name__ == "__main__":
    update_schema()
