import sys
import os
from sqlalchemy.orm import Session
from sqlalchemy import func, exists, and_, or_, not_, delete
from datetime import datetime, timedelta
import dateutil.relativedelta
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RebuildLifecycle")

# Setup path
sys.path.append(r'd:\Antigravity - Project\KHHH - Antigravity - V3.0')
from backend.app.database import SessionLocal
from backend.app.models import Customer, Transaction, MonthlyAnalyticsSummary, CustomerMonthlySnapshot, HierarchyNode

def rebuild_history():
    db = SessionLocal()
    try:
        months = ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
                  "2026-01", "2026-02", "2026-03", "2026-04", "2026-05"]
        
        logger.info("Cleaning up old snapshots...")
        db.execute(delete(MonthlyAnalyticsSummary))
        db.execute(delete(CustomerMonthlySnapshot))
        db.commit()
        
        # Get all points (Hierarchy Nodes) to group summary
        points = db.query(HierarchyNode.id).all()
        point_ids = [p[0] for p in points]
        
        for m_str in months:
            logger.info(f"--- REBUILDING MONTH: {m_str} ---")
            e_dt = datetime.strptime(m_str + "-01", "%Y-%m-%d") + dateutil.relativedelta.relativedelta(months=1) - timedelta(seconds=1)
            s_dt = e_dt.replace(day=1, hour=0, minute=0, second=0)
            
            # Universal Set for this month
            universe = db.query(Customer).filter(
                exists().where(and_(Transaction.ma_kh == Customer.ma_crm_cms, Transaction.ngay_chap_nhan <= e_dt))
            ).all()
            
            logger.info(f"Universe size for {m_str}: {len(universe)}")
            
            # Temporary storage for summary aggregation
            # point_id -> stage -> count
            point_summary = {} 
            for pid in point_ids:
                point_summary[pid] = {
                    "ACTIVE": 0, "NEW": 0, "RECOVERED": 0, "AT_RISK": 0, "CHURNED": 0,
                    "NEW_EVENT": 0, "RECOVERED_EVENT": 0, "CHURN_EVENT": 0
                }
            
            snapshot_batch = []
            
            for cust in universe:
                ma_kh = cust.ma_crm_cms
                pid = cust.point_id
                if pid not in point_summary:
                    # Fallback for null points
                    point_summary[pid] = {"ACTIVE": 0, "NEW": 0, "RECOVERED": 0, "AT_RISK": 0, "CHURNED": 0, "NEW_EVENT": 0, "RECOVERED_EVENT": 0, "CHURN_EVENT": 0}

                # 1. Get transactions metrics
                last_tx_raw = db.query(func.max(Transaction.ngay_chap_nhan)).filter(Transaction.ma_kh == ma_kh, Transaction.ngay_chap_nhan <= e_dt).scalar()
                first_tx_raw = db.query(func.min(Transaction.ngay_chap_nhan)).filter(Transaction.ma_kh == ma_kh, Transaction.ngay_chap_nhan <= e_dt).scalar()
                
                if not last_tx_raw: continue
                
                from backend.app.routers.analytics import parse_db_date
                last_tx = parse_db_date(last_tx_raw)
                first_tx = parse_db_date(first_tx_raw)
                
                # DETERMINISTIC HIERARCHY (Matches Bulletproof Audit)
                is_new_evt = False
                is_recov_evt = False
                is_churn_evt = False
                
                # --- EVENT LAYER ---
                tx_in_month = db.query(exists().where(and_(Transaction.ma_kh == ma_kh, Transaction.ngay_chap_nhan.between(s_dt, e_dt)))).scalar()
                if tx_in_month:
                    # Is it New Event?
                    if first_tx >= s_dt:
                        is_new_evt = True
                        point_summary[pid]["NEW_EVENT"] += 1
                    else:
                        # Is it Recovered Event? (Silence > 90 days before this month)
                        has_pre_silence = db.query(exists().where(and_(
                            Transaction.ma_kh == ma_kh,
                            Transaction.ngay_chap_nhan < s_dt - timedelta(days=90),
                            not_(exists().where(and_(
                                Transaction.ma_kh == ma_kh,
                                Transaction.ngay_chap_nhan.between(s_dt - timedelta(days=90), s_dt - timedelta(seconds=1))
                            )))
                        ))).scalar()
                        if has_pre_silence:
                            is_recov_evt = True
                            point_summary[pid]["RECOVERED_EVENT"] += 1
                else:
                    # Is it Churn Event? (Silence started > 90 days before e_dt, but was active in the previous 90-day window)
                    if last_tx < e_dt - timedelta(days=90) and last_tx >= s_dt - timedelta(days=90):
                        is_churn_evt = True
                        point_summary[pid]["CHURN_EVENT"] += 1

                # --- POPULATION LAYER ---
                stage = "ACTIVE"
                if last_tx < e_dt - timedelta(days=90):
                    stage = "CHURNED"
                elif last_tx < e_dt - timedelta(days=30):
                    stage = "AT_RISK"
                elif first_tx > e_dt - timedelta(days=90):
                    stage = "NEW"
                else:
                    # Check for Reactivated Probation
                    has_gap = db.query(exists().where(and_(
                        Transaction.ma_kh == ma_kh,
                        Transaction.ngay_chap_nhan < e_dt - timedelta(days=90),
                        not_(exists().where(and_(
                            Transaction.ma_kh == ma_kh,
                            Transaction.ngay_chap_nhan.between(e_dt - timedelta(days=180), e_dt - timedelta(days=90))
                        )))
                    ))).scalar()
                    if has_gap:
                        stage = "RECOVERED"
                    else:
                        stage = "ACTIVE"
                
                point_summary[pid][stage] += 1
                
                # Add to snapshot batch
                snapshot_batch.append(CustomerMonthlySnapshot(
                    ma_kh=ma_kh,
                    year_month=m_str,
                    lifecycle_state=stage,
                    is_new_transition=is_new_evt,
                    is_recovered_transition=is_recov_evt,
                    is_churn_transition=is_churn_evt
                ))
                
                if len(snapshot_batch) >= 500:
                    db.bulk_save_objects(snapshot_batch)
                    snapshot_batch = []
            
            if snapshot_batch:
                db.bulk_save_objects(snapshot_batch)

            # Save Summary for this month
            summary_batch = []
            for pid, stages in point_summary.items():
                for s_name, count in stages.items():
                    if count > 0:
                        summary_batch.append(MonthlyAnalyticsSummary(
                            year_month=m_str,
                            point_id=pid,
                            lifecycle_stage=s_name,
                            ma_dv='ALL',
                            total_customers=count
                        ))
            db.bulk_save_objects(summary_batch)
            db.commit()
            logger.info(f"Month {m_str} completed.")

    except Exception as e:
        db.rollback()
        logger.error(f"Error during rebuild: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    rebuild_history()
