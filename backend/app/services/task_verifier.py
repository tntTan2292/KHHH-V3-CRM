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
        Quét toàn bộ Task đang ở trạng thái PENDING_VERIFY để đối soát với Transaction thực tế.
        Nếu phát hiện có đơn hàng phát sinh sau ngày giao việc -> Xác thực thành công B3.
        """
        pending_tasks = db.query(ActionTask).filter(
            ActionTask.trang_thai == "PENDING_VERIFY",
            ActionTask.converted_ma_kh.isnot(None)
        ).all()
        
        verified_count = 0
        
        for task in pending_tasks:
            # 1. Tìm giao dịch của mã CRM này phát sinh SAU khi task được tạo
            # Chúng ta dùng ngày tạo task làm mốc bắt đầu
            
            # Match criteria:
            # - Đúng mã CRM (converted_ma_kh)
            # - Ngày chấp nhận >= Ngày tạo task
            
            match = db.query(Transaction).filter(
                Transaction.ma_kh == task.converted_ma_kh,
                Transaction.ngay_chap_nhan >= task.created_at
            ).first()
            
            if match:
                # 🏆 XÁC THỰC THÀNH CÔNG
                task.verified = True
                task.trang_thai = "Hoàn thành" # Hoặc giữ nguyên PENDING_VERIFY nhưng verified=True
                task.pipeline_stage = "B3"
                task.updated_at = datetime.now()
                
                # Cập nhật thông tin vào bảng Customer nếu chưa có staff phụ trách
                customer = db.query(Customer).filter(Customer.ma_crm_cms == task.converted_ma_kh).first()
                if customer and not customer.assigned_staff_id:
                    customer.assigned_staff_id = task.staff_id
                
                verified_count += 1
                logger.info(f"✅ Task {task.id} verified: CRM {task.converted_ma_kh} has transactions.")
        
        db.commit()
        return verified_count

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
