# 📝 KHHH-V3-CRM CHANGELOG

Tất cả các thay đổi đáng chú ý của dự án sẽ được ghi lại trong tệp này. Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased] - Phase PA3: Service Classification Management
**Tình trạng:** Hoàn thành UAT (PASS)

### Added
- **Service Classification Dictionary (SSOT)**: Quản lý tập trung từ điển phân loại dịch vụ (TMĐT, HCC, Truyền thống, Quốc tế, Khác) trong database (`ServiceClassification` model).
- **Admin Classification Management**: Giao diện UI (`/superadmin` -> Classification Management) cho phép thêm, sửa, xóa, và map các tên dịch vụ thô vào các nhóm dịch vụ chuẩn.
- **Classification Layer Architecture**: Tích hợp lớp Phân loại Dịch vụ vào Backend, cung cấp API GET/POST/PUT/DELETE tại router `/analytics/classification-dict`.
- **Unknown Service Detection**: Hệ thống tự động nhận diện các dịch vụ chưa được map (`Unknown`) trong quá trình tính toán doanh thu (summary).
- **Auto Backfill Workflow**: Khi Admin cập nhật mapping mới cho nhóm `Unknown`, hệ thống tự động cung cấp công cụ Backfill để ánh xạ lại toàn bộ lịch sử giao dịch cũ và cập nhật bảng `MonthlyAnalyticsSummary`.
- **Dashboard Classification Analytics**: Bổ sung `ClassificationDonutChart` (Cơ cấu Nhóm Dịch vụ) vào màn hình Executive Dashboard với kiến trúc tái sử dụng (Shared Component).
- **Customer Profile Classification Widget**: Tích hợp Widget "Cơ cấu Nhóm Dịch vụ" vào Customer Profile Modal để cung cấp góc nhìn doanh thu theo dịch vụ chi tiết cho từng khách hàng.
- **UI/UX Refactoring**: Chuẩn hóa màu sắc (TMĐT: Green, HCC: Blue, Truyền thống: Orange, Quốc tế: Purple, Khác: Gray) và tối ưu hóa Legend layout sử dụng Tailwind CSS + Flexbox (Single Source of Truth).
