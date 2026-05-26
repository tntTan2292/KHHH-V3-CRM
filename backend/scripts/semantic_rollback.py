import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import NhanSu, HierarchyNode, User

def normalize_code(value):
    if not value: return None
    value = str(value).strip()
    if value.endswith(".0"): value = value[:-2]
    return value

db = SessionLocal()
nodes = {normalize_code(n.code): n for n in db.query(HierarchyNode).all() if normalize_code(n.code)}
staff = db.query(NhanSu).all()
anomalies = []

for s in staff:
    bc = normalize_code(s.ma_bc)
    dv = normalize_code(s.ma_don_vi)
    
    bc_node = nodes.get(bc)
    dv_node = nodes.get(dv)
    
    # Ưu tiên ma_bc
    expected_p = bc_node.id if bc_node else (dv_node.id if dv_node else None)
    
    if expected_p and s.point_id != expected_p:
        anomalies.append({
            "hr_id": s.hr_id,
            "full_name": s.full_name,
            "chuc_vu": s.chuc_vu,
            "current_point_id": s.point_id,
            "expected_point_id": expected_p,
            "ma_bc": bc,
            "ma_don_vi": dv
        })

print(f"Tổng số nhân sự sai lệch so với Rule Ưu tiên ma_bc: {len(anomalies)}")
for a in anomalies:
    print(f"{a['hr_id']} | {a['full_name']} | {a['ma_bc']} | {a['ma_don_vi']} | {a['current_point_id']} -> {a['expected_point_id']}")
