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
        # Dùng isolation_level=None để kiểm soát Transaction thủ công tuyệt đối
        return sqlite3.connect(SummaryService.DB_PATH, isolation_level=None)

    @staticmethod
    def refresh_summary_shadow_swap():
        """Làm mới bảng summary bằng kỹ thuật Shadow-Swap (Tối ưu hiệu năng)."""
        conn = SummaryService.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("DROP TABLE IF EXISTS monthly_analytics_summary_shadow")
            cursor.execute("""
            CREATE TABLE monthly_analytics_summary_shadow (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                year_month TEXT,
                point_id INTEGER,
                lifecycle_stage TEXT,
                total_revenue REAL DEFAULT 0.0,
                total_orders INTEGER DEFAULT 0,
                total_customers INTEGER DEFAULT 0,
                last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """)
            
            # Tính toán dữ liệu
            SummaryService._calculate_and_insert_summary_fast(conn, "monthly_analytics_summary_shadow")
            
            cursor.execute("""
            CREATE INDEX idx_summary_main_shadow 
            ON monthly_analytics_summary_shadow (point_id, year_month, lifecycle_stage)
            """)
            
            # SWAP - Hoán đổi bảng
            print("Starting Shadow-Swap transaction...")
            try:
                cursor.execute("BEGIN")
                # Xóa bảng cũ nếu tồn tại
                cursor.execute("DROP TABLE IF EXISTS monthly_analytics_summary_old")
                # Kiểm tra bảng chính có tồn tại không để Rename
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='monthly_analytics_summary'")
                if cursor.fetchone():
                    cursor.execute("ALTER TABLE monthly_analytics_summary RENAME TO monthly_analytics_summary_old")
                # Đổi tên bảng shadow sang chính thức
                cursor.execute("ALTER TABLE monthly_analytics_summary_shadow RENAME TO monthly_analytics_summary")
                # Xóa bảng old
                cursor.execute("DROP TABLE IF EXISTS monthly_analytics_summary_old")
                cursor.execute("COMMIT")
                print("SUCCESS: Shadow-Swap completed successfully.")
                return True
            except Exception as e:
                cursor.execute("ROLLBACK")
                print(f"ERROR: Error during Shadow-Swap transaction: {e}")
                return False
                
        except Exception as e:
            print(f"ERROR: Error in refresh_summary_shadow_swap: {e}")
            return False
        finally:
            conn.close()

    @staticmethod
    def _calculate_and_insert_summary_fast(conn, target_table):
        """Tính toán KPIs thần tốc bằng SQL + Vectorized Pandas."""
        print("Calculating summary data (Fast mode)...")
        
        sql = """
        WITH raw_data AS (
            SELECT ma_kh as customer_key, point_id, strftime('%Y-%m', ngay_chap_nhan) as year_month, 
                   doanh_thu, id
            FROM transactions 
            WHERE ma_kh IS NOT NULL AND ma_kh != ''
            UNION ALL
            SELECT (ten_nguoi_gui_canonical || '|' || dia_chi_nguoi_gui_canonical || '|' || point_id) as customer_key, 
                   point_id, strftime('%Y-%m', ngay_chap_nhan) as year_month, 
                   doanh_thu, id
            FROM transactions 
            WHERE ma_kh IS NULL OR ma_kh = ''
        ),
        monthly_stats AS (
            SELECT customer_key, point_id, year_month, 
                   SUM(doanh_thu) as revenue, COUNT(id) as orders
            FROM raw_data
            GROUP BY customer_key, point_id, year_month
        ),
        first_months AS (
            SELECT customer_key, MIN(year_month) as first_month
            FROM monthly_stats
            GROUP BY customer_key
        )
        SELECT m.customer_key, m.point_id, m.year_month, m.revenue, m.orders, f.first_month
        FROM monthly_stats m
        JOIN first_months f ON m.customer_key = f.customer_key
        """
        
        df = pd.read_sql_query(sql, conn)
        if df.empty: return

        def get_month_diff(m1, m2):
            y1, mo1 = map(int, m1.split('-'))
            y2, mo2 = map(int, m2.split('-'))
            return (y1 - y2) * 12 + (mo1 - mo2)

        df['month_diff'] = df.apply(lambda x: get_month_diff(x['year_month'], x['first_month']), axis=1)
        df['stage'] = 'ACTIVE'
        df.loc[df['month_diff'] < 3, 'stage'] = 'NEW'
        
        final_agg = df.groupby(['year_month', 'point_id', 'stage']).agg({
            'revenue': 'sum',
            'orders': 'sum',
            'customer_key': 'nunique'
        }).rename(columns={'customer_key': 'customers'}).reset_index()
        
        insert_sql = f"INSERT INTO {target_table} (year_month, point_id, lifecycle_stage, total_revenue, total_orders, total_customers) VALUES (?, ?, ?, ?, ?, ?)"
        data_to_insert = [
            (row['year_month'], int(row['point_id']), row['stage'], row['revenue'], int(row['orders']), int(row['customers']))
            for _, row in final_agg.iterrows()
        ]
        
        # Insert theo lô
        conn.execute("BEGIN")
        conn.executemany(insert_sql, data_to_insert)
        conn.execute("COMMIT")
        print(f"- Inserted {len(data_to_insert)} summary records.")

if __name__ == "__main__":
    SummaryService.refresh_summary_shadow_swap()
