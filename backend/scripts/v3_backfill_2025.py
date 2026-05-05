import os
import sys
import pandas as pd
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

# Add current dir to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SQLALCHEMY_DATABASE_URL, Base, SessionLocal
from app.models import Transaction, Customer, SyncLog
from app.services.excel_reader import read_file2, read_file1
from app.services.rfm import compute_rfm

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

BACKFILL_DIR = r"d:\Antigravity - Project\DATA_MASTER\batch_files\2025_BACKFILL"

def backfill_2025():
    db = SessionLocal()
    try:
        # 1. Kiểm tra thư mục backfill
        if not os.path.exists(BACKFILL_DIR):
            logger.error(f"Khong tim thay thu muc: {BACKFILL_DIR}")
            return

        files = [f for f in os.listdir(BACKFILL_DIR) if f.endswith('.xlsx') or f.endswith('.xlsb')]
        if not files:
            logger.warning("Khong co file .xlsx nao trong thu muc 2025_BACKFILL")
            return

        logger.info(f"Bat dau nap {len(files)} file du lieu nam 2025...")
        
        num_files = len(files)
        total_inserted = 0
        
        for idx, filename in enumerate(sorted(files)):
            filepath = os.path.join(BACKFILL_DIR, filename)
            file_pct = (idx / num_files) * 100
            logger.info(f"--- [{file_pct:.1f}%] Dang xu ly file ({idx+1}/{num_files}): {filename} ---")
            
            # Su dung logic read_file2 cua he thong
            try:
                df = read_file2(filepath)
            except Exception as e:
                logger.error(f"Loi khi doc file {filename}: {e}")
                continue
                
            if df is None or df.empty:
                logger.warning(f"File {filename} trong hoac khong dung dinh dang.")
                continue

            df = df.where(pd.notnull(df), None)
            batch_data = []
            
            for _, row in df.iterrows():
                shbg = row.get("shbg")
                if not shbg: continue
                
                # Chuẩn hóa dữ liệu theo khuyến nghị của chuyên gia (DE/DBA)
                username_clean = str(row.get("username", "")).strip().lower()
                madv_clean = str(row.get("ma_dv_chap_nhan", "530000")).strip().upper()
                
                record = {
                    "shbg": str(shbg).strip().upper(),
                    "ma_dv": str(row.get("ma_dv", "")).strip().upper(),
                    "username": username_clean if username_clean != 'nan' else None,
                    "ma_kh": str(row.get("ma_kh", "")).strip().upper() if row.get("ma_kh") and str(row.get("ma_kh")).lower() != 'nan' else None,
                    "ngay_chap_nhan": row.get("ngay_chap_nhan"),
                    "doanh_thu": float(row.get("doanh_thu", 0) or 0),
                    "ma_dv_chap_nhan": madv_clean if madv_clean != 'nan' else "530000",
                    "dich_vu_chinh": str(row.get("dich_vu_chinh", "")).strip().upper(),
                }
                batch_data.append(record)
                
                if len(batch_data) >= 1000:
                    # Su dung insert binh thuong (theo doi soat khong unique shbg)
                    db.execute(sqlite_insert(Transaction).values(batch_data))
                    db.commit()
                    total_inserted += len(batch_data)
                    logger.info(f"  -> Da nap {total_inserted} giao dich...")
                    batch_data = []
            
            if batch_data:
                db.execute(sqlite_insert(Transaction).values(batch_data))
                db.commit()
                total_inserted += len(batch_data)
            
            logger.info(f"Hoan tat file {filename}")

        # 2. Cap nhat danh sach Khach hang moi (neu co) tu du lieu 2025
        logger.info("Cap nhat danh sach Khach hang moi tu du lieu 2025...")
        db.execute(text("""
            INSERT INTO customers (ma_crm_cms, ten_kh, loai_kh, nhom_kh, is_churn, tong_doanh_thu)
            SELECT t.ma_kh, 'KH Chua Dinh Danh (2025)', 'Ngoai danh muc KHHH', 'Khach hang moi', 0, 0
            FROM transactions t
            LEFT JOIN customers c ON t.ma_kh = c.ma_crm_cms
            WHERE c.ma_crm_cms IS NULL AND t.ma_kh IS NOT NULL AND t.ma_kh NOT IN ('', 'nan', 'NAN', 'None')
            GROUP BY t.ma_kh
        """))
        db.commit()

        # 3. Tai tinh toan Doanh thu & Churn
        logger.info("Tai tinh toan Doanh thu & RFM cho toan bo he thong...")
        db.execute(text("""
            UPDATE customers SET tong_doanh_thu = (
                SELECT SUM(doanh_thu) FROM transactions WHERE transactions.ma_kh = customers.ma_crm_cms
            )
        """))
        db.execute(text("""
            UPDATE customers SET is_churn = CASE WHEN tong_doanh_thu > 0 THEN 0 ELSE 1 END
        """))
        db.commit()

        # 4. Tinh lai RFM
        logger.info("Dang tinh toan RFM Segment...")
        all_customers = db.query(Customer).all()
        cust_list_for_rfm = [{"ma_crm_cms": c.ma_crm_cms, "tong_doanh_thu": c.tong_doanh_thu} for c in all_customers]
        rfm_results = compute_rfm(cust_list_for_rfm)
        rfm_map = {r["ma_crm_cms"]: r["rfm_segment"] for r in rfm_results}
        for c in all_customers:
            c.rfm_segment = rfm_map.get(c.ma_crm_cms, "Thuong")
        db.commit()

        # 5. Optimization
        logger.info("Toi uu hoa co so du lieu (INDEXES, VACUUM & ANALYZE)...")
        # Dam bao cac index quan trong ton tai
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_trans_madv_user ON transactions (ma_dv_chap_nhan, username)"))
        db.execute(text("VACUUM"))
        db.execute(text("ANALYZE"))
        db.commit()

        logger.info(f"=== KET THUC === Da nap thanh cong {total_inserted} giao dich lich su nam 2025.")

    except Exception as e:
        logger.error(f"Loi nghiem trong trong qua trinh backfill: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    backfill_2025()
