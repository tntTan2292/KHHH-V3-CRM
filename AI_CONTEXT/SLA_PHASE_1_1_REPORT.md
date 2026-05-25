# BÁO CÁO TRIỂN KHAI: SLA PHASE 1.1 (SAFE FOUNDATION)

## 1. TỔNG QUAN TRIỂN KHAI
Phase 1.1 đã được thiết kế tuân thủ tuyệt đối Hiến pháp Semantic: **OVERDUE = SLA WARNING FLAG**. Không làm thay đổi bất kỳ Workflow chính hay Status máy trạng thái nào của Task.

---

## 2. CHI TIẾT CÁC PATCH ĐÃ THỰC HIỆN

### 2.1. DB Patch
- Đã thêm trường `overdue_at = Column(DateTime, nullable=True)` vào model `ActionTask` (`backend/app/models.py`). 
- **Lý do:** Lưu trữ thời điểm bắt đầu vi phạm SLA mà không phải gán đè trường `trang_thai`.

### 2.2. Scheduler Strategy (Overdue Engine)
- Đã cấu trúc lại hàm kiểm tra quá hạn (`scan_and_mark_overdue`) trong `task_verifier.py`.
- **Logic hoạt động:** Tìm tất cả các Task chưa đóng (Mới, Đang xử lý, CHỜ CHỈ ĐẠO) có `deadline < now` và chưa đánh dấu `overdue_at`. 
- **Độ an toàn:** Hàm này **CHỈ** cập nhật biến `overdue_at = now`. Tuyệt đối không chạm vào trường `trang_thai`, `staff_id`, hay bất cứ ownership nào.

### 2.3. UI Patch (Action Center)
- **Sorting:** Hàm `fetchTasks` ở Frontend đã được sửa đổi. Mọi Task có `overdue_at != null` sẽ được đẩy lên trên cùng (Top Priority).
- **Badge Cảnh Báo:** Thêm Badge `⚠️ QUÁ HẠN` chữ đỏ nền nhạt và đổi màu viền sang đỏ (Red-400) cho thẻ task.
- **Giữ nguyên luồng:** Task quá hạn vẫn nằm trong cột `Đang xử lý` (Kể cả task `CHỜ CHỈ ĐẠO` cũng quy về cột này). Nhân viên không bị mất khách hàng khỏi Kanban Board.

### 2.4. KPI Patch & Dashboard Visibility
- Cập nhật API `/api/actions/summary` (`backend/app/routers/actions.py`).
- Endpoint tự động trả về thêm `overdue_count` (tổng số task quá hạn) và `overdue_rate` (tỷ lệ %) cho Leader. Tích hợp sẵn với scoping tree của user gọi.

---

## 3. PHÂN TÍCH RỦI RO & ROLLBACK SAFETY

| Tiêu chí | Mức độ | Nhận xét |
|---|---|---|
| **Risk Analysis** | Rất Thấp | Không có sự đứt gãy nào về Workflow. Việc ghi `overdue_at` là thao tác append-only không ảnh hưởng tới state machine của `TaskService`. |
| **Rollback Safety** | Dễ dàng | Nếu hệ thống tính giờ sai do lỗi timezone hay logic, chỉ cần chạy script `UPDATE action_tasks SET overdue_at = NULL WHERE overdue_at >= 'thời điểm lỗi'`. |

---

## 4. XÁC NHẬN SEMANTIC CUỐI CÙNG

Hệ thống đã khóa thành công toàn bộ các ràng buộc nghiệp vụ về Task Lifecycle:

- ✅ **OVERDUE là warning flag** (Không còn là status chính)
- ✅ **Workflow chính không bị phá** (Mới $\rightarrow$ Đang xử lý $\rightarrow$ Hoàn thành)
- ✅ **Ownership không đổi** (Overdue không làm nhân viên mất khách hàng)
- ✅ **Không auto unlock** (Lệnh `customer.assigned_staff_id = None` đã bị tháo hoàn toàn)
- ✅ **Không auto reassign** (Không tự chia lại cho nhân viên khác)
- ✅ **SLA chỉ hỗ trợ điều hành** (Cho phép Leader nhìn thấy cảnh báo và tự thao tác thủ công qua Reassign)
