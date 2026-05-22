# PHASE 5.5 — OPERATIONAL UX AUDIT

## 1. Mục tiêu Audit
Đánh giá trải nghiệm người dùng (UX) và luồng công việc (Workflow) của nhân viên/quản lý vận hành khi sử dụng Dashboard hàng ngày. Trọng tâm: Tốc độ, độ rõ ràng, và tính thực thi (Actionability).

## 2. Điểm nghẽn UX (Pain Points) & Nút thắt Workflow
Dựa trên phân tích mã nguồn và luồng thao tác hiện tại:

- **[Friction 1] Thiếu công cụ tìm kiếm nhanh (Quick Search):** Heatmap hiện tại chỉ lọc được theo 4 trạng thái chiến lược. Nếu quản lý muốn tìm nhanh "Bưu điện huyện Phú Lộc", họ phải tự cuộn và tìm bằng mắt. Đây là một điểm nghẽn lớn trong vận hành hàng ngày.
- **[Friction 2] Cột "Thao tác" trên Heatmap quá nghèo nàn:** Hiện tại khi click vào một dòng, hệ thống chỉ Drill-down (đi xuống cấp con). Không có các thao tác nhanh (Quick Actions) như: Sao chép ID đơn vị, Xem nhanh báo cáo chi tiết, hay Gắn cờ cảnh báo.
- **[Friction 3] Đứt gãy luồng "Khách hàng rời bỏ":** Báo cáo AI chỉ ra có "10 KH nguy cơ rời bỏ", nhưng quản lý không thể click vào để xem danh sách 10 KH đó là ai. Điều này làm giảm giá trị thực tiễn của AI Insight.
- **[Friction 4] Chuyển đổi giữa các đơn vị ngang cấp khó khăn:** Breadcrumb (Quay lại) rất tốt, nhưng để xem đơn vị ngang cấp, quản lý phải Bấm quay lại -> Tìm trong danh sách -> Click vào đơn vị mới.

## 3. Các cải tiến High-Value / Low-Risk

- **Thêm thanh tìm kiếm (Search Bar) vào Heatmap:** Chỉ cần lọc chuỗi (text filter) trên mảng `processedHeatmapData` ở Frontend. Cực kỳ an toàn, rủi ro 0%, giá trị cực cao.
- **Thêm Menu Thao tác nhanh (Dropdown/Tooltip) cho mỗi dòng Heatmap:** Thay vì chỉ có nút `>`. Thêm nút `...` để hiện Menu: "Copy ID", "Xem chi tiết".
- **Modal danh sách Khách Hàng (Customer Modal):** Phục hồi lại nút click cho AI Insight "Nguy cơ rời bỏ". Thay vì cuộn xuống Heatmap, click vào sẽ mở ra 1 Modal nhỏ gọn liệt kê danh sách khách hàng (Dùng Frontend state).

## 4. Lộ trình thực thi an toàn (Safe Execution Roadmap)

| Priority | Hạng mục | Độ rủi ro | Giá trị Vận hành |
| :--- | :--- | :--- | :--- |
| **P1** | **Heatmap Quick Search Bar** (Tìm kiếm text theo Tên/ID) | Rất thấp (Chỉ lọc Frontend) | Rất cao |
| **P2** | **Customer List Modal** (Hiển thị danh sách khi click AI Insight) | Thấp (Thêm Component Modal) | Cao (Chuyển Insight thành Action) |
| **P3** | **Row Quick Actions** (Menu thao tác 3 chấm cho Heatmap) | Thấp (Thêm UI Menu) | Trung bình - Cao |

---
**Cam kết kỹ thuật:** 
Tất cả các thay đổi trên sẽ CHỈ được thực hiện ở Frontend, CHỈ tận dụng dữ liệu đã fetch (không gọi thêm API), KHÔNG đụng chạm SWR hay thiết kế kiến trúc của Dashboard.jsx.
