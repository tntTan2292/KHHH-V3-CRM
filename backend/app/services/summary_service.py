import sqlite3
import pandas as pd
from datetime import datetime, timedelta
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
        """Xây dựng lại summary tháng bằng JOIN (Tránh lỗi giới hạn 999 placeholders của SQLite)."""
        cursor = conn.cursor()
        
        # 1. Lấy dữ liệu gộp theo tháng và JOIN trực tiếp với bảng phụ để tính Stage
        # Đây là cách tối ưu nhất: Để SQLite làm mọi thứ bằng JOIN
        sql = """
        WITH month_tx AS (
            SELECT 
                COALESCE(ma_kh, ten_nguoi_gui_canonical || '|' || dia_chi_nguoi_gui_canonical || '|' || point_id) as name,
                point_id,
                ma_dv,
                CASE 
                    WHEN trong_nuoc_quoc_te IN ('quốc tế', 'quoc te') OR ma_dv = 'L' THEN 'Quốc tế'
                    WHEN lien_tinh_noi_tinh IN ('1', 'nội tỉnh', 'noi tinh') THEN 'Nội tỉnh'
                    ELSE 'Liên tỉnh'
                END as region_type,
                SUM(doanh_thu) as revenue,
                COUNT(id) as orders
            FROM transactions
            WHERE ngay_chap_nhan BETWEEN ? AND ?
            GROUP BY name, point_id, ma_dv, region_type
        )
        SELECT 
            m.point_id,
            m.ma_dv,
            m.region_type,
            m.revenue,
            m.orders,
            f.first_month,
            l.last_active_month,
            ? as current_month
        FROM month_tx m
        LEFT JOIN customer_first_order f ON m.name = f.name AND m.point_id = f.point_id
        LEFT JOIN customer_last_active l ON m.name = l.name AND m.point_id = l.point_id
        """
        
        # Tạo dải ngày cho tháng
        start_date = f"{month_str}-01"
        import calendar as py_calendar
        y, m = map(int, month_str.split('-'))
        last_day = py_calendar.monthrange(y, m)[1]
        end_date = f"{month_str}-{last_day} 23:59:59"
        
        print(f"  - Querying data for {month_str}...")
        df = pd.read_sql_query(sql, conn, params=(start_date, end_date, month_str))
        print(f"  - Found {len(df)} raw records.")
        if df.empty:
            cursor.execute("BEGIN")
            cursor.execute("DELETE FROM monthly_analytics_summary WHERE year_month = ?", (month_str,))
            conn.execute("COMMIT")
            return

        def calculate_stage(row):
            curr_m = row['current_month']
            first_m = row['first_month']
            
            if not isinstance(curr_m, str) or not isinstance(first_m, str):
                return 'ACTIVE'
                
            try:
                y1, mo1 = map(int, curr_m.split('-'))
                y2, mo2 = map(int, first_m.split('-'))
                diff = (y1-y2)*12 + (mo1-mo2)
                return 'NEW' if diff < 3 else 'ACTIVE'
            except:
                return 'ACTIVE'

        print(f"  - Calculating stages...")
        df['stage'] = df.apply(calculate_stage, axis=1)
        
        print(f"  - Grouping and aggregating...")
        
        final_agg = df.groupby(['point_id', 'stage', 'ma_dv', 'region_type']).agg({
            'revenue': 'sum',
            'orders': 'sum',
            'current_month': 'count' 
        }).rename(columns={'current_month': 'customers'}).reset_index()
        
        cursor.execute("BEGIN")
        try:
            cursor.execute("DELETE FROM monthly_analytics_summary WHERE year_month = ?", (month_str,))
            insert_sql = "INSERT INTO monthly_analytics_summary (year_month, point_id, lifecycle_stage, ma_dv, region_type, total_revenue, total_orders, total_customers) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            data = [(month_str, int(row['point_id']), row['stage'], row['ma_dv'], row['region_type'], row['revenue'], int(row['orders']), int(row['customers'])) for _, row in final_agg.iterrows()]
            cursor.executemany(insert_sql, data)
            conn.execute("COMMIT")
            print(f"- Rebuilt summary for {month_str}: {len(data)} records.")
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
