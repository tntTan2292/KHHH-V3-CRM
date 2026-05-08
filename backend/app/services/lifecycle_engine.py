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
            # Date windows
            t_minus_1_month = (datetime(y, m, 1) - dateutil.relativedelta.relativedelta(months=1)).strftime('%Y-%m')
            t_minus_12_month = (datetime(y, m, 1) - dateutil.relativedelta.relativedelta(months=12)).strftime('%Y-%m')
            
            # Fetch data with deep historical scanning (SSOT Principle)
            sql = """
            WITH customer_base AS (
                SELECT 
                    t.ma_kh,
                    MIN(t.ngay_chap_nhan) as first_order_date,
                    MAX(t.ngay_chap_nhan) as latest_order_date,
                    MAX(CASE WHEN strftime('%Y-%m', t.ngay_chap_nhan) < '{m}' THEN t.ngay_chap_nhan ELSE NULL END) as last_order_before,
                    SUM(CASE WHEN strftime('%Y-%m', t.ngay_chap_nhan) = '{m}' THEN t.doanh_thu ELSE 0 END) as curr_rev,
                    SUM(CASE WHEN strftime('%Y-%m', t.ngay_chap_nhan) = '{m_1}' THEN t.doanh_thu ELSE 0 END) as prev_rev,
                    COUNT(t.id) as total_orders_hist,
                    SUM(t.doanh_thu) as total_rev_hist,
                    COALESCE(c.point_id, hn.id, t.point_id) as point_id
                FROM transactions t
                LEFT JOIN customers c ON t.ma_kh = c.ma_crm_cms
                LEFT JOIN hierarchy_nodes hn ON (c.point_id IS NULL AND c.ma_bc_phu_trach = hn.code)
                WHERE t.ma_kh IS NOT NULL AND t.ma_kh != ''
                {p_filter}
                GROUP BY t.ma_kh
            )
            SELECT * FROM customer_base
            WHERE curr_rev > 0 OR latest_order_date IS NOT NULL
            """.format(m=month_str, m_1=t_minus_1_month, 
                       p_filter=f"AND COALESCE(hn.id, t.point_id) = {point_id}" if point_id else "")
            
            df = pd.read_sql_query(sql, conn)
            if df.empty: return []

            # Pre-load previous states for transition logging
            prev_states = {}
            cursor = conn.cursor()
            cursor.execute("SELECT ma_crm_cms, lifecycle_state FROM customers")
            for row in cursor.fetchall():
                prev_states[row[0]] = row[1]

            results = []
            
            # [GOVERNANCE] Lifecycle State Machine must anchor to REAL BUSINESS TIME (Latest Transaction)
            # NOT to the first day of the month.
            cursor.execute("SELECT MAX(ngay_chap_nhan) FROM transactions")
            max_ts = cursor.fetchone()[0]
            if max_ts:
                now_dt = pd.to_datetime(max_ts)
            else:
                now_dt = datetime(y, m, 1)
            
            logger.info(f"Lifecycle Governance: Anchoring calculations to {now_dt}")
            
            for _, row in df.iterrows():
                ma_kh = row['ma_kh']
                pid = int(row['point_id'])
                
                # Parse dates
                first_dt = pd.to_datetime(row['first_order_date'])
                last_before_dt = pd.to_datetime(row['last_order_before']) if row['last_order_before'] else None
                
                state = LifecycleEngine._determine_state_v2(now_dt, first_dt, last_before_dt, row['curr_rev'])
                growth = LifecycleEngine._calculate_growth_tag(row['curr_rev'], row['prev_rev'])
                
                # Log transition
                prev_state = prev_states.get(ma_kh)
                if prev_state and prev_state != state:
                    LifecycleEngine.log_transition(conn, ma_kh, prev_state, state, f"Governance re-calc for {month_str}")
                
                results.append({
                    'ma_kh': ma_kh,
                    'point_id': pid,
                    'state': state,
                    'growth': growth,
                    'rev': row['curr_rev'],
                    'orders': 0 # Updated by summary service
                })
            return results
        finally:
            conn.close()

    @staticmethod
    def _determine_state_v2(now_dt, first_order_dt, last_order_before_dt, curr_rev):
        """
        [GOVERNANCE] Lifecycle state transitions are calculated using governed current business time, 
        not month-start anchors. This ensures atomic and deterministic status evaluation based on 
        REAL inactivity duration.
        
        Logic (Constitution Section III Hardened):
        - NEW: First order within 3 months of current business time.
        - REBUY: Churned customer (>90 days inactive before this month) returns.
        - AT_RISK: Over 30 days since last activity.
        - CHURNED: Over 90 days since last activity.
        - ACTIVE: Activity within last 30 days.
        """
        # 1. NEW Customer Check (First 3 months from first order)
        months_since_start = (now_dt.year - first_order_dt.year) * 12 + (now_dt.month - first_order_dt.month)
        if months_since_start < 3:
            return 'NEW'
        
        has_current = curr_rev > 0
        
        if has_current:
            # Check for REBUY (Was CHURNED before this month started)
            # A customer is REBUY if they return after >90 days of total silence
            if last_order_before_dt:
                days_inactive_before_month = (now_dt.replace(day=1) - last_order_before_dt).days
                if days_inactive_before_month > 90:
                    return 'REBUY'
            return 'ACTIVE'
        else:
            # No revenue in the current month - evaluate state based on REAL inactivity
            if last_order_before_dt:
                days_since_last = (now_dt - last_order_before_dt).days
                if days_since_last > 90:
                    return 'CHURNED'
                if days_since_last > 30:
                    return 'AT_RISK'
                return 'ACTIVE' 
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
