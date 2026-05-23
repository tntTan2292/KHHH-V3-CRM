# 🛠️ Development Conventions

## Nguyên tắc tổ chức code
- **Naming Convention**: 
  - File/Component: PascalCase (e.g., `DashboardWidget.jsx`).
  - Hàm/Biến: camelCase (e.g., `fetchDashboardData()`).
  - Hằng số: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_COUNT`).
- **Folder Convention**: Phân tách rõ ràng theo tính năng (e.g., `/components`, `/pages`, `/services`, `/hooks`).
- **Component Structure**: Mỗi file component chỉ chứa 1 component chính. Tách logic lấy dữ liệu (Hooks) ra khỏi UI (View).
- **Service & Hook Naming**: 
  - Service file: `[name]_service.js` / `[name]_service.py`.
  - Custom React Hooks: Bắt đầu bằng `use` (e.g., `useCustomers.js`).
- **API Naming**: RESTful chuẩn mực, ưu tiên danh từ số nhiều (e.g., `/api/customers/`).

## Tư duy lập trình
- **Không Hardcode**: Tránh hardcode các con số logic (như mốc 30/90 ngày) trực tiếp vào UI. Hãy lấy từ config hoặc constants.
- **Reusable-first**: Luôn tự hỏi "Component này có thể tái sử dụng không?" trước khi viết mới.
- **Incremental Refactor**: Cải thiện code từng bước nhỏ qua mỗi ticket, không "đập đi xây lại" (rewrite massive) nếu chưa được duyệt.
