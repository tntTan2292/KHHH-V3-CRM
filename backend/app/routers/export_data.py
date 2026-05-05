import io
import pandas as pd
from fastapi import APIRouter, Depends, Query, HTTPException
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
async def export_customers_excel(
    search: str = None,
    lifecycle_status: str = None,
    rfm_segment: str = None,
    start_date: str = None,
    end_date: str = None,
    sort_by: str = "revenue",
    order: str = "desc",
    node_code: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Sử dụng chung Service với UI để đảm bảo khớp dữ liệu (Elite RBAC 3.0)
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
        include_all=True # Lấy toàn bộ không phân trang
    )

    # Lấy thông tin Bưu cục để map tên
    point_ids = list(set(row.point_id for row in items if row.point_id))
    point_map = {}
    if point_ids:
        point_nodes = db.query(HierarchyNode.id, HierarchyNode.name).filter(HierarchyNode.id.in_(point_ids)).all()
        point_map = {p.id: p.name for p in point_nodes}

    data = []
    for idx, row in enumerate(items):
        c = row.Customer # Đối tượng Customer model
        
        # Mapping dữ liệu đầy đủ như trong Modal Chi tiết của WEB
        data.append({
            "STT": idx + 1,
            "Mã CRM/CMS": row.ma_crm_cms,
            "Tên Khách hàng": c.ten_kh if c else row.ma_crm_cms,
            "Loại Khách hàng": c.loai_kh if c else "N/A",
            "Trạng thái Vòng đời": row.status_type,
            "Phân khúc RFM": c.rfm_segment if c else "Thường",
            "Doanh thu (Kỳ báo cáo)": row.dynamic_revenue,
            "Sản lượng (Kỳ báo cáo)": row.transaction_count,
            "Tốc độ tăng trưởng (%)": round(row.growth_velocity or 0, 1),
            "Điểm Sức khỏe (0-100)": int(row.health_score or 0),
            "Bưu cục Quản lý": point_map.get(row.point_id, "N/A"),
            "Nhân sự phụ trách": row.assigned_staff_name or "Chưa giao",
            # Các trường Chi tiết bổ sung (Data Completeness)
            "Số điện thoại": c.dien_thoai if c else "",
            "Địa chỉ": c.dia_chi if c else "",
            "Người liên hệ": c.nguoi_lien_he if c else "",
            "Số hợp đồng": c.so_hop_dong if c else "",
            "Thời hạn hợp đồng": c.thoi_han_hop_dong if c else "",
            "Ngày kết thúc HĐ": c.thoi_han_ket_thuc if c else "",
            "Cước đặc thù": c.cuoc_dac_thu if c else "",
            "Đơn vị (Tên BC/VHX)": c.ten_bc_vhx if c else ""
        })
        
    df = pd.DataFrame(data)
    
    # Ghi vào bộ nhớ đệm
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name="KhachHangHienHuu")
        worksheet = writer.sheets["KhachHangHienHuu"]
        style_excel_sheet(worksheet, df, title=f"DANH SÁCH KHÁCH HÀNG HIỆN HỮU ({lifecycle_status or 'TẤT CẢ'})")
        
    buffer.seek(0)
    
    safe_lifecycle = remove_accents(lifecycle_status) if lifecycle_status else "All"
    safe_rfm = remove_accents(rfm_segment) if rfm_segment else "All"
    filename = f"BaoCao_KH_HienHuu_{safe_lifecycle}_{safe_rfm}.xlsx"
    headers = {
        'Content-Disposition': f'attachment; filename="{filename}"'
    }
    return StreamingResponse(buffer, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers)

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
