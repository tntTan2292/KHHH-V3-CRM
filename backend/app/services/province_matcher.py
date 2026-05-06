import re
import unicodedata
import pandas as pd
import os

from ..utils.normalization import normalize_name as remove_accents

# Global mapping variable
PROVINCE_MAPPING = {}

def load_province_mapping():
    global PROVINCE_MAPPING
    if PROVINCE_MAPPING:
        return PROVINCE_MAPPING
        
    # Đường dẫn tới tệp chuẩn hóa 34 tỉnh thành tại Kho MASTER dùng chung
    db_path = r"d:\Antigravity - Project\DATA_MASTER\DB_34TTP.xlsx"
    
    if os.path.exists(db_path):
        try:
            df = pd.read_excel(db_path)
            # Schema: Mã tỉnh mới | Tên tỉnh/TP (mới) | Tên tỉnh/thành phố (củ)
            for _, row in df.iterrows():
                new_name = str(row.get('Tên tỉnh/TP (mới)', '')).strip()
                old_names_str = str(row.get('Tên tỉnh/thành phố (củ)', ''))
                
                # Cả tên mới cũng nên được thêm vào dictionary để phòng trường hợp đã là chuẩn
                if new_name:
                    PROVINCE_MAPPING[remove_accents(new_name)] = new_name
                    # Làm sạch tên mới (xóa Tỉnh, TP)
                    clean_new = re.sub(r'^(tỉnh|thành phố|tp\.|tp\s)\s*', '', new_name, flags=re.IGNORECASE).strip()
                    PROVINCE_MAPPING[remove_accents(clean_new)] = new_name
                
                if old_names_str and old_names_str.lower() != 'nan':
                    # Split old names by ; or +
                    old_names = old_names_str.replace('+', ';').split(';')
                    for old in old_names:
                        old_clean = old.strip()
                        if old_clean:
                            # Cả tên có dấu
                            clean_old_regex = re.sub(r'^(tỉnh|thành phố|tp\.|tp\s)\s*', '', old_clean, flags=re.IGNORECASE).strip()
                            PROVINCE_MAPPING[remove_accents(clean_old_regex)] = new_name
        except Exception as e:
            print("Error loading DB_34TTP.xlsx:", str(e))
    
    # Fallback/Additional mappings just in case
    PROVINCE_MAPPING[remove_accents("quang nam (cu)")] = "Đà Nẵng"
    PROVINCE_MAPPING[remove_accents("tphcm")] = "TP Hồ Chí Minh"
    PROVINCE_MAPPING[remove_accents("tp hcm")] = "TP Hồ Chí Minh"
    
    return PROVINCE_MAPPING

def extract_and_map_province(address: str) -> str:
    """
    Trích xuất tỉnh/thành từ địa chỉ và map với bảng 34 tỉnh thành mới.
    """
    mapping = load_province_mapping()
    
    if not address or str(address).strip() in ("nan", "NaN", "None", ""):
        return "[CẦN RÀ SOÁT]"
    
    address = str(address).strip()
    
    # Chiến lược 1: Lấy phần sau dấu phẩy cuối cùng
    parts = [p.strip() for p in address.split(",") if p.strip()]
    if parts:
        last_part = parts[-1]
        
        # Loại bỏ các prefix phổ biến: Tỉnh, Thành phố, TP., TP
        cleaned_last_part = re.sub(r'^(tỉnh|thành phố|tp\.|tp\s)\s*', '', last_part, flags=re.IGNORECASE).strip()
        
        # Tìm trong mapping
        normalized_part = remove_accents(cleaned_last_part)
        
        if normalized_part in mapping:
            return mapping[normalized_part]
            
        # Thử với phần tử kế cuối (trường hợp cuối cùng là tên nước "Việt Nam")
        if normalized_part == "viet nam" and len(parts) >= 2:
            second_last = parts[-2]
            cleaned_second = re.sub(r'^(tỉnh|thành phố|tp\.|tp\s)\s*', '', second_last, flags=re.IGNORECASE).strip()
            norm_second = remove_accents(cleaned_second)
            if norm_second in mapping:
                return mapping[norm_second]

    # Chiến lược 2: Regex tìm trực tiếp Keyword ở cuối chuỗi nếu không có dấu phẩy
    for key, mapped_val in mapping.items():
        # Kiểm tra nếu tên tỉnh xuất hiện sát cuối chuỗi
        if remove_accents(address).endswith(key):
            return mapped_val
            
    # Nếu không map được, trả về cần rà soát + giá trị gốc
    fallback = parts[-1] if parts else address
    return f"[CẦN RÀ SOÁT] {fallback}"
