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

def normalize_name(name: str) -> str:
    if not name:
        return ""
    name = re.sub(r'\s+', ' ', name.strip())
    return remove_accents(name)

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
            Transaction.ten_nguoi_gui.label("raw_name"),
            Transaction.ma_dv_chap_nhan.label("ma_bc"),
            func.count(Transaction.id).label("tong_so_don"),
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
            
        grouped_results = query.group_by(Transaction.ten_nguoi_gui, Transaction.ma_dv_chap_nhan).all()
        
        # 4. Post-process
        points = db.query(HierarchyNode).filter(HierarchyNode.type == 'POINT').all()
        point_map = {p.code: p.name for p in points}

        canonical_groups = {}
        normalization_cache = {} # Tăng tốc xử lý chuỗi
        
        for r in grouped_results:
            raw_name = str(r.raw_name) if r.raw_name else "KHÔNG TÊN"
            
            # Caching normalization
            if raw_name in normalization_cache:
                canonical_name = normalization_cache[raw_name]
            else:
                canonical_name = normalize_name(raw_name)
                normalization_cache[raw_name] = canonical_name
            
            if canonical_name not in canonical_groups:
                canonical_groups[canonical_name] = {
                    "display_name": raw_name,
                    "offices": {},
                    "tong_so_don": 0,
                    "tong_doanh_thu": 0.0,
                    "so_ngay_gui": 0,
                    "ngay_gan_nhat": None,
                    "names": {}
                }
            
            cg = canonical_groups[canonical_name]
            cg["tong_so_don"] += (r.tong_so_don or 0)
            cg["tong_doanh_thu"] += (r.tong_doanh_thu or 0.0)
            cg["so_ngay_gui"] += (r.so_ngay_gui or 0)
            
            # Lưu vết tên để chọn tên phổ biến nhất làm hiển thị
            current_name_count = cg["names"].get(raw_name, 0) + r.tong_so_don
            cg["names"][raw_name] = current_name_count
            if current_name_count > cg["names"].get(cg["display_name"], 0):
                cg["display_name"] = raw_name
                
            bc_code = r.ma_bc or "N/A"
            cg["offices"][bc_code] = cg["offices"].get(bc_code, 0) + r.tong_so_don
            
            if r.ngay_gan_nhat:
                dt_obj = parse_db_date(r.ngay_gan_nhat)
                if dt_obj:
                    if not cg["ngay_gan_nhat"] or dt_obj > cg["ngay_gan_nhat"]:
                        cg["ngay_gan_nhat"] = dt_obj

        # 5. Final Ranking and Filtering
        result_all = []
        summary_counts = {"Kim Cương": 0, "Vàng": 0, "Bạc": 0, "Thường": 0, "Tất cả": 0}
        
        for canonical, data in canonical_groups.items():
            if data["tong_so_don"] >= 1: # Theo Hiến pháp: Chỉ cần có đơn
                rev = data["tong_doanh_thu"]
                cnt = data["tong_so_don"]
                rank = classify_potential_rank(rev, cnt)
                
                summary_counts[rank] += 1
                summary_counts["Tất cả"] += 1
                
                if rfm_segment and rfm_segment != rank and rfm_segment != "Tất cả":
                    continue
                
                # Ẩn hạng THƯỜNG khỏi module (Trừ khi Dashboard gọi lấy tổng số)
                if not include_all and rank == "Thường":
                    continue
                    
                main_bc_code = max(data["offices"], key=data["offices"].get) if data["offices"] else "N/A"
                main_bc_name = point_map.get(main_bc_code, main_bc_code)
                
                result_all.append({
                    "ten_kh": data["display_name"],
                    "ma_bc": main_bc_code,
                    "point_name": main_bc_name,
                    "so_ngay_gui": data["so_ngay_gui"],
                    "tong_so_don": data["tong_so_don"],
                    "tong_doanh_thu": data["tong_doanh_thu"],
                    "ngay_gan_nhat": data["ngay_gan_nhat"].strftime('%Y-%m-%d') if data["ngay_gan_nhat"] else None,
                    "rfm_segment": rank
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
