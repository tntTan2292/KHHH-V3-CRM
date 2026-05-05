import sys
import sqlite3
import os

sys.stdout.reconfigure(encoding='utf-8')

def check_health():
    db_path = r"d:\Antigravity - Project\DATA_MASTER\khhh.db"
    if not os.path.exists(db_path):
        print(f"File not found: {db_path}")
        return

    print("--- Đang phân tích sức khỏe toàn vẹn dữ liệu (System Health Check)...\n")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT COUNT(*) FROM customers")
        total_customers = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM customers WHERE ten_kh IS NULL OR ten_kh = '' OR ma_crm_cms IS NULL OR ma_crm_cms = ''")
        invalid_customers = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT ma_kh) FROM transactions WHERE ma_kh != '' AND ma_kh NOT IN (SELECT ma_crm_cms FROM customers)")
        orphan_trans = cursor.fetchone()[0]

        total_dirty = invalid_customers + orphan_trans

        dirty_rate = (total_dirty / total_customers * 100) if total_customers > 0 else 0

        print(f"--- TỔNG QUAN:")
        print(f" - Tổng khách hàng định danh: {total_customers}")
        print(f" - Khách hàng lỗi (không tên/mã rỗng): {invalid_customers}")
        print(f" - Khách hàng mồ côi (có giao dịch nhưng không có trong CRM): {orphan_trans}")
        print(f"\n--- TỔNG DỮ LIỆU BẨN: {total_dirty} ({dirty_rate:.2f}%)")

        if dirty_rate > 1.0 or total_dirty > 20:
            print("\n!!! CẢNH BÁO: Tỷ lệ dữ liệu bẩn vượt ngưỡng cho phép. Đề nghị kiểm tra lại nguồn nạp CMS!")
        else:
            print("\nOK: Dữ liệu đang trong trạng thái sạch sẽ.")

    except Exception as e:
        print(f"Lỗi truy vấn: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check_health()
