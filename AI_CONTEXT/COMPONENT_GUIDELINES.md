# 🧩 Component Guidelines

## Quy tắc Component
- **Khi nào tạo Component mới?**: Khi một khối UI được sử dụng ở 2 nơi trở lên, hoặc khi một khối UI (như KPI Card) làm file cha dài quá 200 dòng.
- **Khi nào tách Component?**: Khi file hiện tại vượt quá 500 dòng, hoặc khi logic render quá phức tạp khiến việc kiểm soát state khó khăn.
- **Tránh Giant Components**: Không nên để một file vượt quá 800-1000 dòng. Tách nhỏ thành các Sub-components.

## Quy chuẩn UI Components
- **KPI Card Standards**: Phải có Title, Value, So sánh (MoM/YoY), và Icon/Màu sắc chỉ báo (Xanh/Đỏ).
- **Chart Component Standards**: Hỗ trợ Loading State, Empty State, và Tooltip rõ ràng. Luôn responsive theo container.
- **Table Standards**: Phải có Sticky Header, hỗ trợ cuộn ngang (`overflow-x-auto`) cho mobile, và Pagination nếu dữ liệu lớn.

## Thiết kế Props & Responsive
- **Props Organization**: Đặt Props rõ ràng, ưu tiên dùng object destructuring. Tránh truyền Props quá 3 cấp (Prop Drilling).
- **Responsive Behavior**: Thiết kế mobile-first hoặc đảm bảo UI không vỡ khi resize. Dùng Flexbox/Grid chuẩn mực.
