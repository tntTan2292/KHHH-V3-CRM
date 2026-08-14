import asyncio
import sys
import os
import sqlite3

# Adjust path to import app
sys.path.append(r"d:\Antigravity - Project\KHHH - Antigravity - V3.0\backend")

from app.routers.import_data import sync_worker, import_status
from app.database import SessionLocal
from app.models import Transaction, SyncLog
from sqlalchemy import func

async def test_success_reimport():
    print("=== TEST 1: SUCCESS REIMPORT (Day: 20260503) ===")
    db = SessionLocal()
    old_count = db.query(Transaction).filter(func.strftime('%Y%m%d', Transaction.ngay_chap_nhan) == '20260503').count()
    old_rev = db.query(func.sum(Transaction.doanh_thu)).filter(func.strftime('%Y%m%d', Transaction.ngay_chap_nhan) == '20260503').scalar() or 0
    old_log = db.query(SyncLog).filter(SyncLog.folder_name == '20260503').first()
    print(f"[TRƯỚC] Count={old_count}, Rev={old_rev}, Log Status={old_log.status if old_log else 'NONE'}")
    db.close()
    
    await sync_worker(['20260503'])
    
    db = SessionLocal()
    new_count = db.query(Transaction).filter(func.strftime('%Y%m%d', Transaction.ngay_chap_nhan) == '20260503').count()
    new_rev = db.query(func.sum(Transaction.doanh_thu)).filter(func.strftime('%Y%m%d', Transaction.ngay_chap_nhan) == '20260503').scalar() or 0
    new_log = db.query(SyncLog).filter(SyncLog.folder_name == '20260503').first()
    print(f"[SAU] Count={new_count}, Rev={new_rev}, Log Status={new_log.status if new_log else 'NONE'}")
    db.close()
    print("--------------------------------------------------\n")

async def test_reject_reimport():
    print("=== TEST 2: REJECT REIMPORT (Day: 20260503 with fake inflated old data) ===")
    
    # Inflate old data by duplicating rows for 20260503
    db_path = r'd:\Antigravity - Project\KHHH - Antigravity - V3.0\data\database\khhh_v3.db'
    conn = sqlite3.connect(db_path)
    # create temp table and insert
    conn.execute("""
        INSERT INTO transactions (shbg, ma_dv, ma_dv_chap_nhan, username, ma_kh, ten_nguoi_gui, ngay_chap_nhan, doanh_thu, point_id, source_folder)
        SELECT shbg||'-FAKE', ma_dv, ma_dv_chap_nhan, username, ma_kh, ten_nguoi_gui, ngay_chap_nhan, doanh_thu, point_id, source_folder
        FROM transactions 
        WHERE strftime('%Y%m%d', ngay_chap_nhan) = '20260503'
    """)
    conn.commit()
    conn.close()
    
    db = SessionLocal()
    old_count = db.query(Transaction).filter(func.strftime('%Y%m%d', Transaction.ngay_chap_nhan) == '20260503').count()
    old_rev = db.query(func.sum(Transaction.doanh_thu)).filter(func.strftime('%Y%m%d', Transaction.ngay_chap_nhan) == '20260503').scalar() or 0
    
    # Change SyncLog status to simulated
    log = db.query(SyncLog).filter(SyncLog.folder_name == '20260503').first()
    log.status = 'MANUAL_INFLATED'
    db.commit()
    
    old_log = db.query(SyncLog).filter(SyncLog.folder_name == '20260503').first()
    print(f"[TRƯỚC REJECT] Count={old_count}, Rev={old_rev}, Log Status={old_log.status if old_log else 'NONE'}")
    db.close()
    
    # Run sync
    await sync_worker(['20260503'])
    
    db = SessionLocal()
    new_count = db.query(Transaction).filter(func.strftime('%Y%m%d', Transaction.ngay_chap_nhan) == '20260503').count()
    new_rev = db.query(func.sum(Transaction.doanh_thu)).filter(func.strftime('%Y%m%d', Transaction.ngay_chap_nhan) == '20260503').scalar() or 0
    new_log = db.query(SyncLog).filter(SyncLog.folder_name == '20260503').first()
    print(f"[SAU REJECT] Count={new_count}, Rev={new_rev}, Log Status={new_log.status if new_log else 'NONE'}")
    
    # Clean up fake data (only keep original rows without '-FAKE' in shbg)
    conn = sqlite3.connect(db_path)
    conn.execute("DELETE FROM transactions WHERE shbg LIKE '%-FAKE'")
    conn.commit()
    conn.close()
    db.close()
    print("--------------------------------------------------\n")

async def main():
    await test_success_reimport()
    await test_reject_reimport()

if __name__ == "__main__":
    asyncio.run(main())
