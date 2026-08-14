import sqlite3
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DB_PATH = os.path.join(PROJECT_ROOT, "data", "database", "khhh_v3.db")

def remediate_dates():
    if not os.path.exists(DB_PATH):
        logger.error(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    try:
        cur.execute("BEGIN TRANSACTION")

        # 1. Count target records before update
        cur.execute("""
            SELECT COUNT(*) 
            FROM transactions 
            WHERE source_folder = '20260810' AND ngay_chap_nhan >= '2026-10-01'
        """)
        count_before = cur.fetchone()[0]
        logger.info(f"Records to remediate (source_folder='20260810', ngay_chap_nhan >= 2026-10-01): {count_before}")

        if count_before > 0:
            # 2. Update '2026-10-08' -> '2026-08-10' for source_folder '20260810'
            cur.execute("""
                UPDATE transactions 
                SET ngay_chap_nhan = REPLACE(ngay_chap_nhan, '2026-10-08', '2026-08-10')
                WHERE source_folder = '20260810' AND ngay_chap_nhan >= '2026-10-01'
            """)
            updated_rows = cur.rowcount
            logger.info(f"Successfully updated {updated_rows} rows.")

        cur.execute("COMMIT")
        logger.info("Remediation transaction committed successfully.")

        # 3. Verification check
        cur.execute("SELECT MAX(ngay_chap_nhan) FROM transactions")
        max_all = cur.fetchone()[0]
        cur.execute("SELECT MAX(ngay_chap_nhan) FROM transactions WHERE ma_kh IS NOT NULL AND ma_kh != ''")
        max_valid = cur.fetchone()[0]

        logger.info(f"New overall MAX date in transactions: {max_all}")
        logger.info(f"New valid customer MAX date in transactions: {max_valid}")

    except Exception as e:
        cur.execute("ROLLBACK")
        logger.error(f"Error during remediation: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    remediate_dates()
