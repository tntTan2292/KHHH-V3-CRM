import sys
import os
from datetime import datetime

# Add parent directory to path to import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from automate_sync import run_sync

from datetime import datetime, timedelta
from app.database import SessionLocal
from app.models import SyncLog
from automate_sync import run_sync

def main():
    db = SessionLocal()
    now = datetime.now()
    yesterday_str = (now - timedelta(days=1)).strftime("%Y%m%d")
    
    print(f"[*] Startup Check - Thoi gian: {now.strftime('%d/%m/%Y %H:%M:%S')}")
    
    # Lay ngay dong bo thanh cong cuoi cung
    last_sync = db.query(SyncLog).filter(SyncLog.status == 'COMPLETED').order_by(SyncLog.folder_name.desc()).first()
    last_folder = last_sync.folder_name if last_sync else "00000000"
    
    # Neu ngay cuoi cung trong DB < ngay hom qua (T-1)
    if last_folder < yesterday_str:
        print(f"[!] Du lieu dang bi cham (Latest: {last_folder}, Target: {yesterday_str})")
        print("[!] Kich hoat dong bo tu dong ngay lap tuc...")
        try:
            run_sync()
        except Exception as e:
            print(f"[LOI] Khong thể thực hiện đồng bộ khi khởi động: {e}")
    else:
        print(f"[*] Du lieu da cap nhat (Latest: {last_folder}). Khong can dong bo bu.")
    
    db.close()

if __name__ == "__main__":
    main()
