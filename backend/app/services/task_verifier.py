from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import datetime
from ..models import ActionTask, Transaction, Customer
import logging

logger = logging.getLogger(__name__)

class TaskVerifierService:
    @staticmethod
    def verify_all_pending_tasks(db: Session):
        """
        [GOVERNANCE] Thắt chặt đối soát B3:
        1. Kiểm tra sự tồn tại của Giao dịch (SSOT).
        2. Kiểm tra tính nhất quán về Quyền sở hữu (point_id).
        3. Khóa Attribution sau khi xác thực thành công.
        """
        pending_tasks = db.query(ActionTask).filter(
            ActionTask.trang_thai == "PENDING_VERIFY",
            ActionTask.converted_ma_kh.isnot(None)
        ).all()
        
        verified_count = 0
        conflict_count = 0
        
        for task in pending_tasks:
            # 1. Tìm giao dịch của mã CRM phát sinh SAU khi task được tạo
            match = db.query(Transaction).filter(
                Transaction.ma_kh == task.converted_ma_kh,
                Transaction.ngay_chap_nhan >= task.created_at
            ).order_by(Transaction.ngay_chap_nhan.asc()).first()
            
            if match:
                # [GOVERNANCE] Kiểm tra tính nhất quán Sở hữu (Ownership Consistency)
                # Đơn vị phát sinh giao dịch (match.point_id) phải khớp với Đơn vị giao việc (task.original_point_id)
                target_point_id = task.original_point_id
                
                # Nếu task không có original_point_id, lấy từ nhân viên được giao
                if not target_point_id and task.staff:
                    target_point_id = task.staff.point_id

                if target_point_id and match.point_id != target_point_id:
                    # 🔴 XUNG ĐỘT QUẢN TRỊ: Giao dịch phát sinh tại điểm khác với điểm khai thác Lead
                    error_msg = (
                        f"OWNERSHIP_MISMATCH: Task expects Point {target_point_id}, "
                        f"but Transaction occurred at Point {match.point_id} (Code {match.ma_dv_chap_nhan})."
                    )
                    logger.warning(f"⚠️ {error_msg} for CRM {task.converted_ma_kh}")
                    
                    task.trang_thai = "Tranh chấp sở hữu"
                    task.governance_notes = error_msg
                    conflict_count += 1
                    continue

                # 🏆 XÁC THỰC THÀNH CÔNG (B3)
                task.verified = True
                task.trang_thai = "Hoàn thành"
                task.pipeline_stage = "B3"
                task.updated_at = datetime.now()
                task.governance_notes = f"B3_VERIFIED: Transaction {match.shbg} matched at Point {target_point_id}."
                
                # 🔒 ATTRIBUTION LOCK & OWNERSHIP SYNC
                customer = db.query(Customer).filter(Customer.ma_crm_cms == task.converted_ma_kh).first()
                if customer:
                    # Gán nhân viên phụ trách nếu chưa có
                    if not customer.assigned_staff_id:
                        customer.assigned_staff_id = task.staff_id
                    
                    # Cập nhật/Khóa point_id chính thức cho khách hàng
                    if not customer.point_id or customer.point_id != target_point_id:
                        customer.point_id = target_point_id
                        customer.ma_bc_phu_trach = match.ma_dv_chap_nhan
                
                verified_count += 1
                logger.info(f"✅ Task {task.id} verified: B3 success for CRM {task.converted_ma_kh}")
        
        db.commit()
        return {"verified": verified_count, "conflicts": conflict_count}

    @staticmethod
    def auto_unlock_stale_tasks(db: Session, overdue_days: int = 3):
        """
        Giải phóng (Unlock) khách hàng nếu Task quá hạn mà không có cập nhật.
        Áp dụng cho Khách hiện hữu (Hard Lock).
        """
        from datetime import timedelta
        cutoff_date = datetime.now() - timedelta(days=overdue_days)
        
        # Tìm các Task Khách hiện hữu quá hạn deadline và không cập nhật lâu hơn cutoff_date
        stale_tasks = db.query(ActionTask).filter(
            ActionTask.loai_doi_tuong == "KhachHang",
            ActionTask.trang_thai.in_(["Mới", "Đang xử lý"]),
            ActionTask.deadline < datetime.now(),
            ActionTask.updated_at < cutoff_date
        ).all()
        
        unlocked_count = 0
        for task in stale_tasks:
            # Giải phóng khách hàng
            customer = db.query(Customer).filter(Customer.ma_crm_cms == task.target_id).first()
            if customer:
                customer.assigned_staff_id = None
                
            # Cập nhật trạng thái task
            task.trang_thai = "Quá hạn - Giải phóng"
            task.updated_at = datetime.now()
            unlocked_count += 1
            logger.info(f"🔓 Task {task.id} stale: Released customer {task.target_id}")
            
        db.commit()
        return unlocked_count

    @staticmethod
    def auto_promote_stages(db: Session):
        """
        (Nâng cao) Tự động đẩy Stage từ B3 -> B4 (Bùng nổ) 
        nếu doanh thu tích lũy đạt ngưỡng trong tháng.
        """
        # Logic này có thể triển khai sau để tối ưu performance
        pass
