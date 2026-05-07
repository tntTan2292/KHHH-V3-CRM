from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models import (
    SystemEvent, EscalationRecord, SLATracker, ActionTask, 
    KPIScore, KPIDefinition, MonthlyAnalyticsSummary, HierarchyNode
)
from datetime import datetime

class DashboardService:
    """
    GOVERNANCE: Executive Command Center Service.
    Purely READ-ONLY aggregation from Engine Tables (SSOT).
    """

    @staticmethod
    def get_executive_metrics(db: Session, node_id: int = None):
        """
        Aggregates high-level metrics for the Executive Dashboard.
        """
        # 1. SLA Health
        sla_query = db.query(SLATracker)
        # TODO: Filter by node_id if needed (requires join logic)
        
        sla_stats = {
            "active": sla_query.filter(SLATracker.status == 'ACTIVE').count(),
            "breached": sla_query.filter(SLATracker.status == 'BREACHED').count(),
            "met": sla_query.filter(SLATracker.status == 'MET').count()
        }
        total_finished_sla = sla_stats["met"] + sla_stats["breached"]
        sla_stats["compliance_pct"] = (sla_stats["met"] / total_finished_sla * 100) if total_finished_sla > 0 else 100.0

        # 2. Event Intelligence
        event_query = db.query(SystemEvent)
        event_stats = {
            "open": event_query.filter(SystemEvent.status == 'OPEN').count(),
            "reopened": event_query.filter(SystemEvent.status == 'REOPENED').count(),
            "critical": event_query.filter(SystemEvent.severity == 'CRITICAL', SystemEvent.status != 'RESOLVED').count()
        }

        # 3. Escalation Overview
        esc_query = db.query(EscalationRecord)
        esc_stats = {
            "pending": esc_query.filter(EscalationRecord.status == 'PENDING').count(),
            "escalated": esc_query.filter(EscalationRecord.status == 'ESCALATED').count(),
            "resolved": esc_query.filter(EscalationRecord.status == 'RESOLVED').count()
        }

        # 4. Task Execution
        task_query = db.query(ActionTask)
        task_stats = {
            "open": task_query.filter(ActionTask.trang_thai.in_(['Mới', 'Đang xử lý'])).count(),
            "overdue": task_query.filter(ActionTask.deadline < datetime.now(), ActionTask.trang_thai != 'Hoàn thành').count(),
            "completed": task_query.filter(ActionTask.trang_thai == 'Hoàn thành').count()
        }
        total_tasks = task_stats["open"] + task_stats["completed"]
        task_stats["completion_rate"] = (task_stats["completed"] / total_tasks * 100) if total_tasks > 0 else 0.0

        # 5. KPI Summary (Latest Scores)
        kpi_query = db.query(KPIScore)
        # Get latest scores for key KPIs
        latest_kpis = db.query(
            KPIDefinition.code,
            KPIDefinition.name,
            KPIScore.score,
            KPIScore.calculated_at
        ).join(KPIDefinition).order_by(KPIScore.calculated_at.desc()).limit(10).all()

        return {
            "sla": sla_stats,
            "events": event_stats,
            "escalations": esc_stats,
            "tasks": task_stats,
            "kpis": [dict(zip(['code', 'name', 'score', 'timestamp'], k)) for k in latest_kpis],
            "timestamp": datetime.now().isoformat()
        }
