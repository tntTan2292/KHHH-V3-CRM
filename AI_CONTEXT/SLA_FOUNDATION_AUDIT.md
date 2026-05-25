# SLA FOUNDATION AUDIT REPORT
*(Báo cáo Audit & Phân tích rủi ro trước khi triển khai SLA)*

## 1. CURRENT STRUCTURE (Hiện trạng Database & Logic)

**Bảng `action_tasks` hiện tại:**
- **Đã có:**
  - `deadline`: Hạn chót xử lý.
  - `ngay_hoan_thanh` (completed_at): Đã có, ghi nhận lúc Hoàn thành / Thất bại.
  - `trang_thai`: Đã có `OVERDUE` từ Phase Semantic Lockdown.
  - `sla_tracker_id`: Đã có cột liên kết với bảng SLA Tracking.
- **Đang thiếu:**
  - `assigned_at`: Chưa có mốc thời gian nhân viên ấn "Nhận việc" hoặc thời điểm task được giao rõ ràng ngoài `created_at`.
  - `overdue_at`: Chưa có thời điểm chính xác task bị hệ thống quét và gắn cờ Overdue.

**Luồng trạng thái hiện tại (Đã khóa chặt):**
- Mọi logic auto-unlock và auto-reassign khi quá hạn đã bị phế truất.
- Trạng thái `OVERDUE` chỉ đóng vai trò cảnh báo.

## 2. REQUIRED PATCH (Các thay đổi cần thiết)

**Database (Schema):**
- Thêm cột `overdue_at` (DateTime, nullable=True) vào `ActionTask` để phục vụ report dashboard chính xác (Leader có thể biết task đã lố hạn được bao lâu).
- Tận dụng `created_at` làm mốc giao việc (do đặc thù hệ thống tự động giao), hoặc bổ sung cột `assigned_at` nếu cần đo SLA phản hồi. Để an toàn (SAFE VERSION), ta sẽ chỉ thêm `overdue_at`.

**Backend Logic (Overdue Engine):**
- Tạo một Scheduled Job / Service Function an toàn để quét các task:
  - Điều kiện: `deadline < now` và `trang_thai` đang là `['Mới', 'Đang xử lý', 'CHỜ CHỈ ĐẠO']`.
  - Hành động: Cập nhật `trang_thai = "OVERDUE"`, `overdue_at = now`.
  - **TUYỆT ĐỐI KHÔNG:** Không chạm vào `staff_id`, không gán `assigned_staff_id = None`.

**Frontend (UI & Dashboard):**
- **Action Center:** Đảm bảo render nhãn đỏ (OVERDUE) sắc nét, disable một số thao tác nếu cần, nhưng nhân viên vẫn có thể Report hoặc xin Escalation.
- **Leader Dashboard:** Bổ sung Card "SLA Violated / Quá Hạn", đếm số task `OVERDUE` và xếp hạng nhân viên có tỷ lệ trễ hạn cao nhất.

## 3. MIGRATION NEED (Nhu cầu Migrate DB)

- Cần chạy một file migration (Alembic hoặc Script) nhỏ để `ALTER TABLE action_tasks ADD COLUMN overdue_at TIMESTAMP`.
- Cần chạy Data patch: Các task cũ nào có deadline trong quá khứ và chưa đóng thì cần set `trang_thai = 'OVERDUE'` hàng loạt (Nhưng giữ nguyên Owner).

## 4. RISK ANALYSIS (Phân tích Rủi ro)

| Rủi ro | Mức độ | Biện pháp phòng tránh (Safe Guard) |
| --- | --- | --- |
| **Bắn Notification Rác** | Trung bình | Phase này CẤM làm Notification Spam. Overdue engine chạy ngầm chỉ update status, không trigger push notification liên tục. Leader tự xem trên Dashboard. |
| **Unlock nhầm Khách Hàng** | Cao (Đã khóa) | Logic Engine bắt buộc phải dùng lệnh UPDATE chỉ định đúng các field (`trang_thai`, `overdue_at`), tuyệt đối cấm Engine import các module có logic đổi owner. |
| **KPI Punishment sai lệch** | Thấp | Hiện tại chỉ thống kê (Count/Rate), chưa trừ thẳng vào file lương hay cấu trúc thưởng, đảm bảo tính an toàn cho Phase 1. |
