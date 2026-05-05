import sys
import sqlite3
import os
import time

sys.stdout.reconfigure(encoding='utf-8')

def optimize_database():
    db_path = r"d:\Antigravity - Project\DATA_MASTER\khhh.db"
    if not os.path.exists(db_path):
        print(f"X File not found: {db_path}")
        return

    print("--- Bắt đầu tối ưu hóa hệ thống dữ liệu (Database Optimization)...")
    start_time = time.time()
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Tạo Indexes trên bảng transactions (Móng của tốc độ)
        print("Tạo Index cho 'transactions(ma_kh)'...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_trans_ma_kh ON transactions(ma_kh);")
        
        print("Tạo Index cho 'transactions(ngay_chap_nhan)'...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_trans_ngay ON transactions(ngay_chap_nhan);")
        
        print("Tạo Index cho 'transactions(doanh_thu)'...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_trans_doanh_thu ON transactions(doanh_thu);")

        print("Tạo Index kết hợp cho truy vấn MoM 'transactions(ngay_chap_nhan, ma_kh, doanh_thu)'...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_trans_ngay_makh_dt ON transactions(ngay_chap_nhan, ma_kh, doanh_thu);")

        # Tạo Indexes trên bảng customers
        print("Tạo Index cho 'customers(ma_crm_cms)'...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_cust_ma_crm ON customers(ma_crm_cms);")

        print("Tạo Index cho 'customers(don_vi)'...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_cust_don_vi ON customers(don_vi);")

        print("Tạo Index cho bảng 'sync_attempts'...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sync_attempts_folder ON sync_attempts(folder_name);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sync_logs_folder ON sync_logs(folder_name);")

        # Chạy phân tích và tối ưu
        print("Đang thực hiện ANALYZE để lên kế hoạch truy vấn mượt mà nhất...")
        cursor.execute("ANALYZE;")

        print("Đang dọn dẹp phân mảnh dữ liệu (VACUUM)... (có thể mất vài chục giây)")
        conn.commit()
        cursor.execute("VACUUM;")
        
        elapsed = time.time() - start_time
        print(f"✅ Hoàn tất thiết lập móng hệ thống. Thời gian thực thi: {elapsed:.2f} giây.")

    except Exception as e:
        print(f"❌ Xảy ra lỗi trong quá trình tối ưu: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    optimize_database()
