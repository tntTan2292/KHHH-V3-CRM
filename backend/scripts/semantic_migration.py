import os
import sys
import argparse

# Thêm đường dẫn project vào sys.path để import được app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import NhanSu, HierarchyNode, User

def normalize_code(value):
    if not value:
        return None
    value = str(value).strip()
    if value.endswith(".0"):
        value = value[:-2]
    return value

def run_migration(dry_run=True):
    db = SessionLocal()
    print(f"=== SEMANTIC MIGRATION SCRIPT ===")
    print(f"Mode: {'DRY RUN' if dry_run else 'EXECUTE'}")
    
    nodes = db.query(HierarchyNode).all()
    node_map = {normalize_code(n.code): n.id for n in nodes if normalize_code(n.code)}
    
    staff_list = db.query(NhanSu).all()
    
    anomalies = []
    orphan_nodes = []
    missing_mappings = []
    
    for staff in staff_list:
        ma_don_vi = normalize_code(staff.ma_don_vi)
        if not ma_don_vi:
            continue
            
        expected_point_id = node_map.get(ma_don_vi)
        
        if not expected_point_id:
            missing_mappings.append(f"Staff {staff.hr_id} ({staff.full_name}): ma_don_vi '{ma_don_vi}' không có trong HierarchyNode.")
            continue
            
        if staff.point_id != expected_point_id:
            user = db.query(User).filter(User.nhan_su_id == staff.id).first()
            old_scope = user.scope_node_id if user else None
            
            anomaly = {
                "staff": staff,
                "old_point_id": staff.point_id,
                "new_point_id": expected_point_id,
                "user": user,
                "old_scope": old_scope,
                "new_scope": old_scope # Giữ nguyên scope
            }
            anomalies.append(anomaly)
            
    print(f"\n--- TÌNH TRẠNG DỮ LIỆU ---")
    print(f"Missing Mappings (ma_don_vi không tồn tại trên cây): {len(missing_mappings)}")
    for m in missing_mappings[:10]:
        print(f"  - {m}")
    if len(missing_mappings) > 10:
        print("  ... (còn tiếp)")
        
    print(f"\nCần Migrate (point_id sai lệch so với ma_don_vi): {len(anomalies)}")
    
    for a in anomalies:
        s = a['staff']
        print(f"  [{s.hr_id}] {s.full_name} ({s.chuc_vu})")
        print(f"      - Point ID (Nơi công tác): {a['old_point_id']} -> {a['new_point_id']}")
        print(f"      - Scope Node ID (Quyền xem): {a['old_scope']} -> {a['new_scope']} (Giữ nguyên)")
        
        if not dry_run:
            s.point_id = a['new_point_id']
            # User scope remains untouched
            
    if not dry_run:
        print("\nĐang lưu thay đổi vào Database...")
        db.commit()
        print("Đã hoàn tất Migration!")
    else:
        print("\n(DRY RUN HOÀN TẤT. KHÔNG CÓ DỮ LIỆU NÀO BỊ THAY ĐỔI)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Semantic Migration for NhanSu")
    parser.add_argument("--execute", action="store_true", help="Chạy thật và lưu vào DB")
    args = parser.parse_args()
    
    run_migration(dry_run=not args.execute)
