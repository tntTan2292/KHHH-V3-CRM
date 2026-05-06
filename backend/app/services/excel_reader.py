import os
import glob
import logging
import pandas as pd
from datetime import datetime

from .province_matcher import extract_and_map_province

logger = logging.getLogger(__name__)

# Thư mục gốc chứa file (KHHH directory)
# Thư mục dữ liệu MASTER tập trung dùng chung
BASE_DIR = r"d:\Antigravity - Project\DATA_MASTER"

FILE1_COL_MAP = {
    0: "stt",
    4: "ma_crm_cms",
    3: "loai_kh",
    50: "nhom_kh",
    5: "ten_kh",
    62: "ten_bc_vhx",
    63: "bdp_x",
    64: "cuoc_dac_thu",
    65: "nguoi_rs_bg_ttkd",
    66: "nguoi_rs_bg_ttvh",
    67: "don_vi_gan_hd_cms",
    68: "da_gui_hd_vly",
    60: "tinh_hinh_ra_soat", 
    # 14: tinh_hinh_ban_giao_cms - empty
    69: "don_vi",
}

def find_file(pattern: str) -> str:
    """ Tìm file trong thư mục gốc. """
    EXCEL_EXTS = {".xlsx", ".xlsb", ".xls"}
    try:
        all_entries = os.listdir(BASE_DIR)
        # Bổ sung quét cả thư mục archive nếu có
        archive_path = os.path.join(r"d:\Antigravity - Project\KHHH - Antigravity - V3.0", "archive", "data")
        if os.path.exists(archive_path):
            archive_entries = [os.path.join(archive_path, f) for f in os.listdir(archive_path)]
            all_excels = [os.path.join(BASE_DIR, f) for f in all_entries] + archive_entries
        else:
            all_excels = [os.path.join(BASE_DIR, f) for f in all_entries]
        
        all_excels = [f for f in all_excels if os.path.splitext(f)[1].lower() in EXCEL_EXTS]
    except Exception as e:
        raise FileNotFoundError(f"Lỗi khi quét tệp Excel trong {BASE_DIR} hoặc archive: {e}")
    pattern_lower = pattern.lower()
    words = [w for w in pattern_lower.split() if len(w) >= 3]
    for f in all_excels:
        base = os.path.basename(f).lower()
        if any(w in base for w in words):
            return f

    is_file1 = any(k in pattern_lower for k in ["khhh", "bàn giao", "soát"])
    is_file2 = any(k in pattern_lower for k in ["bf", "chấp nhận", "bf_sl"])

    for f in all_excels:
        base_upper = os.path.basename(f).upper()
        if is_file1 and "KHHH" in base_upper:
            return f
        if is_file2 and ("BF_SL" in base_upper or "BF" in base_upper):
            return f

    raise FileNotFoundError(f"Không tìm thấy file phù hợp '{pattern}'. Các file: {[os.path.basename(f) for f in all_excels]}")


def safe_float(val) -> float:
    try:
        if val is None or str(val).strip() in ("", "nan", "NaN"): return 0.0
        return float(str(val).replace(",", "").replace(" ", ""))
    except:
        return 0.0

def safe_str(val) -> str:
    if val is None or str(val).strip() in ("nan", "NaN"): return ""
    return str(val).strip()


def read_file1() -> pd.DataFrame:
    """ Đọc File 1 - KHHH """
    filepath = find_file("RÀ SOÁT BÀN GIAO KHHH")
    logger.info(f"Đọc File 1: {filepath}")

    # File có header phức tạp, đọc skiprows=2 để lấy data thô
    df = pd.read_excel(filepath, header=None, skiprows=2, engine="openpyxl")
    cols_available = len(df.columns)
    df_out = pd.DataFrame()

    for idx, field_name in FILE1_COL_MAP.items():
        if idx < cols_available:
            df_out[field_name] = df.iloc[:, idx].apply(safe_str)
        else:
            df_out[field_name] = ""
            
    df_out["tinh_hinh_ban_giao_cms"] = ""

    # Drop None/Duplicate
    df_out = df_out[df_out["ma_crm_cms"].str.len() > 0].copy()
    
    before = len(df_out)
    df_out = df_out.drop_duplicates(subset=["ma_crm_cms"], keep="last")
    logger.info(f"File 1: Bỏ qua {before - len(df_out)} mã CRM trùng lặp.")

    df_out["stt"] = pd.to_numeric(df_out["stt"], errors="coerce").fillna(0).astype(int)
    return df_out


def find_all_bf_files() -> list:
    """ Tìm tất cả các file BF trong nhiều thư mục khác nhau. """
    # Các đuôi file Excel hỗ trợ
    EXCEL_EXTS = [".xlsx", ".xls", ".xlsb"]
    
    # Danh sách các thư mục cần quét
    search_dirs = [
        BASE_DIR,
        os.path.join(BASE_DIR, "batch_files"),
        os.path.join(BASE_DIR, "batch_files", "2025_BACKFILL"),
        os.path.join(r"D:\Antigravity - Project\KHHH - Antigravity - V3.0\data\raw_files"),
        os.path.join(r"D:\Antigravity - Project\KHHH - Antigravity - V3.0\backend\data\batch_files"),
        os.path.join(r"D:\Antigravity - Project\KHHH - Antigravity - V3.0\archive\data")
    ]
    
    # Các mẫu tên file hợp lệ (Dùng chuỗi ngắn để tránh lỗi Unicode)
    STRICT_PATTERN = "BF_SL"
    NEW_PATTERN = "53_THUA THIEN HUE"
    
    files = []
    for d in search_dirs:
        if not os.path.exists(d): continue
        try:
            for f in os.listdir(d):
                if os.path.splitext(f)[1].lower() in EXCEL_EXTS:
                    if f.startswith("~$"): continue # Bỏ qua file tạm của Excel
                    f_upper = f.upper()
                    if STRICT_PATTERN in f_upper or NEW_PATTERN in f_upper:
                        files.append(os.path.join(d, f))
        except Exception as e:
            logger.error(f"Lỗi khi quét thư mục {d}: {e}")
    
    # Sắp xếp theo số (năm.tháng hoặc ngày tháng) ở đầu tên file
    import re
    def get_sort_key(filepath):
        filename = os.path.basename(filepath)
        # Tìm YYYY.MM hoặc YYYYMMDD
        match = re.search(r"(\d{4})[._](\d{2})", filename)
        if match:
            return (int(match.group(1)), int(match.group(2)))
        match_date = re.search(r"(\d{8})", filename)
        if match_date:
            return (int(match_date.group(1)[:4]), int(match_date.group(1)[4:6]), int(match_date.group(1)[6:]))
        return (0, 0)
    
    files.sort(key=get_sort_key)
    # Loại bỏ file trùng lặp nếu cùng tên (ví dụ ở cả master và raw)
    unique_files = {}
    for f in files:
        unique_files[os.path.basename(f)] = f
        
    final_files = list(unique_files.values())
    logger.info(f"Tìm thấy {len(final_files)} file BF: {[os.path.basename(f) for f in final_files]}")
    return final_files

def read_file2(filepath: str = None) -> pd.DataFrame:
    """ Đọc File giao dịch (BF). Tự động tìm kiếm Header nếu cần. """
    if not filepath:
        filepath = find_file("BF_SL chấp nhận")
        
    logger.info(f"Đọc File giao dịch: {filepath}")

    engine = "pyxlsb" if filepath.endswith(".xlsb") else "openpyxl"
    
    # Thử đọc header ở dòng 1 (mặc định cho BF_SL)
    df = pd.read_excel(filepath, engine=engine, header=1)
    
    # Kiểm tra xem có cột shbg không, nếu không thử ở dòng 0
    cols_check = [str(c).lower() for c in df.columns]
    if 'shbg' not in cols_check and 'số hiệu bưu gửi' not in cols_check:
        logger.info("Header dòng 1 không khớp, thử dòng 0...")
        df = pd.read_excel(filepath, engine=engine, header=0)

    # Chuẩn hóa tên cột
    df.columns = [str(c).strip().lower() for c in df.columns]

    # Mapping linh hoạt
    mapping = {
        "dv": "ma_dv",
        "mã dv": "ma_dv",
        "shbg": "shbg",
        "số hiệu bưu gửi": "shbg",
        "username": "username",
        "makh": "ma_kh",
        "mã khách hàng": "ma_kh",
        "ma_kh": "ma_kh",
        "tennguoigui": "ten_nguoi_gui",
        "tên người gửi": "ten_nguoi_gui",
        "diachinguoinhan": "dia_chi_goc",
        "địa chỉ người nhận": "dia_chi_goc",
        "lientinhnoitinh": "lien_tinh_noi_tinh",
        "liên tỉnh nội tỉnh": "lien_tinh_noi_tinh",
        "trongnuocquocte": "trong_nuoc_quoc_te",
        "trong nước quốc tế": "trong_nuoc_quoc_te",
        "ngaychapnhan": "ngay_chap_nhan",
        "ngày chấp nhận": "ngay_chap_nhan",
        "ngay_chap_nhan": "ngay_chap_nhan",
        "kltinhcuoc": "kl_tinh_cuoc",
        "khối lượng tính cước": "kl_tinh_cuoc",
        "cuocchinhcovatthucthu": "cuoc_chinh_co_vat",
        "phuphixangdaucovatthucthu": "phu_phi_xang_dau_co_vat",
        "phuphivungxacovatthucthu": "phu_phi_vung_xa_co_vat",
        "phuphikhaccovatthucthu": "phu_phi_khac_co_vat",
        "cuocthuhothucthu": "cuoc_thu_ho",
        "cuocgtgtthucthu": "cuoc_gtgt",
        "madvchapnhan": "ma_dv_chap_nhan",
        "mã dv chấp nhận": "ma_dv_chap_nhan",
        "diachinguoigui": "dia_chi_nguoi_gui",
        "địa chỉ người gửi": "dia_chi_nguoi_gui",
        "dichvuchinh": "dich_vu_chinh",
        "dịch vụ chính": "dich_vu_chinh"
    }

    # Danh sách các cột "Sạch" chúng ta thực sự cần lưu vào SQLite
    CLEAN_COLUMNS = [
        "ma_dv", "shbg", "username", "ma_kh", "ten_nguoi_gui", "dia_chi_nguoi_gui", "dia_chi_goc",
        "lien_tinh_noi_tinh", "trong_nuoc_quoc_te", "ngay_chap_nhan", "kl_tinh_cuoc",
        "cuoc_chinh_co_vat", "phu_phi_xang_dau_co_vat", "phu_phi_vung_xa_co_vat",
        "phu_phi_khac_co_vat", "cuoc_thu_ho", "cuoc_gtgt", "ma_dv_chap_nhan", "dich_vu_chinh"
    ]

    rename_final = {c: mapping[c] for c in df.columns if c in mapping}
    df_out = df[list(rename_final.keys())].rename(columns=rename_final).copy()

    # Chỉ giữ lại những cột nằm trong danh sách CLEAN_COLUMNS
    df_out = df_out[[c for c in df_out.columns if c in CLEAN_COLUMNS]]

    # Numeric conversions
    for c in ["kl_tinh_cuoc", "cuoc_chinh_co_vat", "phu_phi_xang_dau_co_vat", 
              "phu_phi_vung_xa_co_vat", "phu_phi_khac_co_vat", "cuoc_thu_ho", "cuoc_gtgt"]:
        if c in df_out.columns:
            df_out[c] = df_out[c].apply(safe_float)
            
    # Xử lý ngày tháng linh hoạt (Excel date serial hoặc String)
    if "ngay_chap_nhan" in df_out.columns:
        def parse_excel_date(val):
            if pd.isna(val) or val == "": return pd.NaT
            try:
                # Nếu là số (Excel date serial)
                num = float(val)
                return pd.to_datetime(num, unit='D', origin='1899-12-30')
            except (ValueError, TypeError):
                # Nếu là chuỗi (String)
                return pd.to_datetime(str(val), errors='coerce', dayfirst=True)
        
        df_out["ngay_chap_nhan"] = df_out["ngay_chap_nhan"].apply(parse_excel_date)
            
    # Tính tổng doanh thu
    revenue_cols = [
        "cuoc_chinh_co_vat", "phu_phi_xang_dau_co_vat", "phu_phi_vung_xa_co_vat", 
        "phu_phi_khac_co_vat", "cuoc_thu_ho", "cuoc_gtgt"
    ]
    
    # Chỉ cộng các cột có tồn tại
    existing_revenue_cols = [c for c in revenue_cols if c in df_out.columns]
    df_out["doanh_thu"] = df_out[existing_revenue_cols].sum(axis=1)

    # Standardize address using mapping logic
    if "dia_chi_goc" in df_out.columns:
        df_out["tinh_thanh_moi"] = df_out["dia_chi_goc"].apply(lambda x: extract_and_map_province(str(x)))

    # TỰ ĐỘNG PHÂN LOẠI DỊCH VỤ THEO QUY ƯỚC CỦA SẾP (E, C, M, R, L)
    def derive_ma_dv(row):
        shbg = str(row.get('shbg', '')).strip().upper()
        tn_qt = str(row.get('trong_nuoc_quoc_te', '')).strip().lower()
        
        # 1. Ưu tiên Quốc tế (L)
        if tn_qt in ["quốc tế", "quoc te"] or shbg.startswith('L'):
            return 'L'
        
        # 2. Phân loại theo ký tự đầu của SHBG
        if len(shbg) > 0:
            first = shbg[0]
            if first in ['E', 'C', 'M', 'R']:
                return first
        
        # Nếu đã có ma_dv từ mapping và nó hợp lệ thì giữ nguyên, ngược lại để Khác
        existing = str(row.get('ma_dv', '')).strip().upper()
        if existing in ['E', 'C', 'M', 'R', 'L']:
            return existing
            
        return 'Khác'

    df_out["ma_dv"] = df_out.apply(derive_ma_dv, axis=1)

    return df_out

def aggregate_revenue_by_customer(df_trans: pd.DataFrame) -> dict:
    if "ma_kh" not in df_trans.columns or "doanh_thu" not in df_trans.columns:
        return {}
    df_valid = df_trans.dropna(subset=["ma_kh"]).copy()
    df_valid["ma_kh"] = df_valid["ma_kh"].astype(str).str.strip()
    agg = df_valid.groupby("ma_kh")["doanh_thu"].sum()
    return agg.to_dict()
