from sqlalchemy.orm import Session
from sqlalchemy import func
import re
from datetime import datetime
from ..database import get_db
from ..models import Transaction, User, HierarchyNode
from ..services.province_matcher import remove_accents
from ..services.scoping_service import ScopingService
from ..core.config_segments import (
    THRESHOLD_DIAMOND_REV, THRESHOLD_GOLD_REV, THRESHOLD_BRONZE_REV,
    THRESHOLD_DIAMOND_SHIP, THRESHOLD_GOLD_SHIP, THRESHOLD_BRONZE_SHIP
)
from ..core.segment_rules import classify_potential_rank

from ..utils.normalization import normalize_name, shorten_address

class PotentialService:
    @staticmethod
    def get_potential_data(
        db: Session,
        current_user: User,
        start_date: str = None,
        end_date: str = None,
        min_days: int = 1,
        sort_by: str = "tong_doanh_thu",
        order: str = "desc",
        page: int = 1,
        page_size: int = 50,
        node_code: str = None,
        rfm_segment: str = None,
        include_all: bool = False
    ):
        # 1. Date parsing helper
        def parse_db_date(db_val):
            if not db_val: return None
            if isinstance(db_val, datetime): return db_val
            db_val_str = str(db_val)
            try:
                return datetime.strptime(db_val_str[:19], "%Y-%m-%d %H:%M:%S")
            except:
                try:
                    return datetime.strptime(db_val_str[:10], "%Y-%m-%d")
                except:
                    return None

        # 2. Default date logic
        if not start_date or not end_date:
            latest_date_raw = db.query(func.max(Transaction.ngay_chap_nhan)).scalar()
            if latest_date_raw:
                latest_dt = parse_db_date(latest_date_raw)
                if latest_dt:
                    import calendar
                    year, month = latest_dt.year, latest_dt.month
                    last_day = calendar.monthrange(year, month)[1]
                    if not start_date: start_date = f"{year}-{month:02d}-01"
                    if not end_date: end_date = f"{year}-{month:02d}-{last_day:02d}"

        applied_dates = {"start": start_date, "end": end_date}

        # 3. Base Query
        scope_ids = ScopingService.get_effective_scope_ids(db, current_user, node_code)
        if scope_ids is not None and not scope_ids:
             return [], 0, {"Kim Cương": 0, "Vàng": 0, "Bạc": 0, "Thường": 0, "Tất cả": 0}, applied_dates

        query = db.query(
            Transaction.ten_nguoi_gui.label('raw_name'),
            Transaction.dia_chi_nguoi_gui.label('raw_address'),
            Transaction.ma_dv_chap_nhan.label('ma_bc'),
            func.count(Transaction.id).label('tong_so_don'),
            func.sum(Transaction.doanh_thu).label("tong_doanh_thu"),
            func.count(func.distinct(func.date(Transaction.ngay_chap_nhan))).label("so_ngay_gui"),
            func.max(Transaction.ngay_chap_nhan).label("ngay_gan_nhat")
        ).filter(
            (Transaction.ma_kh == '') | (Transaction.ma_kh == None)
        )
        
        if scope_ids is not None:
            query = query.filter(Transaction.point_id.in_(scope_ids))
        
        if start_date:
            query = query.filter(Transaction.ngay_chap_nhan >= start_date)
        if end_date:
            query = query.filter(Transaction.ngay_chap_nhan <= f"{end_date} 23:59:59")
            
        grouped_results = query.group_by(Transaction.ten_nguoi_gui, Transaction.dia_chi_nguoi_gui, Transaction.ma_dv_chap_nhan).all()
        
        # 4. Post-process
        points = db.query(HierarchyNode).filter(HierarchyNode.type == 'POINT').all()
        point_map = {p.code: p.name for p in points}

        canonical_groups = {}
        normalization_cache = {} # Tăng tốc xử lý chuỗi
        
        for r in grouped_results:
            raw_name = str(r.raw_name) if r.raw_name else "KHÔNG TÊN"
            raw_address = str(r.raw_address) if r.raw_address else ""
            bc_code = r.ma_bc or "N/A"
            
            # Caching normalization
            if raw_name in normalization_cache:
                canonical_name = normalization_cache[raw_name]
            else:
                canonical_name = normalize_name(raw_name)
                normalization_cache[raw_name] = canonical_name
                
            canonical_address = normalize_name(raw_address)
            
            # Group key: Name + Address + Office
            group_key = f"{canonical_name}_{canonical_address}_{bc_code}"
            
            if group_key not in canonical_groups:
                canonical_groups[group_key] = {
                    "display_name": raw_name,
                    "display_address": raw_address,
                    "ma_bc": bc_code,
                    "point_name": point_map.get(bc_code, "N/A"),
                    "tong_so_don": 0,
                    "tong_doanh_thu": 0.0,
                    "so_ngay_gui": 0,
                    "ngay_gan_nhat": None,
                    "names": {},
                    "addresses": {}
                }
            
            cg = canonical_groups[group_key]
            cg["tong_so_don"] += (r.tong_so_don or 0)
            cg["tong_doanh_thu"] += (r.tong_doanh_thu or 0.0)
            cg["so_ngay_gui"] += (r.so_ngay_gui or 0)
            
            # Lưu vết tên và địa chỉ phổ biến nhất
            cg["names"][raw_name] = cg["names"].get(raw_name, 0) + r.tong_so_don
            if cg["names"][raw_name] > cg["names"].get(cg["display_name"], 0):
                cg["display_name"] = raw_name
                
            cg["addresses"][raw_address] = cg["addresses"].get(raw_address, 0) + r.tong_so_don
            if cg["addresses"][raw_address] > cg["addresses"].get(cg["display_address"], 0):
                cg["display_address"] = raw_address
            
            if r.ngay_gan_nhat:
                dt_obj = parse_db_date(r.ngay_gan_nhat)
                if dt_obj:
                    if not cg["ngay_gan_nhat"] or dt_obj > cg["ngay_gan_nhat"]:
                        cg["ngay_gan_nhat"] = dt_obj

        # 5. Final Ranking and Filtering
        result_all = []
        summary_counts = {"Kim Cương": 0, "Vàng": 0, "Bạc": 0, "Thường": 0, "Tất cả": 0}
        
        for canonical, cg in canonical_groups.items():
            if cg["tong_so_don"] >= 1: # Theo Hiến pháp: Chỉ cần có đơn
                
                # Phân hạng RFM (Sếp muốn hiển thị điểm cho Tiềm năng)
                revenue = cg["tong_doanh_thu"]
                frequency = cg["tong_so_don"]
                
                segment = "Thường"
                if revenue >= 5000000 and frequency >= 5: segment = "Kim Cương"
                elif revenue >= 2000000 and frequency >= 3: segment = "Vàng"
                elif revenue >= 500000 or frequency >= 2: segment = "Bạc"
                
                summary_counts[segment] += 1
                summary_counts["Tất cả"] += 1
                
                if rfm_segment and rfm_segment != segment and rfm_segment != "Tất cả":
                    continue
                
                # Ẩn hạng THƯỜNG khỏi module (Trừ khi Dashboard gọi lấy tổng số)
                if not include_all and segment == "Thường":
                    continue

                # Rút gọn địa chỉ để hiển thị bảng (VD: "Phú Lộc, Huế")
                addr_parts = [p.strip() for p in cg["display_address"].split(',')]
                short_address = ", ".join(addr_parts[-2:]) if len(addr_parts) >= 2 else cg["display_address"]

                result_all.append({
                    "ten_kh": cg["display_name"],
                    "dia_chi_rut_gon": short_address,
                    "dia_chi_full": cg["display_address"],
                    "ma_bc": cg["ma_bc"],
                    "point_name": cg["point_name"],
                    "so_ngay_gui": cg["so_ngay_gui"],
                    "tong_so_don": cg["tong_so_don"],
                    "tong_doanh_thu": cg["tong_doanh_thu"],
                    "ngay_gan_nhat": cg["ngay_gan_nhat"].strftime("%Y-%m-%d %H:%M:%S") if cg["ngay_gan_nhat"] else "N/A",
                    "rfm_segment": segment
                })
                
        # Sort
        is_reverse = (order == "desc")
        # Robust sort key to avoid TypeError comparing None/Str with Num
        def sort_key_func(x):
            val = x.get(sort_by)
            if val is None:
                return 0 if isinstance(sort_by, (int, float)) else ""
            return val

        result_all.sort(key=sort_key_func, reverse=is_reverse)
        
        if include_all:
            return result_all, len(result_all), summary_counts, applied_dates
            
        # Pagination
        total = len(result_all)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        items = result_all[start_idx:end_idx]
        
        return items, total, summary_counts, applied_dates

    @staticmethod
    def get_potential_transactions(
        db: Session,
        current_user: User,
        ten_kh: str,
        dia_chi_full: str = None,
        ma_bc: str = None,
        start_date: str = None,
        end_date: str = None,
        node_code: str = None,
        page: int = 1,
        page_size: int = 10
    ):
        # 1. Định danh chính xác bằng cột Canonical (Đã Index)
        c_name = normalize_name(ten_kh)
        c_addr = normalize_name(dia_chi_full or "")
        
        # 2. Xây dựng Query chuẩn SQL (Giải quyết triệt để vấn đề Scale)
        scope_ids = ScopingService.get_effective_scope_ids(db, current_user, node_code)
        
        base_query = db.query(Transaction).filter(
            (Transaction.ma_kh == '') | (Transaction.ma_kh == None),
            Transaction.ten_nguoi_gui_canonical == c_name
        )
        
        if dia_chi_full:
            base_query = base_query.filter(Transaction.dia_chi_nguoi_gui_canonical == c_addr)
        if ma_bc:
            base_query = base_query.filter(Transaction.ma_dv_chap_nhan == ma_bc)
        if scope_ids is not None:
            base_query = base_query.filter(Transaction.point_id.in_(scope_ids))
        if start_date:
            base_query = base_query.filter(Transaction.ngay_chap_nhan >= f"{start_date} 00:00:00")
        if end_date:
            base_query = base_query.filter(Transaction.ngay_chap_nhan <= f"{end_date} 23:59:59")

        # 3. Lấy tổng số lượng (SQL Count)
        total_count = base_query.count()
        
        # 4. Lấy dữ liệu phân trang (SQL Limit/Offset - PRODUCTION STANDARD)
        txs = base_query.order_by(Transaction.ngay_chap_nhan.desc())\
                        .limit(page_size)\
                        .offset((page - 1) * page_size)\
                        .all()
        
        # 5. Lấy dữ liệu Tần suất tháng (SQL Group By - Tối ưu RAM)
        # Sử dụng func.strftime cho SQLite
        monthly_query = db.query(
            func.strftime('%m/%Y', Transaction.ngay_chap_nhan).label('month_disp'),
            func.strftime('%Y-%m', Transaction.ngay_chap_nhan).label('month_sort'),
            func.count(Transaction.id).label('total_orders'),
            func.sum(Transaction.doanh_thu).label('revenue')
        ).filter(
            (Transaction.ma_kh == '') | (Transaction.ma_kh == None),
            Transaction.ten_nguoi_gui_canonical == c_name
        )
        
        if dia_chi_full: monthly_query = monthly_query.filter(Transaction.dia_chi_nguoi_gui_canonical == c_addr)
        if ma_bc: monthly_query = monthly_query.filter(Transaction.ma_dv_chap_nhan == ma_bc)
        if scope_ids is not None: monthly_query = monthly_query.filter(Transaction.point_id.in_(scope_ids))
        if start_date: monthly_query = monthly_query.filter(Transaction.ngay_chap_nhan >= f"{start_date} 00:00:00")
        if end_date: monthly_query = monthly_query.filter(Transaction.ngay_chap_nhan <= f"{end_date} 23:59:59")
        
        monthly_results = monthly_query.group_by('month_sort').order_by('month_sort').all()
        
        # Mapping tên bưu cục
        points = db.query(HierarchyNode).filter(HierarchyNode.type == 'POINT').all()
        point_map = {p.code: p.name for p in points}
        
        processed_txs = []
        for tx in txs:
            processed_txs.append({
                "shbg": tx.shbg,
                "ngay_chap_nhan": tx.ngay_chap_nhan.strftime('%Y-%m-%d %H:%M:%S') if tx.ngay_chap_nhan else "N/A",
                "dich_vu_chinh": tx.dich_vu_chinh or "Khác",
                "doanh_thu": tx.doanh_thu or 0.0,
                "ma_dv_chap_nhan": tx.ma_dv_chap_nhan,
                "point_name": point_map.get(tx.ma_dv_chap_nhan, tx.ma_dv_chap_nhan)
            })
            
        return {
            "monthly": [{"month": r.month_disp, "total_orders": r.total_orders, "revenue": r.revenue} for r in monthly_results],
            "transactions": processed_txs,
            "total_count": total_count,
            "page": page,
            "page_size": page_size
        }

