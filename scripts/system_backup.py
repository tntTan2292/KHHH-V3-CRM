import os
import shutil
import zipfile
import time
import sys
from datetime import datetime

# Cấu hình đường dẫn
PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_MASTER_DIR = r"d:\Antigravity - Project\DATA_MASTER"
BACKUP_BASE_DIR = r"d:\Antigravity - Project\BACKUPS"
RETENTION_DAYS = 7

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

def cleanup_old_backups(backup_dir):
    print(f"--- [CLEANUP] Dang quet cac ban sao luu cu hon {RETENTION_DAYS} ngay...")
    now = time.time()
    for f in os.listdir(backup_dir):
        f_path = os.path.join(backup_dir, f)
        if os.stat(f_path).st_mtime < now - (RETENTION_DAYS * 86400):
            try:
                if os.path.isfile(f_path) or os.path.islink(f_path):
                    os.remove(f_path)
                    print(f"    - Da xoa: {f}")
                elif os.path.isdir(f_path):
                    shutil.rmtree(f_path)
                    print(f"    - Da xoa thu muc: {f}")
            except Exception as e:
                print(f"    - [!] Canh bao: Khong the xoa file cu {f}: {e}")

def zip_directory(directory_path, zip_path, exclude_dirs=None):
    if exclude_dirs is None:
        exclude_dirs = []
    
    # Chuyen cac folder exclude sang lower case de so sanh de dang hon
    exclude_dirs = [d.lower() for d in exclude_dirs]
    
    file_count = 0
    total_size = 0
    
    # Bat che do ZIP64 de ho tro file lon (>4GB)
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, allowZip64=True) as zipf:
        for root, dirs, files in os.walk(directory_path):
            # Loai bo cac thu muc khong can thiet
            dirs[:] = [d for d in dirs if d.lower() not in exclude_dirs and not d.startswith('.')]
            
            for file in files:
                if file.endswith('.zip'): continue # Khong nén file zip da co
                
                file_path = os.path.join(root, file)
                try:
                    arcname = os.path.relpath(file_path, directory_path)
                    zipf.write(file_path, arcname)
                    file_count += 1
                    
                    # Hien thi tien do moi 500 file de nguoi dung bot lo lang
                    if file_count % 500 == 0:
                        print(f"    -> Da nen {file_count} tep tin...", end='\r')
                        sys.stdout.flush()
                except Exception as e:
                    # Neu file dang bi mo boi ung dung khac (locked), bo qua va thong bao
                    print(f"\n    [!] Bo qua file bi khoa: {file} ({e})")
                    continue
    print(f"\n    -> Hoan tat: Nen {file_count} tep tin.")

def perform_backup():
    ensure_dir(BACKUP_BASE_DIR)
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    
    print(f"===================================================")
    print(f"BAT DAU TIEN TRINH BACKUP HE THONG - {timestamp}")
    print(f"===================================================")

    # 1. Backup DATA_MASTER
    data_backup_name = f"DATA_MASTER_KH_{timestamp}.zip"
    data_backup_path = os.path.join(BACKUP_BASE_DIR, data_backup_name)
    print(f"[1/2] Dang sao luu Du lieu (DATA_MASTER)...")
    try:
        zip_directory(DATA_MASTER_DIR, data_backup_path)
        print(f"    - THANH CONG: {data_backup_name}")
    except Exception as e:
        print(f"    - LOI: Khong the sao luu du lieu. {str(e)}")

    # 2. Backup Source Code (Project)
    code_backup_name = f"PROJECT_CODE_V3.0_{timestamp}.zip"
    code_backup_path = os.path.join(BACKUP_BASE_DIR, code_backup_name)
    print(f"[2/2] Dang sao luu Ma nguon (Project)...")
    try:
        # Exclude common large or unnecessary folders
        zip_directory(PROJECT_DIR, code_backup_path, exclude_dirs=['node_modules', 'dist', '.git', '.gemini', 'backups', 'venv', '__pycache__'])
        print(f"    - THANH CONG: {code_backup_name}")
    except Exception as e:
        print(f"    - LOI: Khong the sao luu ma nguon. {str(e)}")

    # 3. Cleanup
    cleanup_old_backups(BACKUP_BASE_DIR)

    print(f"===================================================")
    print(f"HOAN TAT BACKUP. TEP TIN DUOC LUU TAI: {BACKUP_BASE_DIR}")
    print(f"===================================================")

if __name__ == "__main__":
    # Bat che do UTF-8 cho console tren Windows
    if sys.platform == "win32":
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    
    perform_backup()

