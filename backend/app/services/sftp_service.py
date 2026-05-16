import subprocess
import os
import re
import logging
import tempfile

logger = logging.getLogger(__name__)

# Cấu hình SFTP VNPOST (Kết nối ổn định nhất qua Session)
SFTP_SESSION = "cas_hue@10.1.45.10"
WINSCP_EXE = r"C:\Program Files (x86)\WinSCP\WinSCP.com"
# Trỏ vào kho dữ liệu nội bộ của V3.0
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
LOCAL_DOWNLOAD_DIR = os.path.join(PROJECT_ROOT, "data", "raw_files")

class SFTPManager:
    @staticmethod
    def run_command(commands):
        """Chạy lệnh WinSCP CLI qua File kịch bản (Gold Standard)"""
        # Tạo file kịch bản tạm thời
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as tf:
            # Thêm 'exit' vào cuối kịch bản
            full_script = commands + ["exit"]
            tf.write("\n".join(full_script))
            temp_script_path = tf.name

        try:
            # Gọi WinSCP với tham số /script
            full_args = [WINSCP_EXE, f"/script={temp_script_path}"]
            logger.info(f"🚀 [TRACE] WINSCP START: {commands[0] if len(commands) > 1 else commands}")
            
            # [HOTFIX] Thêm timeout cứng 30s để tránh treo Event Loop vô hạn
            try:
                result = subprocess.run(
                    full_args, 
                    capture_output=True, 
                    text=True, 
                    check=False, 
                    encoding='utf-8', 
                    errors='replace',
                    timeout=30  # Hard timeout 30s
                )
                logger.info(f"✅ [TRACE] WINSCP FINISHED (RC: {result.returncode})")
            except subprocess.TimeoutExpired:
                logger.error("❌ [TRACE] WINSCP TIMEOUT EXPIRED (30s)")
                raise Exception("Lỗi: Kết nối SFTP (WinSCP) bị quá tải hoặc treo (Timeout 30s). Vui lòng thử lại sau.")
            
            # Xóa file kịch bản ngay sau khi chạy
            if os.path.exists(temp_script_path):
                os.remove(temp_script_path)

            if result.returncode == 0:
                return result.stdout
            else:
                err_msg = result.stderr or result.stdout or "Lỗi thực thi WinSCP"
                logger.error(f"WinSCP Error: {err_msg}")
                raise Exception(err_msg)
                
            return result.stdout
        except Exception as e:
            if os.path.exists(temp_script_path):
                os.remove(temp_script_path)
            logger.error(f"Lỗi thực thi WinSCP Script: {e}")
            raise e

    @staticmethod
    def list_folders():
        """Lấy danh sách các thư mục /YYYYMMDD"""
        # Tối ưu: Chỉ liệt kê các folder của tháng hiện tại và tháng trước để đảm bảo không bị cắt bớt
        from datetime import datetime, timedelta
        curr_month = datetime.now().strftime("%Y%m")
        prev_month = (datetime.now() - timedelta(days=28)).strftime("%Y%m")
        output = SFTPManager.run_command([
            f"open {SFTP_SESSION} -hostkey=*", 
            f"ls /{curr_month}*",
            f"ls /{prev_month}*"
        ])
        # Tối ưu: Sử dụng Regex để tìm tất cả các chuỗi 8 chữ số (YYYYMMDD) trong output
        import re
        folders = re.findall(r'\b\d{8}\b', output)
        return sorted(list(set(folders)), reverse=True)

    @staticmethod
    def get_folder_contents(folder_name):
        """Lấy danh sách file trong folder"""
        output = SFTPManager.run_command([f"open {SFTP_SESSION} -hostkey=*", f"ls \"/{folder_name}\""])
        files = []
        lines = output.splitlines()
        for line in lines:
            parts = line.split()
            if len(parts) >= 9 and parts[0].startswith('-'):
                try:
                    size = int(parts[4])
                    mtime = " ".join(parts[5:9])
                    name = " ".join(parts[9:])
                    files.append({"name": name, "size": size, "mtime": mtime})
                except:
                    continue
        return files

    @staticmethod
    def batch_get_all_contents(folder_names):
        """[OPTIMIZED] Lấy nội dung của nhiều folder trong DUY NHẤT 1 session"""
        if not folder_names: return {}
        
        commands = [f"open {SFTP_SESSION} -hostkey=*"]
        for folder in folder_names:
            # Dùng cd và pwd để tạo Marker trong output giúp parsing chính xác
            commands.append(f"cd \"/{folder}\"")
            commands.append("pwd")
            commands.append("ls")
        
        output = SFTPManager.run_command(commands)
        
        # Phân tách kết quả theo từng folder
        results = {}
        current_folder = None
        current_files = []
        
        import re
        lines = output.splitlines()
        for line in lines:
            line = line.strip()
            # Nhận diện dòng marker folder (VD: /20260515)
            folder_match = re.match(r'^/(?P<folder>\d{8})$', line)
            if folder_match:
                # Lưu folder cũ trước khi sang folder mới
                if current_folder:
                    results[current_folder] = current_files
                
                current_folder = folder_match.group('folder')
                current_files = []
                continue
            
            # Parse file info (ls output)
            parts = line.split()
            if len(parts) >= 9 and parts[0].startswith('-'):
                try:
                    # WinSCP ls format: -rw-r--r--   1 998      999         719051 May 16  7:56:10 2026 53_Thua Thien Hue_20260515.xlsx
                    size = int(parts[4])
                    # Mtime có thể có độ dài khác nhau tùy config WinSCP
                    # Tạm lấy name là phần còn lại sau 9 tokens đầu
                    name = " ".join(parts[9:])
                    current_files.append({"name": name, "size": size, "mtime": " ".join(parts[5:9])})
                except:
                    continue
        
        # Lưu folder cuối cùng
        if current_folder:
            results[current_folder] = current_files
            
        return results

    @staticmethod
    def get_target_bf_file(folder_name):
        """Tìm file Excel chính (nặng nhất)"""
        files = SFTPManager.get_folder_contents(folder_name)
        if not files: return None
        xlsx_files = [f for f in files if f['name'].lower().endswith('.xlsx')]
        if not xlsx_files: return None
        return max(xlsx_files, key=lambda x: x['size'])

    @staticmethod
    def download_file(folder_name, file_name):
        """Tải file dùng File kịch bản để tránh lỗi dấu ngoặc/dấu cách"""
        if not os.path.exists(LOCAL_DOWNLOAD_DIR):
            os.makedirs(LOCAL_DOWNLOAD_DIR)
        
        local_path = os.path.join(LOCAL_DOWNLOAD_DIR, file_name)
        if os.path.exists(local_path):
            os.remove(local_path)
            
        # Trong file kịch bản của WinSCP, đường dẫn có dấu cách PHẢI được bao bởi ngoặc kép
        SFTPManager.run_command([
            f"open {SFTP_SESSION} -hostkey=*",
            f"get \"/{folder_name}/{file_name}\" \"{local_path}\"",
        ])
        
        if not os.path.exists(local_path) or os.path.getsize(local_path) == 0:
            raise Exception(f"Lỗi: Không tải được file {file_name} (File không tồn tại sau khi download)")
            
        return local_path
