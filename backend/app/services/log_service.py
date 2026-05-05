from sqlalchemy.orm import Session
from ..models import SystemLog
from typing import Optional

class LogService:
    @staticmethod
    def log_action(
        db: Session,
        user_id: Optional[int],
        action: str,
        resource: str,
        details: str,
        ip_address: Optional[str] = None
    ):
        log_entry = SystemLog(
            user_id=user_id,
            action=action,
            resource=resource,
            details=details,
            ip_address=ip_address
        )
        db.add(log_entry)
        db.commit()
        return log_entry
