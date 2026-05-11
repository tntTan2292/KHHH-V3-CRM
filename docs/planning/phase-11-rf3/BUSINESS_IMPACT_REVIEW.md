# CRM V3 — PHASE 11 | RF3: COMMAND CENTER UI
## BUSINESS IMPACT & OPERATIONAL REVIEW

Tài liệu này phân tích các tác động thực tế của giai đoạn RF3 đối với trải nghiệm người dùng và quy trình vận hành kinh doanh. Mục tiêu là biến Dashboard từ "Bảng số liệu tĩnh" thành "Bề mặt điều hành hành động" (Operational Command Surface) mà không làm thay đổi thói quen sử dụng hiện tại.

---

### 1. Bảng phân tích tác động chi tiết

| STT | Module/Khu vực | Thành phần hiện tại | RF3 thay đổi gì | User sẽ thấy gì | Có đổi layout lớn không | Mức độ rủi ro |
|:---:|-----------------|--------------------|-----------------|-----------------|:-------------------------:|:----------------:|
| 1 | **Dashboard** | Bảng MoM Territory | Tên đơn vị (Cụm/Bưu cục) trở thành liên kết. | Click vào tên đơn vị yếu sẽ mở danh sách KH của đơn vị đó tại module Customers. | **KHÔNG** | Thấp |
| 2 | **Dashboard** | Thẻ Lifecycle (Active/At Risk...) | Các con số thống kê trở thành điểm nhấn có thể click. | Click vào số "KH Nguy cơ" sẽ dẫn thẳng tới danh mục KH cần giữ chân. | **KHÔNG** | Thấp |
| 3 | **Dashboard** | Strategic Insights (AI) | Các dòng phân tích trở thành các gợi ý hành động có link. | Cuối mỗi dòng phân tích (về doanh thu, giá...) sẽ có link "Xử lý ngay" dẫn tới module tương ứng. | **KHÔNG** | Trung bình |
| 4 | **Customers** | Danh sách khách hàng | Tiếp nhận bộ lọc tự động từ Dashboard. | Khi nhảy từ Dashboard sang, danh sách KH đã được lọc sẵn đúng đơn vị/trạng thái đã chọn. | **KHÔNG** | Thấp |
| 5 | **Action Center** | Quản lý tiếp cận | Tiếp nhận bối cảnh đơn vị đang xem. | Khi chuyển từ Dashboard sang, hệ thống tự chọn sẵn đơn vị/cụm mà lãnh đạo đang quan tâm. | **KHÔNG** | Thấp |
| 6 | **Hành trình 5B** | Quản lý tiềm năng | Kết nối với các gợi ý tăng trưởng từ Dashboard. | Các cơ hội tăng trưởng từ Strategic Insights sẽ dẫn trực tiếp vào phễu 5B để bám sát. | **KHÔNG** | Thấp |
| 7 | **TreeExplorer** | Bộ lọc phân cấp | Đồng bộ hóa với địa chỉ URL của trình duyệt. | Khi chọn Cụm X, địa chỉ web sẽ lưu lại Cụm X. Chuyển trang không bị mất đơn vị đang chọn. | **KHÔNG** | Trung bình |
| 8 | **Navigation** | Luồng chuyển trang | Chuyển trang có kèm theo "trí nhớ" (context). | User không phải chọn lại đơn vị nhiều lần khi đi từ Dashboard -> Khách hàng -> Tiếp cận. | **KHÔNG** | Thấp |
| 9 | **Toàn hệ thống** | Trải nghiệm chung | Thêm lớp tương tác "Click-to-Action". | Cảm giác hệ thống "sống" hơn, các con số đều có thể tương tác để ra việc làm cụ thể. | **KHÔNG** | Thấp |

---

### 2. Khu vực AN TOÀN (RF3 Safe Areas)
*Các thay đổi có rủi ro UX cực thấp, không làm xáo trộn thói quen.*

- **Clickable Metrics:** Việc biến con số thành link là hành vi tiêu chuẩn, người dùng dễ dàng làm quen.
- **Persistence (Ghi nhớ đơn vị):** Đây là tính năng "tiện ích ngầm", người dùng sẽ cảm thấy hệ thống thông minh hơn mà không cần học cách dùng mới.
- **Cross-module Routing:** Việc chuyển trang thay vì mở Popup giúp giữ luồng làm việc tập trung.

### 3. Khu vực RỦI RO CAO (RF3 High-Risk Areas)
*Cần giám sát kỹ để tránh làm người dùng thấy "lạ hệ thống".*

- **URL Syncing:** Nếu xử lý không khéo, nút "Back" của trình duyệt có thể gây khó chịu khi lưu quá nhiều lịch sử thay đổi bộ lọc.
- **Visual Clutter:** Nếu thêm quá nhiều biểu tượng "Action", bảng MoM Territory sẽ bị rối. Cần giữ phong cách tối giản (Subtle links).
- **Insight Links:** Các link gợi ý từ AI cần rõ ràng về đích đến để tránh gây bất ngờ (Surprise navigation).

### 4. Các thay đổi tuyệt đối CẤM (Strictly Forbidden)
- **CẤM** thay đổi bố cục (Layout) của Dashboard.jsx.
- **CẤM** thay thế các bảng biểu vận hành bằng các biểu đồ điều hành mới.
- **CẤM** sử dụng Popup/Modal lớn để ép người dùng thực hiện lệnh (Command).
- **CẤM** thay đổi màu sắc nhận diện thương hiệu để tạo cảm giác "Enterprise SaaS".

---

### 5. Lộ trình triển khai an toàn nhất (Safest Order)

1. **Giai đoạn 1 (Nền tảng):** Triển khai ghi nhớ đơn vị qua URL (Persistence). Đây là thay đổi "vô hình" nhưng quan trọng nhất.
2. **Giai đoạn 2 (Điều hướng chỉ số):** Kích hoạt khả năng click cho bảng MoM và các thẻ Lifecycle.
3. **Giai đoạn 3 (Hành động chiến lược):** Kết nối các dòng phân tích của AI Assistant với các module thực thi.
4. **Giai đoạn 4 (Tối ưu phản hồi):** Thêm các chỉ báo "Đang lọc theo..." tại module đích để người dùng không bị lạc hướng.

---

### XÁC NHẬN (CONFIRMATION)
**"No production code modified"** — Tài liệu này hoàn toàn mang tính chất đánh giá nghiệp vụ và lập kế hoạch vận hành.
