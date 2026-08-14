import sys
import os
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.append(os.path.join(PROJECT_ROOT, "backend"))

from app.database import SessionLocal
from app.services.excel_reader import read_file2
from app.models import Transaction, Customer
from app.services.summary_service import SummaryService
from app.services.lifecycle_engine import LifecycleEngine
from sqlalchemy import text

def reimport_20260810():
    file_path = os.path.join(PROJECT_ROOT, "data", "raw_files", "53_Thua Thien Hue_doisoat_20260810.xlsx")
    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        return

    logger.info(f"Reading file: {file_path}")
    df = read_file2(file_path)
    logger.info(f"Loaded {len(df)} rows from Excel.")

    db = SessionLocal()
    try:
        # 1. Clear old transactions for source_folder '20260810'
        deleted = db.execute(text("DELETE FROM transactions WHERE source_folder = '20260810'")).rowcount
        db.commit()
        logger.info(f"Cleared {deleted} previous rows for source_folder='20260810'.")

        # 2. Build transactions list
        new_transactions = []

        for idx, row in df.iterrows():
            shbg = str(row.get("shbg", "")).strip()
            if not shbg or shbg == "nan":
                continue

            ma_kh_val = str(row.get("ma_kh", "")).strip() if pd.notnull(row.get("ma_kh")) else None
            if ma_kh_val in ("", "nan", "None", "NaN"):
                ma_kh_val = None

            ten_gui_val = str(row.get("ten_nguoi_gui", "")).strip() if pd.notnull(row.get("ten_nguoi_gui")) else ""

            p_id = 5300
            ma_dv_chap = str(row.get("ma_dv_chap_nhan", "530000")).split('.')[0]

            rev = float(row.get("doanh_thu", 0) or 0)
            c_main = float(row.get("cuoc_chinh_co_vat", 0) or 0)
            c_xang = float(row.get("phu_phi_xang_dau_co_vat", 0) or 0)
            c_vung = float(row.get("phu_phi_vung_xa_co_vat", 0) or 0)
            c_khac = float(row.get("phu_phi_khac_co_vat", 0) or 0)
            c_vat = float(row.get("cuoc_gtgt", 0) or 0)
            kl = float(row.get("kl_tinh_cuoc", 0) or 0)

            date_raw = row.get("ngay_chap_nhan")
            if pd.notnull(date_raw):
                dt_obj = pd.to_datetime(date_raw).to_pydatetime()
            else:
                dt_obj = datetime(2026, 8, 10, 12, 0, 0)

            t = Transaction(
                shbg=shbg,
                ma_dv=str(row.get("ma_dv", "Khác")),
                username=str(row.get("username", "")),
                ma_kh=ma_kh_val,
                ten_nguoi_gui=ten_gui_val,
                ten_nguoi_gui_canonical=ten_gui_val.upper(),
                dia_chi_nguoi_gui="",
                dia_chi_nguoi_gui_canonical="",
                dia_chi_nguoi_nhan=str(row.get("dia_chi_goc", "")),
                tinh_thanh_moi="",
                lien_tinh_noi_tinh="",
                trong_nuoc_quoc_te="",
                ngay_chap_nhan=dt_obj,
                kl_tinh_cuoc=kl,
                cuoc_chinh_co_vat=c_main,
                phu_phi_xang_dau_co_vat=c_xang,
                phu_phi_vung_xa_co_vat=c_vung,
                phu_phi_khac_co_vat=c_khac,
                cuoc_thu_ho=0.0,
                cuoc_gtgt=c_vat,
                doanh_thu=rev,
                dich_vu_chinh=str(row.get("dich_vu_chinh", "")),
                loai_dich_vu="Chuyển phát",
                ma_dv_chap_nhan=ma_dv_chap,
                point_id=p_id,
                source_folder="20260810"
            )
            new_transactions.append(t)

        db.bulk_save_objects(new_transactions)
        db.commit()
        logger.info(f"Successfully inserted {len(new_transactions)} transactions into DB.")

        # 3. Refresh Customer Master Table for new customer IDs
        db.execute(text("""
            INSERT OR IGNORE INTO customers (ma_crm_cms, ten_kh, created_at, lifecycle_state)
            SELECT DISTINCT ma_kh, ten_nguoi_gui, datetime('now'), 'NEW'
            FROM transactions
            WHERE ma_kh IS NOT NULL AND ma_kh != ''
        """))
        db.commit()
        logger.info("Updated Customer Master Table.")

        # 4. Refresh Summary & Lifecycle Snapshots
        SummaryService.refresh_summary_incremental()
        logger.info("Refreshed Summary Table.")

        # 5. Verify stats
        valid_cnt = db.execute(text("SELECT COUNT(*) FROM transactions WHERE source_folder = '20260810' AND ma_kh IS NOT NULL")).scalar()
        total_rev = db.execute(text("SELECT SUM(doanh_thu) FROM transactions WHERE source_folder = '20260810'")).scalar()
        logger.info(f"VERIFICATION: source_folder='20260810' has {valid_cnt} transactions with valid ma_kh, Total Revenue: {total_rev:,.0f} VNĐ")

    except Exception as e:
        db.rollback()
        logger.error(f"Error during re-import: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    import pandas as pd
    reimport_20260810()
