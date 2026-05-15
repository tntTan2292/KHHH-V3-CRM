from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, text, case
from datetime import datetime, timedelta

from ..database import get_db
from ..models import Customer, Transaction, SyncAttempt, SyncLog, HierarchyNode, MonthlyAnalyticsSummary, CustomerMonthlySnapshot
from ..services.lifecycle_service import LifecycleService
import dateutil.relativedelta
from ..core.cache import cache_response
import asyncio
from ..services.scoping_service import ScopingService
from ..routers.auth import get_current_user
from ..models import User
from ..services.potential_service import PotentialService
from ..core.kpi_governance import KPIRegistry
from ..services.kpi_scoring_service import KPIScoringService

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
        curr_end = max_data_date.replace(hour=23, minute=59, second=59)
    else:
        curr_start = datetime.strptime(start_date, "%Y-%m-%d")
        requested_end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        # [GOVERNANCE] Boundary Capping: Cannot report into the future
        curr_end = min(requested_end, max_data_date.replace(hour=23, minute=59, second=59))

    if comparison_type == "yoy":
        prev_start = curr_start - dateutil.relativedelta.relativedelta(years=1)
        prev_end = curr_end - dateutil.relativedelta.relativedelta(years=1)
    else:
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
# @cache_response(ttl_hours=4)
async def get_dashboard_stats(
    start_date: str = None,
    end_date: str = None,
    node_code: str = None,
    comparison_type: str = "mom",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Xác định phạm vi (Elite RBAC 3.0)
    scope_point_ids = ScopingService.get_effective_scope_ids(db, current_user, node_code)
    if scope_point_ids is not None and not scope_point_ids:
        return {
            "tong_doanh_thu": 0, "tong_kh": 0, "kh_moi": 0, "kh_roi_bo": 0,
            "kh_tiem_nang": 0, "revenue_growth": 0, "latest_date": None, "lifecycle": {}
        }
        
    # 2. Xác định dải thời gian được quản trị (Governed Temporal Range)
    curr_start, curr_end, prev_start, prev_end, max_data_date = get_governed_comparison_periods(db, start_date, end_date, comparison_type)
    
    governed_start = curr_start.strftime("%Y-%m-%d")
    governed_end = curr_end.strftime("%Y-%m-%d")
    prev_start_str = prev_start.strftime("%Y-%m-%d")
    prev_end_str = prev_end.strftime("%Y-%m-%d")
    month_str = governed_start[:7]
    current_month_str = max_data_date.strftime("%Y-%m")

    # 3. FETCH REVENUE KPI (GOVERNANCE RULE 1: Total Revenue -> Transaction)
    def get_rev_for_range(start_str, end_str, s_ids):
        q = db.query(func.sum(Transaction.doanh_thu)).filter(
            Transaction.ngay_chap_nhan >= start_str,
            Transaction.ngay_chap_nhan <= f"{end_str} 23:59:59"
        )
        if s_ids is not None:
            q = q.filter(Transaction.point_id.in_(s_ids))
        return q.scalar() or 0.0

    latest_val = get_rev_for_range(governed_start, governed_end, scope_point_ids)
    prev_val = get_rev_for_range(prev_start_str, prev_end_str, scope_point_ids)
    rev_growth = ((latest_val - prev_val) / prev_val * 100) if prev_val > 0 else 0
    
    # 4. FETCH LIFECYCLE POPULATIONS (GOVERNANCE: Derived from LifecycleService)
    lifecycle_stats = LifecycleService.get_customer_lifecycle_stats(
        db, 
        month_str=month_str, 
        scope_point_ids=scope_point_ids,
        start_date=governed_start,
        end_date=governed_end
    )
    
    # [RF5C] Map to Constitutional Fields
    kh_moi = lifecycle_stats.get("new_event", 0)
    kh_roi_bo = lifecycle_stats.get("churn_event", 0)
    tong_kh = lifecycle_stats.get("total", 0)

    # 5. KH Tiềm Năng (PotentialService)
    _, kh_tiem_nang, potential_ranks, _ = PotentialService.get_potential_data(
        db=db, current_user=current_user, start_date=governed_start, end_date=governed_end,
        node_code=node_code, min_days=1, include_all=True
    )
    
    # 6. Lifecycle Delta & Growth (Unified SSOT)
    lifecycle_delta = {k: 0 for k in lifecycle_stats.keys() if k != 'total'}
    lifecycle_growth = {k: 0 for k in lifecycle_stats.keys() if k != 'total'}
    if prev_start:
        prev_lifecycle_stats = LifecycleService.get_customer_lifecycle_stats(
            db, month_str=prev_start_str[:7], scope_point_ids=scope_point_ids,
            start_date=prev_start_str, end_date=prev_end_str
        )
        for k in lifecycle_delta.keys():
            curr_v, prev_v = lifecycle_stats.get(k, 0), prev_lifecycle_stats.get(k, 0)
            lifecycle_delta[k] = curr_v - prev_v
            lifecycle_growth[k] = round(((curr_v - prev_v) / prev_v) * 100, 1) if prev_v > 0 else (100.0 if curr_v > 0 else 0.0)

    # 7. Growth Distribution from Summary
    growth_stats = {"GROWTH": 0, "STABLE": 0, "DECLINING": 0}
    summary_res = db.query(
        MonthlyAnalyticsSummary.growth_tag,
        func.sum(MonthlyAnalyticsSummary.total_customers).label("customers")
    ).filter(MonthlyAnalyticsSummary.year_month == month_str)
    if scope_point_ids is not None:
        summary_res = summary_res.filter(MonthlyAnalyticsSummary.point_id.in_(scope_point_ids))
    for tag, cust in summary_res.group_by(MonthlyAnalyticsSummary.growth_tag).all():
        if tag in growth_stats: growth_stats[tag] = cust or 0

    latest_date_raw = db.query(func.max(Transaction.ngay_chap_nhan)).scalar()
    latest_date_str = str(latest_date_raw).split('.')[0] if latest_date_raw else None

    response_data = {
        "tong_doanh_thu": latest_val,
        "tong_kh": tong_kh,
        "kh_moi": kh_moi,
        "kh_roi_bo": kh_roi_bo,
        "kh_tiem_nang": kh_tiem_nang,
        "revenue_growth": round(rev_growth, 2),
        "latest_date": latest_date_str,
        "lifecycle": lifecycle_stats,
        "lifecycle_delta": lifecycle_delta,
        "lifecycle_growth": lifecycle_growth,
        "growth": growth_stats,
        "potential_ranks": potential_ranks,
        "debug_info": {"month": month_str, "scope_ids": scope_point_ids},
        "governance": {
            "metrics": {
                "tong_doanh_thu": {
                    "code": "REVENUE",
                    "authority": "GOVERNED",
                    "score": KPIScoringService.calculate_normalized_score("REVENUE", latest_val),
                    "status": KPIScoringService.get_performance_status("REVENUE", KPIScoringService.calculate_normalized_score("REVENUE", latest_val)),
                    "unit": "VND"
                },
                "revenue_growth": {
                    "code": "REVENUE_GROWTH",
                    "authority": "DERIVED",
                    "score": KPIScoringService.calculate_normalized_score("REVENUE_GROWTH", rev_growth),
                    "status": KPIScoringService.get_performance_status("REVENUE_GROWTH", KPIScoringService.calculate_normalized_score("REVENUE_GROWTH", rev_growth)),
                    "unit": "%"
                }
            }
        }
    }
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
    logger.info(f"[DIAGNOSTIC-SUMMARY] start_date={start_date}, end_date={end_date}, node_code={node_code}")
    """ Endpoint hợp nhất: KPIs + Service Mix + Region Mix """
    # Chạy tuần tự các query (do dùng chung 1 Session DB không an toàn cho concurrency)
    stats = await get_dashboard_stats(start_date=start_date, end_date=end_date, node_code=node_code, comparison_type=comparison_type, db=db, current_user=current_user)
    services = await get_revenue_by_service(start_date=start_date, end_date=end_date, node_code=node_code, db=db, current_user=current_user)
    regions = await get_revenue_by_region(start_date=start_date, end_date=end_date, node_code=node_code, db=db, current_user=current_user)
    
    # Lấy thông tin tháng gần nhất có dữ liệu
    latest_trans_raw = db.query(func.max(Transaction.ngay_chap_nhan)).scalar()
    latest_trans = parse_db_date(latest_trans_raw)
    
    latest_month_range = None
    if latest_trans and hasattr(latest_trans, 'year'):
        year, month = latest_trans.year, latest_trans.month
        latest_month_range = {
            "label": f"Tháng {month:02d}/{year}",
            "value": f"{year}-{month:02d}",
            "start": f"{year}-{month:02d}-01",
            "end": latest_trans.strftime("%Y-%m-%d")
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
# @cache_response(ttl_hours=4)
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
# @cache_response(ttl_hours=4)
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

    # 2. Xác định dải thời gian (CỐ ĐỊNH: Tháng dữ liệu cuối cùng lùi 13 tháng)
    # [GOVERNANCE] Global Financial Trend ignores temporal filters to show historical context.
    target_month = db.query(func.max(MonthlyAnalyticsSummary.year_month)).scalar() or datetime.now().strftime("%Y-%m")
    
    end_dt = datetime.strptime(target_month, "%Y-%m")
    print(f"[DEBUG BACKEND] target_month: {target_month}, start_date_param: {start_date}, end_date_param: {end_date}")
    
    # Tạo danh sách 14 tháng (T-13 -> T)
    months_range = []
    for i in range(13, -1, -1):
        m = end_dt - dateutil.relativedelta.relativedelta(months=i)
        months_range.append(m.strftime("%Y-%m"))
    
    start_month_str = months_range[0]
    max_month_str = months_range[-1]

    # 3. Query dữ liệu (GOVERNANCE: Pull from Transaction for Realtime Trend)
    query = db.query(
        func.strftime('%Y-%m', Transaction.ngay_chap_nhan).label("month"),
        func.sum(Transaction.doanh_thu).label("total")
    ).filter(
        Transaction.ngay_chap_nhan >= f"{start_month_str}-01",
        Transaction.ngay_chap_nhan <= f"{max_month_str}-31 23:59:59"
    )
    
    if scope_ids is not None:
        query = query.filter(Transaction.point_id.in_(scope_ids))
        
    stats = query.group_by("month").all()
    
    # Mapping kết quả vào dải tháng (Điền 0 nếu khuyết dữ liệu)
    data_map = {r[0]: (r[1] or 0) for r in stats}
    return [{"month": m, "total": data_map.get(m, 0)} for m in months_range]

@router.get("/revenue-by-service")
# @cache_response(ttl_hours=12)
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

    # 2. Xác định dải thời gian (GOVERNANCE: Pull from Transaction for Realtime Service Mix)
    curr_start, curr_end, _, _, _ = get_governed_comparison_periods(db, start_date, end_date)

    # Ưu tiên lấy từ bảng Transaction
    query = db.query(
        Transaction.ma_dv, 
        func.sum(Transaction.doanh_thu).label("total")
    ).filter(Transaction.ngay_chap_nhan.between(curr_start, curr_end))
    
    if scope_ids is not None:
        query = query.filter(Transaction.point_id.in_(scope_ids))
        
    stats = query.group_by(Transaction.ma_dv).all()
        
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
# @cache_response(ttl_hours=12)
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

    # 2. Xác định dải thời gian (GOVERNANCE: Pull from Transaction for Realtime Region Mix)
    curr_start, curr_end, _, _, _ = get_governed_comparison_periods(db, start_date, end_date)

    # Ưu tiên lấy từ bảng Transaction (SSOT Realtime)
    # [GOVERNANCE] Map từ lien_tinh_noi_tinh và trong_nuoc_quoc_te
    query = db.query(
        case(
            (Transaction.trong_nuoc_quoc_te == "Quốc tế", "Quốc tế"),
            (Transaction.lien_tinh_noi_tinh == "Nội tỉnh", "Nội tỉnh"),
            else_="Liên tỉnh"
        ).label("region"),
        func.sum(Transaction.doanh_thu).label("total")
    ).filter(Transaction.ngay_chap_nhan.between(curr_start, curr_end))
    
    if scope_ids is not None:
        query = query.filter(Transaction.point_id.in_(scope_ids))
        
    stats = query.group_by(text("region")).all()
        
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

    # 2 & 3. Query Doanh thu kỳ hiện tại và kỳ trước (GOVERNANCE: Pull from CustomerMonthlySnapshot)
    async def get_period_data(month_str, ids):
        q = db.query(
            CustomerMonthlySnapshot.ma_kh, 
            func.sum(CustomerMonthlySnapshot.revenue).label("val")
        ).filter(
            CustomerMonthlySnapshot.year_month == month_str,
            CustomerMonthlySnapshot.ma_kh != None,
            CustomerMonthlySnapshot.ma_kh != ''
        )
        if ids:
            q = q.filter(CustomerMonthlySnapshot.point_id.in_(ids))
        return q.group_by(CustomerMonthlySnapshot.ma_kh).all()

    curr_month_str = curr_start.strftime("%Y-%m")
    prev_month_str = prev_start.strftime("%Y-%m")

    curr_task = get_period_data(curr_month_str, scope_ids)
    prev_task = get_period_data(prev_month_str, scope_ids)
    
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

    # 5. Phân tích TỔNG THỂ (MoM Summary by Service) - (GOVERNANCE: Pull from MonthlyAnalyticsSummary)
    async def get_service_stats(month_str, ids):
        q = db.query(
            MonthlyAnalyticsSummary.ma_dv,
            func.sum(MonthlyAnalyticsSummary.total_revenue).label("rev"),
            func.sum(MonthlyAnalyticsSummary.total_orders).label("vol")
        ).filter(MonthlyAnalyticsSummary.year_month == month_str)
        
        if ids:
            q = q.filter(MonthlyAnalyticsSummary.point_id.in_(ids))
            
        raw = q.group_by(MonthlyAnalyticsSummary.ma_dv).all()
        
        svc_map = {"EMS": {"rev": 0, "vol": 0}, "Bưu kiện": {"rev": 0, "vol": 0}, 
                   "KT1": {"rev": 0, "vol": 0}, "BĐBD": {"rev": 0, "vol": 0}, 
                   "Quốc tế": {"rev": 0, "vol": 0}, "Khác": {"rev": 0, "vol": 0}}
        
        service_id_map = {
            'E': 'EMS', 'C': 'Bưu kiện', 'M': 'KT1', 'R': 'BĐBD', 'L': 'Quốc tế'
        }
        
        for ma_dv, rev, vol in raw:
            s_key = service_id_map.get(ma_dv, "Khác")
            svc_map[s_key]["rev"] += (rev or 0)
            svc_map[s_key]["vol"] += (vol or 0)
            
        return svc_map

    curr_svc_task = get_service_stats(curr_month_str, scope_ids)
    prev_svc_task = get_service_stats(prev_month_str, scope_ids)
    
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
# @cache_response(ttl_hours=24)
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

    # Query metrics (GOVERNANCE: Pull from CustomerMonthlySnapshot for Scoring)
    month_str = curr_start.strftime("%Y-%m")
    metrics_query = db.query(
        CustomerMonthlySnapshot.ma_kh,
        func.sum(CustomerMonthlySnapshot.revenue).label("revenue"),
        func.sum(CustomerMonthlySnapshot.orders).label("frequency")
    ).filter(
        CustomerMonthlySnapshot.year_month == month_str,
        CustomerMonthlySnapshot.ma_kh != None,
        CustomerMonthlySnapshot.ma_kh != ''
    )
    
    if scope_ids is not None:
        metrics_query = metrics_query.filter(CustomerMonthlySnapshot.point_id.in_(scope_ids))
        
    metrics = metrics_query.group_by(CustomerMonthlySnapshot.ma_kh).all()
    
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
            "score": round(final_score, 1),
            "rank": "Tiềm năng cao" if final_score > 90 else "Ổn định" if final_score > 60 else "Cần chăm sóc"
        })
        
    return sorted(results, key=lambda x: x['score'], reverse=True)[:limit]

@router.get("/churn-prediction")
# @cache_response(ttl_hours=24)
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
