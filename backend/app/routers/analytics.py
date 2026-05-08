from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, timedelta

from ..database import get_db
from ..models import Customer, Transaction, SyncAttempt, SyncLog, HierarchyNode, MonthlyAnalyticsSummary
from ..services.lifecycle_service import LifecycleService
import dateutil.relativedelta
from ..core.cache import cache_response
import asyncio
from ..services.scoping_service import ScopingService
from ..routers.auth import get_current_user
from ..models import User
from ..services.potential_service import PotentialService

def parse_db_date(db_val):
    """Cấp cứu cho SQLite: Chuyển đổi mọi giá trị trả về từ func.max() sang datetime an toàn"""
    if not db_val: return None
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

import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

from ..services.hierarchy_service import HierarchyService
from ..services.summary_service import SummaryService

def get_governed_comparison_periods(db, start_date, end_date, comparison_type="mom"):
    """
    [GOVERNANCE] Centralized Like-for-Like date calculation.
    Enforces max_data_date capping for ALL widgets to ensure SSOT MoM alignment.
    """
    max_data_date_raw = db.query(func.max(Transaction.ngay_chap_nhan)).scalar()
    max_data_date = parse_db_date(max_data_date_raw)
    
    if not start_date or not end_date:
        if not max_data_date:
            return None, None, None, None, None
        curr_start = max_data_date.replace(day=1, hour=0, minute=0, second=0)
        # [USER RULE] Always use end of day to include all transactions
        curr_end = max_data_date.replace(hour=23, minute=59, second=59)
    else:
        curr_start = datetime.strptime(start_date, "%Y-%m-%d")
        curr_end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)

    if comparison_type == "yoy":
        prev_start = curr_start - dateutil.relativedelta.relativedelta(years=1)
        prev_end = curr_end - dateutil.relativedelta.relativedelta(years=1)
    else:
        # Standard MoM date shift (Preserving the 23:59:59 boundary)
        prev_start = curr_start - dateutil.relativedelta.relativedelta(months=1)
        prev_end = curr_end - dateutil.relativedelta.relativedelta(months=1)
        
    return curr_start, curr_end, prev_start, prev_end, max_data_date

@router.post("/refresh-summary")
async def trigger_summary_refresh(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Kích hoạt làm mới bảng Summary (Shadow-Swap) - Dành cho Admin."""
    if current_user.role.name != "ADMIN":
        raise HTTPException(status_code=403, detail="Chỉ Admin mới có quyền làm mới dữ liệu tổng hợp")
    
    success = SummaryService.refresh_summary_incremental()
    if success:
        return {"status": "success", "message": "Dữ liệu Dashboard đã được làm mới thành công."}
    else:
        raise HTTPException(status_code=500, detail="Lỗi trong quá trình làm mới dữ liệu tổng hợp.")

@router.get("/dashboard")
@cache_response(ttl_hours=1)
async def get_dashboard_stats(
    start_date: str = None,
    end_date: str = None,
    node_code: str = None, 
    comparison_type: str = "mom",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Xác định phạm vi dữ liệu hiệu lực (Elite RBAC 3.0)
    scope_point_ids = ScopingService.get_effective_scope_ids(db, current_user, node_code)
    
    # NEU KHONG TIM THAY ID NAO TRONG PHAM VI -> PHAI TRA VE 0
    if scope_point_ids is not None and not scope_point_ids:
        return {
            "tong_doanh_thu": 0, "tong_kh": 0, "kh_moi": 0, "kh_roi_bo": 0,
            "kh_tiem_nang": 0, "revenue_growth": 0, "latest_date": None, "lifecycle": {}
        }
        
    # 2. Xác định ngày dữ liệu mới nhất
    max_data_date_raw = db.query(func.max(Transaction.ngay_chap_nhan)).scalar()
    max_data_date = parse_db_date(max_data_date_raw)

    # 3. Kiểm tra xem có thể dùng bảng Summary không (Nếu filter theo tháng trọn vẹn)
    is_monthly = False
    if start_date and end_date:
        s_dt = datetime.strptime(start_date, "%Y-%m-%d")
        e_dt = datetime.strptime(end_date, "%Y-%m-%d")
        if s_dt.day == 1 and (e_dt + timedelta(days=1)).day == 1:
            is_monthly = True

    # 4. Lấy dữ liệu Lifecycle và Doanh thu (ƯU TIÊN SUMMARY)
    month_str = (start_date[:7] if start_date else None) or max_data_date.strftime("%Y-%m")
    current_month_str = max_data_date.strftime("%Y-%m")
    
    # [GOVERNANCE] Lifecycle is a Historical State Machine. 
    # Dashboard summary should always reflect the CURRENT state distribution.
    lifecycle_stats = {
        "active": 0,
        "new": 0,
        "recovered": 0,
        "at_risk": 0,
        "churned": 0
    }
    growth_stats = {"GROWTH": 0, "STABLE": 0, "DECLINING": 0}

    # Fetch Lifecycle from CURRENT month summary (SSOT)
    curr_summary_res = db.query(
        MonthlyAnalyticsSummary.lifecycle_stage,
        func.sum(MonthlyAnalyticsSummary.total_customers).label("customers")
    ).filter(
        MonthlyAnalyticsSummary.year_month == current_month_str,
        MonthlyAnalyticsSummary.ma_dv == 'ALL' 
    )
    if scope_point_ids is not None:
        curr_summary_res = curr_summary_res.filter(MonthlyAnalyticsSummary.point_id.in_(scope_point_ids))
    
    # Terminology mapping (Backend SSOT -> Frontend View)
    stage_map = {
        "active": "active",
        "new": "new",
        "rebuy": "recovered",
        "reactivated": "recovered",
        "at_risk": "at_risk",
        "churned": "churned"
    }

    for stage, cust in curr_summary_res.group_by(MonthlyAnalyticsSummary.lifecycle_stage).all():
        if not stage: continue
        raw_key = stage.lower()
        target_key = stage_map.get(raw_key, raw_key)
        if target_key in lifecycle_stats:
            lifecycle_stats[target_key] = int(cust or 0)

    # Fetch Revenue and Growth from FILTERED month summary
    summary_exists = db.query(MonthlyAnalyticsSummary).filter(MonthlyAnalyticsSummary.year_month == month_str).first() is not None

    if summary_exists:
        summary_query = db.query(
            MonthlyAnalyticsSummary.lifecycle_stage,
            func.sum(MonthlyAnalyticsSummary.total_revenue).label("revenue"),
            func.sum(MonthlyAnalyticsSummary.total_customers).label("customers"),
            func.sum(MonthlyAnalyticsSummary.total_orders).label("orders"),
            MonthlyAnalyticsSummary.growth_tag
        ).filter(MonthlyAnalyticsSummary.year_month == month_str)
        
        if scope_point_ids is not None:
            summary_query = summary_query.filter(MonthlyAnalyticsSummary.point_id.in_(scope_point_ids))
            
        summary_res = summary_query.group_by(MonthlyAnalyticsSummary.lifecycle_stage, MonthlyAnalyticsSummary.growth_tag).all()
        
        for stage, rev, cust, ords, growth in summary_res:
            if growth in growth_stats:
                growth_stats[growth] += (cust or 0)
        
        tong_dt = sum(r[1] for r in summary_res)
    else:
        # [GOVERNANCE] Enforce Summary-First: Refuse to scan millions of raw transactions for Dashboard KPIs.
        # This forces the system to run the SummaryEngine before data is visible.
        logger.warning(f"Governance Warning: Dashboard blocked raw scan for month {month_str}. Data must be summarized first.")
        tong_dt = 0.0
        # Optional: Trigger summary refresh logic here or return 425 Too Early
    
    # 4. KPIs Lấy trực tiếp từ Lifecycle Engine (Sử dụng Slugs)
    kh_moi = lifecycle_stats.get("new", 0)
    kh_roi_bo = lifecycle_stats.get("churned", 0)
    kh_hien_huu = lifecycle_stats.get("active", 0)
    kh_tai_ban = lifecycle_stats.get("recovered", 0)
    kh_nguy_co = lifecycle_stats.get("at_risk", 0)
    
    tong_kh = kh_moi + kh_hien_huu + kh_tai_ban + kh_nguy_co + kh_roi_bo
    
    # 5. KH Tiềm Năng (Vãng lai - Gọi trực tiếp từ Service để đảm bảo đồng bộ logic gom tên)
    _, kh_tiem_nang, potential_ranks, _ = PotentialService.get_potential_data(
        db=db,
        current_user=current_user,
        start_date=start_date,
        end_date=end_date,
        node_code=node_code,
        min_days=1, # Theo Hiến pháp
        include_all=True
    )
    
    # 5. Tính toán tăng trưởng (MoM hoặc YoY) - GOVERNED SSOT
    curr_start, curr_end, prev_start, prev_end, max_data_date = get_governed_comparison_periods(
        db, start_date, end_date, comparison_type
    )
    
    rev_growth = 0
    latest_val = db.query(func.sum(Transaction.doanh_thu)).filter(Transaction.id == -1) # Default empty query
    prev_val_q = db.query(func.sum(Transaction.doanh_thu)).filter(Transaction.id == -1) # Default empty query

    if curr_start:
        latest_val = db.query(func.sum(Transaction.doanh_thu)).filter(
            Transaction.ngay_chap_nhan.between(curr_start, curr_end)
        )
        prev_val_q = db.query(func.sum(Transaction.doanh_thu)).filter(
            Transaction.ngay_chap_nhan.between(prev_start, prev_end)
        )

    if scope_point_ids is not None:
        latest_val = latest_val.filter(Transaction.point_id.in_(scope_point_ids))
        prev_val_q = prev_val_q.filter(Transaction.point_id.in_(scope_point_ids))
    
    latest_val = latest_val.scalar() or 0
    prev_val = prev_val_q.scalar() or 0
    
    rev_growth = 0
    if prev_val > 0:
        rev_growth = ((latest_val - prev_val) / prev_val) * 100

    # 6. Ngày cập nhật mới nhất
    latest_date = parse_db_date(db.query(func.max(Transaction.ngay_chap_nhan)).scalar())
    
    # Xử lý an toàn cho SQLite (có thể trả về string thay vì object datetime)
    latest_date_str = None
    if latest_date:
        if isinstance(latest_date, str):
            latest_date_str = latest_date
        elif hasattr(latest_date, 'isoformat'):
            latest_date_str = latest_date.isoformat()
        else:
            latest_date_str = str(latest_date)

    response_data = {
        "tong_doanh_thu": latest_val,
        "tong_kh": tong_kh,
        "kh_moi": kh_moi,
        "kh_roi_bo": kh_roi_bo,
        "kh_tiem_nang": kh_tiem_nang,
        "revenue_growth": round(rev_growth, 2),
        "latest_date": latest_date_str,
        "lifecycle": lifecycle_stats,
        "growth": growth_stats,
        "potential_ranks": potential_ranks,
        "debug_info": {
            "month": current_month_str,
            "scope_ids": scope_point_ids,
            "is_admin": ScopingService.is_admin(current_user)
        }
    }
    
    logger.info(f"DASHBOARD API SUCCESS: {current_month_str} | Scope: {scope_point_ids} | Results: {lifecycle_stats}")
    return response_data

@router.get("/summary")
# @cache_response(ttl_hours=24) # Tạm thời tắt để refresh số liệu SSOT
async def get_analytics_summary(
    start_date: str = None,
    end_date: str = None,
    node_code: str = None,
    comparison_type: str = "mom",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """ Endpoint hợp nhất: KPIs + Service Mix + Region Mix """
    # Chạy song song các query độc lập để tối ưu thời gian phản hồi
    stats_task = get_dashboard_stats(start_date=start_date, end_date=end_date, node_code=node_code, comparison_type=comparison_type, db=db, current_user=current_user)
    services_task = get_revenue_by_service(start_date=start_date, end_date=end_date, node_code=node_code, db=db, current_user=current_user)
    regions_task = get_revenue_by_region(start_date=start_date, end_date=end_date, node_code=node_code, db=db, current_user=current_user)
    
    stats, services, regions = await asyncio.gather(stats_task, services_task, regions_task)
    
    # Lấy thông tin tháng gần nhất có dữ liệu
    latest_trans_raw = db.query(func.max(Transaction.ngay_chap_nhan)).scalar()
    latest_trans = parse_db_date(latest_trans_raw)
    
    latest_month_range = None
    if latest_trans and hasattr(latest_trans, 'year'):
        year, month = latest_trans.year, latest_trans.month
        import calendar
        last_day = calendar.monthrange(year, month)[1]
        latest_month_range = {
            "label": f"Tháng {month:02d}/{year}",
            "value": f"{year}-{month:02d}",
            "start": f"{year}-{month:02d}-01",
            "end": f"{year}-{month:02d}-{last_day:02d}"
        }
    
    return {
        "stats": stats,
        "services": services,
        "regions": regions,
        "latest_month": latest_month_range
    }

@router.get("/data-coverage")
async def get_data_coverage(db: Session = Depends(get_db)):
    """ Trả về thông tin dải dữ liệu hiện có trong hệ thống """
    stats = db.query(
        func.min(Transaction.ngay_chap_nhan),
        func.max(Transaction.ngay_chap_nhan)
    ).first()
    
    if not stats or not stats[0]:
        return {"start": None, "end": None, "months": []}
        
    months = db.query(
        func.strftime('%Y-%m', Transaction.ngay_chap_nhan).label("month")
    ).filter(Transaction.ngay_chap_nhan != None)\
     .distinct().order_by("month").all()
     
    latest_trans = stats[1] # stats[1] là func.max(Transaction.ngay_chap_nhan)
    latest_month_range = None
    if latest_trans:
        # Xử lý trường hợp latest_trans là chuỗi (SQLite đôi khi trả về string)
        if isinstance(latest_trans, str):
            try:
                latest_trans = datetime.strptime(latest_trans.split('.')[0], "%Y-%m-%d %H:%M:%S")
            except:
                try:
                    latest_trans = datetime.strptime(latest_trans, "%Y-%m-%d")
                except: pass
        
        if hasattr(latest_trans, 'year'):
            year = latest_trans.year
            month = latest_trans.month
            # Thay đổi logic: Mặc định lấy đến ngày có dữ liệu thực tế thay vì cuối tháng
            latest_month_range = {
                "label": f"Tháng {month:02d}/{year}",
                "value": f"{year}-{month:02d}",
                "start": f"{year}-{month:02d}-01",
                "end": latest_trans.strftime("%Y-%m-%d")
            }

    return {
        "start": stats[0].strftime("%m/%Y") if stats[0] else None,
        "end": stats[1].strftime("%m/%Y") if stats[1] else None,
        "max_date": stats[1].isoformat() if stats[1] else None,
        "months": [
            {"value": r[0], "label": f"Tháng {r[0].split('-')[1]}/{r[0].split('-')[0]}"} 
            for r in reversed(months) # Đảo ngược để tháng mới nhất lên đầu
        ],
        "latest_month": latest_month_range
    }

@router.get("/revenue-trend")
@cache_response(ttl_hours=4)
async def get_revenue_trend(
    start_date: str = None,
    end_date: str = None,
    node_code: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Xác định phạm vi (Elite RBAC 3.0)
    scope_ids = ScopingService.get_effective_scope_ids(db, current_user, node_code)
    if scope_ids is not None and not scope_ids: return []

    query = db.query(
        func.date(Transaction.ngay_chap_nhan).label("date"),
        func.sum(Transaction.doanh_thu).label("value")
    ).filter(Transaction.ngay_chap_nhan != None)
    
    if start_date:
        query = query.filter(Transaction.ngay_chap_nhan >= start_date)
    if end_date:
        query = query.filter(Transaction.ngay_chap_nhan <= f"{end_date} 23:59:59")
    
    if scope_ids is not None:
        query = query.filter(Transaction.point_id.in_(scope_ids))
        
    stats = query.group_by(func.date(Transaction.ngay_chap_nhan)).order_by(func.date(Transaction.ngay_chap_nhan)).all()
    return [{"date": str(r[0]), "value": r[1] or 0} for r in stats]

@router.get("/revenue-monthly")
@cache_response(ttl_hours=4)
async def get_revenue_monthly(
    start_date: str = None,
    end_date: str = None,
    node_code: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Xác định phạm vi (Elite RBAC 3.0)
    scope_ids = ScopingService.get_effective_scope_ids(db, current_user, node_code)
    if scope_ids is not None and not scope_ids: return []

    # 2. Xác định dải thời gian (Rolling 12 months + Current)
    max_month_raw = db.query(func.max(MonthlyAnalyticsSummary.year_month)).scalar()
    if not max_month_raw: return []
    
    # Tính mốc bắt đầu (T-12)
    end_dt = datetime.strptime(max_month_raw, "%Y-%m")
    start_dt = end_dt - dateutil.relativedelta.relativedelta(months=12)
    start_month_str = start_dt.strftime("%Y-%m")

    # Group by Tháng-Năm (YYYY-MM)
    # Ưu tiên lấy từ bảng MonthlyAnalyticsSummary để đạt tốc độ tối đa
    # Chỉ lấy các Stage chính (NEW, ACTIVE, RECOVERED) để tránh double counting với Rank
    query = db.query(
        MonthlyAnalyticsSummary.year_month.label("month"),
        func.sum(MonthlyAnalyticsSummary.total_revenue).label("total")
    ).filter(
        MonthlyAnalyticsSummary.year_month >= start_month_str,
        MonthlyAnalyticsSummary.year_month <= max_month_raw,
        MonthlyAnalyticsSummary.lifecycle_stage.in_(['NEW', 'ACTIVE', 'RECOVERED'])
    )
    
    if scope_ids is not None:
        query = query.filter(MonthlyAnalyticsSummary.point_id.in_(scope_ids))
        
    stats = query.group_by(MonthlyAnalyticsSummary.year_month)\
                 .order_by(MonthlyAnalyticsSummary.year_month).all()
     
    return [{"month": r[0], "total": r[1] or 0} for r in stats]

@router.get("/revenue-by-service")
@cache_response(ttl_hours=12)
async def get_revenue_by_service(
    start_date: str = None,
    end_date: str = None,
    node_code: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Xác định phạm vi (Elite RBAC 3.0)
    scope_ids = ScopingService.get_effective_scope_ids(db, current_user, node_code)
    if scope_ids is not None and not scope_ids: return []

    # 2. Xác định tháng
    month_str = (start_date[:7] if start_date else None) or datetime.now().strftime("%Y-%m")

    # Ưu tiên lấy từ bảng MonthlyAnalyticsSummary
    query = db.query(
        MonthlyAnalyticsSummary.ma_dv, 
        func.sum(MonthlyAnalyticsSummary.total_revenue).label("total")
    ).filter(MonthlyAnalyticsSummary.year_month == month_str)
    
    if scope_ids is not None:
        query = query.filter(MonthlyAnalyticsSummary.point_id.in_(scope_ids))
        
    stats = query.group_by(MonthlyAnalyticsSummary.ma_dv).all()
        
    service_map = {
        'C': 'C - Bưu kiện',
        'E': 'E - EMS',
        'M': 'M - KT1',
        'R': 'R - Bưu phẩm BĐ',
        'L': 'L - Quốc tế'
    }
        
    result = []
    for r in stats:
        ma = str(r[0]).strip().upper() if r[0] else "Khác"
        name = service_map.get(ma, f"{ma} - Dịch vụ khác")
        result.append({"name": name, "value": r[1] or 0})
        
    return result

@router.get("/revenue-by-region")
@cache_response(ttl_hours=12)
async def get_revenue_by_region(
    start_date: str = None,
    end_date: str = None,
    node_code: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Xác định phạm vi (Elite RBAC 3.0)
    scope_ids = ScopingService.get_effective_scope_ids(db, current_user, node_code)
    if scope_ids is not None and not scope_ids: return []

    # 2. Xác định tháng
    month_str = (start_date[:7] if start_date else None) or datetime.now().strftime("%Y-%m")

    # Ưu tiên lấy từ bảng MonthlyAnalyticsSummary
    query = db.query(
        MonthlyAnalyticsSummary.region_type, 
        func.sum(MonthlyAnalyticsSummary.total_revenue).label("total")
    ).filter(MonthlyAnalyticsSummary.year_month == month_str)
    
    if scope_ids is not None:
        query = query.filter(MonthlyAnalyticsSummary.point_id.in_(scope_ids))
        
    stats = query.group_by(MonthlyAnalyticsSummary.region_type).all()
        
    result = { "Nội tỉnh": 0, "Liên tỉnh": 0, "Quốc tế": 0 }
    
    for r in stats:
        region, val = r
        val = val or 0
        if region in result:
            result[region] += val
        else:
            result["Liên tỉnh"] += val
            
    return [{"name": k, "value": v} for k, v in result.items() if v > 0]

@router.get("/top-movers")
# @cache_response(ttl_hours=6) # Tạm thời tắt để refresh số liệu SSOT
async def get_top_movers(
    start_date: str = None,
    end_date: str = None,
    node_code: str = None,
    limit: int = 20,
    comparison_type: str = "mom", # mom hoặc yoy
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Tính toán dải ngày (MoM hoặc YoY) - GOVERNED SSOT
    curr_start, curr_end, prev_start, prev_end, max_data_date = get_governed_comparison_periods(
        db, start_date, end_date, comparison_type
    )

    # Xác định phạm vi dữ liệu hiệu lực (Elite RBAC 3.0)
    scope_ids = ScopingService.get_effective_scope_ids(db, current_user, node_code)
    if scope_ids is not None and not scope_ids:
        return {
            "summary": {"revenue": {"current": 0, "previous": 0}, "volume": {"current": 0, "previous": 0}, "services": []},
            "movers": {"gainers": [], "losers": []},
            "period": {"current": {"start": "", "end": ""}, "previous": {"start": "", "end": ""}}
        }

    # [GOVERNANCE] Summary-First Boundary Check
    # Top Movers is a heavy operation. We ONLY allow it if the month has been summarized.
    month_str = curr_start.strftime("%Y-%m")
    summary_exists = db.query(MonthlyAnalyticsSummary).filter(MonthlyAnalyticsSummary.year_month == month_str).first() is not None
    if not summary_exists:
        logger.error(f"Governance Block: Top Movers refused for un-summarized month {month_str}")
        return {
            "summary": {"revenue": {"current": 0, "previous": 0}, "volume": {"current": 0, "previous": 0}, "services": []},
            "movers": {"gainers": [], "losers": []},
            "period": {"current": {"start": "", "end": ""}, "previous": {"start": "", "end": ""}},
            "governance_alert": "Data pending summary. Please run maintenance."
        }

    # 2 & 3. Query Doanh thu kỳ hiện tại và kỳ trước song song
    async def get_period_data(start, end, ids):
        q = db.query(
            Transaction.ma_kh, 
            func.sum(Transaction.doanh_thu).label("val")
        ).filter(
            Transaction.ngay_chap_nhan >= start, 
            Transaction.ngay_chap_nhan <= end,
            Transaction.ma_kh != None,
            Transaction.ma_kh != ''
        )
        if ids:
            q = q.filter(Transaction.point_id.in_(ids))
        return q.group_by(Transaction.ma_kh).all()

    curr_task = get_period_data(curr_start, curr_end, scope_ids)
    prev_task = get_period_data(prev_start, prev_end, scope_ids)
    
    curr_results, prev_results = await asyncio.gather(curr_task, prev_task)
    prev_data = {r[0]: (r[1] or 0) for r in prev_results if r[0]}

    # 4. Lấy tên mới nhất cho TOÀN BỘ Mã KH tham gia (Theo lệnh Sếp: Lấy từ giao dịch gần nhất trong DB)
    all_involved_ids = list(set([r[0] for r in curr_results if r[0]] + list(prev_data.keys())))
    
    name_map = {}
    if all_involved_ids:
        # Query này lấy tên từ giao dịch có ngày lớn nhất cho mỗi mã (Trong toàn bộ DB)
        names_query = db.query(
            Transaction.ma_kh,
            Transaction.ten_nguoi_gui,
            func.max(Transaction.ngay_chap_nhan)
        ).filter(Transaction.ma_kh.in_(all_involved_ids)).group_by(Transaction.ma_kh).all()
        name_map = {r[0]: r[1] for r in names_query if r[0]}

    # 5. Tính toán chênh lệch
    results = []
    for r in curr_results:
        ma_kh = r[0] or ""
        ten_kh = name_map.get(ma_kh, "N/A")
        curr_val = r[1] or 0
        prev_val = prev_data.get(ma_kh, 0)
        diff = curr_val - prev_val
        
        results.append({
            "ma_kh": ma_kh,
            "ten_kh": ten_kh,
            "current": curr_val,
            "previous": prev_val,
            "diff": diff
        })

    # Xử lý trường hợp có đơn tháng trước nhưng tháng này không có
    curr_ma_khs = {r["ma_kh"] for r in results}
    for ma_kh, prev_val in prev_data.items():
        if ma_kh not in curr_ma_khs:
            ten_kh = name_map.get(ma_kh, "KH đã ngừng gửi")
            results.append({
                "ma_kh": ma_kh,
                "ten_kh": ten_kh,
                "current": 0,
                "previous": prev_val,
                "diff": -prev_val
            })

    # 5. Phân tích TỔNG THỂ (MoM Summary by Service) - NEW
    async def get_service_stats(start, end, ids):
        base_q = db.query(
            Transaction.shbg,
            Transaction.trong_nuoc_quoc_te,
            Transaction.ma_dv,
            func.sum(Transaction.doanh_thu).label("rev"),
            func.count(Transaction.id).label("vol")
        ).filter(Transaction.ngay_chap_nhan >= start, Transaction.ngay_chap_nhan <= end)
        
        if ids:
            base_q = base_q.filter(Transaction.point_id.in_(ids))
            
        raw = base_q.group_by(func.substr(Transaction.shbg, 1, 1), Transaction.trong_nuoc_quoc_te, Transaction.ma_dv).all()
        
        svc_map = {"EMS": {"rev": 0, "vol": 0}, "Bưu kiện": {"rev": 0, "vol": 0}, 
                   "KT1": {"rev": 0, "vol": 0}, "BĐBD": {"rev": 0, "vol": 0}, 
                   "Quốc tế": {"rev": 0, "vol": 0}, "Khác": {"rev": 0, "vol": 0}}
        
        for r in raw:
            shbg_prefix = (r[0] or "")[:1].upper()
            trong_nuoc_qt = str(r[1] or "").strip().lower()
            ma_dv = str(r[2] or "").strip().upper()
            
            # Logic nhận diện Quốc tế linh hoạt (khớp với region logic)
            is_intl = trong_nuoc_qt in ['quốc tế', 'quoc te'] or ma_dv == 'L'
            
            if is_intl:
                s_key = "Quốc tế"
            elif shbg_prefix == 'E': s_key = "EMS"
            elif shbg_prefix == 'C': s_key = "Bưu kiện"
            elif shbg_prefix == 'M': s_key = "KT1"
            elif shbg_prefix == 'R': s_key = "BĐBD"
            else: s_key = "Khác"
            
            svc_map[s_key]["rev"] += (r[3] or 0)
            svc_map[s_key]["vol"] += (r[4] or 0)
            
        return svc_map

    curr_svc_task = get_service_stats(curr_start, curr_end, scope_ids)
    prev_svc_task = get_service_stats(prev_start, prev_end, scope_ids)
    
    curr_svc, prev_svc = await asyncio.gather(curr_svc_task, prev_svc_task)
    
    services_summary = []
    # Bao gồm cả 'Khác' để đảm bảo Tổng doanh thu chính xác 100%
    for s_name in ["EMS", "Bưu kiện", "KT1", "BĐBD", "Quốc tế", "Khác"]:
        curr_r = curr_svc[s_name]["rev"]
        prev_r = prev_svc[s_name]["rev"]
        curr_v = curr_svc[s_name]["vol"]
        prev_v = prev_svc[s_name]["vol"]
        
        # Lấy nếu có dữ liệu ở bất kỳ kỳ nào
        if curr_r > 0 or prev_r > 0 or curr_v > 0 or prev_v > 0:
            services_summary.append({
                "service": s_name,
                "current_rev": curr_r,
                "previous_rev": prev_r,
                "current_vol": curr_v,
                "previous_vol": prev_v
            })

    total_curr_rev = sum(s["current_rev"] for s in services_summary)
    total_prev_rev = sum(s["previous_rev"] for s in services_summary)
    total_curr_vol = sum(s["current_vol"] for s in services_summary)
    total_prev_vol = sum(s["previous_vol"] for s in services_summary)

    # 6. Sắp xếp và lấy Top
    gainers = sorted([r for r in results if r['diff'] > 0], key=lambda x: x['diff'], reverse=True)[:limit]
    losers = sorted([r for r in results if r['diff'] < 0], key=lambda x: x['diff'])[:limit]

    return {
        "summary": {
            "revenue": {"current": total_curr_rev, "previous": total_prev_rev},
            "volume": {"current": total_curr_vol, "previous": total_prev_vol},
            "services": services_summary
        },
        "movers": {
            "gainers": gainers,
            "losers": losers
        },
        "period": {
            "current": {"start": curr_start.strftime("%d/%m/%Y"), "end": curr_end.strftime("%d/%m/%Y")},
            "previous": {"start": prev_start.strftime("%d/%m/%Y"), "end": prev_end.strftime("%d/%m/%Y")},
            "type": comparison_type
        }
    }

@router.get("/sync-status")
async def get_sync_status(db: Session = Depends(get_db)):
    """Kiểm tra tình trạng đồng bộ trong ngày để cảnh báo UI"""
    expected_date = datetime.now() - timedelta(days=1)
    expected_str = expected_date.strftime("%Y%m%d")
    
    # Lấy các nỗ lực cho ngày T-1
    attempts = db.query(SyncAttempt).filter(
        SyncAttempt.folder_name == expected_str
    ).order_by(SyncAttempt.attempt_time.desc()).all()
    
    # Kiểm tra xem đã có dữ liệu hoàn tất chưa
    is_success = db.query(SyncLog).filter(
        SyncLog.folder_name == expected_str,
        SyncLog.status == 'COMPLETED'
    ).first() is not None
    
    failures = [a for a in attempts if a.status in ('FAILED', 'MISSING_DATA')]
    
    return {
        "folder_name": expected_str,
        "is_synced": is_success,
        "failure_count": len(failures),
        "has_alert": len(failures) >= 3 and not is_success,
        "latest_attempt": {
            "time": attempts[0].attempt_time.isoformat() if attempts else None,
            "status": attempts[0].status if attempts else None,
            "error": attempts[0].error_details if attempts else None
        } if attempts else None,
        "message": "Cần can thiệp kỹ thuật: Dữ liệu chưa về sau 3 lần thử!" if len(failures) >= 3 and not is_success else None
    }

@router.get("/system-health")
async def get_system_health(db: Session = Depends(get_db)):
    """Kiểm tra độ sạch của dữ liệu để cảnh báo trên Dashboard"""
    # 1. Tổng số khách hàng (định danh)
    total_customers = db.query(Customer).count()
    
    # 2. Lỗi 1: Khách hàng (CMS) không có tên hoặc rác
    invalid_customers = db.query(Customer).filter(
        (Customer.ten_kh == None) | (Customer.ten_kh == '') |
        (Customer.ma_crm_cms == None) | (Customer.ma_crm_cms == '')
    ).count()

    # 3. Lỗi 2: Transaction có mã KH, nhưng mã này KHÔNG TỒN TẠI trong bảng Customer (Khách hàng mồ côi)
    orphan_trans_count = db.query(func.count(func.distinct(Transaction.ma_kh))).filter(
        Transaction.ma_kh != None,
        Transaction.ma_kh != '',
        ~Transaction.ma_kh.in_(db.query(Customer.ma_crm_cms))
    ).scalar() or 0

    total_dirty = invalid_customers + orphan_trans_count
    
    dirty_rate = 0
    if total_customers > 0:
        dirty_rate = (total_dirty / total_customers) * 100

    return {
        "status": "success",
        "health": {
            "total_customers": total_customers,
            "invalid_customers": invalid_customers,
            "orphan_transactions": orphan_trans_count,
            "total_dirty": total_dirty,
            "dirty_rate": round(dirty_rate, 2)
        },
        "has_alert": dirty_rate > 1.0 or total_dirty > 20,
        "message": f"Cảnh báo: Phát hiện {total_dirty} dữ liệu bất thường ({round(dirty_rate, 1)}%). Đề nghị dọn dẹp Master File!" if (dirty_rate > 1.0 or total_dirty > 20) else "Tuyệt vời, dữ liệu đang rất sạch (<=1% tỉ lệ bẩn)!"
    }

@router.get("/customer-scoring")
@cache_response(ttl_hours=24)
async def get_customer_performance_scoring(
    start_date: str = None,
    end_date: str = None,
    node_code: str = None,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tính điểm tiềm năng của khách hàng dựa trên RFM"""
    
    # Xác định phạm vi dữ liệu hiệu lực (Elite RBAC 3.0)
    scope_ids = ScopingService.get_effective_scope_ids(db, current_user, node_code)
    if scope_ids is not None and not scope_ids: return []
    
    # Mặc định lấy tháng hiện tại
    if not start_date or not end_date:
        max_date = parse_db_date(db.query(func.max(Transaction.ngay_chap_nhan)).scalar())
        if not max_date: return []
        curr_start = max_date.replace(day=1)
        curr_end = max_date
    else:
        curr_start = datetime.strptime(start_date, "%Y-%m-%d")
        curr_end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)

    # Query metrics
    metrics_query = db.query(
        Transaction.ma_kh,
        func.sum(Transaction.doanh_thu).label("revenue"),
        func.count(Transaction.id).label("frequency"),
        func.max(Transaction.ngay_chap_nhan).label("last_active")
    ).filter(
        Transaction.ngay_chap_nhan.between(curr_start, curr_end),
        Transaction.ma_kh != None,
        Transaction.ma_kh != '',
        Transaction.ma_kh != 'None',
        Transaction.ma_kh != 'NONE'
    )
    
    # Apply scope filter
    if scope_ids is not None:
        metrics_query = metrics_query.filter(Transaction.point_id.in_(scope_ids))
        
    metrics = metrics_query.group_by(Transaction.ma_kh).all()
    
    if not metrics: return []

    # Lấy tên mới nhất (Data-Driven)
    involved_ids = [m.ma_kh for m in metrics if m.ma_kh]
    name_map = {}
    if involved_ids:
        names = db.query(
            Transaction.ma_kh,
            Transaction.ten_nguoi_gui,
            func.max(Transaction.ngay_chap_nhan)
        ).filter(Transaction.ma_kh.in_(involved_ids)).group_by(Transaction.ma_kh).all()
        name_map = {r[0]: r[1] for r in names if r[0]}
    
    # Chấm điểm Percentile (Xếp hạng phần trăm)
    sorted_rev = sorted(metrics, key=lambda x: x.revenue or 0)
    sorted_freq = sorted(metrics, key=lambda x: x.frequency or 0)
    
    rev_ranks = {m.ma_kh: (i+1)/len(sorted_rev)*100 for i, m in enumerate(sorted_rev)}
    freq_ranks = {m.ma_kh: (i+1)/len(sorted_freq)*100 for i, m in enumerate(sorted_freq)}
    
    results = []
    for m in metrics:
        # Fallback Name Logic
        ten_kh = name_map.get(m.ma_kh)
        if not ten_kh or ten_kh == "N/A":
            cust = db.query(Customer).filter(Customer.ma_crm_cms == m.ma_kh).first()
            ten_kh = cust.ten_kh if cust else f"KH: {m.ma_kh}"

        # Score based on Percentile
        r_score = rev_ranks.get(m.ma_kh, 0)
        f_score = freq_ranks.get(m.ma_kh, 0)
        final_score = (r_score * 0.7 + f_score * 0.3)
        
        results.append({
            "ma_kh": m.ma_kh,
            "ten_kh": ten_kh,
            "revenue": m.revenue or 0,
            "frequency": m.frequency or 0,
            "last_active": m.last_active.strftime("%d/%m/%Y") if m.last_active else "N/A",
            "score": round(final_score, 1),
            "rank": "Tiềm năng cao" if final_score > 90 else "Ổn định" if final_score > 60 else "Cần chăm sóc"
        })
        
    return sorted(results, key=lambda x: x['score'], reverse=True)[:limit]

@router.get("/churn-prediction")
@cache_response(ttl_hours=24)
async def get_churn_prediction_alerts(
    end_date: str = None,
    node_code: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Phát hiện khách hàng có dấu hiệu rời bỏ sớm"""
    
    # Xác định phạm vi dữ liệu hiệu lực (Elite RBAC 3.0)
    scope_ids = ScopingService.get_effective_scope_ids(db, current_user, node_code)
    if scope_ids is not None and not scope_ids: return []
    
    if not end_date:
        max_date = parse_db_date(db.query(func.max(Transaction.ngay_chap_nhan)).scalar())
        if not max_date: return []
    else:
        max_date = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
    

    # 1. Tháng hiện tại
    curr_start = max_date.replace(day=1)
    curr_end = max_date

    # 2. Tháng trước
    prev_start = curr_start - dateutil.relativedelta.relativedelta(months=1)
    prev_end = curr_end - dateutil.relativedelta.relativedelta(months=1)
    
    # Subqueries
    curr_q = db.query(Transaction.ma_kh, func.sum(Transaction.doanh_thu).label("rev"))\
               .filter(Transaction.ngay_chap_nhan.between(curr_start, curr_end))
    
    prev_q = db.query(Transaction.ma_kh, func.sum(Transaction.doanh_thu).label("rev"))\
               .filter(Transaction.ngay_chap_nhan.between(prev_start, prev_end))

    if scope_ids is not None:
        curr_q = curr_q.filter(Transaction.point_id.in_(scope_ids))
        prev_q = prev_q.filter(Transaction.point_id.in_(scope_ids))

    curr_rev = curr_q.group_by(Transaction.ma_kh).subquery()
    prev_rev = prev_q.group_by(Transaction.ma_kh).subquery()
                 
    # Tìm những khách giảm > 30%
    prediction = db.query(
        Customer.ma_crm_cms,
        Customer.ten_kh,
        Customer.rfm_segment,
        prev_rev.c.rev.label("prev_val"),
        func.coalesce(curr_rev.c.rev, 0).label("curr_val")
    ).join(prev_rev, Customer.ma_crm_cms == prev_rev.c.ma_kh)\
     .outerjoin(curr_rev, Customer.ma_crm_cms == curr_rev.c.ma_kh)\
     .filter(prev_rev.c.rev > 1000000) 
     
    results = []
    # Lấy tên mới nhất (Data-Driven)
    involved_ids = [r.ma_crm_cms for r in prediction.all()]
    name_map = {}
    if involved_ids:
        names = db.query(
            Transaction.ma_kh,
            Transaction.ten_nguoi_gui,
            func.max(Transaction.ngay_chap_nhan)
        ).filter(Transaction.ma_kh.in_(involved_ids)).group_by(Transaction.ma_kh).all()
        name_map = {r[0]: r[1] for r in names if r[0]}

    for r in prediction.all():
        drop_pct = ((r.prev_val - r.curr_val) / r.prev_val) * 100
        # Ngưỡng: 30% cho Diamond/Gold, 50% cho người khác
        threshold = 30 if r.rfm_segment in ('Kim Cương', 'Vàng') else 50
        
        if drop_pct >= threshold:
            # Lấy ngày gửi cuối cùng của khách này
            last_date = db.query(func.max(Transaction.ngay_chap_nhan)).filter(Transaction.ma_kh == r.ma_crm_cms).scalar()
            last_date_obj = parse_db_date(last_date)
            days_inactive = (max_date - last_date_obj).days if last_date_obj else 99
            
            # Fallback Name Logic
            ten_kh = name_map.get(r.ma_crm_cms)
            if not ten_kh or ten_kh == "N/A":
                ten_kh = r.ten_kh if r.ten_kh and r.ten_kh != "N/A" else f"KH: {r.ma_crm_cms}"

            # Detailed Reason Logic
            reasons = []
            if drop_pct > threshold:
                reasons.append(f"Doanh thu sụt giảm {round(drop_pct, 1)}%")
            if days_inactive > 15:
                reasons.append(f"Vắng mặt {days_inactive} ngày")
            detailed_reason = " & ".join(reasons) if reasons else "Biến động giao dịch bất thường"

            results.append({
                "ma_kh": r.ma_crm_cms,
                "ten_kh": ten_kh,
                "segment": r.rfm_segment or "Thường",
                "lifecycle_stage": r.rfm_segment or "Thường", # Using segment as a proxy for stage if not directly available
                "drop_pct": round(drop_pct, 1),
                "last_active": last_date_obj.strftime("%d/%m/%Y") if last_date_obj else "N/A",
                "days_inactive": days_inactive,
                "curr_rev": r.curr_val,
                "prev_rev": r.prev_val,
                "detailed_reason": detailed_reason,
                "risk_level": "🚨 CAO" if drop_pct > 70 or days_inactive > 20 else "⚠️ TRUNG BÌNH"
            })
            
    return sorted(results, key=lambda x: x['drop_pct'], reverse=True)[:10]

@router.get("/heatmap-units")
# @cache_response(ttl_hours=24)
async def get_heatmap_units(
    start_date: str = None,
    end_date: str = None,
    node_code: str = None,
    comparison_type: str = "mom",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trả về dữ liệu doanh thu phân bổ theo Cấp bậc quản lý (Cluster -> Ward -> Point)"""
    
    # 1. Xác định mốc thời gian (GOVERNED SSOT)
    curr_start, curr_end, prev_start, prev_end, max_data_date = get_governed_comparison_periods(
        db, start_date, end_date, comparison_type
    )
    
    if not curr_start:
        return []
    
    # 2. Xác định danh sách các nhóm dựa trên drill-down level (Elite RBAC 3.0)
    # Get nodes that the user is allowed to see
    user_scope_ids = ScopingService.get_effective_scope_ids(db, current_user, node_code)
    
    if user_scope_ids is not None and not user_scope_ids:
        return []

    if not node_code or node_code == "":
        # Nếu không có node_code, ta hiển thị con của node phạm vi của user
        if not current_user.scope_node_id:
            # Admin: Hiện các Cụm (Level 1)
            sub_groups = db.query(HierarchyNode).filter(HierarchyNode.type == 'CLUSTER').all()
        else:
            # User thường: Hiện các con trực tiếp của node phạm vi của họ
            sub_groups = db.query(HierarchyNode).filter(HierarchyNode.parent_id == current_user.scope_node_id).all()
            # Nếu node phạm vi không có con (ví dụ user ở cấp POINT), thì hiện chính node đó
            if not sub_groups:
                sub_groups = [current_user.scope_node]
    else:
        # Drill-down vào node cụ thể -> Hiện các con trực tiếp
        parent_node = db.query(HierarchyNode).filter(HierarchyNode.code == node_code).first()
        if not parent_node: return []
        
        sub_groups = db.query(HierarchyNode).filter(HierarchyNode.parent_id == parent_node.id).all()
        # Nếu node được chọn không có con, hiển thị chính nó
        if not sub_groups:
            sub_groups = [parent_node]
    
    results = []
    sum_c_val = 0
    sum_p_val = 0
    
    # 3. Tính toán TỔNG của phạm vi đang soi để tìm Orphan (Transactions không gán đúng hierarchy)
    # [SSOT] Phải dùng cùng một user_scope_ids để đảm bảo tính nhất quán
    total_q_c = db.query(func.sum(Transaction.doanh_thu)).filter(
        Transaction.ngay_chap_nhan >= curr_start,
        Transaction.ngay_chap_nhan <= curr_end
    )
    total_q_p = db.query(func.sum(Transaction.doanh_thu)).filter(
        Transaction.ngay_chap_nhan >= prev_start,
        Transaction.ngay_chap_nhan <= prev_end
    )
    
    if user_scope_ids is not None:
        total_q_c = total_q_c.filter(Transaction.point_id.in_(user_scope_ids))
        total_q_p = total_q_p.filter(Transaction.point_id.in_(user_scope_ids))
        
    total_c_val = total_q_c.scalar() or 0
    total_p_val = total_q_p.scalar() or 0
    
    for group in sub_groups:
        # Lấy tất cả descendant IDs của group này
        group_desc_ids = HierarchyService.get_descendant_ids(db, group.code)
        
        # QUAN TRỌNG: Giao giữa các đơn vị con của group này và phạm vi được phép của user
        allowed_ids = list(set(group_desc_ids) & set(user_scope_ids)) if user_scope_ids is not None else group_desc_ids
        
        if not allowed_ids:
            continue

        # Doanh thu kỳ này
        c_val = db.query(func.sum(Transaction.doanh_thu)).filter(
            Transaction.point_id.in_(allowed_ids),
            Transaction.ngay_chap_nhan >= curr_start,
            Transaction.ngay_chap_nhan <= curr_end
        ).scalar() or 0
        
        # Doanh thu kỳ trước
        p_val = db.query(func.sum(Transaction.doanh_thu)).filter(
            Transaction.point_id.in_(allowed_ids),
            Transaction.ngay_chap_nhan >= prev_start,
            Transaction.ngay_chap_nhan <= prev_end
        ).scalar() or 0
        
        growth = ((c_val - p_val) / p_val * 100) if p_val > 0 else (100 if c_val > 0 else 0)
        
        results.append({
            "don_vi": group.name,
            "ma_don_vi": group.code,
            "type": group.type,
            "revenue": float(c_val),
            "previous_revenue": float(p_val),
            "growth": round(float(growth), 1)
        })
        sum_c_val += c_val
        sum_p_val += p_val
    
    # [SSOT] Handle Orphan Revenue (Transactions with point_id not in hierarchy loop)
    orphan_c_val = total_c_val - sum_c_val
    orphan_p_val = total_p_val - sum_p_val
    
    if orphan_c_val > 0 or orphan_p_val > 0:
        orphan_growth = ((orphan_c_val - orphan_p_val) / orphan_p_val * 100) if orphan_p_val > 0 else (100 if orphan_c_val > 0 else 0)
        results.append({
            "don_vi": "Đơn vị khác / Chưa phân loại",
            "ma_don_vi": "ORPHAN",
            "type": "OTHER",
            "revenue": float(max(0, orphan_c_val)),
            "previous_revenue": float(max(0, orphan_p_val)),
            "growth": round(float(orphan_growth), 1)
        })
    
    if not results: return []
    
    # Tính toán intensity (kích thước điểm)
    max_rev = max([r["revenue"] for r in results]) if results else 1
    for r in results:
        r["intensity"] = round((r["revenue"] / max_rev) * 100, 1)
        
    return sorted(results, key=lambda x: x["revenue"], reverse=True)
