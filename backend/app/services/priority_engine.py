import sqlite3
import pandas as pd
from datetime import datetime, timedelta
import logging
import os
from ..core.config_segments import *

logger = logging.getLogger(__name__)

class PriorityEngine:
    PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    DB_PATH = os.path.join(PROJECT_ROOT, "data", "database", "khhh_v3.db")

    @staticmethod
    def get_connection():
        return sqlite3.connect(PriorityEngine.DB_PATH, isolation_level=None)

    @staticmethod
    def process_priority_month(month_str, lifecycle_results, vip_results):
        """
        Calculates Priority Scores and Levels based on Lifecycle and VIP results.
        Hybrid Model: Fixed Base + Dynamic Multipliers.
        """
        if not lifecycle_results or not vip_results:
            return []

        # Convert results to maps for fast lookup
        lc_map = {r['ma_kh']: r for r in lifecycle_results}
        vip_map = {r['ma_kh']: r for r in vip_results}
        
        all_ma_kh = set(lc_map.keys()) | set(vip_map.keys())
        
        # Get current DB states for transition logging
        conn = PriorityEngine.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT ma_crm_cms, priority_score, priority_level FROM customers")
        db_states = {row[0]: {'score': row[1], 'level': row[2]} for row in cursor.fetchall()}
        
        results = []
        for ma_kh in all_ma_kh:
            lc = lc_map.get(ma_kh, {})
            vip = vip_map.get(ma_kh, {})
            
            stage = lc.get('state', 'NEW')
            tier = vip.get('vip_tier', 'NORMAL')
            growth = lc.get('growth')
            risk = vip.get('risk_status')
            
            # 1. Base Score
            score = SCORE_VIP.get(tier, 0) + SCORE_LIFECYCLE.get(stage, 0)
            triggers = []
            
            # 2. Dynamic Factors
            # Revenue Drop (from VIP Engine)
            if risk == 'REVENUE_DROP':
                score += WEIGHT_REVENUE_DROP
                triggers.append('REVENUE_DROP')
            
            # VIP Downgrade Risk
            if tier != 'NORMAL' and risk == 'REVENUE_DROP':
                score += WEIGHT_VIP_DOWNGRADE_RISK
                triggers.append('VIP_DOWNGRADE_RISK')
                
            # Growth Momentum
            if growth == 'GROWTH':
                score += WEIGHT_GROWTH_MOMENTUM
                triggers.append('GROWTH_MOMENTUM')
                
            # At-Risk Aging (Approximate from lifecycle engine if needed, 
            # here we use stage and risk status)
            if stage == 'AT_RISK':
                score += WEIGHT_RISK_AGING
                triggers.append('AT_RISK_AGING')

            # Cap score at 100
            score = min(100, score)
            
            # 3. Determine Level
            if score >= PRIORITY_THRESHOLD_CRITICAL:
                level = 'CRITICAL'
            elif score >= PRIORITY_THRESHOLD_HIGH:
                level = 'HIGH'
            elif score >= PRIORITY_THRESHOLD_MEDIUM:
                level = 'MEDIUM'
            else:
                level = 'LOW'
                
            # 4. Recommendations
            esc_rec = None
            if level == 'CRITICAL':
                esc_rec = "Lãnh đạo BĐTP" if tier == 'DIAMOND' else "Giám đốc BCVH"
            elif level == 'HIGH':
                esc_rec = "Trưởng đại diện Cụm"
                
            # 5. Logging
            prev = db_states.get(ma_kh, {'score': 0, 'level': 'LOW'})
            if prev['level'] != level:
                PriorityEngine._log_transition(
                    conn, ma_kh, prev['score'], score, prev['level'], level, 
                    ", ".join(triggers) if triggers else "Auto-recalc"
                )
            
            results.append({
                'ma_kh': ma_kh,
                'point_id': lc.get('point_id') or vip.get('point_id'),
                'priority_score': score,
                'priority_level': level,
                'triggers': triggers,
                'escalation_recommendation': esc_rec
            })
            
        conn.close()
        return results

    @staticmethod
    def sync_customers_table(month_str, priority_results):
        """
        Updates the 'customers' table with calculated priority.
        """
        if not priority_results: return
        
        conn = PriorityEngine.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("BEGIN")
            cursor.execute("CREATE TEMP TABLE temp_priority (ma_kh TEXT, score INTEGER, level TEXT)")
            cursor.executemany(
                "INSERT INTO temp_priority VALUES (?, ?, ?)",
                [(r['ma_kh'], r['priority_score'], r['priority_level']) for r in priority_results]
            )
            
            cursor.execute("""
                UPDATE customers 
                SET priority_score = (SELECT score FROM temp_priority WHERE temp_priority.ma_kh = customers.ma_crm_cms),
                    priority_level = (SELECT level FROM temp_priority WHERE temp_priority.ma_kh = customers.ma_crm_cms)
                WHERE ma_crm_cms IN (SELECT ma_kh FROM temp_priority)
            """)
            
            conn.execute("COMMIT")
            print(f"Successfully synced {len(priority_results)} Priority records to customers table.")
        except Exception as e:
            conn.execute("ROLLBACK")
            logger.error(f"Error syncing Priority: {e}")
        finally:
            conn.close()

    @staticmethod
    def _log_transition(conn, ma_kh, old_score, new_score, old_level, new_level, reason):
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO priority_logs (ma_kh, previous_score, new_score, previous_level, new_level, trigger_reason, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            """, (ma_kh, old_score, new_score, old_level, new_level, reason))
        except Exception as e:
            logger.error(f"Error logging Priority transition for {ma_kh}: {e}")

if __name__ == "__main__":
    pass
