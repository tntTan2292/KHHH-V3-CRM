# 📁 Important Files

Danh sách các tệp tin quan trọng mang tính sống còn của hệ thống:

## Vùng Nguy Hiểm (Không nên sửa bừa)
- **`backend/app/services/lifecycle_engine.py`**: Chứa logic phân loại Vòng đời cốt lõi. Bất kỳ sai sót nào sẽ làm sai lệch tập dữ liệu toàn tỉnh.
- **`backend/app/services/scoping_service.py`**: Xử lý phân quyền 5 cấp. Rất dễ gây lộ lọt dữ liệu nếu chạm vào mà không test kỹ.
- **`backend/app/services/summary_service.py`**: Build bảng Summary từ Transactions. Nặng về tính toán.

## Vùng Trọng Tâm UI
- **`src/pages/Dashboard.jsx`**: Trái tim UI của hệ thống, chứa toàn bộ logic hiển thị chỉ số vĩ mô (Hiện đang là Technical Debt cần đập nhỏ).
- **`src/pages/Customers.jsx`**: Lưới dữ liệu chi tiết khách hàng và logic Drill-down.

## Vùng API
- **`backend/app/routers/analytics.py`**: API cấp số liệu cho Dashboard (Summary, Trends, Heatmap).
