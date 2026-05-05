import datetime
import hashlib
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from ..models import Transaction, Customer, HierarchyNode, ActionTask, NhanSu

class EliteBotService:
    SECRET_KEY = "ELITE_ANTIGRAVITY_V3"

    @staticmethod
    def get_date_range(target_date: datetime.date):
        """Trả về start_datetime và end_datetime cho một ngày cụ thể."""
        start = datetime.datetime.combine(target_date, datetime.time.min)
        end = datetime.datetime.combine(target_date, datetime.time.max)
        return start, end

    @staticmethod
    def calculate_t1_stats(db: Session, target_date: datetime.date = None):
        """Tính toán thống kê doanh thu và sản lượng ngày T-1."""
        if not target_date:
            target_date = datetime.date.today() - datetime.timedelta(days=1)
            
        t1_start, t1_end = EliteBotService.get_date_range(target_date)
        t2_start, t2_end = EliteBotService.get_date_range(target_date - datetime.timedelta(days=1))

        # T-1 Stats
        t1_data = db.query(
            func.sum(Transaction.doanh_thu).label("revenue"),
            func.count(Transaction.id).label("orders")
        ).filter(and_(Transaction.ngay_chap_nhan >= t1_start, Transaction.ngay_chap_nhan <= t1_end)).first()

        # T-2 Stats (for growth)
        t2_data = db.query(
            func.sum(Transaction.doanh_thu).label("revenue"),
            func.count(Transaction.id).label("orders")
        ).filter(and_(Transaction.ngay_chap_nhan >= t2_start, Transaction.ngay_chap_nhan <= t2_end)).first()

        t1_rev = t1_data.revenue or 0
        t1_orders = t1_data.orders or 0
        t2_rev = t2_data.revenue or 0
        
        growth = 0
        if t2_rev > 0:
            growth = ((t1_rev - t2_rev) / t2_rev) * 100

        return {
            "date": target_date.strftime("%d/%m/%Y"),
            "revenue": t1_rev,
            "orders": t1_orders,
            "growth": growth,
            "is_up": growth >= 0
        }

    @staticmethod
    def generate_task_token(task_id: int):
        """Tạo token bảo mật đơn giản cho link 1 chạm."""
        return hashlib.md5(f"{task_id}:{EliteBotService.SECRET_KEY}".encode()).hexdigest()[:8]

    @staticmethod
    def detect_lifecycle_alerts(db: Session):
        """Phát hiện các thay đổi quan trọng về trạng thái khách hàng và tạo Task."""
        today = datetime.date.today()
        first_day_current = today.replace(day=1)
        
        # 3. Newly At-risk (Quá 15 ngày chưa có đơn mới)
        fifteen_days_ago = today - datetime.timedelta(days=15)
        
        # Tìm những khách hàng có đơn gần nhất trong khoảng từ 15 ngày đến 3 tháng trước
        # (Nếu quá 3 tháng thì đã thuộc nhóm Churn/Rời bỏ)
        three_months_ago = today - datetime.timedelta(days=90)
        
        at_risk_query = db.query(Transaction.ma_kh).group_by(Transaction.ma_kh).having(
            and_(
                func.max(Transaction.ngay_chap_nhan) <= fifteen_days_ago,
                func.max(Transaction.ngay_chap_nhan) >= three_months_ago
            )
        ).all()
        
        at_risk_ids = [r[0] for r in at_risk_query if r[0]]
        
        # Lấy top 5 khách hàng At-risk có doanh thu cao nhất tháng trước
        top_at_risk = db.query(Customer).filter(Customer.ma_crm_cms.in_(at_risk_ids[:1000])).order_by(Customer.tong_doanh_thu.desc()).limit(5).all()

        alerts = []
        for c in top_at_risk:
            # Kiểm tra xem đã có task cho khách hàng này trong tháng chưa
            existing_task = db.query(ActionTask).filter(
                and_(
                    ActionTask.target_id == c.ma_crm_cms,
                    ActionTask.phan_loai_giao_viec == "Giao Cảnh báo",
                    ActionTask.created_at >= first_day_current
                )
            ).first()

            if not existing_task:
                # Tạo Task tự động nếu chưa có
                # Tính số ngày ngừng gửi (Recency)
                last_order_date = db.query(func.max(Transaction.ngay_chap_nhan)).filter(Transaction.ma_kh == c.ma_crm_cms).scalar()
                days_since = (today - last_order_date.date()).days if last_order_date else 0
                last_order_str = last_order_date.strftime("%d/%m/%Y") if last_order_date else "N/A"

                new_task = ActionTask(
                    target_id=c.ma_crm_cms,
                    loai_doi_tuong="HienHuu",
                    phan_loai_giao_viec="Giao Cảnh báo",
                    staff_id=c.assigned_staff_id,
                    noi_dung=f"BOT CẢNH BÁO: Khách hàng '{c.ten_kh}' đã {days_since} ngày chưa phát sinh đơn mới (Lần cuối: {last_order_str}). Cần liên hệ cứu chữa gấp.",
                    trang_thai="Mới"
                )
                db.add(new_task)
                db.flush() # Để lấy ID
                task_id = new_task.id

                # Ghi Log cho BOT
                from ..models import SystemLog
                bot_log = SystemLog(
                    user_id=None, # BOT không có user_id
                    action="BOT_ASSIGN_TASK",
                    resource="HienHuu",
                    details=f"BOT tự động giao việc cảnh báo cho KH {c.ma_crm_cms} (Nhân sự ID {c.assigned_staff_id})",
                    ip_address="127.0.0.1"
                )
                db.add(bot_log)
            else:
                task_id = existing_task.id

            token = EliteBotService.generate_task_token(task_id)
            # URL sẽ là URL tuyệt đối của backend
            base_url = "http://localhost:8000" # Có thể cấu hình qua ENV
            report_url = f"{base_url}/api/bot/quick-report/{task_id}?token={token}"
            
            alerts.append({
                "ma_kh": c.ma_crm_cms,
                "ten_kh": c.ten_kh,
                "revenue": c.tong_doanh_thu,
                "task_id": task_id,
                "report_url": report_url
            })
        
        db.commit()

        return {
            "at_risk_count": len(at_risk_ids),
            "top_alerts": alerts
        }

    @staticmethod
    def format_morning_message(stats: dict, alerts: dict):
        """Tạo nội dung tin nhắn báo cáo sáng chuyên nghiệp với Link 1 chạm."""
        growth_icon = "📈" if stats['is_up'] else "📉"
        growth_text = f"+{stats['growth']:.1f}%" if stats['is_up'] else f"{stats['growth']:.1f}%"
        
        msg = f"🚀 *ELITE MORNING REPORT - {stats['date']}*\n"
        msg += f"━━━━━━━━━━━━━━━━━━━━━\n\n"
        
        msg += f"📊 *KẾT QUẢ KINH DOANH (T-1)*\n"
        msg += f"💰 Doanh thu: {stats['revenue']:,.0f} VNĐ\n"
        msg += f"📦 Sản lượng: {stats['orders']:,} đơn hàng\n"
        msg += f"{growth_icon} Tăng trưởng: {growth_text} (so với T-2)\n\n"
        
        msg += f"⚠️ *SỨC KHỎE HỆ THỐNG (LIFECYCLE)*\n"
        msg += f"🚩 Khách hàng Nguy cơ: {alerts['at_risk_count']:,} (Đã quá 15 ngày chưa gửi hàng)\n"
        
        if alerts['top_alerts']:
            msg += f"\n👉 *TOP KHÁCH HÀNG CẦN CỨU CHỮA:*\n"
            for i, c in enumerate(alerts['top_alerts'], 1):
                msg += f"   {i}. {c['ten_kh']} ({c['revenue']:,.0f}đ)\n"
                msg += f"      🔗 Báo cáo nhanh: {c['report_url']}\n"
        
        msg += f"\n━━━━━━━━━━━━━━━━━━━━━\n"
        msg += f"💡 *Gợi ý:* Nhân viên bấm vào link trên để báo cáo kết quả tiếp cận ngay từ Zalo.\n"
        msg += f"🚀 *Hệ thống CRM V3.0 - Biệt đội Antigravity*"
        
        return msg
