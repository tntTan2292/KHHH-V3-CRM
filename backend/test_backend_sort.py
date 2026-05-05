import os
from sqlalchemy import create_engine, func, text, desc, or_
from sqlalchemy.orm import sessionmaker
from app.models import Customer, Transaction

DB_URL = "sqlite:///data/khhh.db"
engine = create_engine(DB_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

def test_sorting():
    # Armored Logic
    rev_sub = db.query(
        func.trim(Transaction.ma_kh).label("ma_kh_trimmed"),
        func.sum(Transaction.doanh_thu).label("period_revenue")
    ).group_by(func.trim(Transaction.ma_kh)).subquery()

    dynamic_revenue = func.coalesce(rev_sub.c.period_revenue, 0.0).label("dynamic_revenue")

    sub_query = db.query(Customer.id.label("cid"), dynamic_revenue).outerjoin(
        rev_sub, 
        func.trim(Customer.ma_crm_cms) == rev_sub.c.ma_kh_trimmed
    ).subquery()

    query = db.query(Customer, sub_query.c.dynamic_revenue).join(
        sub_query, Customer.id == sub_query.c.cid
    ).order_by(text("dynamic_revenue DESC"))

    results = query.limit(10).all()
    
    with open("sort_results_v3.txt", "w", encoding="utf-8") as f:
        f.write(f"{'Mã CRM':<15} | {'Tên KH':<25} | {'Doanh thu':<15}\n")
        f.write("-" * 60 + "\n")
        for cust, rev in results:
            f.write(f"{cust.ma_crm_cms:<15} | {cust.ten_kh[:25]:<25} | {rev:>15,.0f} VND\n")

if __name__ == "__main__":
    test_sorting()
    db.close()
