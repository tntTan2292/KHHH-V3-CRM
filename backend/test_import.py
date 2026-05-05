import os
import sys

# Đảm bảo đường dẫn
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.database import engine, Base, SessionLocal
from app.routers.import_data import do_import, import_status
from app.models import Customer, Transaction

print("Khoi dong DB...")
Base.metadata.create_all(bind=engine)
db = SessionLocal()

print("Bat dau Import Process...")
do_import(db)

customers_count = db.query(Customer).count()
transactions_count = db.query(Transaction).count()
total_rev = sum([t.doanh_thu for t in db.query(Transaction).all() if t.doanh_thu])

print(f"[{import_status}]")
print(f"Total Customers: {customers_count}")
print(f"Total Transactions: {transactions_count}")
print(f"Total Revenue: {total_rev}")

print("Danh sach cac Dich Vu:")
services = set([t.ma_dv for t in db.query(Transaction).all()])
print(services)
