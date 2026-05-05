import os
import zipfile
from datetime import datetime
import shutil

# Cấu hình đường dẫn (tương đối từ project root)
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DB_PATH = os.path.join(PROJECT_ROOT, "data", "database", "khhh_v3.db")
BACKUP_DIR = os.path.join(PROJECT_ROOT, "data", "backups")

def run_backup():
    if not os.path.exists(DB_PATH):
        print(f"--- [ERROR] Không tìm thấy DB tại: {DB_PATH}")
        return

    os.makedirs(BACKUP_DIR, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"backup_{timestamp}.zip"
    backup_path = os.path.join(BACKUP_DIR, backup_filename)

    print(f"--- [BACKUP] Đang sao lưu {DB_PATH}...")
    
    try:
        with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(DB_PATH, os.path.basename(DB_PATH))
        
        size_mb = os.path.getsize(backup_path) / (1024 * 1024)
        print(f"--- [SUCCESS] Đã tạo bản sao lưu: {backup_filename} ({size_mb:.2f} MB)")
        
        # Chính sách dọn dẹp (Giữ 7 bản gần nhất)
        all_backups = sorted([f for f in os.listdir(BACKUP_DIR) if f.startswith("backup_") and f.endswith(".zip")])
        if len(all_backups) > 7:
            for old_file in all_backups[:-7]:
                os.remove(os.path.join(BACKUP_DIR, old_file))
                print(f"--- [CLEANUP] Đã xóa bản cũ: {old_file}")
                
    except Exception as e:
        print(f"--- [ERROR] Lỗi sao lưu: {e}")

if __name__ == "__main__":
    run_backup()
