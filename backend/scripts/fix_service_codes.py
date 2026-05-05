import sqlite3
import os

# Đường dẫn DB tuyệt đối
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "khhh.db"))

def fix_service_codes():
    print(f"--- BAT DAU CHUAN HOA MA DICH VU (E, C, M, R, L) ---")
    print(f"Database: {DB_PATH}")
    
    if not os.path.exists(DB_PATH):
        print("Loi: Khong tim thay database!")
        return

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    try:
        # 1. Reset các mã không hợp lệ hoặc rỗng để chuẩn bị gán lại
        print("[*] Dang chuan bi du lieu (uoc luong 48k ban ghi)...")
        c.execute("UPDATE transactions SET ma_dv = 'Khac' WHERE ma_dv IS NULL OR ma_dv = ''")
        
        # 2. Ưu tiên QUỐC TẾ (L)
        print("[*] Dang cap nhat dich vu QUOC TE (L)...")
        c.execute("""
            UPDATE transactions 
            SET ma_dv = 'L' 
            WHERE UPPER(trong_nuoc_quoc_te) LIKE '%QUỐC TẾ%' 
               OR UPPER(trong_nuoc_quoc_te) LIKE '%QUOC TE%'
               OR UPPER(shbg) LIKE 'L%'
        """)
        count_l = c.rowcount
        
        # 3. Phân loại trong nước
        services = [
            ('E', 'EMS'),
            ('C', 'Buu kien'),
            ('M', 'KT1'),
            ('R', 'BD')
        ]
        
        counts = {}
        for code, name in services:
            print(f"[*] Dang cap nhat dich vu {name} ({code})...")
            # Quan trọng: Ghi đè cả mã 'Khac' vừa tạo ở bước 1 bằng logic SHBG
            c.execute(f"UPDATE transactions SET ma_dv = '{code}' WHERE ma_dv != 'L' AND UPPER(shbg) LIKE '{code}%'")
            counts[code] = c.rowcount
            
        conn.commit()
        
        print("\n--- KET QUA CHUAN HOA ---")
        print(f"- Quoc te (L): {count_l} ban ghi")
        for code, count in counts.items():
            print(f"- {services[code]} ({code}): {count} ban ghi")
            
        print("\nTHANH CONG RUC RO! Toan bo du lieu da duoc chuan hoa.")
        
    except Exception as e:
        conn.rollback()
        print(f"Loi: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    fix_service_codes()
