# PA3: SERVICE CLASSIFICATION MANAGEMENT REPORT

**Tình trạng:** HOÀN THÀNH (PASS UAT)
**Ngày cập nhật:** 23/06/2026

## 1. Classification Layer Architecture
Kiến trúc Phân loại Dịch vụ được thiết kế như một Layer trung gian (Middleware/Service) độc lập, hoạt động giữa lớp Dữ liệu thô (`Transactions`/`Customer`) và lớp Phân tích (`Summary Analytics`).
- **Nguồn chân lý (Source of Truth)**: Lưu trữ tập trung tại bảng `service_classification` trong Database.
- **Tính tự động hóa**: Các API Analytics (VD: Dashboard, Profiling) khi tính toán doanh thu tự động truy vấn từ điển classification này để gom nhóm dịch vụ thay vì hard-code trong mã nguồn.

## 2. Service Classification Dictionary (SSOT)
Hệ thống thiết lập một Từ điển Phân loại chuẩn mực (Single Source of Truth) hỗ trợ ánh xạ 1-N (1 Nhóm Dịch vụ chuẩn - N Dịch vụ thô).
Các nhóm dịch vụ cố định bao gồm:
- **TMĐT** (Thương mại điện tử)
- **HCC** (Hành chính công)
- **Truyền thống**
- **Quốc tế**
- **Khác**

Quy tắc thiết kế bảo đảm mọi tên dịch vụ thu thập từ hệ thống ngoài đều phải đi qua "Phễu" từ điển này để được gán đúng label.

## 3. Unknown Service Detection
- **Khái niệm**: Cơ chế tự động phát hiện các tên dịch vụ mới từ các giao dịch thô mà hệ thống chưa có luật ánh xạ.
- **Hoạt động**: Khi chạy luồng tổng hợp dữ liệu, nếu xuất hiện tên dịch vụ không tồn tại trong tập SSOT, hệ thống sẽ tự động tạo một bản ghi Dictionary mới với nhãn `Unknown` (Chưa phân loại) và ghi log cảnh báo.

## 4. Admin Classification Management
Mô đun quản lý danh mục (GUI) dành cho SuperAdmin:
- **Vị trí**: `/superadmin` -> **Classification Management**.
- **Tính năng**: 
  - Xem toàn bộ danh sách quy tắc mapping (Raw Service -> Standard Classification).
  - Lọc, tìm kiếm các dịch vụ đang ở trạng thái `Unknown`.
  - Cập nhật, sửa đổi, gán nhãn cho các dịch vụ mới phát sinh.
  - Xóa hoặc vô hiệu hóa các quy tắc không còn sử dụng.

## 5. Auto Backfill Workflow
- **Vấn đề**: Khi một dịch vụ `Unknown` được Admin gán nhãn lại thành `TMĐT` hoặc `HCC`, doanh thu lịch sử trước đó đã bị tổng hợp sai vào nhóm `Unknown`.
- **Giải pháp (Auto Backfill)**: Sau khi Admin thay đổi một quy tắc mapping, hệ thống tự động kích hoạt luồng Batch Processing ngầm (hoặc cung cấp công cụ Backfill trên giao diện) để cày lại toàn bộ giao dịch lịch sử chứa tên dịch vụ đó, sau đó tính toán và cập nhật lại dữ liệu vào các bảng Aggregation (như `MonthlyAnalyticsSummary`). Việc này đảm bảo tính nhất quán của báo cáo.

## 6. Dashboard Classification Analytics
- **Triển khai Widget**: Phát triển Shared Component `ClassificationDonutChart` tái sử dụng hoàn toàn logic tính toán và hiển thị.
- **Tính năng**: Biểu diễn cơ cấu doanh thu theo các nhóm dịch vụ SSOT dưới dạng Donut Chart và Legend List, hỗ trợ Tooltip, tính phần trăm tỷ trọng trực tiếp trên Backend hoặc Frontend qua prop `totalRevenue`.
- **Vị trí**: Màn hình chính Dashboard.

## 7. Customer Profile Classification Widget
- **Triển khai Modal Widget**: Tích hợp trực tiếp `ClassificationDonutChart` vào `CustomerProfileModal`.
- **Đồng bộ hóa (UI/UX SSOT)**: Chia sẻ 100% component code với Dashboard, không có tình trạng lặp code (DRY - Don't Repeat Yourself). Đảm bảo hiển thị nhất quán từ tỷ lệ khung hình, quy chuẩn màu sắc, định dạng số tiền và font chữ. Điều kiện hiển thị thông minh: Chỉ render khi `classifications` payload của khách hàng có dữ liệu hợp lệ.
