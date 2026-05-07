import logging
from datetime import datetime, timedelta
from backend.app.database import SessionLocal
from backend.app.models import SLAPolicy, SLATracker, SLASnapshot
import json

logger = logging.getLogger(__name__)

class SLAService:
    @staticmethod
    def attach_tracker(db, target_type, target_id, policy_code):
        """
        GOVERNANCE: Attach an SLA Tracker to an operational entity
        """
        policy = db.query(SLAPolicy).filter(SLAPolicy.code == policy_code, SLAPolicy.is_enabled == True).first()
        if not policy:
            logger.error(f"SLA Policy not found or disabled: {policy_code}")
            return None

        # Check if already attached (Avoid duplicates for active trackers of same policy)
        existing = db.query(SLATracker).filter(
            SLATracker.target_type == target_type,
            SLATracker.target_id == target_id,
            SLATracker.policy_id == policy.id,
            SLATracker.status.in_(['ACTIVE', 'PAUSED'])
        ).first()
        
        if existing:
            return existing

        now = datetime.now()
        due_time = now + timedelta(hours=policy.target_hours)
        
        tracker = SLATracker(
            policy_id=policy.id,
            target_type=target_type,
            target_id=target_id,
            status='ACTIVE',
            start_time=now,
            due_time=due_time,
            current_elapsed_hours=0.0
        )
        db.add(tracker)
        db.flush() # Get ID

        # Initial Snapshot
        snapshot = SLASnapshot(
            tracker_id=tracker.id,
            event_type='CREATED',
            status_at_snapshot='ACTIVE',
            elapsed_at_snapshot=0.0,
            remaining_at_snapshot=policy.target_hours,
            snapshot_json=json.dumps({"policy_code": policy_code}),
            recorded_at=now
        )
        db.add(snapshot)
        db.commit()
        
        logger.info(f"SLA Tracker ATTACHED: {target_type}:{target_id} with {policy_code}")
        return tracker

    @staticmethod
    def mark_met(db, target_type, target_id, metric_type=None, policy_code=None):
        """
        GOVERNANCE: Mark SLA as MET (Completed)
        """
        query = db.query(SLATracker).filter(
            SLATracker.target_type == target_type,
            SLATracker.target_id == target_id,
            SLATracker.status.in_(['ACTIVE', 'PAUSED', 'BREACHED'])
        )
        
        if policy_code:
            query = query.join(SLAPolicy).filter(SLAPolicy.code == policy_code)
        elif metric_type:
            query = query.join(SLAPolicy).filter(SLAPolicy.metric_type == metric_type)
            
        trackers = query.all()
        now = datetime.now()
        
        for tracker in trackers:
            if tracker.status == 'MET': continue
            
            elapsed = (now - tracker.start_time).total_seconds() / 3600 - (tracker.total_paused_hours or 0)
            
            tracker.status = 'MET'
            tracker.end_time = now
            tracker.current_elapsed_hours = elapsed
            
            snapshot = SLASnapshot(
                tracker_id=tracker.id,
                event_type='MET',
                status_at_snapshot='MET',
                elapsed_at_snapshot=elapsed,
                remaining_at_snapshot=0.0,
                snapshot_json=json.dumps({"reason": "Target action completed"}),
                recorded_at=now
            )
            db.add(snapshot)
            logger.info(f"SLA Tracker MET: {target_type}:{target_id} (Tracker ID: {tracker.id})")
            
        db.commit()

    @staticmethod
    def pause_tracker(db, target_type, target_id):
        """
        GOVERNANCE: Pause SLA tracking (e.g., waiting for customer)
        """
        trackers = db.query(SLATracker).filter(
            SLATracker.target_type == target_type,
            SLATracker.target_id == target_id,
            SLATracker.status == 'ACTIVE'
        ).all()
        
        now = datetime.now()
        for tracker in trackers:
            tracker.status = 'PAUSED'
            tracker.last_paused_at = now
            
            snapshot = SLASnapshot(
                tracker_id=tracker.id,
                event_type='PAUSED',
                status_at_snapshot='PAUSED',
                elapsed_at_snapshot=tracker.current_elapsed_hours,
                remaining_at_snapshot=0.0, # Will be calculated correctly on tick
                snapshot_json=json.dumps({"info": "SLA Paused"}),
                recorded_at=now
            )
            db.add(snapshot)
            
        db.commit()

    @staticmethod
    def resume_tracker(db, target_type, target_id):
        """
        GOVERNANCE: Resume SLA tracking
        """
        trackers = db.query(SLATracker).filter(
            SLATracker.target_type == target_type,
            SLATracker.target_id == target_id,
            SLATracker.status == 'PAUSED'
        ).all()
        
        now = datetime.now()
        for tracker in trackers:
            if tracker.last_paused_at:
                paused_duration = (now - tracker.last_paused_at).total_seconds() / 3600
                tracker.total_paused_hours = (tracker.total_paused_hours or 0.0) + paused_duration
                # Push due_time further
                tracker.due_time = tracker.due_time + timedelta(hours=paused_duration)
            
            tracker.status = 'ACTIVE'
            tracker.last_paused_at = None
            
            snapshot = SLASnapshot(
                tracker_id=tracker.id,
                event_type='RESUMED',
                status_at_snapshot='ACTIVE',
                elapsed_at_snapshot=tracker.current_elapsed_hours,
                remaining_at_snapshot=0.0,
                snapshot_json=json.dumps({"info": "SLA Resumed"}),
                recorded_at=now
            )
            db.add(snapshot)
            
        db.commit()
