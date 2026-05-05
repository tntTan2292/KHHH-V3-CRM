import time
import datetime
import logging
import os
import sys

# Đảm bảo có thể import app module
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.append(PROJECT_ROOT)

LOG_DIR = os.path.join(PROJECT_ROOT, "data", "logs")
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR, exist_ok=True)

# Cấu hình logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] ELITE-BOT: %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(LOG_DIR, "bot_scheduler.log"), encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("EliteBot")

def run_bot_job():
    logger.info("⏰ Đang kích hoạt báo cáo sáng tự động...")
    try:
        from backend.app.database import SessionLocal
        from backend.app.services.bot_service import EliteBotService
        
        db = SessionLocal()
        try:
            stats = EliteBotService.calculate_t1_stats(db)
            alerts = EliteBotService.detect_lifecycle_alerts(db)
            message = EliteBotService.format_morning_message(stats, alerts)
            
            logger.info(f"✅ Báo cáo đã được tạo thành công cho ngày {stats['date']}")
            logger.info(f"💰 Doanh thu T-1: {stats['revenue']:,.0f} VNĐ")
            logger.info(f"🚩 Cảnh báo Nguy cơ: {alerts['at_risk_count']} khách hàng")
            
            # Lưu vết vào file report hàng ngày
            report_path = os.path.join(LOG_DIR, f"morning_report_{datetime.date.today().strftime('%Y%m%d')}.txt")
            with open(report_path, "w", encoding="utf-8") as f:
                f.write(message)
            
            logger.info(f"💾 Đã lưu bản sao báo cáo tại: {report_path}")
                
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"❌ Lỗi khi chạy bot: {str(e)}")

def main():
    logger.info("🚀 Elite Bot Scheduler đã khởi động...")
    logger.info(f"📂 Project Root: {PROJECT_ROOT}")
    
    last_run_date = None
    
    while True:
        now = datetime.datetime.now()
        current_date = now.date()
        
        # Kiểm tra nếu chưa chạy hôm nay và đã đến 08:30 sáng
        # Hoặc nếu chạy lần đầu mà đã qua 08:30 nhưng chưa có log báo cáo hôm nay (tùy chọn)
        if current_date != last_run_date and now.hour == 8 and now.minute == 30:
            run_bot_job()
            last_run_date = current_date
            
        # Nghỉ 30 giây rồi check tiếp
        time.sleep(30)

if __name__ == "__main__":
    main()
