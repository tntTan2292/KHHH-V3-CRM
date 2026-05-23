# PHASE 2.1 — TASK TIMELINE FOUNDATION AUDIT

## 1. TASK TIMELINE EVENT
Các sự kiện nghiệp vụ (Semantic Events) phát sinh trong một Task hiện tại (Dựa trên `TaskStateLog.action_type`):

| Event | Ý nghĩa |
| :--- | :--- |
| **TASK_CREATED** | Hệ thống hoặc Quản lý vừa tạo Task. |
| **TASK_ASSIGNED** | Giao/Chia Task cho nhân viên xử lý. Khách hàng bắt đầu bị Lock. |
| **TASK_STARTED** | Nhân viên bấm "Nhận việc" và bắt đầu tiếp cận. |
| **TASK_PAUSED** | Tạm dừng Task (Hold). |
| **TASK_RESUMED** | Tiếp tục xử lý Task. |
| **TASK_REPORTED** | Nhân viên báo cáo kết quả tương tác (Nhưng chưa đóng Task). |
| **TASK_ESCALATED** | Đẩy lên cấp trên xin hỗ trợ (Vượt thẩm quyền). |
| **TASK_REASSIGNED**| Cắt Task giao cho người khác (Sang Owner mới). |
| **TASK_COMPLETED** | Chốt kết quả cuối cùng (Success/Failed) -> Đóng Task -> Unlock KH. |
| **TASK_CANCELLED** | Hủy bỏ do sai sót -> Đóng Task -> Unlock KH. |

---

## 2. PHÂN TÁCH LOG
Kiến trúc Log đã được tách bạch rõ ràng theo đúng Domain Driven Design:

| Thành phần | Vai trò thực tế |
| :--- | :--- |
| **SystemLog** | **Audit hệ thống:** Lưu dấu vết thao tác nhạy cảm (Đăng nhập, Sửa/Xóa dữ liệu cấp cao, Phân quyền). Không dùng để vẽ hành trình khách hàng. |
| **TaskStateLog** | **Timeline nghiệp vụ:** Lưu vết "Ai đã làm gì với Task này". Chứa `action_type`, `previous_status`, `new_status`, và `evidence_snapshot_json` (Bằng chứng xử lý). Đây là Data Model gốc. |
| **Activity Timeline**| **UI hiển thị lịch sử:** Lớp giao diện (Frontend) đọc từ `TaskStateLog` (kết hợp `SLASnapshot`) để vẽ lại toàn bộ chặng đường của khách hàng/Task cho người dùng xem. |

---

## 3. REASSIGN HISTORY
**Hiện trạng:**
- Bảng `TaskStateLog` đã có `changed_by` (Ai thao tác), `action_type = ASSIGN`.
- Tuy nhiên, **THIẾU** trường định danh rõ ràng `assigned_from` (Giao từ ai) và `assigned_to` (Giao cho ai). Hiện tại phải parse từ cục JSON `evidence_snapshot_json` hoặc `reason` để biết.

**Đề xuất thiết kế:**
- Cần chuẩn hóa Payload JSON lưu trong `evidence_snapshot_json` khi Reassign: `{"from_user": A, "to_user": B, "reason": "Quá tải"}`. Tuyệt đối không thêm cột CSDL mới.

---

## 4. ESCALATION CHAIN
**Hiện trạng:**
- Bảng `ActionTask` hiện tại **chưa có** `parent_id` hay `child_id`.
- Tức là khi Escalate, hệ thống chỉ đổi trạng thái của Task hiện tại (`action_type = ESCALATE`), đổi Owner, chứ chưa tự đẻ ra 1 "Child Task" cho Sếp.

**Rủi ro/Đề xuất:**
- Việc không có Parent-Child khiến Sếp và Nhân viên phải "dùng chung 1 Task".
- Đề xuất: Giữ nguyên 1 Task (Không tạo Parent-Child để tránh phình rác dữ liệu), khi Escalate thì đổi `status = CHỜ HỖ TRỢ` và thông báo cho Sếp.

---

## 5. CUSTOMER LOCK HISTORY
**Hiện trạng:**
- Lock chưa có bảng lưu lịch sử riêng (`CustomerLockHistory`). Nó đang sống dựa vào trạng thái của `ActionTask`.
- **Khi nào Lock:** Khi Task ở trạng thái `ACTIVE` / `IN_PROGRESS`.
- **Khi nào Unlock:** Khi Task `COMPLETED`, `CANCELLED` hoặc `BREACHED` (Quá hạn SLA).
- **Orphan Lock Risk:** Rất lớn nếu hệ thống sập job chạy ngầm (SLA Worker chết $\rightarrow$ Task lố hạn không bị Breached $\rightarrow$ Mãi mãi bị Lock).

**Đề xuất:**
- Chấp nhận không lưu Lock History (để hệ thống nhẹ), nhưng bắt buộc phải có **Auto-Unlock Cronjob** quét định kỳ để xử lý Orphan Lock.

---

## 6. SLA / OVERDUE
Hệ thống có Model `SLATracker` và `SLASnapshot` cực kỳ xịn (Agnostic):

| Thành phần | Hiện trạng |
| :--- | :--- |
| **deadline** | Nằm ở cột `due_time` trong `SLATracker`. Được tính dựa trên `target_hours` của Policy. |
| **overdue** | Gọi là `BREACHED` (status trong SLATracker). Khi `func.now() > due_time`. |
| **stale** | Tính bằng `total_paused_hours` hoặc quét các Task không có Log mới trong thời gian dài. |
| **SLA tracker** | Quản lý vòng đời riêng biệt (ACTIVE, PAUSED, MET, BREACHED). Khi Tracker báo BREACHED $\rightarrow$ Kích hoạt Unlock. |
