import re
import unicodedata

def normalize_name(name: str) -> str:
    """
    Chuẩn hóa tên/địa chỉ theo tiêu chuẩn Enterprise:
    1. Unicode NFKD (Tách ký tự tổ hợp)
    2. Loại bỏ dấu tiếng Việt
    3. Loại bỏ ký tự đặc biệt/dấu câu (- . ,)
    4. Gộp nhiều khoảng trắng thành 1
    5. Lowercase và Trim
    """
    if not name or str(name).lower() == 'nan':
        return ""
    
    # 1. Unicode NFKD & Remove Combining Characters (Dấu)
    nfkd_form = unicodedata.normalize('NFKD', str(name))
    name = u"".join([c for c in nfkd_form if not unicodedata.combining(c)])
    
    # 2. Lowercase
    name = name.lower()
    
    # 3. Loại bỏ dấu câu và ký tự đặc biệt (giữ lại chữ cái và số)
    # Thay thế - . , bằng khoảng trắng
    name = re.sub(r'[-.,]', ' ', name)
    
    # Loại bỏ các ký tự không phải chữ cái/số/khoảng trắng
    name = re.sub(r'[^a-z0-9\s]', '', name)
    
    # 4. Collapse multiple spaces & Trim
    name = re.sub(r'\s+', ' ', name).strip()
    
    # 5. Common Address Mappings (Optional but recommended)
    # Ví dụ: "p " -> "phuong ", "q " -> "quan "
    # Lưu ý: Cần cẩn thận để không thay thế nhầm từ bên trong
    name = re.sub(r'\bp\s', 'phuong ', name)
    name = re.sub(r'\bq\s', 'quan ', name)
    
    return name

def shorten_address(address: str) -> str:
    """Rút gọn địa chỉ để hiển thị trên UI (giữ lại Phường/Quận/Thành phố)"""
    if not address: return "N/A"
    parts = address.split(',')
    if len(parts) > 2:
        return ", ".join(parts[-2:]).strip()
    return address.strip()
