import sqlite3
import os
import sys

# Thêm đường dẫn backend vào sys.path để import được logic chuẩn hóa
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.province_matcher import extract_and_map_province

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "khhh.db"))

def derive_ma_dv(shbg, tn_qt):
    shbg = str(shbg).strip().upper() if shbg else ""
    tn_qt = str(tn_qt).strip().lower() if tn_qt else ""
    
    if tn_qt in ["quốc tế", "quoc te"] or shbg.startswith('L'):
        return 'L'
    
    if len(shbg) > 0:
        first = shbg[0]
        if first in ['E', 'C', 'M', 'R']:
            return first
    return 'Khac'

def run_overhaul():
    print(f"--- BAT DAU DAI TU TOAN DIEN DATABASE ---")
    print(f"Database: {DB_PATH}")
    
    if not os.path.exists(DB_PATH):
        print("Loi: Khong tim thay database!")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    try:
        # 1. Tai danh muc khach hang de dong bo ten chuẩn
        print("[*] Dang tai danh muc CRM...")
        c.execute("SELECT ma_crm_cms, ten_kh FROM customers")
        crm_map = {row['ma_crm_cms']: row['ten_kh'] for row in c.fetchall()}
        print(f"    - Tim thay {len(crm_map)} khach hang trong CRM.")

        # 2. Lay danh sach giao dich (Phan trang de tranh treo)
        c.execute("SELECT count(*) FROM transactions")
        total = c.fetchone()[0]
        print(f"[*] Tong so giao dich can xu ly: {total}")

        BATCH_SIZE = 5000
        offset = 0
        updated_count = 0

        while offset < total:
            print(f"    - Dang xu ly tu ban ghi {offset} den {min(offset + BATCH_SIZE, total)}...")
            
            c.execute(f"""
                SELECT id, shbg, trong_nuoc_quoc_te, dia_chi_nguoi_nhan, ma_kh, ten_nguoi_gui 
                FROM transactions 
                LIMIT {BATCH_SIZE} OFFSET {offset}
            """)
            rows = c.fetchall()
            
            update_batch = []
            for row in rows:
                # A. Chuan hoa Tinh thanh
                new_tinh = extract_and_map_province(row['dia_chi_nguoi_nhan'])
                
                # B. Chuan hoa Dich vu
                new_ma_dv = derive_ma_dv(row['shbg'], row['trong_nuoc_quoc_te'])
                
                # C. Dong bo ten tu CRM (Neu co ma_kh hop le)
                new_name = row['ten_nguoi_gui']
                if row['ma_kh'] in crm_map:
                    new_name = crm_map[row['ma_kh']]
                
                update_batch.append((
                    new_ma_dv,
                    new_tinh,
                    new_name,
                    row['id']
                ))

            # Update batch
            c.executemany("""
                UPDATE transactions 
                SET ma_dv = ?, tinh_thanh_moi = ?, ten_nguoi_gui = ? 
                WHERE id = ?
            """, update_batch)
            
            offset += BATCH_SIZE
            updated_count += len(rows)
            conn.commit() # Commit moi batch de an toan

        print(f"\n--- KET QUA DAI TU ---")
        print(f"✅ Da xu ly thanh cong: {updated_count} bản ghi.")
        print(f"🚀 He thong da duoc chuan hoa toan dien!")

    except Exception as e:
        conn.rollback()
        print(f"Loi: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    run_overhaul()
