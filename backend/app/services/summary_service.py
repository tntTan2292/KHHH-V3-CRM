import sqlite3
import pandas as pd
import calendar as py_calendar
from datetime import datetime, timedelta
import dateutil.relativedelta
import os
import logging
from .lifecycle_engine import LifecycleEngine
from .vip_tier_engine import VIPTierEngine

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
            return True
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
        
        print(f"    - Processing identified customers using LifecycleEngine...")
        ident_results = LifecycleEngine.process_month_summary(month_str)
        
        print(f"    - Processing VIP Tiers using VIPTierEngine...")
        vip_results = VIPTierEngine.process_vip_month(month_str)
        vip_df = pd.DataFrame(vip_results) if vip_results else pd.DataFrame()
        
        summary_data = []

        if ident_results:
            df_ident = pd.DataFrame(ident_results)
            
            # Merge with VIP data
            if not vip_df.empty:
                df_ident = pd.merge(df_ident, vip_df[['ma_kh', 'vip_tier', 'risk_status']], on='ma_kh', how='left')
                df_ident['vip_tier'] = df_ident['vip_tier'].fillna('NORMAL')
            else:
                df_ident['vip_tier'] = 'NORMAL'
                df_ident['risk_status'] = None

            # Gộp theo Stage, Growth và VIP (Dùng ma_dv='ALL' để đếm unique khách hàng)
            stage_counts = df_ident.groupby(['point_id', 'state', 'growth', 'vip_tier']).size().reset_index(name='count')
            for _, r in stage_counts.iterrows():
                summary_data.append((month_str, int(r['point_id']), r['state'], r['growth'], r['vip_tier'], 'ALL', 'ALL', 0.0, 0, int(r['count'])))
            
            # Tính doanh thu thực tế cho nhóm định danh
            sql_rev_ident = """
            SELECT point_id, ma_kh, ma_dv, 
                   CASE 
                        WHEN trong_nuoc_quoc_te IN ('quốc tế', 'quoc te') OR ma_dv = 'L' THEN 'Quốc tế'
                        WHEN lien_tinh_noi_tinh IN ('1', 'nội tỉnh', 'noi tinh') THEN 'Nội tỉnh'
                        ELSE 'Liên tỉnh'
                   END as region_type,
                   SUM(doanh_thu) as rev, COUNT(id) as orders
            FROM transactions
            WHERE ngay_chap_nhan BETWEEN ? AND ? AND ma_kh IS NOT NULL AND ma_kh != ''
            GROUP BY point_id, ma_kh, ma_dv, region_type
            """
            df_rev_ident = pd.read_sql_query(sql_rev_ident, conn, params=(start_date, end_date))
            
            # Map VIP tier to revenue records for proper aggregation if needed, 
            # but usually dashboard sums by service/region regardless of VIP.
            # However, for SSOT, we include VIP in the summary record.
            if not vip_df.empty:
                df_rev_ident = pd.merge(df_rev_ident, vip_df[['ma_kh', 'vip_tier']], on='ma_kh', how='left')
                df_rev_ident['vip_tier'] = df_rev_ident['vip_tier'].fillna('NORMAL')
            else:
                df_rev_ident['vip_tier'] = 'NORMAL'

            # Aggregate by service/region/VIP
            rev_agg = df_rev_ident.groupby(['point_id', 'ma_dv', 'region_type', 'vip_tier']).agg({'rev': 'sum', 'orders': 'sum'}).reset_index()
            for _, r in rev_agg.iterrows():
                # Dùng stage='ACTIVE' làm placeholder cho doanh thu định danh
                summary_data.append((month_str, int(r['point_id']), 'ACTIVE', None, r['vip_tier'], r['ma_dv'], r['region_type'], r['rev'], int(r['orders']), 0))

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
                summary_data.append((month_str, int(r['point_id']), r['rank'], None, 'NORMAL', r['ma_dv'], r['region_type'], r['rev'], int(r['orders']), int(r['name'])))

        # 3. Lưu Database
        cursor.execute("BEGIN")
        try:
            cursor.execute("DELETE FROM monthly_analytics_summary WHERE year_month = ?", (month_str,))
            insert_sql = "INSERT INTO monthly_analytics_summary (year_month, point_id, lifecycle_stage, growth_tag, vip_tier, ma_dv, region_type, total_revenue, total_orders, total_customers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            cursor.executemany(insert_sql, summary_data)
            conn.execute("COMMIT")
            print(f"- Rebuilt summary for {month_str}: {len(summary_data)} records.")
            
            # Sync customers table for list views
            LifecycleEngine.sync_customers_table(month_str)
            VIPTierEngine.sync_customers_table(month_str)
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
