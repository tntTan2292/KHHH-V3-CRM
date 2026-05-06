import sqlite3
import pandas as pd
import calendar as py_calendar
from datetime import datetime, timedelta
import dateutil.relativedelta
import os
import logging

logger = logging.getLogger(__name__)

class SummaryService:
    DB_PATH = r"d:\Antigravity - Project\KHHH - Antigravity - V3.0\data\database\khhh_v3.db"

    @staticmethod
    def get_connection():
        return sqlite3.connect(SummaryService.DB_PATH, isolation_level=None)

    @staticmethod
    def initialize_auxiliary_tables():
        """Khởi tạo dữ liệu cho các bảng phụ từ lịch sử giao dịch (Chỉ chạy 1 lần)."""
        print("Initializing auxiliary tables from history...")
        conn = SummaryService.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("BEGIN")
            
            # 1. Populating customer_first_order
            cursor.execute("""
            INSERT OR IGNORE INTO customer_first_order (name, addr, point_id, first_month)
            SELECT 
                COALESCE(ma_kh, ten_nguoi_gui_canonical || '|' || dia_chi_nguoi_gui_canonical || '|' || point_id) as key_name,
                MIN(COALESCE(dia_chi_nguoi_gui_canonical, '')) as addr,
                point_id,
                MIN(strftime('%Y-%m', ngay_chap_nhan)) as first_month
            FROM transactions
            GROUP BY key_name, point_id
            """)
            
            # 2. Populating customer_last_active
            cursor.execute("""
            INSERT OR REPLACE INTO customer_last_active (name, addr, point_id, last_active_month)
            SELECT 
                COALESCE(ma_kh, ten_nguoi_gui_canonical || '|' || dia_chi_nguoi_gui_canonical || '|' || point_id) as key_name,
                MAX(COALESCE(dia_chi_nguoi_gui_canonical, '')) as addr,
                point_id,
                MAX(strftime('%Y-%m', ngay_chap_nhan)) as last_active_month
            FROM transactions
            GROUP BY key_name, point_id
            """)
            
            conn.execute("COMMIT")
            print("SUCCESS: Auxiliary tables initialized.")
        except Exception as e:
            conn.execute("ROLLBACK")
            print(f"ERROR initializing auxiliary tables: {e}")
        finally:
            conn.close()

    @staticmethod
    def refresh_summary_incremental(target_months=None):
        if not target_months:
            now = datetime.now()
            target_months = [
                (now - timedelta(days=60)).strftime("%Y-%m"),
                (now - timedelta(days=30)).strftime("%Y-%m"),
                now.strftime("%Y-%m")
            ]
        
        print(f"Refreshing summary for months: {target_months}")
        conn = SummaryService.get_connection()
        try:
            for month in target_months:
                SummaryService._rebuild_month_summary_optimized(conn, month)
            print("SUCCESS: Incremental summary refresh completed.")
        finally:
            conn.close()

    @staticmethod
    def _rebuild_month_summary_optimized(conn, month_str):
        """Xây dựng lại summary tháng tuân thủ Hiến pháp CRM 3.0 (Calculated Lifecycle)."""
        cursor = conn.cursor()
        
        # Tạo dải ngày cho tháng
        start_date = f"{month_str}-01"
        y, m = map(int, month_str.split('-'))
        last_day = py_calendar.monthrange(y, m)[1]
        end_date = f"{month_str}-{last_day} 23:59:59"
        
        # Mốc thời gian cho Churn/Recovered (3 tháng)
        t_minus_3_dt = datetime(y, m, 1) - dateutil.relativedelta.relativedelta(months=3)
        t_minus_3_str = t_minus_3_dt.strftime('%Y-%m')

        print(f"  - Rebuilding {month_str} using Constitutional Logic...")
        
        # 1. Lấy dữ liệu ĐỊNH DANH (Nhóm 1)
        # Quét lịch sử để xác định Stage chính xác
        # Lấy tất cả khách hàng đã từng phát sinh đơn tại điểm này
        sql_ident = """
        WITH ident_history AS (
            SELECT 
                ma_kh,
                point_id,
                MIN(strftime('%Y-%m', ngay_chap_nhan)) as first_month,
                MAX(CASE WHEN ngay_chap_nhan < ? THEN strftime('%Y-%m', ngay_chap_nhan) ELSE NULL END) as last_month_before,
                SUM(CASE WHEN ngay_chap_nhan BETWEEN ? AND ? THEN doanh_thu ELSE 0 END) as curr_rev,
                COUNT(CASE WHEN ngay_chap_nhan BETWEEN ? AND ? THEN id ELSE NULL END) as curr_orders,
                MAX(CASE WHEN ngay_chap_nhan BETWEEN ? AND ? THEN 1 ELSE 0 END) as has_order_this_month
            FROM transactions
            WHERE ma_kh IS NOT NULL AND ma_kh != ''
            GROUP BY ma_kh, point_id
        )
        SELECT * FROM ident_history 
        WHERE has_order_this_month = 1 
           OR (last_month_before IS NOT NULL AND last_month_before >= ?) 
        """
        # (last_month_before >= t_minus_3_str) để lấy những người có nguy cơ hoặc mới rời bỏ gần đây
        
        # Note: We query back to 12 months for at-risk/churned scanning
        t_minus_12_str = (datetime(y, m, 1) - dateutil.relativedelta.relativedelta(months=12)).strftime('%Y-%m')
        
        print(f"    - Scanning identified customers history...")
        df_ident = pd.read_sql_query(sql_ident, conn, params=(start_date, start_date, end_date, start_date, end_date, start_date, end_date, t_minus_12_str))
        
        summary_data = []

        if not df_ident.empty:
            def classify_ident(row):
                first = row['first_month']
                last_before = row['last_month_before']
                has_now = row['has_order_this_month']
                
                # Tính diff (tháng)
                y_c, m_c = y, m
                
                # NEW: Trong vòng 3 tháng đầu
                y_f, m_f = map(int, first.split('-'))
                diff_f = (y_c - y_f) * 12 + (m_c - m_f)
                
                if diff_f < 3: return 'NEW'
                
                if has_now:
                    # RECOVERED: Quay lại sau > 3 tháng
                    if last_before:
                        y_l, m_l = map(int, last_before.split('-'))
                        diff_l = (y_c - y_l) * 12 + (m_c - m_l)
                        if diff_l > 3: return 'RECOVERED'
                    return 'ACTIVE'
                else:
                    # KHÔNG có đơn tháng này
                    if last_before:
                        y_l, m_l = map(int, last_before.split('-'))
                        diff_l = (y_c - y_l) * 12 + (m_c - m_l)
                        if diff_l > 3: return 'CHURNED'
                        return 'AT_RISK'
                return 'CHURNED'

            df_ident['stage'] = df_ident.apply(classify_ident, axis=1)
            
            # Gộp theo Stage (Dùng ma_dv='ALL' để đếm unique khách hàng)
            stage_counts = df_ident.groupby(['point_id', 'stage']).size().reset_index(name='count')
            for _, r in stage_counts.iterrows():
                summary_data.append((month_str, int(r['point_id']), r['stage'], 'ALL', 'ALL', 0.0, 0, int(r['count'])))
            
            # Tính doanh thu thực tế cho nhóm định danh (phân rã theo ma_dv, region_type)
            # Truy vấn lại doanh thu chi tiết tháng này
            sql_rev_ident = """
            SELECT point_id, ma_dv, 
                   CASE 
                        WHEN trong_nuoc_quoc_te IN ('quốc tế', 'quoc te') OR ma_dv = 'L' THEN 'Quốc tế'
                        WHEN lien_tinh_noi_tinh IN ('1', 'nội tỉnh', 'noi tinh') THEN 'Nội tỉnh'
                        ELSE 'Liên tỉnh'
                   END as region_type,
                   SUM(doanh_thu) as rev, COUNT(id) as orders
            FROM transactions
            WHERE ngay_chap_nhan BETWEEN ? AND ? AND ma_kh IS NOT NULL AND ma_kh != ''
            GROUP BY point_id, ma_dv, region_type
            """
            df_rev_ident = pd.read_sql_query(sql_rev_ident, conn, params=(start_date, end_date))
            for _, r in df_rev_ident.iterrows():
                # Dùng stage='ACTIVE' làm placeholder cho doanh thu định danh (để Dashboard sum lại)
                summary_data.append((month_str, int(r['point_id']), 'ACTIVE', r['ma_dv'], r['region_type'], r['rev'], int(r['orders']), 0))

        # 2. Lấy dữ liệu TIỀM NĂNG (Nhóm 2)
        print(f"    - Processing potential customers (Leads)...")
        sql_pot = """
        SELECT 
            ten_nguoi_gui_canonical as name,
            dia_chi_nguoi_gui_canonical as addr,
            point_id, ma_dv,
            CASE 
                WHEN trong_nuoc_quoc_te IN ('quốc tế', 'quoc te') OR ma_dv = 'L' THEN 'Quốc tế'
                WHEN lien_tinh_noi_tinh IN ('1', 'nội tỉnh', 'noi tinh') THEN 'Nội tỉnh'
                ELSE 'Liên tỉnh'
            END as region_type,
            SUM(doanh_thu) as rev, COUNT(id) as orders
        FROM transactions
        WHERE ngay_chap_nhan BETWEEN ? AND ? AND (ma_kh IS NULL OR ma_kh = '')
        GROUP BY name, addr, point_id, ma_dv, region_type
        """
        df_pot = pd.read_sql_query(sql_pot, conn, params=(start_date, end_date))
        if not df_pot.empty:
            def classify_rank(row):
                rev, cnt = row['rev'], row['orders']
                if rev > 5000000 and cnt > 20: return 'KIM CƯƠNG'
                if rev > 1000000 and cnt > 10: return 'VÀNG'
                if rev > 500000 and cnt > 5: return 'BẠC'
                return 'THƯỜNG'
            
            df_pot['rank'] = df_pot.apply(classify_rank, axis=1)
            
            # Gộp doanh thu Tiềm năng
            pot_agg = df_pot[df_pot['rank'] != 'THƯỜNG'].groupby(['point_id', 'rank', 'ma_dv', 'region_type']).agg({
                'rev': 'sum', 'orders': 'sum', 'name': 'count'
            }).reset_index()
            for _, r in pot_agg.iterrows():
                summary_data.append((month_str, int(r['point_id']), r['rank'], r['ma_dv'], r['region_type'], r['rev'], int(r['orders']), int(r['name'])))

        # 3. Lưu Database
        cursor.execute("BEGIN")
        try:
            cursor.execute("DELETE FROM monthly_analytics_summary WHERE year_month = ?", (month_str,))
            insert_sql = "INSERT INTO monthly_analytics_summary (year_month, point_id, lifecycle_stage, ma_dv, region_type, total_revenue, total_orders, total_customers) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            cursor.executemany(insert_sql, summary_data)
            conn.execute("COMMIT")
            print(f"- Rebuilt summary for {month_str}: {len(summary_data)} records.")
        except Exception as e:
            conn.execute("ROLLBACK")
            print(f"ERROR rebuilding month {month_str}: {e}")

    @staticmethod
    def cleanup_expired_tokens():
        conn = SummaryService.get_connection()
        try:
            cursor = conn.cursor()
            total_deleted = 0
            while True:
                cursor.execute("BEGIN")
                cursor.execute("DELETE FROM used_tokens WHERE expires_at < datetime('now') LIMIT 500")
                count = cursor.rowcount
                conn.execute("COMMIT")
                total_deleted += count
                if count < 500:
                    break
            if total_deleted > 0:
                print(f"Cleaned up {total_deleted} expired tokens.")
        finally:
            conn.close()

if __name__ == "__main__":
    pass
