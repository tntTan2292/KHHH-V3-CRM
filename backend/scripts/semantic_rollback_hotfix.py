import os
import sys
import argparse
import json
from datetime import datetime

# Thêm đường dẫn project vào sys.path để import được app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import NhanSu, HierarchyNode

# MAP CỐ ĐỊNH CHỈ DÙNG CHO 50 NHÂN SỰ BỊ MIGRATION SAI (TRÍCH TỪ LOG)
ROLLBACK_MAP = {
    "00214275": 163,
    "00062334": 162,
    "00098998": 56,
    "00062303": 53,
    "00062323": 55,
    "00264969": 111,
    "00270886": 112,
    "00242998": 116,
    "00062315": 115,
    "00062321": 113,
    "00062307": 107,
    "00062312": 110,
    "00247301": 109,
    "00258380": 108,
    "00102165": 128,
    "00062262": 126,
    "00214069": 131,
    "00062254": 117,
    "00062268": 119,
    "00062249": 118,
    "00062261": 120,
    "00062259": 121,
    "00062231": 124,
    "00258396": 122,
    "00062260": 123,
    "00249291": 127,
    "00239819": 130,
    "00062256": 132,
    "00270566": 129,
    "00062557": 170,
    "00243299": 170,
    "00252159": 170,
    "00258315": 170,
    "00262737": 170,
    "00062580": 170,
    "00263988": 170,
    "00267199": 170,
    "00062638": 170,
    "00062656": 170,
    "00223906": 170,
    "00245792": 170,
    "00248762": 170,
    "00061880": 1,
    "00061895": 1,
    "00061898": 1,
    "00061902": 1,
    "00061914": 1,
    "00086221": 8,
    "00062077": 6,
    "00061925": 9
}

def create_backup(db, backup_dir="backups"):
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)
        
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(backup_dir, f"semantic_backup_{timestamp}.json")
    
    try:
        staff_list = db.query(NhanSu).all()
        # Lấy tất cả user để map scope_node_id
        from app.models import User
        users = db.query(User).all()
        user_map = {u.nhan_su_id: u.scope_node_id for u in users if u.nhan_su_id}
        
        backup_data = []
        for s in staff_list:
            backup_data.append({
                "hr_id": s.hr_id,
                "point_id": s.point_id,
                "scope_node_id": user_map.get(s.id),
                "timestamp": timestamp
            })
            
        with open(backup_file, 'w', encoding='utf-8') as f:
            json.dump(backup_data, f, indent=2, ensure_ascii=False)
            
        print(f"[OK] Đã tạo file Backup: {backup_file} ({len(backup_data)} records)")
        return True
    except Exception as e:
        print(f"[FAIL] KHÔNG THỂ TẠO BACKUP: {e}")
        return False

def run_rollback(dry_run=True):
    print("==================================================")
    print("      CRITICAL INCIDENT - DATA ROLLBACK")
    print("==================================================")
    print(f"Mode: {'DRY RUN' if dry_run else 'EXECUTE TRANSACTION'}")
    
    db = SessionLocal()
    
    # 1. BẮT BUỘC BACKUP
    print("\n--- PHASE 1: BACKUP SNAPSHOT ---")
    if not create_backup(db):
        print("STOP TOÀN BỘ. BACKUP THẤT BẠI.")
        sys.exit(1)
        
    print("\n--- PHASE 2: FORENSIC AUDIT & VALIDATION ---")
    valid_node_ids = {n.id for n in db.query(HierarchyNode).all()}
    
    # Validation Tracking
    total_affected = len(ROLLBACK_MAP)
    missing_hr_ids = []
    invalid_target_nodes = []
    already_correct = 0
    duplicate_check = set()
    has_duplicates = False
    
    rollback_plan = []
    
    for hr_id, expected_old_point in ROLLBACK_MAP.items():
        if hr_id in duplicate_check:
            print(f"[ERROR] Phát hiện trùng lặp mapping cho HR_ID: {hr_id}")
            has_duplicates = True
        duplicate_check.add(hr_id)
        
        staff = db.query(NhanSu).filter(NhanSu.hr_id == hr_id).first()
        if not staff:
            missing_hr_ids.append(hr_id)
            continue
            
        if expected_old_point not in valid_node_ids:
            invalid_target_nodes.append((hr_id, expected_old_point))
            continue
            
        if staff.point_id == expected_old_point:
            already_correct += 1
            status = "UNCHANGED (ALREADY CORRECT)"
        else:
            status = "PENDING ROLLBACK"
            
        rollback_plan.append({
            "staff": staff,
            "hr_id": hr_id,
            "full_name": staff.full_name,
            "current_point_id": staff.point_id,
            "rollback_to_point_id": expected_old_point,
            "status": status
        })

    # DRY-RUN REPORT
    print("\n=== DRY-RUN REPORT ===")
    print(f"- Total Affected Target (Từ Map): {total_affected}")
    print(f"- Missing HR_IDs: {len(missing_hr_ids)}")
    print(f"- Invalid Target Nodes: {len(invalid_target_nodes)}")
    print(f"- Duplicate Mappings: {'YES' if has_duplicates else 'NO'}")
    print(f"- Unchanged (Đã đúng sẵn): {already_correct}")
    print(f"- Sẽ cập nhật: {len(rollback_plan) - already_correct}")
    
    print("\nChi tiết Mapping:")
    print("-" * 100)
    print(f"{'HR_ID':<10} | {'HỌ VÀ TÊN':<30} | {'HIỆN TẠI':<10} | {'SẼ ROLLBACK':<15} | {'STATUS':<20}")
    print("-" * 100)
    for p in rollback_plan:
        print(f"{p['hr_id']:<10} | {p['full_name']:<30} | {str(p['current_point_id']):<10} | {str(p['rollback_to_point_id']):<15} | {p['status']:<20}")
        
    # Export dry-run reports
    report_data = {
        "summary": {
            "total_affected": total_affected,
            "missing_hr_ids": len(missing_hr_ids),
            "invalid_target_nodes": len(invalid_target_nodes),
            "duplicate_mappings": has_duplicates,
            "already_correct": already_correct,
            "pending_updates": len(rollback_plan) - already_correct
        },
        "details": [
            {
                "hr_id": p['hr_id'],
                "full_name": p['full_name'],
                "current_point_id": p['current_point_id'],
                "rollback_to_point_id": p['rollback_to_point_id'],
                "status": p['status']
            } for p in rollback_plan
        ]
    }
    
    with open("rollback_preview_report.json", "w", encoding="utf-8") as f:
        json.dump(report_data, f, ensure_ascii=False, indent=2)
        
    with open("rollback_preview_report.md", "w", encoding="utf-8") as f:
        f.write("# ROLLBACK PREVIEW REPORT\n\n")
        f.write(f"- Total Affected: {total_affected}\n")
        f.write(f"- Missing: {len(missing_hr_ids)}\n")
        f.write(f"- Invalid Targets: {len(invalid_target_nodes)}\n")
        f.write(f"- Duplicates: {'YES' if has_duplicates else 'NO'}\n")
        f.write(f"- Unchanged: {already_correct}\n")
        f.write(f"- Pending Updates: {len(rollback_plan) - already_correct}\n\n")
        f.write("| HR_ID | HỌ VÀ TÊN | HIỆN TẠI | SẼ ROLLBACK | STATUS |\n")
        f.write("|---|---|---|---|---|\n")
        for p in rollback_plan:
            f.write(f"| {p['hr_id']} | {p['full_name']} | {p['current_point_id']} | {p['rollback_to_point_id']} | {p['status']} |\n")
            
    print("\n[OK] Đã xuất báo cáo ra rollback_preview_report.json và rollback_preview_report.md")

    # HARD STOP CONDITIONS
    print("\n--- PHASE 3: HARD STOP EVALUATION ---")
    if has_duplicates or missing_hr_ids or invalid_target_nodes:
        print("[CRITICAL ERROR] Phát hiện lỗi vi phạm tính toàn vẹn dữ liệu!")
        if has_duplicates: print("  -> Có mapping trùng lặp.")
        if missing_hr_ids: print(f"  -> Không tìm thấy nhân sự: {missing_hr_ids}")
        if invalid_target_nodes: print(f"  -> Target Node không tồn tại: {invalid_target_nodes}")
        print("\n=> HARD STOP KÍCH HOẠT. HỦY TOÀN BỘ QUÁ TRÌNH.")
        db.close()
        sys.exit(1)
        
    print("[PASS] Không phát hiện lỗi nghiêm trọng.")
    
    # TRANSACTION SAFETY
    if not dry_run:
        print("\n--- PHASE 4: EXECUTE TRANSACTION ---")
        try:
            print("Bắt đầu DB Transaction...")
            count_updated = 0
            for p in rollback_plan:
                if p['current_point_id'] != p['rollback_to_point_id']:
                    p['staff'].point_id = p['rollback_to_point_id']
                    count_updated += 1
            
            print(f"Đã cập nhật {count_updated} bản ghi trên RAM.")
            print("Chuẩn bị Commit...")
            db.commit()
            print("=> COMMIT THÀNH CÔNG. DỮ LIỆU ĐÃ ĐƯỢC PHỤC HỒI!")
        except Exception as e:
            print(f"\n[CRITICAL ERROR TRONG TRANSACTION]: {e}")
            print("=> ROLLBACK TOÀN BỘ TRANSACTION...")
            db.rollback()
            print("Giao dịch đã bị hủy. Dữ liệu an toàn.")
            sys.exit(1)
        finally:
            db.close()
    else:
        print("\n(DRY RUN HOÀN TẤT. KHÔNG UPDATE DATABASE.)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    
    run_rollback(dry_run=not args.execute)
