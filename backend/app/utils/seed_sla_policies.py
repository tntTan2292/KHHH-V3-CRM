import sys
import os
import logging

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.append(PROJECT_ROOT)

from backend.app.database import SessionLocal
from backend.app.models import SLAPolicy

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_policies():
    db = SessionLocal()
    policies = [
        {
            "code": "EVENT_VIP_RESPONSE_2H",
            "description": "Phản hồi cảnh báo khách hàng VIP trong vòng 2 giờ",
            "target_entity_type": "SYSTEM_EVENT",
            "metric_type": "RESPONSE",
            "target_hours": 2.0,
            "warning_threshold_pct": 80.0
        },
        {
            "code": "EVENT_REGULAR_RESPONSE_24H",
            "description": "Phản hồi cảnh báo khách hàng thường trong vòng 24 giờ",
            "target_entity_type": "SYSTEM_EVENT",
            "metric_type": "RESPONSE",
            "target_hours": 24.0,
            "warning_threshold_pct": 80.0
        },
        {
            "code": "TASK_B1_RESPONSE_48H",
            "description": "Liên hệ khách hàng tiềm năng B1 trong vòng 48 giờ",
            "target_entity_type": "ACTION_TASK",
            "metric_type": "RESPONSE",
            "target_hours": 48.0,
            "warning_threshold_pct": 75.0
        },
        {
            "code": "TASK_B2_RESOLUTION_72H",
            "description": "Hoàn thành thương thảo B2 trong vòng 72 giờ (3 ngày)",
            "target_entity_type": "ACTION_TASK",
            "metric_type": "RESOLUTION",
            "target_hours": 72.0,
            "warning_threshold_pct": 90.0
        },
        {
            "code": "ESCALATION_LV1_RESOLUTION_12H",
            "description": "Xử lý hồ sơ leo thang cấp 1 trong vòng 12 giờ",
            "target_entity_type": "ESCALATION",
            "metric_type": "RESOLUTION",
            "target_hours": 12.0,
            "warning_threshold_pct": 80.0
        }
    ]

    try:
        for p_data in policies:
            existing = db.query(SLAPolicy).filter(SLAPolicy.code == p_data["code"]).first()
            if not existing:
                policy = SLAPolicy(**p_data)
                db.add(policy)
                logger.info(f"Seeded Policy: {p_data['code']}")
            else:
                logger.info(f"Policy already exists: {p_data['code']}")
        
        db.commit()
        logger.info("SLA Policy Seeding completed.")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to seed policies: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_policies()
