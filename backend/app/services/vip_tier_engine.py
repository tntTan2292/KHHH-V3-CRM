import sqlite3
import pandas as pd
from datetime import datetime, timedelta
import dateutil.relativedelta
import logging
import os
import calendar
from ..core.config_segments import *

logger = logging.getLogger(__name__)

class VIPTierEngine:
    PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    DB_PATH = os.path.join(PROJECT_ROOT, "data", "database", "khhh_v3.db")

    @staticmethod
    def get_connection():
        return sqlite3.connect(VIPTierEngine.DB_PATH, isolation_level=None)

    @staticmethod
    def process_vip_month(month_str):
        """
        Calculates VIP Tiers and Risk status for a given month.
        Used by SummaryService for SSOT synchronization.
        """
        conn = VIPTierEngine.get_connection()
        try:
            y, m = map(int, month_str.split('-'))
            
            # Rolling 3 months window (Current Month + 2 Previous Months)
            curr_month_start = f"{month_str}-01"
            rolling_start_dt = datetime(y, m, 1) - dateutil.relativedelta.relativedelta(months=2)
            rolling_start = rolling_start_dt.strftime('%Y-%m-01')
            
            # Window end
            last_day = calendar.monthrange(y, m)[1]
            rolling_end = f"{month_str}-{last_day} 23:59:59"

            # Previous rolling window (for momentum/risk detection)
            prev_rolling_start_dt = rolling_start_dt - dateutil.relativedelta.relativedelta(months=1)
            prev_rolling_end_dt = datetime(y, m, 1) - timedelta(seconds=1)
            prev_rolling_start = prev_rolling_start_dt.strftime('%Y-%m-01')
            prev_rolling_end = prev_rolling_end_dt.strftime('%Y-%m-%d %H:%M:%S')

            print(f"Engine: Calculating VIP for {month_str} (Window: {rolling_start} to {rolling_end})")

            # SQL for current rolling revenue
            sql_curr = """
            SELECT 
                ma_kh,
                SUM(doanh_thu) as rolling_rev,
                COUNT(id) as rolling_orders,
                MAX(point_id) as point_id
            FROM transactions
            WHERE ma_kh IS NOT NULL AND ma_kh != ''
              AND ngay_chap_nhan BETWEEN ? AND ?
            GROUP BY ma_kh
            ORDER BY rolling_rev DESC
            """
            df_curr = pd.read_sql_query(sql_curr, conn, params=(rolling_start, rolling_end))
            if df_curr.empty: return []

            # SQL for previous rolling revenue (benchmark)
            sql_prev = """
            SELECT ma_kh, SUM(doanh_thu) as prev_rolling_rev
            FROM transactions
            WHERE ma_kh IS NOT NULL AND ma_kh != ''
              AND ngay_chap_nhan BETWEEN ? AND ?
            GROUP BY ma_kh
            """
            df_prev = pd.read_sql_query(sql_prev, conn, params=(prev_rolling_start, prev_rolling_end))
            
            # Merge
            df = pd.merge(df_curr, df_prev, on='ma_kh', how='left').fillna(0)

            # Ranking Logic
            df['rank'] = range(1, len(df) + 1)
            
            def assign_tier(rank):
                if rank <= VIP_THRESHOLD_DIAMOND: return 'DIAMOND'
                if rank <= VIP_THRESHOLD_PLATINUM: return 'PLATINUM'
                if rank <= VIP_THRESHOLD_GOLD: return 'GOLD'
                if rank <= VIP_THRESHOLD_SILVER: return 'SILVER'
                if rank <= VIP_THRESHOLD_BRONZE: return 'BRONZE'
                return 'NORMAL'
            
            df['vip_tier'] = df['rank'].apply(assign_tier)

            # Risk/Momentum Detection
            def detect_risk(row):
                if row['vip_tier'] == 'NORMAL': return None
                if row['prev_rolling_rev'] > 0:
                    change = (row['rolling_rev'] - row['prev_rolling_rev']) / row['prev_rolling_rev']
                    if change < -0.3: return 'REVENUE_DROP'
                    if change > 0.3: return 'MOMENTUM'
                return 'STABLE'

            df['risk_status'] = df.apply(detect_risk, axis=1)

            # Fetch existing tiers for logging
            cursor = conn.cursor()
            cursor.execute("SELECT ma_crm_cms, vip_tier FROM customers")
            prev_db_tiers = {row[0]: row[1] for row in cursor.fetchall()}

            results = []
            for _, row in df.iterrows():
                ma_kh = row['ma_kh']
                new_tier = row['vip_tier']
                old_tier = prev_db_tiers.get(ma_kh, 'NORMAL')
                
                if old_tier != new_tier:
                    VIPTierEngine._log_transition(conn, ma_kh, old_tier, new_tier, f"Auto-recalc for {month_str}")
                
                results.append({
                    'ma_kh': ma_kh,
                    'point_id': int(row['point_id']),
                    'vip_tier': new_tier,
                    'risk_status': row['risk_status'],
                    'rolling_rev': row['rolling_rev'],
                    'rolling_orders': row['rolling_orders']
                })
            
            return results
        finally:
            conn.close()

    @staticmethod
    def sync_customers_table(month_str):
        """
        Updates the 'customers' table with the latest VIP Tier.
        """
        results = VIPTierEngine.process_vip_month(month_str)
        if not results: return
        
        conn = VIPTierEngine.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("BEGIN")
            cursor.execute("CREATE TEMP TABLE temp_vip (ma_kh TEXT, tier TEXT)")
            cursor.executemany(
                "INSERT INTO temp_vip VALUES (?, ?)",
                [(r['ma_kh'], r['vip_tier']) for r in results]
            )
            
            cursor.execute("""
                UPDATE customers 
                SET vip_tier = (SELECT tier FROM temp_vip WHERE temp_vip.ma_kh = customers.ma_crm_cms)
                WHERE ma_crm_cms IN (SELECT ma_kh FROM temp_vip)
            """)
            
            conn.execute("COMMIT")
            print(f"Successfully synced {len(results)} VIP Tiers to customers table.")
        except Exception as e:
            conn.execute("ROLLBACK")
            logger.error(f"Error syncing VIP Tiers: {e}")
        finally:
            conn.close()

    @staticmethod
    def _log_transition(conn, ma_kh, old_tier, new_tier, reason):
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO vip_logs (ma_kh, previous_tier, new_tier, trigger_reason, timestamp)
                VALUES (?, ?, ?, ?, datetime('now'))
            """, (ma_kh, old_tier, new_tier, reason))
        except Exception as e:
            logger.error(f"Error logging VIP transition for {ma_kh}: {e}")

if __name__ == "__main__":
    pass
