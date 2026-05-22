import os
import re
import logging
import paramiko

logger = logging.getLogger(__name__)

SFTP_HOST = "10.1.45.10"
SFTP_PORT = 22
SFTP_USER = "cas_hue"
SFTP_PASS = os.environ.get("SFTP_PASSWORD", "")

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
LOCAL_DOWNLOAD_DIR = os.path.join(PROJECT_ROOT, "data", "raw_files")


def _get_sftp_password() -> str:
    pwd = SFTP_PASS
    if not pwd:
        raise Exception(
            "Lỗi: Chưa cấu hình mật khẩu SFTP. "
            "Vui lòng đặt biến môi trường SFTP_PASSWORD."
        )
    return pwd


def _open_sftp() -> tuple:
    """Mở kết nối SSH + SFTP, trả về (ssh_client, sftp_client)."""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        hostname=SFTP_HOST,
        port=SFTP_PORT,
        username=SFTP_USER,
        password=_get_sftp_password(),
        timeout=30,
        banner_timeout=30,
        auth_timeout=30,
    )
    sftp = ssh.open_sftp()
    return ssh, sftp


class SFTPManager:

    @staticmethod
    def list_folders() -> list:
        """Lấy danh sách các thư mục /YYYYMMDD trên SFTP server."""
        from datetime import datetime, timedelta
        curr_month = datetime.now().strftime("%Y%m")
        prev_month = (datetime.now() - timedelta(days=28)).strftime("%Y%m")

        ssh, sftp = _open_sftp()
        folders = []
        try:
            for prefix in [curr_month, prev_month]:
                try:
                    all_entries = sftp.listdir("/")
                    matched = [e for e in all_entries if re.match(r'^\d{8}$', e) and e.startswith(prefix)]
                    folders.extend(matched)
                except Exception as e:
                    logger.warning(f"Không liệt kê được folder prefix {prefix}: {e}")
        finally:
            sftp.close()
            ssh.close()

        return sorted(list(set(folders)), reverse=True)

    @staticmethod
    def get_folder_contents(folder_name: str) -> list:
        """Lấy danh sách file trong một folder."""
        ssh, sftp = _open_sftp()
        files = []
        try:
            remote_path = f"/{folder_name}"
            for attr in sftp.listdir_attr(remote_path):
                import stat
                if stat.S_ISREG(attr.st_mode):
                    files.append({
                        "name": attr.filename,
                        "size": attr.st_size,
                        "mtime": attr.st_mtime,
                    })
        except Exception as e:
            logger.error(f"Lỗi khi lấy nội dung folder {folder_name}: {e}")
        finally:
            sftp.close()
            ssh.close()
        return files

    @staticmethod
    def batch_get_all_contents(folder_names: list) -> dict:
        """Lấy nội dung của nhiều folder trong DUY NHẤT 1 session."""
        if not folder_names:
            return {}

        ssh, sftp = _open_sftp()
        results = {}
        try:
            import stat
            for folder in folder_names:
                remote_path = f"/{folder}"
                try:
                    files = []
                    for attr in sftp.listdir_attr(remote_path):
                        if stat.S_ISREG(attr.st_mode):
                            files.append({
                                "name": attr.filename,
                                "size": attr.st_size,
                                "mtime": attr.st_mtime,
                            })
                    results[folder] = files
                except Exception as e:
                    logger.warning(f"Không lấy được nội dung folder {folder}: {e}")
                    results[folder] = []
        finally:
            sftp.close()
            ssh.close()

        return results

    @staticmethod
    def get_target_bf_file(folder_name: str):
        """Tìm file Excel chính (nặng nhất) trong folder."""
        files = SFTPManager.get_folder_contents(folder_name)
        if not files:
            return None
        xlsx_files = [f for f in files if f['name'].lower().endswith('.xlsx')]
        if not xlsx_files:
            return None
        return max(xlsx_files, key=lambda x: x['size'])

    @staticmethod
    def download_file(folder_name: str, file_name: str) -> str:
        """Tải file từ SFTP về LOCAL_DOWNLOAD_DIR."""
        if not os.path.exists(LOCAL_DOWNLOAD_DIR):
            os.makedirs(LOCAL_DOWNLOAD_DIR)

        local_path = os.path.join(LOCAL_DOWNLOAD_DIR, file_name)
        if os.path.exists(local_path):
            os.remove(local_path)

        remote_path = f"/{folder_name}/{file_name}"
        logger.info(f"Đang tải: {remote_path} → {local_path}")

        ssh, sftp = _open_sftp()
        try:
            sftp.get(remote_path, local_path)
        finally:
            sftp.close()
            ssh.close()

        if not os.path.exists(local_path) or os.path.getsize(local_path) == 0:
            raise Exception(f"Lỗi: Không tải được file {file_name} (File rỗng hoặc không tồn tại sau download)")

        return local_path
