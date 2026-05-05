
import os
import sys
from datetime import datetime
from sqlalchemy import create_engine, or_, and_, func, desc, asc, text, case
from sqlalchemy.orm import sessionmaker

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models import Customer, Transaction, NhanSu

def test_query():
    db = SessionLocal()
    try:
        start_date = "2026-04-01"
        end_date = "2026-04-30"
        lifecycle_status = "KH Mới"
        page = 1
        page_size = 50
        sort_by = "dynamic_revenue"
        order = "desc"
        
        curr_start = datetime.strptime(start_date, "%Y-%m-%d")
        curr_end = datetime.strptime(end_date, "%Y-%m-%d")
        
        # Ngưỡng
        prev_3m_start = curr_start - func.relativedelta(months=3) # This might fail if using func.relativedelta
        # Use python instead
        import dateutil.relativedelta
        prev_3m_start = curr_start - dateutil.relativedelta.relativedelta(months=3)
        new_threshold_date = curr_start - dateutil.relativedelta.relativedelta(months=2) # simplified
        
        # 2. Logic Lifecycle SQL
        identified_metrics = db.query(
            Transaction.ma_kh.label("ma_kh"),
            func.sum(case((Transaction.ngay_chap_nhan.between(curr_start, curr_end), Transaction.doanh_thu), else_=0)).label("curr_rev"),
            func.count(case((Transaction.ngay_chap_nhan.between(curr_start, curr_end), Transaction.id), else_=None)).label("curr_count"),
            func.sum(case((Transaction.ngay_chap_nhan.between(curr_start, curr_end), Transaction.doanh_thu), else_=0)).label("prev_rev"),
            func.sum(case((Transaction.ngay_chap_nhan.between(prev_3m_start, curr_end), Transaction.doanh_thu), else_=0)).label("prev_3m_rev"),
            func.min(Transaction.ngay_chap_nhan).label("first_seen_under_limit"),
            func.max(case((Transaction.ngay_chap_nhan < curr_start, Transaction.ngay_chap_nhan), else_=None)).label("last_shipped_before"),
            func.max(Transaction.point_id).label("point_id")
        ).filter(
            Transaction.ma_kh.isnot(None), 
            Transaction.ma_kh != '',
            Transaction.ngay_chap_nhan >= prev_3m_start
        ).group_by(Transaction.ma_kh).subquery()

        identified_status = case(
            (identified_metrics.c.first_seen_under_limit >= new_threshold_date, 'KH Mới'),
            else_='KH Nguy cơ'
        ).label("status_type")

        growth_velocity = literal(0.0).label("growth_velocity")
        health_score = literal(50).label("health_score")

        base_query = db.query(
            Customer.id,
            Customer.ma_crm_cms,
            Customer.ten_kh,
            identified_status.label("status_type"),
            func.coalesce(Customer.rfm_segment, "Thường").label("rfm_segment"),
            func.coalesce(identified_metrics.c.curr_rev, 0).label("dynamic_revenue"),
            func.coalesce(identified_metrics.c.curr_count, 0).label("transaction_count"),
            growth_velocity.label("growth_velocity"),
            health_score.label("health_score"),
            Customer.assigned_staff_id,
            identified_metrics.c.point_id
        ).outerjoin(identified_metrics, Customer.ma_crm_cms == identified_metrics.c.ma_kh).subquery()

        final_query = db.query(base_query)
        
        if lifecycle_status:
            final_query = final_query.filter(base_query.c.status_type == lifecycle_status)
            
        print(f"Total count: {final_query.count()}")
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    from sqlalchemy.sql import literal
    test_query()
