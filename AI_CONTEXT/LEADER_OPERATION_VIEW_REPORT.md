# BÁO CÁO TRIỂN KHAI: SLA PHASE 1.2 (LEADER OPERATION VIEW)

## 1. TỔNG QUAN TRIỂN KHAI
Phase 1.2 tập trung vào mục tiêu "Visibility" (Khả năng hiển thị và giám sát) dành cho Leader. Tất cả các tính năng được bổ sung đều tuân thủ nguyên tắc chỉ hiển thị thông tin để hỗ trợ ra quyết định, không tự động hóa thay quyền Leader.

---

## 2. CÁC TÍNH NĂNG ĐÃ THÊM (FEATURES ADDED)

### 2.1. Leader Operation Summary
Bổ sung các bảng thống kê và số liệu tổng quan vào đầu trang Leader Dashboard:
- **Card "Tổng Task Quá Hạn":** Highlight màu đỏ.
- **Card "Sắp Quá Hạn (< 24h)":** Highlight màu cam.
- **Card "Task Treo Lâu (> 2 ngày)":** Highlight màu vàng, giúp Leader nhận diện các task bị bỏ quên dù chưa lố deadline.

### 2.2. Overdue Staff View (Top Nhân Sự Quá Hạn)
- Thêm một bảng Leaderboard nhỏ liệt kê Top các nhân sự có backlog/overdue cao nhất.
- Hiển thị: Tên nhân sự, số task đang giữ (pending), số task đã quá hạn (overdue), và tỷ lệ % quá hạn. Giúp Leader đánh giá năng lực và phân bổ lại nguồn lực nếu thấy quá tải.

### 2.3. Upcoming SLA Warning & Task Aging View
- **Sắp quá hạn:** Hệ thống tự động tính toán deadline (nếu còn < 24h) và đính kèm cờ `upcoming_sla`. UI hiển thị badge vàng cam "SẮP QUÁ HẠN".
- **Task Treo:** Hệ thống tính toán thời gian kể từ lần cuối cập nhật (`updated_at`). Nếu > 2 ngày, đính kèm cờ `stale_days`. UI hiển thị badge "TREO X NGÀY".

### 2.4. Action Center Safe Patch
- Cập nhật backend API (`/summary` và `/tasks`) để tính toán và trả về các cờ cảnh báo trên.
- Frontend Leader Dashboard đã được bổ sung trực tiếp các thành phần cảnh báo mà không làm phá vỡ bảng danh sách nhiệm vụ hiện hữu.

---

## 3. PHÂN TÍCH RỦI RO & ROLLBACK SAFETY

| Tiêu chí | Mức độ | Nhận xét |
|---|---|---|
| **Risk Analysis** | Cực thấp | 100% các tính năng chỉ là hiển thị (Read-only). Không sinh thêm API write, không làm ảnh hưởng tới State Machine của Task Lifecycle. |
| **Rollback Safety** | Rất cao | Bản Patch chỉ xoay quanh giao diện (Frontend) và thêm field tính toán vào response của hàm `get_action_summary`, `get_tasks` (Backend). Nếu có lỗi logic tính toán, hệ thống chính vẫn hoạt động bình thường, việc Rollback dễ dàng bằng cách checkout file cũ. |

---

## 4. XÁC NHẬN SEMANTIC & ĐIỀU KIỆN HIẾN PHÁP

Hệ thống đã thỏa mãn các điều kiện khóa cứng:

- ✅ **Leader nhìn thấy overdue rõ hơn** (Hiển thị ngay trên top widget và badge chi tiết)
- ✅ **Leader nhìn thấy backlog rõ hơn** (Có bảng Top Nhân sự quá hạn)
- ✅ **Không có automation trái hiến pháp** (Leader phải tự ấn Giao lại/Reassign nếu muốn can thiệp)
- ✅ **Workflow không đổi** (Task cảnh báo vẫn giữ nguyên Status)
- ✅ **Ownership không đổi** (Trách nhiệm của task vẫn nằm trên người được giao)
- ✅ **SLA chỉ hỗ trợ điều hành** (Toàn bộ là Visibility features)
