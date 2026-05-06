import os
import sys
import pandas as pd
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from datetime import datetime

# Add current dir to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SQLALCHEMY_DATABASE_URL, Base, SessionLocal
from app.models import Transaction, Customer, BackfillStatus, CustomerFirstOrder, CustomerLastActive, HierarchyNode
from app.utils.normalization import normalize_name
from app.services.excel_reader import read_file2

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

BACKFILL_DIR = r"d:\Antigravity - Project\DATA_MASTER\batch_files\2025_BACKFILL"

def update_customer_states(db, transactions_batch):
    """
    Cập nhật bảng trạng thái phụ (First Order & Last Active) dựa trên batch giao dịch vừa nạp.
    Đảm bảo tính nhất quán dữ liệu cho module Potential.
    """
    for tx in transactions_batch:
        if not tx.get('ten_nguoi_gui_canonical') or not tx.get('point_id'):
            continue
            
        c_name = tx['ten_nguoi_gui_canonical']
        c_addr = tx['dia_chi_nguoi_gui_canonical']
        p_id = tx['point_id']
        
        # Lấy tháng từ ngày chấp nhận
        dt = tx['ngay_chap_nhan']
        if isinstance(dt, str):
            try:
                dt = datetime.strptime(dt, "%Y-%m-%d %H:%M:%S")
            except:
                continue
        
        if not dt: continue
        month_str = dt.strftime("%Y-%m")
        
        # 1. Update First Order (Chỉ chèn nếu chưa có)
        stmt_first = sqlite_insert(CustomerFirstOrder).values(
            name=c_name, addr=c_addr, point_id=p_id, first_month=month_str
        ).on_conflict_do_nothing()
        db.execute(stmt_first)
        
        # 2. Update Last Active (Ghi đè nếu tháng mới hơn)
        # Vì đây là Backfill 2025, ta dùng logic đơn giản hoặc so sánh
        stmt_last = sqlite_insert(CustomerLastActive).values(
            name=c_name, addr=c_addr, point_id=p_id, last_active_month=month_str
        ).on_conflict_do_update(
            index_elements=['name', 'addr', 'point_id'],
            set_={'last_active_month': month_str}
        )
        db.execute(stmt_last)

def backfill_2025():
    db = SessionLocal()
    try:
        # 0. Khởi tạo cây Point Map để gán Point ID
        points = db.query(HierarchyNode).filter(HierarchyNode.type == 'POINT').all()
        point_map = {p.code: p.id for p in points}

        # 1. Kiểm tra thư mục backfill
        if not os.path.exists(BACKFILL_DIR):
            logger.error(f"Không tìm thấy thư mục: {BACKFILL_DIR}")
            return

        files = [f for f in os.listdir(BACKFILL_DIR) if f.endswith('.xlsx') or f.endswith('.xlsb')]
        if not files:
            logger.warning("Không có file dữ liệu nào trong thư mục 2025_BACKFILL")
            return

        logger.info(f"🚀 Bắt đầu nạp {len(files)} file dữ liệu năm 2025 (Resilient Mode)...")
        
        num_files = len(files)
        total_inserted = 0
        
        for idx, filename in enumerate(sorted(files)):
            # Checkpoint: Kiểm tra xem file đã nạp chưa
            status = db.query(BackfillStatus).filter(BackfillStatus.filename == filename).first()
            if status and status.status == 'COMPLETED':
                logger.info(f"⏩ Bỏ qua file đã hoàn thành: {filename}")
                continue

            filepath = os.path.join(BACKFILL_DIR, filename)
            logger.info(f"--- Processing ({idx+1}/{num_files}): {filename} ---")
            
            # Cập nhật trạng thái đang xử lý
            if not status:
                status = BackfillStatus(filename=filename, status='IN_PROGRESS')
                db.add(status)
            else:
                status.status = 'IN_PROGRESS'
            db.commit()

            try:
                df = read_file2(filepath)
            except Exception as e:
                logger.error(f"Lỗi khi đọc file {filename}: {e}")
                status.status = 'FAILED'
                db.commit()
                continue
                
            if df is None or df.empty:
                status.status = 'COMPLETED' # Coi như xong nếu file trống
                db.commit()
                continue

            df = df.where(pd.notnull(df), None)
            batch_data = []
            file_records = 0
            
            for _, row in df.iterrows():
                shbg = row.get("shbg")
                if not shbg: continue
                
                raw_name = str(row.get("ten_nguoi_gui", "") or "")
                raw_addr = str(row.get("dia_chi_nguoi_gui", "") or "")
                madv_clean = str(row.get("ma_dv_chap_nhan", "530000")).strip().upper()
                
                record = {
                    "shbg": str(shbg).strip().upper(),
                    "ma_dv": str(row.get("ma_dv", "")).strip().upper(),
                    "username": str(row.get("username", "")).strip().lower(),
                    "ma_kh": str(row.get("ma_kh", "")).strip().upper() if row.get("ma_kh") else None,
                    "ngay_chap_nhan": row.get("ngay_chap_nhan"),
                    "doanh_thu": float(row.get("doanh_thu", 0) or 0),
                    "ma_dv_chap_nhan": madv_clean,
                    "dich_vu_chinh": str(row.get("dich_vu_chinh", "")).strip().upper(),
                    "ten_nguoi_gui": raw_name,
                    "dia_chi_nguoi_gui": raw_addr,
                    # Canonicalization (Enterprise Hardening)
                    "ten_nguoi_gui_canonical": normalize_name(raw_name),
                    "dia_chi_nguoi_gui_canonical": normalize_name(raw_addr),
                    "point_id": point_map.get(madv_clean)
                }
                batch_data.append(record)
                
                if len(batch_data) >= 500:
                    db.execute(sqlite_insert(Transaction).values(batch_data))
                    update_customer_states(db, batch_data)
                    db.commit()
                    file_records += len(batch_data)
                    batch_data = []
            
            if batch_data:
                db.execute(sqlite_insert(Transaction).values(batch_data))
                update_customer_states(db, batch_data)
                db.commit()
                file_records += len(batch_data)
            
            # Cập nhật trạng thái hoàn thành file
            status.status = 'COMPLETED'
            status.total_records = file_records
            status.last_processed_at = datetime.now()
            db.commit()
            
            total_inserted += file_records
            logger.info(f"✅ Hoàn tất file {filename} ({file_records} records)")

        logger.info(f"🏁 KẾT THÚC === Đã nạp thành công tổng cộng {total_inserted} giao dịch.")

    except Exception as e:
        logger.error(f"Lỗi nghiêm trọng: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    backfill_2025()
