import sys
import os
import pandas as pd
import logging
from sqlalchemy.orm import Session
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.database import SessionLocal, engine
from app.models import Transaction, HierarchyNode, SyncLog

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("REIMPORT")

def manual_reimport():
    db = SessionLocal()
    archive_dir = r"d:\Antigravity - Project\KHHH - Antigravity - V2\archive\data"
    
    # Pre-load Point Map
    point_map = {n.code: n.id for n in db.query(HierarchyNode).filter(HierarchyNode.type == 'POINT').all()}
    logger.info(f"Loaded {len(point_map)} points for mapping.")

    files = [
        "2025.11_BF_SL chấp nhận toàn BĐHUE.xlsb",
        "2025.12_BF_SL chấp nhận toàn BĐHUE.xlsb",
        "2026.01_BF_SL chấp nhận toàn BĐHUE.xlsb",
        "2026.02_BF_SL chấp nhận toàn BĐHUE.xlsb",
        "2026.03_BF_SL chấp nhận toàn BĐHUE.xlsb"
    ]
    
    total_added = 0
    
    try:
        for f in files:
            f_path = os.path.join(archive_dir, f)
            if not os.path.exists(f_path):
                logger.warning(f"File not found: {f}")
                continue
                
            logger.info(f"Reading {f}...")
            # Use pyxlsb directly for stability
            df = pd.read_excel(f_path, engine='pyxlsb', header=1)
            
            # Normalize columns
            df.columns = [str(c).strip().lower() for c in df.columns]
            
            # Map columns (manual mapping for reliability)
            col_map = {
                "số hiệu bưu gửi": "shbg",
                "shbg": "shbg",
                "username": "username",
                "mã khách hàng": "ma_kh",
                "ma_kh": "ma_kh",
                "tên người gửi": "ten_nguoi_gui",
                "địa chỉ người nhận": "dia_chi_goc",
                "ngày chấp nhận": "ngay_chap_nhan",
                "ngày_chấp_nhận": "ngay_chap_nhan",
                "khối lượng tính cước": "kl_tinh_cuoc",
                "cuối_cùng_thu_thực_thu": "doanh_thu", # Check if this is the name
                "mã dv chấp nhận": "ma_dv_chap_nhan",
                "madvchapnhan": "ma_dv_chap_nhan"
            }
            
            # Rename columns that exist
            current_cols = df.columns
            rename_map = {k: v for k, v in col_map.items() if k in current_cols}
            df = df.rename(columns=rename_map)
            
            # If still no shbg, try header 0
            if 'shbg' not in df.columns:
                logger.info(f"shbg not found in header 1 of {f}, trying header 0...")
                df = pd.read_excel(f_path, engine='pyxlsb', header=0)
                df.columns = [str(c).strip().lower() for c in df.columns]
                rename_map = {k: v for k, v in col_map.items() if k in df.columns}
                df = df.rename(columns=rename_map)

            if 'shbg' not in df.columns:
                logger.error(f"Could not find shbg column in {f}. Columns: {df.columns}")
                continue

            # Batch Insert
            batch = []
            for _, row in df.iterrows():
                shbg = str(row.get('shbg', ''))
                if not shbg or shbg == 'nan': continue
                
                ma_dv_chap_nhan = str(row.get('ma_dv_chap_nhan', '530000'))
                p_id = point_map.get(ma_dv_chap_nhan)
                
                # Cleanup date
                raw_date = row.get('ngay_chap_nhan')
                ngay_chap_nhan = None
                if raw_date:
                    try:
                        if isinstance(raw_date, (int, float)):
                            # Convert Excel serial date
                            from datetime import datetime, timedelta
                            ngay_chap_nhan = datetime(1899, 12, 30) + timedelta(days=raw_date)
                        else:
                            ngay_chap_nhan = pd.to_datetime(raw_date)
                    except:
                        pass

                batch.append({
                    "shbg": shbg,
                    "username": str(row.get("username", "")),
                    "ma_kh": str(row.get("ma_kh", "")).strip(),
                    "ten_nguoi_gui": str(row.get("ten_nguoi_gui", "")),
                    "dia_chi_nguoi_nhan": str(row.get("dia_chi_goc", "")),
                    "ngay_chap_nhan": ngay_chap_nhan,
                    "kl_tinh_cuoc": float(row.get("kl_tinh_cuoc", 0) or 0),
                    "doanh_thu": float(row.get("doanh_thu", row.get("cuoc_chinh_co_vat", 0)) or 0),
                    "ma_dv_chap_nhan": ma_dv_chap_nhan,
                    "point_id": p_id
                })
                
                if len(batch) >= 1000:
                    db.execute(sqlite_insert(Transaction).values(batch))
                    db.commit()
                    total_added += 1000
                    batch = []
                    
            if batch:
                db.execute(sqlite_insert(Transaction).values(batch))
                db.commit()
                total_added += len(batch)
                
            logger.info(f"Finished {f}. Total rows added so far: {total_added}")

        logger.info(f"FINAL TOTAL: {total_added} transactions re-imported.")
        
    except Exception as e:
        logger.error(f"Fatal error during re-import: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    manual_reimport()
