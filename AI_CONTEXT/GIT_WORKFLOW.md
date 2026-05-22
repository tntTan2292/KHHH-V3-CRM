# 🐙 Git Workflow & Refactor

## Nguyên tắc Commit
- **Commit Naming**: Sử dụng Conventional Commits:
  - `feat: [mô tả]` (Tính năng mới)
  - `fix: [mô tả]` (Sửa lỗi)
  - `docs: [mô tả]` (Cập nhật tài liệu)
  - `refactor: [mô tả]` (Cải tiến code không đổi logic)
  - `chore: [mô tả]` (Việc linh tinh, update package)
- **Refactor Commit Examples**:
  - `refactor: extract ElitePulse into separate widget component`
  - `refactor: optimize rendering loop in Heatmap table`

## Quy trình an toàn (Safe Workflow)
- **Branch Naming**: Đặt tên nhánh theo cấu trúc `type/feature-name` (e.g., `feat/lead-tier-engine`, `fix/table-overflow`).
- **Small Incremental Commits**: Commit từng cục nhỏ, hoạt động được. Tránh việc code 3 ngày rồi gom vào 1 commit khổng lồ.
- **Tuyệt đối không Massive Rewrite**: Trừ khi có Task yêu cầu đập đi xây lại, nếu không AI/Developer chỉ được refactor cục bộ khu vực mình đang sửa.
- **Test trước khi Push**: Đảm bảo code chạy được, không lỗi build trước khi đẩy lên.
