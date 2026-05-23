# ⚠️ Technical Debt

Các vấn đề kỹ thuật hiện tại cần được giải quyết trong tương lai:

- **Dashboard.jsx Monolithic**: File quá lớn (>1800 dòng), khó maintain, dễ gây conflict khi nhiều người cùng sửa.
- **Re-render Issues**: Một số thẻ KPI và Widget có dấu hiệu render lặp lại không cần thiết do trộn lẫn logic fetch data và UI layout.
- **Responsive Issues**: Các bảng dữ liệu (Heatmap) xử lý overflow-x chưa triệt để trên màn hình nhỏ. Các khối filter dễ bị xô lệch trên mobile.
- **UI Inconsistency**: Một số widget chưa đồng nhất về padding/margin gây mất cân đối thị giác.
- **Hardcoded Logic**: Một số logic format hoặc data fetching còn phụ thuộc lẫn nhau, thiếu tính linh hoạt.
