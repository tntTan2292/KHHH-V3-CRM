# 📊 KPI & Lifecycle Definitions (SSOT)

Hệ thống quản lý 5 trạng thái vòng đời khách hàng (Mutually Exclusive Population States) bao phủ 100% Customer Universe.

## Lifecycle States
1. **New (Mới)**: Khách hàng có đơn hàng đầu tiên (trong 3 tháng đầu).
2. **Active (Hiện hữu)**: Tệp nòng cốt, duy trì giao dịch ổn định.
3. **At Risk (Nguy cơ)**: Khách hàng có dấu hiệu rớt. **(Luật cố định: Inactive > 30 days)**.
4. **Churn (Rời bỏ)**: Khách hàng chính thức rời bỏ. **(Luật cố định: Inactive > 90 days)**.
5. **Reactivated (Tái bản)**: Tệp khách hàng cũ quay lại giao dịch.

*Lưu ý: Các mốc 30/90 ngày là luật Hiến pháp (Constitution Rule), tuyệt đối không được AI tự ý thay đổi khi refactor.*

## Core KPIs
- **Revenue (Doanh thu)**: Tổng doanh thu phát sinh từ khách hàng.
- **Retention Rate**: Tỷ lệ giữ chân khách hàng Active.
- **Growth (MoM/YoY)**: Tốc độ tăng trưởng so với tháng trước/năm trước.
