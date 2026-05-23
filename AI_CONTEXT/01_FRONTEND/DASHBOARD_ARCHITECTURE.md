# 🏗️ Dashboard Architecture

## Triết lý thiết kế (Layout Philosophy)
- Dashboard của CRM 3.0 không phải là trang báo cáo tĩnh, mà là **Trung tâm điều hành (Executive Command Center)**.
- Giao diện phải mang tính hành động cao (Actionable). Nhìn là biết ngay chỗ nào đang có vấn đề.

## Kiến trúc tương lai
- **Widget/Module Based**: Dashboard nên được tổ chức dưới dạng các Widget độc lập. Mỗi Widget tự chịu trách nhiệm fetch và render dữ liệu của nó (VD: `ElitePulseWidget`, `PopulationWidget`).
- **Realtime Section**: Dành khu vực trang trọng nhất (thường ở trên cùng) cho các cảnh báo nóng và số liệu Realtime (Bot Alert, Elite Pulse).
- **KPI Hierarchy**: Số to, cảnh báo đỏ ở trên. Bảng biểu chi tiết, xu hướng dài hạn ở dưới.

## Drilldown Flow
- Mọi con số KPI trên Dashboard không đứng một mình. Người dùng phải có khả năng **Click** vào con số đó để Drill-down (đi sâu) xuống danh sách chi tiết (Customer List) nhằm ra quyết định.
