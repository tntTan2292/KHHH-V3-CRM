import sys
import os
import logging
from datetime import datetime, timedelta

# Add parent directory to path to import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models import SyncLog, SyncAttempt
from app.services.sftp_service import SFTPManager
from app.routers.import_data import do_import
from app.core.cache import CacheService
from app.core.maintenance import is_sync_locked

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(os.path.dirname(__file__), "sync_history.log"), encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("AUTOMATE_SYNC")

def run_sync():
    if is_sync_locked():
        logger.warning("🚫 AUTOMATE_SYNC BLOCKED: System is in Maintenance Mode (Phase 1).")
        print("🚫 System is in Maintenance Mode (Phase 1). Sync is locked.")
        return

    db = SessionLocal()
    expected_str = (datetime.now() - timedelta(days=1)).strftime("%Y%m%d")
    
    # Tinh toan lan thu trong ngay
    from sqlalchemy import func
    attempts_today = db.query(func.count(SyncAttempt.id)).filter(
        func.date(SyncAttempt.attempt_time) == datetime.now().date()
    ).scalar() or 0
    current_attempt_num = attempts_today + 1

    # Khoi tao Attempt log
    attempt = SyncAttempt(
        folder_name=expected_str,
        attempt_number=current_attempt_num,
        status='STARTED'
    )
    db.add(attempt)
    db.commit()

    try:
        logger.info(f"=== BAT DAU DONG BO TU DONG (WinSCP) - Lan thu {current_attempt_num} ===")
        
        # 1. Quet SFTP
        remote_folders = SFTPManager.list_folders()
        synced_folders = {r.folder_name for r in db.query(SyncLog).filter(SyncLog.status == 'COMPLETED').all()}
        
        # Chi dong bo nhung ngay chua co trong log và tu ngay 31/03/2026 tro di theo y sep
        folders_to_sync = [f for f in remote_folders if f not in synced_folders and f >= "20260331"]
        
        if not folders_to_sync:
            logger.info("Khong co du lieu moi. He thong da cap nhat nhat.")
            # Kiem tra xem folder du kien (T-1) da co tren server chua
            if expected_str not in remote_folders and expected_str not in synced_folders:
                attempt.status = 'MISSING_DATA'
                attempt.error_details = f"Folder {expected_str} (T-1) chua xuat hien tren SFTP server."
                logger.warning(attempt.error_details)
            else:
                attempt.status = 'SUCCESS'
            db.commit()
            return

        logger.info(f"Phat hien {len(folders_to_sync)} ngay moi: {folders_to_sync}")

        downloaded_files = []
        for f_name in folders_to_sync:
            logger.info(f"Dang xu ly ngay: {f_name}")
            target = SFTPManager.get_target_bf_file(f_name)
            if not target: 
                logger.warning(f"Khong thay file BatchFile trong folder {f_name}")
                continue
            
            # Tai file
            local_path = SFTPManager.download_file(f_name, target["name"])
            downloaded_files.append(local_path)
            
            # Luu log vao SyncLog (hoan thanh)
            log = db.query(SyncLog).filter(SyncLog.folder_name == f_name).first()
            if not log:
                log = SyncLog(folder_name=f_name)
                db.add(log)
            
            log.file_name = target["name"]
            log.file_size = target["size"]
            log.remote_mtime = target["mtime"]
            log.status = "COMPLETED"
            db.commit()

        # 2. Thuc hien Import vao Database
        if downloaded_files:
            logger.info(f"Dang nap {len(downloaded_files)} file vao Database...")
            # Chay nap bu (full_reset=False)
            do_import(db, full_reset=False, target_files=downloaded_files)
            logger.info("Hoan tat nap du lieu!")
            
            # 3. Clear Cache de Dashboard tinh toan lai so lieu moi
            logger.info("Dang lam moi Cache he thong...")
            CacheService.clear()
            logger.info("Cache da duoc lam moi!")
        
        # Cap nhat trang thai thanh cong cho Attempt nay
        attempt.status = 'SUCCESS'
        db.commit()
        
    except Exception as e:
        logger.error(f"LOI NGHIEM TRONG: {e}", exc_info=True)
        attempt.status = 'FAILED'
        attempt.error_details = str(e)
        db.commit()
    finally:
        db.close()
        logger.info("=== KET THUC ===")

if __name__ == "__main__":
    # Ensure tables exist (especially new SyncAttempt)
    from app.database import engine, Base
    from app.models import SyncAttempt # Ensure imported
    Base.metadata.create_all(bind=engine)
    
    # Force UTF-8 for Windows console
    if sys.platform == "win32":
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    run_sync()
