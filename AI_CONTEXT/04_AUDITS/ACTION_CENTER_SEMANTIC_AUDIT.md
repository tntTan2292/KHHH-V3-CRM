# ACTION CENTER SEMANTIC AUDIT REPORT

*Mục tiêu: Đánh giá và chuẩn hóa lại ngôn từ, ngữ nghĩa (semantic) của phân hệ Action Center, tách biệt hoàn toàn khỏi Lead Funnel / Sales Pipeline.*

## 1. Kết quả Rà soát (Audit Findings)

Những điểm sai lệch về mindset đã được phát hiện trong các tài liệu cũ:
- **Trộn lẫn 3 khái niệm:** Đã gộp chung "Customer Lifecycle", "Transaction Lead" và "Manual Lead" vào chung một mô hình Action Center (tại `TASK_LIFECYCLE_RULES.md`).
- **Sử dụng sai thuật ngữ bán hàng:** Dùng từ "Tiếp cận Lead", "Phễu bán hàng", "Chuyển đổi", "Pipeline", "Win rate", "Ownership chốt sale" cho tập Khách hàng hiện hữu.
- **Vai trò người dùng bị lệch:** Gọi nhân sự chăm sóc là "Sale/AM" thay vì "Nhân viên chăm sóc".

## 2. Phân Tách 3 Domain Dữ Liệu Rõ Ràng

Tài liệu đã được quy hoạch cứng theo 3 luồng riêng biệt:
1. **CUSTOMER LIFECYCLE DOMAIN**
   - Đối tượng: Khách hàng ĐÃ có mã KH chính thức và đã/đang đóng góp doanh thu.
   - Nơi xử lý: **Sử dụng Action Center hiện tại.**
2. **POTENTIAL LEAD DOMAIN**
   - Đối tượng: Lead chưa có mã nhưng đã phát sinh giao dịch thực tế.
   - Nơi xử lý: Sẽ có workflow riêng (Module chuyên trách tương lai).
3. **MARKET LEAD DOMAIN**
   - Đối tượng: Lead do nhân viên tự tìm kiếm đi thị trường, import tay.
   - Nơi xử lý: Sẽ có module Sales CRM riêng biệt.

## 3. Các File Đã Được Chuẩn Hóa Wording

1. `/Rules/CRM_WORKFLOW/TASK_LIFECYCLE_RULES.md`:
   - Gỡ bỏ hoàn toàn bảng mô tả "Transaction Lead" và "Manual Lead" ra khỏi phạm vi quy trình Action Center.
   - Cập nhật định nghĩa: "Action Center hiện tại CHỈ xử lý Domain số 1 (Customer Lifecycle)".
   - Xóa bỏ Task Type `LEAD_APPROACH` (vì nó thuộc về Sales CRM).
   - Đính chính ý nghĩa `Ownership` là Quyền chăm sóc khách hàng, không dính líu đến Hoa hồng bán hàng.

2. `/AI_CONTEXT/00_FOUNDATION/PROJECT_OVERVIEW.md`:
   - Đổi "Nhân Viên Kinh Doanh (Sale/AM)" thành "Nhân Viên Chăm sóc Khách hàng".
   - Tách "Lead Pipeline" ra khỏi Business Scope hiện tại của Action Center.
   - Xóa module ảo "Lead Tier & 5B Journey" thay bằng "Action Center".

*Tất cả các tài liệu trên đã được làm sạch và trở thành Nguồn luật chuẩn mực (Single Source of Truth) mới cho hệ thống.*
