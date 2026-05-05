import sys
import os
import pandas as pd
import logging
from sqlalchemy.orm import Session

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.database import SessionLocal, engine
from app.routers.import_data import do_import
from app.models import Transaction, SyncLog

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("REIMPORT")

def reimport_all():
    db = SessionLocal()
    archive_dir = r"d:\Antigravity - Project\KHHH - Antigravity - V2\archive\data"
    backfill_dir = r"d:\Antigravity - Project\DATA_MASTER\batch_files\2025_BACKFILL"
    
    # 1. Danh sach file Backfill (01-10.2025)
    backfill_files = [
        f"2025.{str(i).zfill(2)}_BF_SL chấp nhận toàn BĐHUE.xlsb" for i in range(1, 11)
    ]
    
    # 2. Danh sach file Archive (11.2025 - 03.2026)
    archive_files = [
        "2025.11_BF_SL chấp nhận toàn BĐHUE.xlsb",
        "2025.12_BF_SL chấp nhận toàn BĐHUE.xlsb",
        "2026.01_BF_SL chấp nhận toàn BĐHUE.xlsb",
        "2026.02_BF_SL chấp nhận toàn BĐHUE.xlsb",
        "2026.03_BF_SL chấp nhận toàn BĐHUE.xlsb"
    ]
    
    full_paths = []
    # Add backfill
    for f in backfill_files:
        path = os.path.join(backfill_dir, f)
        if os.path.exists(path):
            full_paths.append(path)
        else:
            logger.warning(f"Khong tim thay file backfill: {f}")

    # Add archive
    for f in archive_files:
        path = os.path.join(archive_dir, f)
        if os.path.exists(path):
            full_paths.append(path)
        else:
            logger.warning(f"Khong tim thay file archive: {f}")
    
    if not full_paths:
        logger.error("Khong tim thay bat ky file nao de nap!")
        return

    logger.info(f"Bat dau nap lai {len(full_paths)} file lich su (Source of Truth)...")
    
    try:
        # Chay import logic (full_reset=True de lam sach bong DB truoc khi nap lai 16 thang)
        do_import(db, full_reset=True, target_files=full_paths)
        
        # Xoa Cache de Dashboard load lai du lieu moi
        try:
            from app.core.cache import CacheService
            CacheService.clear()
            logger.info("Da xoa Cache he thong.")
        except ImportError:
            logger.warning("Khong tim thay CacheService, bo qua buoc xoa cache.")
        
        logger.info("Nap du lieu hoan tat!")
        
        # Cap nhat SyncLog de khong bi nap trung sau nay
        all_imported_files = backfill_files + archive_files
        for f in all_imported_files:
            folder_name = f.split("_")[0].replace(".", "") # e.g. 202511
            log = db.query(SyncLog).filter(SyncLog.folder_name == folder_name).first()
            if not log:
                log = SyncLog(folder_name=folder_name, file_name=f, status="COMPLETED")
                db.add(log)
        db.commit()
        
    except Exception as e:
        logger.error(f"Loi khi nap du lieu: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    # Force UTF-8 for Windows console
    if sys.platform == "win32":
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    reimport_all()
