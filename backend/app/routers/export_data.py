from typing import Optional
import io
import pandas as pd
from fastapi import APIRouter, Depends, Query, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Customer, User, HierarchyNode
from ..services.customer_service import CustomerService
from ..services.potential_service import PotentialService
from .auth import get_current_user
from ..core.excel_utils import style_excel_sheet
from ..services.province_matcher import remove_accents

router = APIRouter(prefix="/api/export", tags=["export"])

@router.get("/excel")
def export_customers_excel(
    search: Optional[str] = None,
    lifecycle_status: Optional[str] = None,
    rfm_segment: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    sort_by: str = "dynamic_revenue",
    order: str = "desc",
    node_code: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    import time
    import os
    try:
        import psutil
        process = psutil.Process(os.getpid())
    except ImportError:
        process = None

    start_time = time.time()
    def get_mem():
        return f"{process.memory_info().rss / 1024 / 1024:.1f} MB" if process else "N/A"

    print(f"[EXPORT_DEBUG] {time.strftime('%Y-%m-%d %H:%M:%S')} - START export_customers_excel - User: {current_user.username} - Initial Mem: {get_mem()}")
    
    try:
        # 1. Querying
        print(f"[EXPORT_DEBUG] {time.time()-start_time:.2f}s - Starting DB Query...")
        items, total = CustomerService.get_customers_data(
            db=db,
            current_user=current_user,
            search=search,
            lifecycle_status=lifecycle_status,
            rfm_segment=rfm_segment,
            start_date=start_date,
            end_date=end_date,
            sort_by=sort_by,
            order=order,
            node_code=node_code,
            include_all=True
        )
        print(f"[EXPORT_DEBUG] {time.time()-start_time:.2f}s - DB Query Done. Total rows: {len(items)} - Mem: {get_mem()}")

        # 2. Hierarchy Mapping
        print(f"[EXPORT_DEBUG] {time.time()-start_time:.2f}s - Starting Point Mapping...")
        point_codes = []
        for row in items:
            c_obj = getattr(row, 'Customer', None)
            if c_obj is None and len(row) > 0: c_obj = row[0]
            p_code = getattr(c_obj, 'ma_bc_phu_trach', None)
            if p_code: point_codes.append(p_code)
        
        point_codes = list(set(point_codes))
        point_map = {}
        if point_codes:
            point_nodes = db.query(HierarchyNode.code, HierarchyNode.name).filter(HierarchyNode.code.in_(point_codes)).all()
            point_map = {p.code: p.name for p in point_nodes}
        print(f"[EXPORT_DEBUG] {time.time()-start_time:.2f}s - Point Mapping Done. Mem: {get_mem()}")

        # 3. Data Formatting
        data = []
        for idx, row in enumerate(items):
            c = getattr(row, 'Customer', None)
            if c is None and len(row) > 0: c = row[0]
            if not c: continue
            status_raw = str(getattr(c, 'lifecycle_state', "ACTIVE") or "ACTIVE").lower()
            status_map = {"rebuy": "recovered", "reactivated": "recovered", "active": "active", "new": "new", "at_risk": "at_risk", "churned": "churned"}
            status_final = status_map.get(status_raw, status_raw)
            data.append({
                "STT": idx + 1,
                "Mã CRM/CMS": getattr(c, 'ma_crm_cms', "N/A"),
                "Tên Khách hàng": getattr(c, 'ten_kh', None) or getattr(c, 'ma_crm_cms', "N/A"),
                "Loại Khách hàng": getattr(c, 'loai_kh', "N/A") or "N/A",
                "Trạng thái Vòng đời": status_final,
                "Phân khúc RFM": getattr(c, 'rfm_segment', "Thường") or "Thường",
                "Doanh thu (Kỳ báo cáo)": float(getattr(row, 'dynamic_revenue', 0) or 0),
                "Sản lượng (Kỳ báo cáo)": int(getattr(row, 'transaction_count', 0) or 0),
                "Bưu cục Quản lý": point_map.get(getattr(c, 'ma_bc_phu_trach', None), "N/A"),
                "Nhân sự phụ trách": getattr(row, 'assigned_staff_name', "Chưa giao") or "Chưa giao"
            })
        df = pd.DataFrame(data) if data else pd.DataFrame([{"Thông báo": "Không có dữ liệu"}])
        
        # 4. XLSX Generation
        print(f"[EXPORT_DEBUG] {time.time()-start_time:.2f}s - Starting XLSX Generation...")
        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name="KhachHangHienHuu")
            worksheet = writer.sheets["KhachHangHienHuu"]
            style_excel_sheet(worksheet, df, title=f"DANH SÁCH KHÁCH HÀNG ({lifecycle_status or 'TẤT CẢ'})")
        buffer.seek(0)
        file_content = buffer.getvalue()
        file_size = len(file_content)
        print(f"[EXPORT_DEBUG] {time.time()-start_time:.2f}s - XLSX DONE. FILE_SIZE_BYTES: {file_size}")
        
        # 5. Response Return
        safe_lifecycle = remove_accents(str(lifecycle_status)) if lifecycle_status else "All"
        filename = f"BaoCao_KH_HienHuu_{safe_lifecycle}.xlsx"
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Content-Length': str(file_size),
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length'
        }
        
        print(f"[EXPORT_DEBUG] {time.time()-start_time:.2f}s - RESPONSE_HEADERS_START")
        for k, v in headers.items():
            print(f"[EXPORT_DEBUG] Header -> {k}: {v}")
        
        resp = Response(content=file_content, media_type=headers['Content-Type'], headers=headers)
        print(f"[EXPORT_DEBUG] {time.time()-start_time:.2f}s - RESPONSE_HEADERS_SENT")
        return resp

    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        print(f"[EXPORT_DEBUG] {time.time()-start_time:.2f}s - ERROR: {str(e)}")
        print(error_msg)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        print(f"[EXPORT_DEBUG] {time.time()-start_time:.2f}s - END export_customers_excel")

@router.get("/excel-minimal")
def export_customers_minimal(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Endpoint cực nhẹ để test đường truyền (Chỉ 10 dòng, không style)"""
    import time
    start_time = time.time()
    print(f"[EXPORT_DEBUG_MINIMAL] {time.strftime('%Y-%m-%d %H:%M:%S')} - START")
    
    try:
        # Lấy 10 dòng đầu tiên bất kỳ
        items, _ = CustomerService.get_customers_data(db=db, current_user=current_user, include_all=True)
        items = items[:10]
        
        data = [{"STT": i+1, "Mã CRM": getattr(getattr(row, 'Customer', row[0]), 'ma_crm_cms', "N/A")} for i, row in enumerate(items)]
        df = pd.DataFrame(data)
        
        buffer = io.BytesIO()
        df.to_excel(buffer, index=False) # Không dùng writer phứctał
        buffer.seek(0)
        file_content = buffer.getvalue()
        file_size = len(file_content)
        
        headers = {
            'Content-Disposition': 'attachment; filename="MINIMAL_TEST.xlsx"',
            'Content-Length': str(file_size),
            'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length'
        }
        print(f"[EXPORT_DEBUG_MINIMAL] {time.time()-start_time:.2f}s - XLSX DONE. SIZE: {file_size}")
        print(f"[EXPORT_DEBUG_MINIMAL] RESPONSE_HEADERS_START")
        resp = Response(content=file_content, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers)
        print(f"[EXPORT_DEBUG_MINIMAL] {time.time()-start_time:.2f}s - RESPONSE_HEADERS_SENT")
        return resp
    except Exception as e:
        print(f"[EXPORT_DEBUG_MINIMAL] ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/potential")
async def export_potential_excel(
    start_date: str = None,
    end_date: str = None,
    min_days: int = 3,
    rfm_segment: str = None,
    node_code: str = None,
    sort_by: str = "tong_doanh_thu",
    order: str = "desc",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        print(f"DEBUG: Starting export_potential_excel for {current_user.username}")
        # Sử dụng chung Service với UI
        items, total, summary, applied_dates = PotentialService.get_potential_data(
            db=db,
            current_user=current_user,
            start_date=start_date,
            end_date=end_date,
            min_days=min_days,
            sort_by=sort_by,
            order=order,
            page=1,
            page_size=100000, # Lấy hết
            rfm_segment=rfm_segment,
            node_code=node_code,
            include_all=True
        )

        data = []
        for idx, item in enumerate(items):
            data.append({
                "STT": idx + 1,
                "Tên Chủ hàng vãng lai": item["ten_kh"],
                "Bưu cục giao dịch chính": item["point_name"],
                "Mã BC": item["ma_bc"],
                "Tần suất gửi (Ngày)": item["so_ngay_gui"],
                "Tổng sản lượng (Đơn)": item["tong_so_don"],
                "Tổng doanh thu (VNĐ)": item["tong_doanh_thu"],
                "Ngày giao dịch gần nhất": item["ngay_gan_nhat"],
                "Phân hạng tiềm năng": item["rfm_segment"]
            })
            
        if not data:
            # Trả về file trống nếu không có dữ liệu để tránh lỗi frontend
            df = pd.DataFrame([{"Thông báo": "Không có dữ liệu phù hợp với bộ lọc"}])
        else:
            df = pd.DataFrame(data)

        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name="KhachHangTiemNang")
            worksheet = writer.sheets["KhachHangTiemNang"]
            safe_rfm = rfm_segment if rfm_segment else "TẤT CẢ"
            style_excel_sheet(worksheet, df, title=f"DANH SÁCH KHÁCH HÀNG TIỀM NĂNG ({safe_rfm})")
        
        buffer.seek(0)
        
        safe_rfm_fn = remove_accents(rfm_segment) if rfm_segment else "All"
        filename = f"BaoCao_KH_TiemNang_{safe_rfm_fn}.xlsx"
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Access-Control-Expose-Headers': 'Content-Disposition'
        }
        print(f"DEBUG: Export successful, sending {len(data)} rows")
        return StreamingResponse(buffer, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers)
    except Exception as e:
        print(f"ERROR in export_potential_excel: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống khi xuất Excel: {str(e)}")

@router.get("/potential/transactions")
async def export_potential_transactions_excel(
    ten_kh: str,
    dia_chi_full: str = None,
    ma_bc: str = None,
    start_date: str = None,
    end_date: str = None,
    node_code: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        data_res = PotentialService.get_potential_transactions(
            db=db,
            current_user=current_user,
            ten_kh=ten_kh,
            dia_chi_full=dia_chi_full,
            ma_bc=ma_bc,
            start_date=start_date,
            end_date=end_date,
            node_code=node_code
        )
        
        txs = data_res["transactions"]
        
        data = []
        for idx, item in enumerate(txs):
            data.append({
                "STT": idx + 1,
                "Mã bưu gửi": item["shbg"],
                "Ngày gửi": item["ngay_chap_nhan"],
                "Dịch vụ": item["dich_vu_chinh"],
                "Doanh thu (VNĐ)": item["doanh_thu"],
                "Bưu cục nhận": item["point_name"],
                "Mã BC": item["ma_dv_chap_nhan"]
            })
            
        if not data:
            df = pd.DataFrame([{"Thông báo": "Không có giao dịch nào"}])
        else:
            df = pd.DataFrame(data)

        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name="LichSuGiaoDich")
            worksheet = writer.sheets["LichSuGiaoDich"]
            safe_name = remove_accents(ten_kh) if ten_kh else "KH"
            style_excel_sheet(worksheet, df, title=f"LỊCH SỬ GIAO DỊCH - {ten_kh.upper()}")
        
        buffer.seek(0)
        
        filename = f"LichSu_TiemNang_{safe_name}.xlsx".replace(" ", "_")
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Access-Control-Expose-Headers': 'Content-Disposition'
        }
        return StreamingResponse(buffer, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi xuất Excel: {str(e)}")
