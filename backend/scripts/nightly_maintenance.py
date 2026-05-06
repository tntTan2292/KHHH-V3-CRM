import sys
import os
import sqlite3
import logging
from datetime import datetime

# Add project root to path
sys.path.append(r"d:\Antigravity - Project\KHHH - Antigravity - V3.0")

from backend.app.services.summary_service import SummaryService

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def run_nightly_maintenance():
    logger.info("Starting nightly maintenance...")
    
    # 1. Cleanup expired tokens
    try:
        logger.info("Cleaning up expired tokens...")
        SummaryService.cleanup_expired_tokens()
    except Exception as e:
        logger.error(f"Error cleaning up tokens: {e}")
        
    # 2. Database VACUUM (Optimization)
    try:
        logger.info("Optimizing database (VACUUM & PRAGMA optimize)...")
        conn = sqlite3.connect(SummaryService.DB_PATH)
        conn.execute("VACUUM")
        conn.execute("PRAGMA optimize")
        conn.close()
        logger.info("Database optimization completed.")
    except Exception as e:
        logger.error(f"Error optimizing database: {e}")
        
    logger.info("Nightly maintenance finished.")

if __name__ == "__main__":
    run_nightly_maintenance()
