from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func, desc, asc, text, literal, case
from datetime import datetime, timedelta
import dateutil.relativedelta
import io
import pandas as pd
from fastapi.responses import StreamingResponse

from ..database import get_db
from ..models import Customer, Transaction, HierarchyNode, User
from ..services.hierarchy_service import HierarchyService
from ..services.scoping_service import ScopingService
from .auth import get_current_user
from ..core.excel_utils import style_excel_sheet
import logging

logger = logging.getLogger(__name__)

def parse_date_flexible(date_str: str):
    """Hỗ trợ cả định dạng YYYY-MM-DD và DD/MM/YYYY"""
    if not date_str: return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    raise ValueError(f"Không thể định dạng ngày: {date_str}")

router = APIRouter(prefix="/api/reports", tags=["reports"])

@router.get("/movement")
async def get_movement_report(
    start_a: str,
    end_a: str,
    start_b: str,
    end_b: str,
    node_code: str = None,
    rfm_segment: str = None,
    nhom_kh: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        dt_start_a = parse_date_flexible(start_a)
        dt_end_a = parse_date_flexible(end_a).replace(hour=23, minute=59, second=59)
        dt_start_b = parse_date_flexible(start_b)
        dt_end_b = parse_date_flexible(end_b).replace(hour=23, minute=59, second=59)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 1. Hierarchy Filtering (Elite RBAC 3.0)
    scope_ids = ScopingService.get_effective_scope_ids(db, current_user, node_code)
    if scope_ids is not None and not scope_ids:
         return {"summary": {}, "items": [], "total": 0}

    # 2. Query Period A (Current)
    query_a = db.query(
        Transaction.ma_kh,
        func.sum(Transaction.doanh_thu).label("rev_a"),
        func.count(Transaction.id).label("count_a"),
        func.max(Transaction.ten_nguoi_gui).label("ten_kh"),
        func.max(Transaction.point_id).label("point_id")
    ).filter(
        Transaction.ngay_chap_nhan.between(dt_start_a, dt_end_a),
        Transaction.ma_kh != None,
        Transaction.ma_kh != ''
    )
    if scope_ids:
        query_a = query_a.filter(Transaction.point_id.in_(scope_ids))
    
    results_a = query_a.group_by(Transaction.ma_kh).all()
    data_a = {r.ma_kh: {"rev": r.rev_a or 0, "count": r.count_a or 0, "name": r.ten_kh, "point_id": r.point_id} for r in results_a}

    # 3. Query Period B (Baseline)
    query_b = db.query(
        Transaction.ma_kh,
        func.sum(Transaction.doanh_thu).label("rev_b"),
        func.count(Transaction.id).label("count_b")
    ).filter(
        Transaction.ngay_chap_nhan.between(dt_start_b, dt_end_b),
        Transaction.ma_kh != None,
        Transaction.ma_kh != ''
    )
    if scope_ids:
        query_b = query_b.filter(Transaction.point_id.in_(scope_ids))
    
    results_b = query_b.group_by(Transaction.ma_kh).all()
    data_b = {r.ma_kh: {"rev": r.rev_b or 0, "count": r.count_b or 0} for r in results_b}

    # 4. Merge and Identify Status
    all_ma_khs = set(data_a.keys()) | set(data_b.keys())
    
    # Pre-fetch Customer metadata for filtering
    customer_meta = {}
    if all_ma_khs:
        customers = db.query(Customer.ma_crm_cms, Customer.rfm_segment, Customer.nhom_kh).filter(Customer.ma_crm_cms.in_(list(all_ma_khs))).all()
        customer_meta = {c.ma_crm_cms: {"rfm": c.rfm_segment, "nhom": c.nhom_kh} for c in customers}

    # Fetch Point names and codes
    point_ids = list(set(r.point_id for r in results_a if r.point_id))
    point_map = {}
    if point_ids:
        points = db.query(HierarchyNode.id, HierarchyNode.name, HierarchyNode.code).filter(HierarchyNode.id.in_(point_ids)).all()
        point_map = {p.id: f"{p.code} - {p.name}" if p.code else p.name for p in points}

    merged_results = []
    summary = {
        "total_rev_a": 0, "total_rev_b": 0,
        "new_count": 0, "lost_count": 0, "growing_count": 0, "declining_count": 0
    }

    for ma_kh in all_ma_khs:
        a = data_a.get(ma_kh, {"rev": 0, "count": 0, "name": "N/A", "point_id": None})
        b = data_b.get(ma_kh, {"rev": 0, "count": 0})
        meta = customer_meta.get(ma_kh, {"rfm": "Thường", "nhom": "Khác"})

        # Apply Filters
        if rfm_segment and meta["rfm"] != rfm_segment: continue
        if nhom_kh and meta["nhom"] != nhom_kh: continue

        rev_a = a["rev"]
        rev_b = b["rev"]
        diff = rev_a - rev_b
        growth = (diff / rev_b * 100) if rev_b > 0 else (100 if rev_a > 0 else 0)

        # Determine Status
        status = "Stable"
        if rev_a > 0 and rev_b == 0:
            status = "New"
            summary["new_count"] += 1
        elif rev_a == 0 and rev_b > 0:
            status = "Lost"
            summary["lost_count"] += 1
        elif diff > 0:
            status = "Growing"
            summary["growing_count"] += 1
        elif diff < 0:
            status = "Declining"
            summary["declining_count"] += 1

        summary["total_rev_a"] += rev_a
        summary["total_rev_b"] += rev_b

        merged_results.append({
            "ma_kh": ma_kh,
            "ten_kh": a["name"] if a["name"] != "N/A" else "KH chưa định danh",
            "point_name": point_map.get(a["point_id"], "N/A"),
            "rfm_segment": meta["rfm"],
            "nhom_kh": meta["nhom"],
            "rev_a": rev_a,
            "rev_b": rev_b,
            "diff": diff,
            "growth": round(growth, 1),
            "status": status
        })

    # 5. Xử lý doanh thu Khách vãng lai (Chưa định danh) - Phân rã theo từng Bưu cục
    unidentified_query_a = db.query(
        Transaction.point_id,
        func.sum(Transaction.doanh_thu).label("rev_a")
    ).filter(
        Transaction.ngay_chap_nhan.between(dt_start_a, dt_end_a),
        or_(Transaction.ma_kh == None, Transaction.ma_kh == '')
    )
    if scope_ids:
        unidentified_query_a = unidentified_query_a.filter(Transaction.point_id.in_(scope_ids))
    
    unidentified_results_a = {r.point_id: r.rev_a or 0 for r in unidentified_query_a.group_by(Transaction.point_id).all()}

    unidentified_query_b = db.query(
        Transaction.point_id,
        func.sum(Transaction.doanh_thu).label("rev_b")
    ).filter(
        Transaction.ngay_chap_nhan.between(dt_start_b, dt_end_b),
        or_(Transaction.ma_kh == None, Transaction.ma_kh == '')
    )
    if scope_ids:
        unidentified_query_b = unidentified_query_b.filter(Transaction.point_id.in_(scope_ids))
    
    unidentified_results_b = {r.point_id: r.rev_b or 0 for r in unidentified_query_b.group_by(Transaction.point_id).all()}

    # Merge point IDs from both periods for unidentified revenue
    all_unidentified_points = set(unidentified_results_a.keys()) | set(unidentified_results_b.keys())
    
    # Ensure point_map has all these points too
    missing_point_ids = list(all_unidentified_points - set(point_map.keys()))
    if missing_point_ids:
        missing_points = db.query(HierarchyNode.id, HierarchyNode.name, HierarchyNode.code).filter(HierarchyNode.id.in_(missing_point_ids)).all()
        for p in missing_points:
            point_map[p.id] = f"{p.code} - {p.name}" if p.code else p.name

    for p_id in all_unidentified_points:
        rev_a = unidentified_results_a.get(p_id, 0)
        rev_b = unidentified_results_b.get(p_id, 0)
        if rev_a == 0 and rev_b == 0: continue
        
        diff = rev_a - rev_b
        growth = (diff / rev_b * 100) if rev_b > 0 else (100 if rev_a > 0 else 0)
        
        summary["total_rev_a"] += rev_a
        summary["total_rev_b"] += rev_b
        
        merged_results.append({
            "ma_kh": f"VANG_LAI_{p_id}",
            "ten_kh": "Khách lẻ / Chưa định danh",
            "point_name": point_map.get(p_id, "N/A"),
            "rfm_segment": "N/A",
            "nhom_kh": "N/A",
            "rev_a": rev_a,
            "rev_b": rev_b,
            "diff": diff,
            "growth": round(growth, 1),
            "status": "Stable"
        })

    # Sort by diff descending
    merged_results.sort(key=lambda x: x["diff"], reverse=True)

    return {
        "summary": summary,
        "items": merged_results,
        "total": len(merged_results)
    }

@router.get("/movement/aggregate")
async def get_movement_aggregate(
    start_a: str,
    end_a: str,
    start_b: str,
    end_b: str,
    node_code: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        dt_start_a = parse_date_flexible(start_a)
        dt_end_a = parse_date_flexible(end_a).replace(hour=23, minute=59, second=59)
        dt_start_b = parse_date_flexible(start_b)
        dt_end_b = parse_date_flexible(end_b).replace(hour=23, minute=59, second=59)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 1. Hierarchy Filtering (Elite RBAC 3.0)
    # Get nodes that the user is allowed to see rows for
    scope_ids = ScopingService.get_effective_scope_ids(db, current_user, node_code)
    if scope_ids is not None and not scope_ids:
        return []

    # Identify target nodes (the rows of our table) - children of the requested node within scope
    if not node_code:
        # Default to root children within user scope
        if not current_user.scope_node_id:
            target_nodes = db.query(HierarchyNode).filter(HierarchyNode.parent_id == None).all()
        else:
            target_nodes = [current_user.scope_node]
    else:
        parent = db.query(HierarchyNode).filter(HierarchyNode.code == node_code).first()
        if not parent: return []
        target_nodes = db.query(HierarchyNode).filter(HierarchyNode.parent_id == parent.id).all()
        
    if not target_nodes:
        # Fallback: if selected node has no children (is a leaf), show itself as the only row
        if node_code:
            target_nodes = [parent]
        else:
            return []

    report_items = []
    
    for node in target_nodes:
        # Get all leaf point IDs under this unit
        descendant_ids = HierarchyService.get_descendant_ids_by_id(db, node.id)
        
        # 1. Tính tổng doanh thu THỰC TẾ (Bao gồm cả khách vãng lai - Theo yêu cầu chuẩn số liệu Dashboard)
        rev_a = db.query(func.sum(Transaction.doanh_thu)).filter(
            Transaction.ngay_chap_nhan.between(dt_start_a, dt_end_a),
            Transaction.point_id.in_(descendant_ids)
        ).scalar() or 0

        rev_b = db.query(func.sum(Transaction.doanh_thu)).filter(
            Transaction.ngay_chap_nhan.between(dt_start_b, dt_end_b),
            Transaction.point_id.in_(descendant_ids)
        ).scalar() or 0

        # 2. Tính toán chỉ số khách hàng (Chỉ áp dụng cho khách có Mã định danh để phân loại được trạng thái)
        q1_identified = db.query(
            Transaction.ma_kh.label("ma_kh"),
            Transaction.doanh_thu.label("rev_a"),
            literal(0).label("rev_b")
        ).filter(
            Transaction.ngay_chap_nhan.between(dt_start_a, dt_end_a),
            Transaction.point_id.in_(descendant_ids),
            Transaction.ma_kh != None,
            Transaction.ma_kh != ''
        )
        
        q2_identified = db.query(
            Transaction.ma_kh.label("ma_kh"),
            literal(0).label("rev_a"),
            Transaction.doanh_thu.label("rev_b")
        ).filter(
            Transaction.ngay_chap_nhan.between(dt_start_b, dt_end_b),
            Transaction.point_id.in_(descendant_ids),
            Transaction.ma_kh != None,
            Transaction.ma_kh != ''
        )
        
        union_q = q1_identified.union_all(q2_identified).subquery()

        # Step 2: Sum revenues per customer
        customer_totals = db.query(
            union_q.c.ma_kh.label("ma_kh"),
            func.sum(union_q.c.rev_a).label("total_rev_a"),
            func.sum(union_q.c.rev_b).label("total_rev_b")
        ).group_by(union_q.c.ma_kh).subquery()

        # Step 3: Categorize customers based on their totals
        customer_stats = db.query(
            case((and_(customer_totals.c.total_rev_a > 0, customer_totals.c.total_rev_b == 0), 1), else_=0).label("is_new"),
            case((and_(customer_totals.c.total_rev_a == 0, customer_totals.c.total_rev_b > 0), 1), else_=0).label("is_lost"),
            case((and_(customer_totals.c.total_rev_a > customer_totals.c.total_rev_b, customer_totals.c.total_rev_b > 0), 1), else_=0).label("is_growing"),
            case((and_(customer_totals.c.total_rev_a < customer_totals.c.total_rev_b, customer_totals.c.total_rev_a > 0), 1), else_=0).label("is_declining")
        ).subquery()
        
        final_summary = db.query(
            func.sum(customer_stats.c.is_new),
            func.sum(customer_stats.c.is_lost),
            func.sum(customer_stats.c.is_growing),
            func.sum(customer_stats.c.is_declining)
        ).first()

        new_count = final_summary[0] or 0
        lost_count = final_summary[1] or 0
        growing_count = final_summary[2] or 0
        declining_count = final_summary[3] or 0

        diff = rev_a - rev_b
        growth = (diff / rev_b * 100) if rev_b > 0 else (100 if rev_a > 0 else 0)
        
        report_items.append({
            "node_code": node.code,
            "node_name": node.name,
            "node_type": node.type,
            "rev_a": rev_a,
            "rev_b": rev_b,
            "diff": diff,
            "growth": round(growth, 1),
            "new_count": int(new_count),
            "lost_count": int(lost_count),
            "growing_count": int(growing_count),
            "declining_count": int(declining_count)
        })

    # Sort by diff descending
    report_items.sort(key=lambda x: x["diff"], reverse=True)
    
    return report_items

@router.get("/movement/export")
async def export_movement_report(
    start_a: str, end_a: str,
    start_b: str, end_b: str,
    view_mode: str = 'detail',
    node_code: str = None,
    rfm_segment: str = None,
    nhom_kh: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    logger.info(f"EXPORT REQUEST: mode={view_mode}, node={node_code}, start_a={start_a}, end_a={end_a}")
    try:
        # Tên file cực giản lược để đảm bảo tương thích mọi trình duyệt/HĐH
        filename = "Bao_Cao_Bien_Dong.xlsx"

        if view_mode == 'aggregate':
            data = await get_movement_aggregate(
                start_a=start_a, end_a=end_a, 
                start_b=start_b, end_b=end_b, 
                node_code=node_code, 
                db=db, 
                current_user=current_user
            )
            df_data = []
            for item in data:
                df_data.append({
                    "Mã Đơn vị": item["node_code"],
                    "Tên Đơn vị": item["node_name"],
                    "Loại": item["node_type"],
                    "Doanh thu Kỳ A": item["rev_a"],
                    "Doanh thu Kỳ B": item["rev_b"],
                    "Biến động Tuyệt đối": item["diff"],
                    "Tăng trưởng (%)": item["growth"],
                    "Khách Mới": item["new_count"],
                    "Khách Mất": item["lost_count"],
                    "Đang Tăng": item["growing_count"],
                    "Đang Giảm": item["declining_count"]
                })
            sheet_name = "TongHop"
        else:
            res = await get_movement_report(
                start_a=start_a, end_a=end_a, 
                start_b=start_b, end_b=end_b, 
                node_code=node_code, 
                rfm_segment=rfm_segment, 
                nhom_kh=nhom_kh, 
                db=db, 
                current_user=current_user
            )
            data = res["items"]
            df_data = []
            for item in data:
                df_data.append({
                    "Mã KH": item["ma_kh"],
                    "Tên Khách hàng": item["ten_kh"],
                    "Bưu cục": item["point_name"],
                    "Hạng RFM": item["rfm_segment"],
                    "Nhóm KH": item["nhom_kh"],
                    "Doanh thu Kỳ A": item["rev_a"],
                    "Doanh thu Kỳ B": item["rev_b"],
                    "Biến động": item["diff"],
                    "Tăng trưởng (%)": item["growth"],
                    "Trạng thái": item["status"]
                })
            sheet_name = "ChiTiet"

        df = pd.DataFrame(df_data)
        
        # Safe numeric conversion
        if not df.empty:
            for col in df.columns:
                if any(k in col for k in ["Doanh thu", "Biến động", "diff", "rev_a", "rev_b", "Tăng trưởng"]):
                    df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name=sheet_name)
            # Tạm thời bỏ qua style_excel_sheet nếu nó gây lỗi crash
            try:
                worksheet = writer.sheets[sheet_name]
                style_excel_sheet(worksheet, df, title=f"BIEN DONG DOANH THU ({view_mode.upper()})")
            except:
                pass
        buffer.seek(0)
        
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length',
            'Cache-Control': 'no-cache'
        }
        logger.info(f"EXPORT SUCCESS: filename={filename}")
        return StreamingResponse(buffer, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers)
    
    except Exception as e:
        logger.error(f"CRITICAL EXPORT ERROR: {str(e)}", exc_info=True)
        # Trả về lỗi dạng JSON để Frontend có thể Alert được chi tiết
        return StreamingResponse(
            io.BytesIO(f'{{"error": "{str(e)}"}}'.encode("utf-8")),
            status_code=500,
            media_type="application/json"
        )
