from fastapi import APIRouter, Depends, HTTPException, Query, Form
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from datetime import datetime
from ..database import get_db
from ..services.bot_service import EliteBotService
from ..models import User, ActionTask, Customer
from ..routers.auth import get_current_user

router = APIRouter(prefix="/api/bot", tags=["bot"])

@router.get("/latest-report")
async def get_latest_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy báo cáo sáng nay nhất (T-1)."""
    try:
        stats = EliteBotService.calculate_t1_stats(db)
        alerts = EliteBotService.detect_lifecycle_alerts(db)
        message = EliteBotService.format_morning_message(stats, alerts)
        
        return {
            "stats": stats,
            "alerts": alerts,
            "formatted_message": message
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi tạo báo cáo bot: {str(e)}")

@router.get("/quick-report/{task_id}", response_class=HTMLResponse)
async def quick_report(
    task_id: int,
    token: str,
    db: Session = Depends(get_db)
):
    """Hiển thị Form báo cáo nhanh từ Zalo (không cần login)."""
    # 1. Kiểm tra token (Enterprise Grade - HMAC Verify)
    if not EliteBotService.verify_task_token(task_id, token):
        return """
        <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #fff1f2;">
                <h2 style="color: #be123c;">❌ Liên kết không hợp lệ hoặc đã hết hạn</h2>
                <p>Vui lòng sử dụng liên kết mới nhất từ tin nhắn Zalo.</p>
            </body>
        </html>
        """

    # 2. Lấy thông tin task và khách hàng
    task = db.query(ActionTask).filter(ActionTask.id == task_id).first()
    if not task:
        return "<h2>Nhiệm vụ không tồn tại</h2>"
    
    customer = db.query(Customer).filter(Customer.ma_crm_cms == task.target_id).first()
    ten_kh = customer.ten_kh if customer else task.target_id

    return f"""
    <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <style>
                :root {{ --primary: #2563eb; --bg: #f8fafc; --card: #ffffff; --text: #1e293b; }}
                body {{ font-family: -apple-system, system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 20px; display: flex; justify-content: center; }}
                .card {{ background: var(--card); width: 100%; max-width: 400px; padding: 24px; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }}
                .header {{ text-align: center; margin-bottom: 24px; }}
                .header .icon {{ font-size: 40px; margin-bottom: 8px; }}
                .header h2 {{ margin: 0; color: var(--primary); font-size: 20px; }}
                .info-box {{ background: #eff6ff; padding: 12px; border-radius: 12px; margin-bottom: 20px; border: 1px dashed #bfdbfe; }}
                .info-label {{ font-size: 12px; color: #64748b; margin-bottom: 4px; }}
                .info-value {{ font-weight: bold; font-size: 16px; color: #1e3a8a; }}
                .form-group {{ margin-bottom: 20px; }}
                label {{ display: block; font-weight: 600; margin-bottom: 12px; font-size: 14px; }}
                .radio-group {{ display: flex; flex-direction: column; gap: 10px; }}
                .radio-item {{ display: flex; align-items: center; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; cursor: pointer; transition: all 0.2s; }}
                .radio-item:has(input:checked) {{ border-color: var(--primary); background: #f0f7ff; }}
                .radio-item input {{ margin-right: 12px; width: 18px; height: 18px; }}
                textarea {{ width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; box-sizing: border-box; font-family: inherit; font-size: 14px; min-height: 80px; resize: none; }}
                .btn-submit {{ background: var(--primary); color: white; width: 100%; padding: 14px; border: none; border-radius: 12px; font-weight: bold; font-size: 16px; cursor: pointer; transition: opacity 0.2s; margin-top: 10px; }}
                .footer {{ text-align: center; margin-top: 20px; font-size: 11px; color: #94a3b8; }}
            </style>
        </head>
        <body>
            <div class="card">
                <div class="header">
                    <div class="icon">📝</div>
                    <h2>Báo cáo Tiếp cận KH</h2>
                </div>
                
                <div class="info-box">
                    <div class="info-label">KHÁCH HÀNG:</div>
                    <div class="info-value">{ten_kh}</div>
                </div>

                <form action="/api/bot/quick-report-submit" method="POST">
                    <input type="hidden" name="task_id" value="{task_id}">
                    <input type="hidden" name="token" value="{token}">
                    
                    <div class="form-group">
                        <label>Kết quả tiếp cận:</label>
                        <div class="radio-group">
                            <label class="radio-item">
                                <input type="radio" name="result" value="tot" checked>
                                <span>🟢 Kết quả tốt (Sẽ gửi hàng)</span>
                            </label>
                            <label class="radio-item">
                                <input type="radio" name="result" value="binh_thuong">
                                <span>🟡 Bình thường (Đang theo dõi)</span>
                            </label>
                            <label class="radio-item">
                                <input type="radio" name="result" value="khong_tot">
                                <span>🔴 Không ổn (Cần hỗ trợ)</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Ghi chú chi tiết:</label>
                        <textarea name="note" placeholder="Nhập nội dung trao đổi với khách hàng..."></textarea>
                    </div>

                    <button type="submit" class="btn-submit">XÁC NHẬN BÁO CÁO</button>
                </form>
                
                <div class="footer">
                    Hệ thống CRM V3.0 - Biệt đội Antigravity 🚀
                </div>
            </div>
        </body>
    </html>
    """

@router.post("/quick-report-submit", response_class=HTMLResponse)
async def submit_quick_report(
    task_id: int = Form(...),
    token: str = Form(...),
    result: str = Form(...),
    note: str = Form(None),
    db: Session = Depends(get_db)
):
    """Xử lý nộp form báo cáo nhanh."""
    # 1. Kiểm tra token (Enterprise Grade - HMAC Verify)
    if not EliteBotService.verify_task_token(task_id, token):
        return "<h2>Lỗi xác thực dữ liệu hoặc liên kết hết hạn</h2>"

    # 2. Cập nhật task
    task = db.query(ActionTask).filter(ActionTask.id == task_id).first()
    if not task:
        return "<h2>Nhiệm vụ không tồn tại</h2>"

    res_map = {
        "tot": "🟢 Kết quả tốt (Sẽ gửi hàng lại)",
        "binh_thuong": "🟡 Bình thường (Đang theo dõi tiếp)",
        "khong_tot": "🔴 Không ổn (Khách phàn nàn/Cần hỗ trợ)"
    }
    
    task.trang_thai = "Hoàn thành"
    task.bao_cao_ket_qua = f"{res_map.get(result, 'Đã tiếp cận')}\nChi chú: {note if note else 'Không có'}"
    task.ngay_hoan_thanh = datetime.now()
    db.commit()

    return """
    <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #ecfdf5; color: #065f46; text-align: center; }
                .card { background: white; padding: 40px; border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); border: 2px solid #10b981; }
                h1 { margin: 0 0 10px 0; }
                .btn { background: #10b981; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; display: inline-block; margin-top: 20px; font-weight: bold; border: none; }
            </style>
        </head>
        <body>
            <div class="card">
                <div style="font-size: 50px; margin-bottom: 10px;">✅</div>
                <h1>THÀNH CÔNG!</h1>
                <p>Kết quả đã được cập nhật vào CRM.</p>
                <button onclick="window.close();" class="btn">Đóng trình duyệt</button>
            </div>
        </body>
    </html>
    """

@router.post("/trigger")
async def trigger_bot_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Kích hoạt chạy bot thủ công (Dành cho Admin)."""
    if current_user.role.name != "ADMIN":
        raise HTTPException(status_code=403, detail="Chỉ Admin mới có quyền kích hoạt Bot")
        
    stats = EliteBotService.calculate_t1_stats(db)
    alerts = EliteBotService.detect_lifecycle_alerts(db)
    message = EliteBotService.format_morning_message(stats, alerts)
    
    # Ở đây có thể tích hợp gửi Webhook nếu cần
    return {
        "status": "success",
        "message": "Báo cáo bot đã được tạo lại thành công",
        "report": {
            "stats": stats,
            "alerts": alerts,
            "formatted_message": message
        }
    }
