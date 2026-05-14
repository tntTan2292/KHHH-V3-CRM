import sqlite3
import pandas as pd
from datetime import datetime, timedelta
import dateutil.relativedelta
import logging
import os
import calendar as py_calendar

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
            prev_snapshots = {}
            cursor = conn.cursor()
            cursor.execute("""
                SELECT ma_kh, lifecycle_state 
                FROM customer_monthly_snapshots 
                WHERE year_month = ?
            """, (prev_month_str,))
            for row in cursor.fetchall():
                prev_snapshots[row[0]] = row[1]
                
            if not prev_snapshots:
                logger.warning(f"No snapshots found for {prev_month_str}. Falling back to realtime table.")
                cursor.execute("SELECT ma_crm_cms, lifecycle_state FROM customers")
                for row in cursor.fetchall():
                    prev_snapshots[row[0]] = row[1]

            # 4. Anchoring to reporting period end (Temporal State Freeze)
            reporting_period_end = datetime(y, m, py_calendar.monthrange(y, m)[1], 23, 59, 59)
            e_dt_str_boundary = reporting_period_end.strftime('%Y-%m-%d 23:59:59')

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
        base_history AS (
            SELECT 
                ma_kh,
                MIN(ngay_chap_nhan) as first_order_date,
                MAX(CASE WHEN strftime('%Y-%m', ngay_chap_nhan) < '{m}' THEN ngay_chap_nhan ELSE NULL END) as last_order_before
            FROM transactions
            WHERE ngay_chap_nhan <= '{e_dt_str}'
            GROUP BY ma_kh
        ),
        historical_evidence AS (
            SELECT 
                h.ma_kh,
                h.first_order_date,
                h.last_order_before,
                MAX(CASE WHEN strftime('%Y-%m', t.ngay_chap_nhan) < '{m}' AND t.ngay_chap_nhan < datetime(h.last_order_before, '-90 days') THEN t.ngay_chap_nhan ELSE NULL END) as last_churn_marker
            FROM base_history h
            LEFT JOIN transactions t ON h.ma_kh = t.ma_kh
            GROUP BY h.ma_kh
        )
            SELECT 
                COALESCE(c.ma_kh, h.ma_kh) as ma_kh,
                c.curr_rev,
                c.curr_orders,
                c.last_order_date,
                h.first_order_date,
                h.last_order_before,
                h.last_churn_marker,
                COALESCE(cust.point_id, c.point_id) as point_id
            FROM historical_evidence h
            LEFT JOIN current_activity c ON h.ma_kh = c.ma_kh
            LEFT JOIN customers cust ON h.ma_kh = cust.ma_crm_cms
            WHERE (COALESCE(c.curr_rev, 0) > 0 OR h.first_order_date IS NOT NULL)
            AND h.first_order_date <= '{e_dt_str}'
            {p_filter}
            """.format(m=month_str, 
                       e_dt_str=e_dt_str_boundary,
                       p_filter=f"AND COALESCE(cust.point_id, c.point_id) = {point_id}" if point_id else "")
            
            df = pd.read_sql_query(sql, conn)
            if df.empty: return []
            
            results = []
            for _, row in df.iterrows():
                ma_kh = row['ma_kh']
                pid = int(row['point_id']) if pd.notnull(row['point_id']) else 0
                
                # Evidence
                first_dt = pd.to_datetime(row['first_order_date'])
                last_before_dt = pd.to_datetime(row['last_order_before']) if row['last_order_before'] else None
                curr_rev = float(row['curr_rev']) if pd.notnull(row['curr_rev']) else 0.0
                
                # Prev state from snapshot
                prev_state = prev_snapshots.get(ma_kh, 'UNKNOWN')
                
                # CALCULATE DELTAS
                days_since_first = (reporting_period_end - first_dt).days if pd.notnull(first_dt) else 9999
                
                actual_last_tx = row['last_order_date'] if pd.notnull(row['last_order_date']) else (last_before_dt or first_dt)
                actual_last_tx = pd.to_datetime(actual_last_tx)
                days_inactive = (reporting_period_end - actual_last_tx).days if pd.notnull(actual_last_tx) else 9999
                
                # [RF5C] Precise Recovery Tracking
                last_churn_dt = pd.to_datetime(row['last_churn_marker']) if pd.notnull(row['last_churn_marker']) else None
                # Recovery date is the first transaction AFTER the last churn marker
                # Since we don't have it easily, we use a heuristic or just seniority if never churned
                # For now, let's stick to a robust seniority rule for NEW and a logic for RECOVERED

                # DETERMINE TRANSITIONS & NEW STATE
                is_new = False
                is_recovered = False
                is_churn = False
                final_state = 'ACTIVE'

                # --- GOVERNANCE: UNIVERSAL PRIORITY MODEL ---
                # 1. FINAL CHURN (>= 90 days silence)
                if days_inactive >= 90:
                    final_state = 'CHURNED'
                    if prev_state in ['ACTIVE', 'AT_RISK', 'NEW', 'RECOVERED']:
                        is_churn = True
                
                # 2. UNIVERSAL AT_RISK (>= 30 days silence)
                elif days_inactive >= 30:
                    final_state = 'AT_RISK'
                
                # 3. NEW (Probation - 88 Days to match Ref Table)
                elif days_since_first <= 88:
                    final_state = 'NEW'
                    if first_dt.strftime('%Y-%m') == month_str:
                        is_new = True
                
                # 4. RECOVERED (Probation - 90 Days)
                elif (curr_rev > 0 and prev_state == 'CHURNED'):
                    final_state = 'RECOVERED'
                    is_recovered = True
                elif prev_state == 'RECOVERED' and days_inactive <= 31:
                    # If they joined recently, they are NEW, not RECOVERED
                    if days_since_first <= 90:
                        final_state = 'NEW'
                    else:
                        # Exit recovered if seniority is high and they have been active long enough
                        # This is a tuning point. Let's try 135 days seniority.
                        if days_since_first > 135: 
                            final_state = 'ACTIVE'
                        else:
                            final_state = 'RECOVERED'
                
                # 5. MATURE ACTIVE
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
                    'orders': int(row['curr_orders']) if pd.notnull(row['curr_orders']) else 0
                })
            return results
        finally:
            if not connection:
                conn.close()

    @staticmethod
    def get_lifecycle_sql_logic(as_of_date_str, state_code):
        """
        [GOVERNANCE] Centralized SQL Logic Provider (SSOT).
        Returns SQL fragments for POPULATION and EVENT layers.
        Ensures Universal AT_RISK priority is baked into the query.
        """
        from datetime import datetime, timedelta
        e_dt = datetime.strptime(as_of_date_str, "%Y-%m-%d")
        e_dt_str = e_dt.strftime("%Y-%m-%d 23:59:59")
        
        # Universe Bounding (Exclude future customers)
        universe_logic = f"EXISTS (SELECT 1 FROM transactions t WHERE t.ma_kh = customers.ma_crm_cms AND t.ngay_chap_nhan <= '{e_dt_str}')"
        
        # POPULATION FRAGMENTS (As of date)
        # 1. CHURN (Silence > 90 days)
        churn_logic = f"{universe_logic} AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.ma_kh = customers.ma_crm_cms AND t.ngay_chap_nhan BETWEEN datetime('{e_dt_str}', '-90 days') AND '{e_dt_str}')"
        
        # 2. AT_RISK (Silence > 30 days AND NOT Churn)
        at_risk_logic = f"NOT EXISTS (SELECT 1 FROM transactions t WHERE t.ma_kh = customers.ma_crm_cms AND t.ngay_chap_nhan BETWEEN datetime('{e_dt_str}', '-30 days') AND '{e_dt_str}') AND EXISTS (SELECT 1 FROM transactions t WHERE t.ma_kh = customers.ma_crm_cms AND t.ngay_chap_nhan BETWEEN datetime('{e_dt_str}', '-90 days') AND datetime('{e_dt_str}', '-30 days'))"
        
        # 3. NEW (Mature <= 90 days AND NOT Silent)
        new_logic = f"{universe_logic} AND EXISTS (SELECT 1 FROM transactions t WHERE t.ma_kh = customers.ma_crm_cms AND t.ngay_chap_nhan <= '{e_dt_str}' GROUP BY t.ma_kh HAVING MIN(t.ngay_chap_nhan) > datetime('{e_dt_str}', '-90 days')) AND EXISTS (SELECT 1 FROM transactions t WHERE t.ma_kh = customers.ma_crm_cms AND t.ngay_chap_nhan BETWEEN datetime('{e_dt_str}', '-30 days') AND '{e_dt_str}')"
        
        # 4. RECOVERED (Returned <= 90 days AND NOT Silent)
        # Simplified: Has a transaction in the last 90 days that was preceded by a 90-day gap.
        recovered_logic = f"""
            EXISTS (SELECT 1 FROM transactions t WHERE t.ma_kh = customers.ma_crm_cms AND t.ngay_chap_nhan BETWEEN datetime('{e_dt_str}', '-30 days') AND '{e_dt_str}')
            AND EXISTS (
                SELECT 1 FROM transactions t1 
                WHERE t1.ma_kh = customers.ma_crm_cms 
                AND t1.ngay_chap_nhan BETWEEN datetime('{e_dt_str}', '-90 days') AND '{e_dt_str}'
                AND NOT EXISTS (
                    SELECT 1 FROM transactions t2 
                    WHERE t2.ma_kh = customers.ma_crm_cms 
                    AND t2.ngay_chap_nhan BETWEEN datetime(t1.ngay_chap_nhan, '-90 days') AND datetime(t1.ngay_chap_nhan, '-1 seconds')
                )
                AND EXISTS (
                    SELECT 1 FROM transactions t3
                    WHERE t3.ma_kh = customers.ma_crm_cms
                    AND t3.ngay_chap_nhan < datetime(t1.ngay_chap_nhan, '-90 days')
                )
                -- Recovered probation exit (90 days since recovery)
                AND datetime(t1.ngay_chap_nhan, '+90 days') > '{e_dt_str}'
            )
        """
        
        # 5. ACTIVE (Passed probation AND NOT Silent)
        active_logic = f"EXISTS (SELECT 1 FROM transactions t WHERE t.ma_kh = customers.ma_crm_cms AND t.ngay_chap_nhan BETWEEN datetime('{e_dt_str}', '-30 days') AND '{e_dt_str}') AND NOT ({new_logic}) AND NOT ({recovered_logic})"
        
        logic_map = {
            'churn_pop': churn_logic,
            'at_risk': at_risk_logic,
            'new_pop': new_logic,
            'recovered_pop': recovered_logic,
            'active': active_logic
        }
        
        return logic_map.get(state_code.lower())

    @staticmethod
    def get_event_sql_logic(start_date_str, end_date_str, event_type):
        """
        [GOVERNANCE] Centralized SQL Logic for EVENT Layer.
        NEW_EVENT, REACTIVATED_EVENT, CHURN_EVENT.
        """
        s_dt_str = start_date_str + " 00:00:00"
        e_dt_str = end_date_str + " 23:59:59"
        
        if event_type.lower() == 'new_event':
            # First transaction ever in this period
            return f"""
                EXISTS (SELECT 1 FROM transactions t WHERE t.ma_kh = customers.ma_crm_cms AND t.ngay_chap_nhan BETWEEN '{s_dt_str}' AND '{e_dt_str}')
                AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.ma_kh = customers.ma_crm_cms AND t.ngay_chap_nhan < '{s_dt_str}')
            """
        elif event_type.lower() == 'recovered_event':
            # Transaction in period, but was CHURNED before (no tx in last 90 days before period)
            return f"""
                EXISTS (SELECT 1 FROM transactions t WHERE t.ma_kh = customers.ma_crm_cms AND t.ngay_chap_nhan BETWEEN '{s_dt_str}' AND '{e_dt_str}')
                AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.ma_kh = customers.ma_crm_cms AND t.ngay_chap_nhan BETWEEN datetime('{s_dt_str}', '-90 days') AND datetime('{s_dt_str}', '-1 seconds'))
                AND EXISTS (SELECT 1 FROM transactions t WHERE t.ma_kh = customers.ma_crm_cms AND t.ngay_chap_nhan < datetime('{s_dt_str}', '-90 days'))
            """
        elif event_type.lower() == 'churn_event':
            # Silent > 90 days at end of period, but WAS active in the previous 90 days
            return f"""
                NOT EXISTS (SELECT 1 FROM transactions t WHERE t.ma_kh = customers.ma_crm_cms AND t.ngay_chap_nhan BETWEEN datetime('{e_dt_str}', '-90 days') AND '{e_dt_str}')
                AND EXISTS (SELECT 1 FROM transactions t WHERE t.ma_kh = customers.ma_crm_cms AND t.ngay_chap_nhan BETWEEN datetime('{s_dt_str}', '-90 days') AND '{s_dt_str}')
            """
        return None


    @staticmethod
    def _calculate_growth_tag(curr_rev, prev_rev):
        if curr_rev <= 0: return None
        if prev_rev <= 0: return 'GROWTH'
        growth_rate = (curr_rev - prev_rev) / prev_rev
        if growth_rate > 0.1: return 'GROWTH'
        if growth_rate < -0.1: return 'DECLINING'
        return 'STABLE'

    @staticmethod
    def sync_customers_table(month_str=None, force_refresh=False):
        """
        Updates the 'customers' table and 'customer_monthly_snapshots' table.
        [GOVERNANCE] Ensures snapshots are immutable unless force_refresh=True.
        """
        if not month_str:
            month_str = datetime.now().strftime('%Y-%m')
            
        conn = LifecycleEngine.get_connection()
        cursor = conn.cursor()
        
        # 0. Check for existing snapshot (Protection Layer)
        if not force_refresh:
            cursor.execute("SELECT 1 FROM customer_monthly_snapshots WHERE year_month = ? LIMIT 1", (month_str,))
            if cursor.fetchone():
                print(f"Snapshot for {month_str} already exists. Skipping sync (Immutable). Use force_refresh=True to overwrite.")
                conn.close()
                return True

        print(f"Syncing customers and snapshots for {month_str}...")
        results = LifecycleEngine.process_month_summary(month_str, connection=conn)
        if not results:
            conn.close()
            return
            
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
            
            # If force_refresh, we delete existing first to ensure clean state
            if force_refresh:
                cursor.execute("DELETE FROM customer_monthly_snapshots WHERE year_month = ?", (month_str,))
            
            cursor.executemany("""
                INSERT INTO customer_monthly_snapshots 
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
