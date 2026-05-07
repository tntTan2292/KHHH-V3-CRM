import sys
import os
import logging

# Thêm PROJECT_ROOT vào sys.path để import được backend.app
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.append(PROJECT_ROOT)

from backend.app.database import engine, Base
from backend.app.models import SLAPolicy, SLATracker, SLASnapshot

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_sla_tables():
    logger.info("Initializing SLA Agnostic Tables (Phase 6 Foundation)...")
    try:
        # Chỉ tạo các bảng chưa tồn tại
        SLAPolicy.__table__.create(engine, checkfirst=True)
        SLATracker.__table__.create(engine, checkfirst=True)
        SLASnapshot.__table__.create(engine, checkfirst=True)
        logger.info("SLA Governance Tables created successfully.")
    except Exception as e:
        logger.error(f"Failed to create SLA tables: {e}")
        sys.exit(1)

if __name__ == "__main__":
    create_sla_tables()
