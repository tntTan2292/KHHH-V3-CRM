# FINAL DASHBOARD UI CONSISTENCY AUDIT

Bản Audit này được thực hiện sau khi hoàn tất Phase 3, nhằm rà soát toàn bộ Dashboard (`Dashboard.jsx` và các components liên quan) để phát hiện các tàn dư UI, nợ kỹ thuật (Technical Debt) và các điểm bất hợp lý cuối cùng trước khi chuyển sang tính năng mới.

## 1. REMAINING UI ISSUES (Các vấn đề UI còn tồn đọng)

| Khu vực / Component | Vấn đề phát hiện | Mức độ | Đề xuất khắc phục (Phase 4) |
| :--- | :--- | :---: | :--- |
| **Global Header (`Dashboard.jsx`)** | Vẫn sử dụng `font-black` và `tracking-tight` cho thẻ h2 "CRM 3.0 Dashboard" (Line 477). | Low | Đổi thành `font-bold tracking-wider` để đồng bộ với Phase 3. |
| **Heatmap Table Header (`Dashboard.jsx`)** | Các thẻ `<th>` đang dùng `font-black text-gray-500 uppercase tracking-widest`. | Medium | Đồng bộ với Phase 3D: `font-bold tracking-wider`. |
| **System Health Alert Banner** | Khối cảnh báo đỏ vẫn dùng `font-black uppercase tracking-widest`. | Low | Cập nhật thành `font-bold tracking-wider`. |
| **Heatmap Table Body** | Dữ liệu bảng (tên địa bàn, tỷ trọng, doanh thu) đang dùng `font-black` khiến bảng trông rất chật chội và lem nhem trên mobile. | High | Chuyển dữ liệu dòng thành `font-semibold` hoặc `font-medium`. |
| **Breadcrumb (Safe Header)** | Các nút breadcrumb dùng `text-[10px] font-black uppercase`. | Low | Đổi thành `font-bold`. |

## 2. TECHNICAL DEBT LEFTOVERS (Nợ kỹ thuật để lại)

- **Duplicated Inline Classes:** Quá nhiều chuỗi class bị lặp lại trong `Dashboard.jsx`. Ví dụ: `text-[11px] font-black text-gray-500 uppercase tracking-widest` xuất hiện ở 6 cột `<th>` của bảng Heatmap. 
- **Heatmap Component Size:** `Dashboard.jsx` đã giảm xuống 1349 dòng (từ 1800), nhưng riêng phần Heatmap (từ line 652 đến 800+) vẫn chiếm hơn 150 dòng logic render JSX phức tạp. Đã đến lúc xem xét bóc tách thành Component riêng (`HeatmapTable.jsx`).
- **Custom Tooltip Recharts:** Hàm `CustomTooltip` (Lines 64-97) dài và chứa nhiều inline style bóng đổ `shadow-2xl`, có thể tách riêng.

## 3. SAFE CLEANUP OPPORTUNITIES (Cơ hội dọn dẹp an toàn)

- **Typography Normalization for `Dashboard.jsx`:** Có thể chạy chuỗi Regex String Replace giống như đã làm ở Phase 3A để dọn sạch `font-black` và `tracking-widest` còn sót lại bên trong `Dashboard.jsx` mà không chạm tới Business Logic.
- **CSS Abstraction (Tùy chọn):** Di chuyển các class lặp lại (như label của bảng) vào `@layer components` trong `index.css` (Ví dụ: `.table-header-label`).

## 4. RECOMMENDED PHASE 4 DIRECTION (Định hướng Phase 4)

Dựa trên nguyên tắc An toàn tuyệt đối (Không đụng Backend, không đụng SWR, không đụng Logic), Phase 4 nên tập trung vào:

1. **PHASE 4A: Clean Up `Dashboard.jsx` Typography:** Đồng bộ hóa toàn bộ typography còn sót lại (Header, Breadcrumb, Table Header) theo chuẩn Phase 3.
2. **PHASE 4B: Heatmap UI Polish:** Làm "nhẹ" lại độ đậm của chữ trong bảng Heatmap để tạo cảm giác chuyên nghiệp (Data Density Optimization). Thêm `truncate` cho các tên địa bàn dài trong bảng.
3. **PHASE 4C: Heatmap Component Extraction:** Nếu được cho phép, bóc tách an toàn `HeatmapTable` ra khỏi `Dashboard.jsx` để giảm file này xuống dưới 1000 dòng.
