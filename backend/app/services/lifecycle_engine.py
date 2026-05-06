import sqlite3
import pandas as pd
from datetime import datetime, timedelta
import dateutil.relativedelta
import logging
import os

logger = logging.getLogger(__name__)

class LifecycleEngine:
    PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    DB_PATH = os.path.join(PROJECT_ROOT, "data", "database", "khhh_v3.db")

    @staticmethod
    def get_connection():
        return sqlite3.connect(LifecycleEngine.DB_PATH, isolation_level=None)

    @staticmethod
    def process_month_summary(month_str, point_id=None):
        """
        Calculates lifecycle and growth for all customers in a month.
        Used by SummaryService.
        """
        conn = LifecycleEngine.get_connection()
        try:
            y, m = map(int, month_str.split('-'))
            
            # Date windows
            t_minus_1_month = (datetime(y, m, 1) - dateutil.relativedelta.relativedelta(months=1)).strftime('%Y-%m')
            t_minus_3_month = (datetime(y, m, 1) - dateutil.relativedelta.relativedelta(months=3)).strftime('%Y-%m')
            t_minus_12_month = (datetime(y, m, 1) - dateutil.relativedelta.relativedelta(months=12)).strftime('%Y-%m')
            
            # Fetch data
            sql = """
            WITH customer_base AS (
                SELECT 
                    ma_kh,
                    MIN(strftime('%Y-%m', ngay_chap_nhan)) as first_month,
                    MAX(CASE WHEN strftime('%Y-%m', ngay_chap_nhan) < '{m}' THEN strftime('%Y-%m', ngay_chap_nhan) ELSE NULL END) as last_month_before,
                    SUM(CASE WHEN strftime('%Y-%m', ngay_chap_nhan) = '{m}' THEN doanh_thu ELSE 0 END) as curr_rev,
                    SUM(CASE WHEN strftime('%Y-%m', ngay_chap_nhan) = '{m_1}' THEN doanh_thu ELSE 0 END) as prev_rev,
                    MAX(CASE WHEN strftime('%Y-%m', ngay_chap_nhan) BETWEEN '{m_3}' AND '{m_1}' THEN 1 ELSE 0 END) as active_in_rolling_3m,
                    point_id
                FROM transactions
                WHERE ma_kh IS NOT NULL AND ma_kh != ''
                {p_filter}
                GROUP BY ma_kh, point_id
            )
            SELECT * FROM customer_base
            WHERE curr_rev > 0 OR (last_month_before IS NOT NULL AND last_month_before >= '{m_12}')
            """.format(m=month_str, m_1=t_minus_1_month, m_3=t_minus_3_month, m_12=t_minus_12_month, 
                       p_filter=f"AND point_id = {point_id}" if point_id else "")
            
            df = pd.read_sql_query(sql, conn)
            if df.empty: return []

            # Fetch previous states from the customers table for logging
            prev_states = {}
            cursor = conn.cursor()
            cursor.execute("SELECT ma_crm_cms, lifecycle_state FROM customers")
            for row in cursor.fetchall():
                prev_states[row[0]] = row[1]

            results = []
            for _, row in df.iterrows():
                ma_kh = row['ma_kh']
                pid = int(row['point_id'])
                state = LifecycleEngine._determine_state(y, m, row['first_month'], row['last_month_before'], row['curr_rev'])
                growth = LifecycleEngine._calculate_growth_tag(row['curr_rev'], row['prev_rev'])
                
                # Log transition if changed
                prev_state = prev_states.get(ma_kh)
                if prev_state and prev_state != state:
                    LifecycleEngine.log_transition(conn, ma_kh, prev_state, state, f"Auto-recalc for {month_str}")
                
                results.append({
                    'ma_kh': ma_kh,
                    'point_id': pid,
                    'state': state,
                    'growth': growth,
                    'rev': row['curr_rev'],
                    'orders': 0 # Will be updated by summary service
                })
            return results
        finally:
            conn.close()

    @staticmethod
    def _determine_state(curr_y, curr_m, first_month, last_month_before, curr_rev):
        # NEW
        y_f, m_f = map(int, first_month.split('-'))
        diff_f = (curr_y - y_f) * 12 + (curr_m - m_f)
        if diff_f < 3: return 'NEW'
        
        has_now = curr_rev > 0
        if has_now:
            if last_month_before:
                y_l, m_l = map(int, last_month_before.split('-'))
                diff_l = (curr_y - y_l) * 12 + (curr_m - m_l)
                if diff_l >= 4: return 'REACTIVATED'
            return 'ACTIVE'
        else:
            if last_month_before:
                y_l, m_l = map(int, last_month_before.split('-'))
                diff_l = (curr_y - y_l) * 12 + (curr_m - m_l)
                if diff_l >= 4: return 'CHURNED'
                return 'AT_RISK'
            return 'CHURNED'

    @staticmethod
    def _calculate_growth_tag(curr_rev, prev_rev):
        if curr_rev <= 0: return None
        if prev_rev <= 0: return 'GROWTH'
        growth_rate = (curr_rev - prev_rev) / prev_rev
        if growth_rate > 0.1: return 'GROWTH'
        if growth_rate < -0.1: return 'DECLINING'
        return 'STABLE'

    @staticmethod
    def sync_customers_table(month_str=None):
        """
        Updates the 'customers' table with the latest lifecycle_state and growth_tag.
        """
        if not month_str:
            month_str = datetime.now().strftime('%Y-%m')
            
        print(f"Syncing customers table for {month_str}...")
        results = LifecycleEngine.process_month_summary(month_str)
        if not results:
            return
            
        conn = LifecycleEngine.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("BEGIN")
            cursor.execute("CREATE TEMP TABLE temp_lifecycle (ma_kh TEXT, state TEXT, growth TEXT)")
            cursor.executemany(
                "INSERT INTO temp_lifecycle VALUES (?, ?, ?)",
                [(r['ma_kh'], r['state'], r['growth']) for r in results]
            )
            
            cursor.execute("""
                UPDATE customers 
                SET lifecycle_state = (SELECT state FROM temp_lifecycle WHERE temp_lifecycle.ma_kh = customers.ma_crm_cms),
                    growth_tag = (SELECT growth FROM temp_lifecycle WHERE temp_lifecycle.ma_kh = customers.ma_crm_cms)
                WHERE ma_crm_cms IN (SELECT ma_kh FROM temp_lifecycle)
            """)
            
            conn.execute("COMMIT")
            print(f"Successfully synced {len(results)} customers.")
            return True
        except Exception as e:
            conn.execute("ROLLBACK")
            print(f"Error syncing customers table: {e}")
            return False
        finally:
            conn.close()

    @staticmethod
    def log_transition(conn, ma_kh, prev_state, new_state, reason):
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO lifecycle_logs (ma_kh, previous_state, new_state, trigger_reason, timestamp)
                VALUES (?, ?, ?, ?, datetime('now'))
            """, (ma_kh, prev_state, new_state, reason))
        except Exception as e:
            logger.error(f"Error logging transition for {ma_kh}: {e}")

if __name__ == "__main__":
    pass
