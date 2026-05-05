from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from datetime import datetime, timedelta
import dateutil.relativedelta
from ..models import Customer, Transaction
from ..core.config_segments import *
from ..core.segment_rules import classify_potential_rank
import re
from ..services.province_matcher import remove_accents

def normalize_name(name: str) -> str:
    if not name:
        return ""
    name = re.sub(r'\s+', ' ', name.strip())
    return remove_accents(name)

def parse_db_date(db_val):
    """Cấp cứu cho SQLite: Chuyển đổi mọi giá trị trả về từ func.max() sang datetime an toàn"""
    if not db_val: return None
    from datetime import datetime
    if isinstance(db_val, datetime): return db_val
    if isinstance(db_val, str):
        try:
            return datetime.strptime(db_val.split('.')[0], "%Y-%m-%d %H:%M:%S")
        except:
            try:
                return datetime.strptime(db_val, "%Y-%m-%d")
            except:
                return None
    return None

class LifecycleService:
    @staticmethod
    def get_customer_lifecycle_stats(db: Session, don_vi: str = None, start_date: str = None, end_date: str = None, scope_point_ids: list = None):
        from sqlalchemy import case, and_, or_, func, literal
        import dateutil.relativedelta

        # 1. Xác định mốc thời gian
        if not end_date:
            latest_date_raw = db.query(func.max(Transaction.ngay_chap_nhan)).scalar()
            latest_date = parse_db_date(latest_date_raw)
            if not latest_date:
                return {}
            curr_month_end = latest_date
            curr_month_start = latest_date.replace(day=1)
        else:
            curr_month_end = datetime.strptime(end_date, "%Y-%m-%d")
            curr_month_start = datetime.strptime(start_date, "%Y-%m-%d")

        prev_month_start = curr_month_start - dateutil.relativedelta.relativedelta(months=1)
        prev_month_end = curr_month_start - timedelta(days=1)
        
        # Ngưỡng 3 tháng cho Rời bỏ và Tái bán
        prev_3m_start = curr_month_start - dateutil.relativedelta.relativedelta(months=3)
        churn_threshold_date = prev_3m_start # T-3
        
        # Ngưỡng 3 tháng cho Khách hàng MỚI (Lũy kế 3 tháng từ ngày đầu tiên)
        new_threshold_date = curr_month_start - dateutil.relativedelta.relativedelta(months=MONTHS_FOR_NEW - 1)
        new_threshold_date = new_threshold_date.replace(day=1)

        # 2. Query Thống kê Khách hàng Định danh (Set-based)
        scan_barrier = curr_month_start - dateutil.relativedelta.relativedelta(months=12)

        metrics_query = db.query(
            Transaction.ma_kh.label("ma_kh"),
            func.sum(case((Transaction.ngay_chap_nhan.between(curr_month_start, curr_month_end), Transaction.doanh_thu), else_=0)).label("curr_rev"),
            func.count(case((Transaction.ngay_chap_nhan.between(curr_month_start, curr_month_end), Transaction.id), else_=None)).label("curr_cnt"),
            func.sum(case((Transaction.ngay_chap_nhan.between(prev_month_start, prev_month_end), Transaction.doanh_thu), else_=0)).label("prev_rev"),
            func.sum(case((Transaction.ngay_chap_nhan.between(prev_3m_start, prev_month_end), Transaction.doanh_thu), else_=0)).label("prev_3m_rev"),
            func.min(Transaction.ngay_chap_nhan).label("first_seen_all_time"),
            func.max(Transaction.ngay_chap_nhan).label("last_shipped_absolute"),
            func.max(case((Transaction.ngay_chap_nhan < curr_month_start, Transaction.ngay_chap_nhan), else_=None)).label("last_shipped_before")
        ).filter(
            Transaction.ma_kh.isnot(None),
            Transaction.ma_kh != '',
            func.trim(Transaction.ma_kh) != '',
            ~Transaction.ma_kh.in_(['None', 'none', 'NULL', 'null', 'nan', 'NaN']),
            Transaction.ngay_chap_nhan >= scan_barrier
        )
        
        # NÀY CHÍNH LÀ ĐIỂM CHỐT: Lọc theo Hierarchy
        if scope_point_ids:
            metrics_query = metrics_query.filter(Transaction.point_id.in_(scope_point_ids))

        metrics_sub = metrics_query.group_by(Transaction.ma_kh).subquery()

        # 2b. Classification Logic (Ưu tiên At-risk và New theo Hiến pháp)
        status_case = case(
            (metrics_sub.c.first_seen_all_time >= new_threshold_date, 'new'),
            (and_(metrics_sub.c.curr_rev > 0, metrics_sub.c.prev_3m_rev == 0), 'recovered'),
            (metrics_sub.c.last_shipped_absolute <= (curr_month_start - timedelta(days=15)), 'at_risk'),
            (metrics_sub.c.last_shipped_absolute <= churn_threshold_date, 'churned'),
            (metrics_sub.c.curr_rev > 0, 'active'),
            else_='active'
        ).label("lifecycle")
        
        # 2c. Ranking Logic for Identified Customers (Sử dụng '>' thay vì '>=')
        rank_case = case(
            (and_(metrics_sub.c.curr_rev > THRESHOLD_DIAMOND_REV, metrics_sub.c.curr_cnt > THRESHOLD_DIAMOND_SHIP), 'Kim Cương'),
            (and_(metrics_sub.c.curr_rev > THRESHOLD_GOLD_REV, metrics_sub.c.curr_cnt > THRESHOLD_GOLD_SHIP), 'Vàng'),
            (and_(metrics_sub.c.curr_rev > THRESHOLD_BRONZE_REV, metrics_sub.c.curr_cnt > THRESHOLD_BRONZE_SHIP), 'Bạc'),
            else_='Thường'
        ).label("rank")

        # 2d. Aggregate counts
        ident_stats_query = db.query(
            status_case,
            rank_case,
            func.count(distinct(metrics_sub.c.ma_kh))
        ).group_by(status_case, rank_case).all()
        
        full_stats = {
            "new": 0, "active": 0, "at_risk": 0, 
            "churned": 0, "recovered": 0,
            "Bạc": 0, "Vàng": 0, "Kim Cương": 0, "Thường": 0
        }
        
        for status, rank, count in ident_stats_query:
            if status in full_stats:
                full_stats[status] += count
            if rank in full_stats:
                full_stats[rank] += count

        return full_stats
