from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, case
from typing import List, Optional
import datetime

from ..database import get_db
from ..models import LeadPerformance, LeadSyncLog, HierarchyNode
from ..services.scoping_service import ScopingService
from ..services.hierarchy_service import HierarchyService
from ..services.lead_sync_engine import LeadSyncEngine

router = APIRouter(prefix="/api/leads", tags=["Lead Performance"])

@router.get("/funnel")
def get_lead_funnel(
    db: Session = Depends(get_db),
    scope_id: Optional[int] = Query(None, description="ID của node (Cụm/Bưu cục) để lọc"),
    date_from: Optional[datetime.date] = Query(None),
    date_to: Optional[datetime.date] = Query(None)
):
    """
    Trả về 4 Tầng Phễu Hành Trình Chuyển Đổi kèm theo Metric chuyển đổi (Conversion Rate).
    Không chứa Completion Rate (chỉ đo số lượng khách hàng).
    """
    # 1. Scoping (Phân quyền 5 cấp)
    base_query = db.query(LeadPerformance)
    if scope_id:
        effective_point_ids = HierarchyService.get_descendant_ids_by_id(db, scope_id, include_children=True)
        if effective_point_ids:
            base_query = base_query.filter(LeadPerformance.point_id.in_(effective_point_ids))
            
    if date_from:
        base_query = base_query.filter(LeadPerformance.created_at_source >= date_from)
    if date_to:
        base_query = base_query.filter(LeadPerformance.created_at_source <= date_to)
    
    # 2. Tính toán 4 tầng
    # Tầng 1: Lead Tiếp Nhận (Tất cả khách hàng từ Dashboard)
    stage_1 = base_query.count()
    
    # Tầng 2: Lead Đã Khai Thác (expected_revenue > 0)
    stage_2 = base_query.filter(LeadPerformance.expected_revenue > 0).count()
    
    # Tầng 3: Khách Hàng Đã Chuyển Đổi (Có mã CMS)
    stage_3 = base_query.filter(LeadPerformance.ma_cms.isnot(None)).count()
    
    # Tầng 4: Khách Hàng Ra Số (actual_revenue > 0)
    stage_4 = base_query.filter(LeadPerformance.actual_revenue > 0).count()
    
    # 3. Tính toán Conversion Metrics
    def calc_metrics(current: int, previous: int, total: int):
        return {
            "count": current,
            "percent_of_total": round((current / total * 100), 2) if total > 0 else 0,
            "conversion_from_previous": round((current / previous * 100), 2) if previous > 0 else 0
        }
    
    return {
        "funnel": [
            {
                "stage": 1,
                "name": "Lead Tiếp Nhận",
                **calc_metrics(stage_1, stage_1, stage_1)
            },
            {
                "stage": 2,
                "name": "Lead Đã Khai Thác",
                **calc_metrics(stage_2, stage_1, stage_1)
            },
            {
                "stage": 3,
                "name": "Khách Hàng Đã Chuyển Đổi",
                **calc_metrics(stage_3, stage_2, stage_1)
            },
            {
                "stage": 4,
                "name": "Khách Hàng Ra Số",
                **calc_metrics(stage_4, stage_3, stage_1)
            }
        ]
    }

@router.get("/ranking")
def get_lead_ranking(
    db: Session = Depends(get_db),
    scope_id: Optional[int] = Query(None, description="ID của node cha để xếp hạng các node con"),
    date_from: Optional[datetime.date] = Query(None),
    date_to: Optional[datetime.date] = Query(None)
):
    """
    Xếp hạng Bưu cục/Cụm. 
    Tiêu chí 1: actual_revenue giảm dần. 
    Tiêu chí 2: completion_rate giảm dần.
    """
    if not scope_id:
        top_node = db.query(HierarchyNode).filter(HierarchyNode.parent_id == None).first()
        if not top_node:
            return []
        scope_id = top_node.id
        
    children = db.query(HierarchyNode).filter(HierarchyNode.parent_id == scope_id).all()

    # Nếu không có node con (tức là node lá - Bưu cục), hiển thị chính nó
    nodes_to_rank = children if children else [db.query(HierarchyNode).filter(HierarchyNode.id == scope_id).first()]
    if not nodes_to_rank or not nodes_to_rank[0]:
        return []

    # [FIX] Phát hiện lead được gán trực tiếp vào scope_id (không qua node con nào)
    # Ví dụ: Kim Long (WARD id=10) có lead point_id=10 nhưng các POINT con (64,65,66,67) không có lead.
    # Nếu bỏ qua trường hợp này, ranking sẽ ra 0 trong khi funnel vẫn báo có dữ liệu.
    if children:
        orphan_query = db.query(func.count(LeadPerformance.id)).filter(
            LeadPerformance.point_id == scope_id
        )
        if date_from:
            orphan_query = orphan_query.filter(LeadPerformance.created_at_source >= date_from)
        if date_to:
            orphan_query = orphan_query.filter(LeadPerformance.created_at_source <= date_to)
        orphan_count = orphan_query.scalar() or 0

        if orphan_count > 0:
            # Thêm chính scope_id vào đầu danh sách để rank (dùng descendant của chính nó)
            scope_node_self = db.query(HierarchyNode).filter(HierarchyNode.id == scope_id).first()
            if scope_node_self:
                nodes_to_rank = [scope_node_self] + list(children)

    ranking = []
    seen_ids = set()
    for child in nodes_to_rank:
        if child.id in seen_ids:
            continue
        seen_ids.add(child.id)

        if child.id == scope_id and children:
            child_point_ids = [child.id]
            display_name = f"{child.name} (Trực tiếp)"
        else:
            child_point_ids = HierarchyService.get_descendant_ids_by_id(db, child.id, include_children=True)
            display_name = child.name

        query = db.query(
            func.count(LeadPerformance.id).label("total_leads"),
            func.sum(LeadPerformance.expected_revenue).label("total_expected"),
            func.sum(LeadPerformance.actual_revenue).label("total_actual")
        ).filter(LeadPerformance.point_id.in_(child_point_ids))

        if date_from:
            query = query.filter(LeadPerformance.created_at_source >= date_from)
        if date_to:
            query = query.filter(LeadPerformance.created_at_source <= date_to)

        stats = query.first()

        total_leads = stats.total_leads or 0
        total_expected = stats.total_expected or 0.0
        total_actual = stats.total_actual or 0.0

        completion_rate = 0.0
        if total_expected > 0:
            completion_rate = round((total_actual / total_expected) * 100, 2)

        ranking.append({
            "point_id": child.id,
            "point_name": display_name,
            "point_code": child.code,
            "total_leads": total_leads,
            "total_expected": total_expected,
            "total_actual": total_actual,
            "completion_rate": completion_rate
        })

    # Sort: Tiêu chí 1 (total_actual DESC), Tiêu chí 2 (completion_rate DESC)
    ranking.sort(key=lambda x: (x["total_actual"], x["completion_rate"]), reverse=True)

    return ranking

@router.get("/details")
def get_lead_details(
    db: Session = Depends(get_db),
    scope_id: Optional[int] = Query(None),
    date_from: Optional[datetime.date] = Query(None),
    date_to: Optional[datetime.date] = Query(None),
    limit: int = 50,
    offset: int = 0
):
    """
    Danh sách khách hàng chi tiết (Tab 3).
    """
    query = db.query(LeadPerformance)
    if scope_id:
        effective_point_ids = HierarchyService.get_descendant_ids_by_id(db, scope_id, include_children=True)
        if effective_point_ids:
            query = query.filter(LeadPerformance.point_id.in_(effective_point_ids))
            
    if date_from:
        query = query.filter(LeadPerformance.created_at_source >= date_from)
    if date_to:
        query = query.filter(LeadPerformance.created_at_source <= date_to)
            
    total = query.count()
    
    # Tính KPI tổng hợp
    kpi_stats = db.query(
        func.sum(LeadPerformance.expected_revenue).label("total_expected"),
        func.sum(LeadPerformance.actual_revenue).label("total_actual"),
        func.sum(case((LeadPerformance.expected_revenue > 0, 1), else_=0)).label("total_ops"),
        func.sum(case((LeadPerformance.ma_cms.isnot(None), 1), else_=0)).label("total_cms"),
        func.sum(case((LeadPerformance.actual_revenue > 0, 1), else_=0)).label("total_rev")
    )
    if scope_id and effective_point_ids:
        kpi_stats = kpi_stats.filter(LeadPerformance.point_id.in_(effective_point_ids))
    if date_from:
        kpi_stats = kpi_stats.filter(LeadPerformance.created_at_source >= date_from)
    if date_to:
        kpi_stats = kpi_stats.filter(LeadPerformance.created_at_source <= date_to)
        
    kpi_result = kpi_stats.first()
    total_expected = kpi_result.total_expected or 0.0
    total_actual = kpi_result.total_actual or 0.0
    total_ops = kpi_result.total_ops or 0
    total_cms = kpi_result.total_cms or 0
    total_rev = kpi_result.total_rev or 0
    
    # Sort mặc định theo trạng thái nóng (actual_revenue > 0)
    items = query.order_by(desc(LeadPerformance.actual_revenue)).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "total_expected": total_expected,
        "total_actual": total_actual,
        "total_ops": total_ops,
        "total_cms": total_cms,
        "total_rev": total_rev,
        "items": [
            {
                "id": i.id,
                "ma_cms": i.ma_cms,
                "ten_kh": i.ten_kh,
                "expected_revenue": i.expected_revenue,
                "actual_revenue": i.actual_revenue,
                "completion_rate": i.completion_rate,
                "point_id": i.point_id,
                "owner_hrm": i.owner_hrm,
            } for i in items
        ]
    }

@router.post("/sync")
def trigger_sync(db: Session = Depends(get_db)):
    """
    Trigger chạy đồng bộ dữ liệu thủ công từ CRM_Dashboard sang CRM 3.0.
    """
    engine = LeadSyncEngine(db)
    try:
        result = engine.run_sync()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
