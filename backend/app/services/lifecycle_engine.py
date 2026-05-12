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
    def process_month_summary(month_str, point_id=None, connection=None):
        """
        [RF5C GOVERNANCE] Calculates lifecycle snapshot and transitions for a specific period.
        Transitions (New, Recovered, Churned) are calculated based on the previous period's frozen snapshot.
        """
        conn = connection if connection else LifecycleEngine.get_connection()
        try:
            y, m = map(int, month_str.split('-'))
            
            # 1. Date windows for analysis
            curr_month_start = datetime(y, m, 1)
            prev_month_str = (curr_month_start - timedelta(days=1)).strftime('%Y-%m')
            
            # 2. Fetch Previous Snapshot (Temporal Consistency)
            # We look into customer_monthly_snapshots for the previous month's frozen truth.
            prev_snapshots = {}
            cursor = conn.cursor()
            cursor.execute("""
                SELECT ma_kh, lifecycle_state 
                FROM customer_monthly_snapshots 
                WHERE year_month = ?
            """, (prev_month_str,))
            for row in cursor.fetchall():
                prev_snapshots[row[0]] = row[1]
                
            # If no historical snapshots, fall back to current customers table (initial migration safety)
            if not prev_snapshots:
                logger.warning(f"No snapshots found for {prev_month_str}. Falling back to realtime table.")
                cursor.execute("SELECT ma_crm_cms, lifecycle_state FROM customers")
                for row in cursor.fetchall():
                    prev_snapshots[row[0]] = row[1]

            # 3. Fetch Transactional Evidence for current period
            sql = """
            WITH current_activity AS (
                SELECT 
                    ma_kh,
                    SUM(doanh_thu) as curr_rev,
                    COUNT(id) as curr_orders,
                    MAX(ngay_chap_nhan) as last_order_date,
                    point_id
                FROM transactions
                WHERE strftime('%Y-%m', ngay_chap_nhan) = '{m}'
                GROUP BY ma_kh
            ),
            historical_evidence AS (
                SELECT 
                    ma_kh,
                    MIN(ngay_chap_nhan) as first_order_date,
                    MAX(CASE WHEN strftime('%Y-%m', ngay_chap_nhan) < '{m}' THEN ngay_chap_nhan ELSE NULL END) as last_order_before
                FROM transactions
                GROUP BY ma_kh
            )
            SELECT 
                COALESCE(c.ma_kh, h.ma_kh) as ma_kh,
                c.curr_rev,
                c.curr_orders,
                c.last_order_date,
                h.first_order_date,
                h.last_order_before,
                COALESCE(cust.point_id, c.point_id) as point_id
            FROM historical_evidence h
            LEFT JOIN current_activity c ON h.ma_kh = c.ma_kh
            LEFT JOIN customers cust ON h.ma_kh = cust.ma_crm_cms
            WHERE COALESCE(c.curr_rev, 0) > 0 OR h.first_order_date IS NOT NULL
            {p_filter}
            """.format(m=month_str, 
                       p_filter=f"AND COALESCE(cust.point_id, c.point_id) = {point_id}" if point_id else "")
            
            df = pd.read_sql_query(sql, conn)
            if df.empty: return []

            # 4. Anchoring to reporting period end (Temporal State Freeze)
            reporting_period_end = datetime(y, m, py_calendar.monthrange(y, m)[1], 23, 59, 59)
            
            results = []
            for _, row in df.iterrows():
                ma_kh = row['ma_kh']
                pid = int(row['point_id']) if row['point_id'] else 0
                
                # Evidence
                first_dt = pd.to_datetime(row['first_order_date'])
                last_before_dt = pd.to_datetime(row['last_order_before']) if row['last_order_before'] else None
                curr_rev = row['curr_rev'] or 0
                
                # Prev state from snapshot
                prev_state = prev_snapshots.get(ma_kh, 'UNKNOWN')
                
                # DETERMINE TRANSITIONS & NEW STATE
                is_new = False
                is_recovered = False
                is_churn = False
                final_state = 'ACTIVE'
                
                # Transition 1: NEW (First revenue ever in this period)
                if first_dt.strftime('%Y-%m') == month_str:
                    is_new = True
                    final_state = 'NEW'
                
                # Transition 2: RECOVERED (Prev was Risk/Churn, now has Revenue)
                elif curr_rev > 0 and prev_state in ['AT_RISK', 'CHURNED']:
                    is_recovered = True
                    final_state = 'ACTIVE' # Transition: RECOVERED, Snapshot state: ACTIVE
                
                # Transition 3: CHURN (Prev was ACTIVE, now >90 days inactive at period end)
                elif curr_rev == 0:
                    last_active = last_before_dt or first_dt
                    days_inactive = (reporting_period_end - last_active).days
                    
                    if days_inactive > 90:
                        final_state = 'CHURNED'
                        if prev_state == 'ACTIVE':
                            is_churn = True
                    elif days_inactive > 30:
                        final_state = 'AT_RISK'
                    else:
                        final_state = 'ACTIVE'
                else:
                    final_state = 'ACTIVE'

                # Log for summary consumption
                results.append({
                    'ma_kh': ma_kh,
                    'point_id': pid,
                    'lifecycle_state': final_state,
                    'is_new_transition': is_new,
                    'is_recovered_transition': is_recovered,
                    'is_churn_transition': is_churn,
                    'revenue': curr_rev,
                    'orders': int(row['curr_orders'] or 0)
                })
            return results
        finally:
            if not connection:
                conn.close()

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
        Updates the 'customers' table and 'customer_monthly_snapshots' table.
        Ensures idempotency by using REPLACE for snapshots.
        """
        if not month_str:
            month_str = datetime.now().strftime('%Y-%m')
            
        print(f"Syncing customers and snapshots for {month_str}...")
        results = LifecycleEngine.process_month_summary(month_str)
        if not results:
            return
            
        conn = LifecycleEngine.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("BEGIN")
            
            # 1. Update customer_monthly_snapshots (Frozen Truth)
            snapshot_data = [
                (
                    month_str, r['ma_kh'], r['point_id'], r['lifecycle_state'],
                    r['is_new_transition'], r['is_recovered_transition'], r['is_churn_transition'],
                    r['revenue'], r['orders']
                ) for r in results
            ]
            
            cursor.executemany("""
                INSERT OR REPLACE INTO customer_monthly_snapshots 
                (year_month, ma_kh, point_id, lifecycle_state, is_new_transition, is_recovered_transition, is_churn_transition, revenue, orders)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, snapshot_data)
            
            # 2. Update realtime customers table for list views
            # We use a temp table for bulk update
            cursor.execute("CREATE TEMP TABLE temp_lifecycle_v3 (ma_kh TEXT, state TEXT)")
            cursor.executemany(
                "INSERT INTO temp_lifecycle_v3 VALUES (?, ?)",
                [(r['ma_kh'], r['lifecycle_state']) for r in results]
            )
            
            cursor.execute("""
                UPDATE customers 
                SET lifecycle_state = (SELECT state FROM temp_lifecycle_v3 WHERE temp_lifecycle_v3.ma_kh = customers.ma_crm_cms)
                WHERE ma_crm_cms IN (SELECT ma_kh FROM temp_lifecycle_v3)
            """)
            
            conn.execute("COMMIT")
            print(f"Successfully synced {len(results)} customers and snapshots for {month_str}.")
            return True
        except Exception as e:
            conn.execute("ROLLBACK")
            logger.error(f"Error syncing lifecycle governance: {e}")
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
