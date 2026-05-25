# SLA IMPLEMENTATION PLAN
*(Kế hoạch triển khai an toàn - SLA Phase 1)*

## TỔNG QUAN
Đây là kế hoạch tích hợp "SLA Nền tảng An toàn" dựa trên Hiến pháp đã khóa cứng. Hệ thống chỉ thực hiện công việc đo lường, cảnh báo, thống kê. TUYỆT ĐỐI không tự động hóa thay quyền định đoạt của con người (Leader).

---

## CÁC BƯỚC THỰC HIỆN (PHASE NHỎ)

### Phase 1.1: Database Patch & Overdue Engine
1. **Migration:**
   - Viết migration script thêm cột `overdue_at` vào bảng `action_tasks`.
2. **Overdue Service (Safe Version):**
   - Tạo class `SLAOverdueEngine` trong thư mục engines/services.
   - Viết hàm `scan_and_mark_overdue()`.
   - **Luật an toàn:** Chỉ đổi `trang_thai = 'OVERDUE'`, cập nhật `overdue_at`, ghi Log vào bảng `TaskStateLog`. Không đụng tới Owner.
3. **Rollback Safety:**
   - Nếu Engine chạy sai, ta chỉ cần set `trang_thai` của các task `overdue_at >= time_of_error` trở về trạng thái cũ dựa theo `TaskStateLog`.

### Phase 1.2: Dashboard API & KPI Metrics
1. **API Leader Dashboard:**
   - Cập nhật API `/summary` hoặc tạo endpoint mới `/sla-metrics`.
   - Thống kê: Tổng task Overdue hiện hành, tỷ lệ Overdue trên tổng task, top nhân sự quá hạn.
2. **SLA Query Optimization:**
   - Đảm bảo query lọc theo `scope_id` của Leader để chỉ thấy nhân viên dưới quyền.

### Phase 1.3: UI/UX Warning (Frontend)
1. **Action Center:**
   - Thay đổi màu viền, icon cho các Task mang trạng thái `OVERDUE` (Cảnh báo đỏ).
   - Card task quá hạn sẽ luôn nhảy lên ưu tiên hoặc có badge "⚠️ QUÁ HẠN".
2. **Dashboard Render:**
   - Dựng UI biểu đồ/bảng số liệu hiển thị KPI Quá hạn trên màn hình Dashboard của Leader.

---

## 🛑 CHECKLIST AN TOÀN TRƯỚC KHI DEPLOY
- [ ] Hàm quét Overdue KHÔNG được chứa bất kỳ lệnh gán `staff_id` hay `assigned_staff_id`.
- [ ] Không có cơ chế gửi tin nhắn rác (Zalo/Push/Email) trong hàm quét Overdue.
- [ ] Đã chạy script migration test trên môi trường staging trước.
- [ ] Các task lố hạn từ trước khi có luật này phải được chuyển đổi khéo léo để tránh làm vỡ Timeline (Ghi lý do là: "Áp dụng chính sách SLA 3.0").
