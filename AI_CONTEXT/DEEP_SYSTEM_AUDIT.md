# DEEP SYSTEM EXPORT — KHHH-V3-CRM (ACTION CENTER)

## 1. EXPORT DATABASE REAL STRUCTURE

### Task Related
- **Task Table (`ActionTask`)**:
  - `staff_id`: Khóa ngoại trỏ đến `NhanSu`. Đây là field chỉ định **Current Owner** của task.
  - `target_id`: CMS ID của khách hàng.
  - Khóa khách hàng (Customer Lock): Không nằm trên `ActionTask` mà nằm trên bảng `Customer` qua field `assigned_staff_id`.
  - `deadline`: Thời điểm quá hạn. (Không có cờ boolean `is_overdue`, trạng thái được cập nhật qua `trang_thai` = "OVERDUE").
  - `trang_thai`: Status (Mới, Đang xử lý, Hoàn thành, Thất bại, Hủy, Escalation, PENDING_VERIFY).
  - Khóa ngoại Timeline: Liên kết 1-n qua `TaskStateLog` bằng `task_id`.
  - Khóa ngoại Hierarchy (Giao chéo): `cross_point_flag`, `original_point_id`, `original_staff_id`.
  - `escalation_id`: Khóa ngoại trỏ tới `EscalationRecord` để nối với Engine.

- **Timeline Table (`TaskStateLog`)**:
  - `action_type`: Mã hành động (ASSIGN, START, COMPLETE, ESCALATE, FORWARDED, REASSIGNED...).
  - `previous_status`, `new_status`: Trạng thái trước và sau khi thay đổi.
  - `changed_by`: User ID thực hiện.
  - `evidence_snapshot_json`: Field quan trọng nhất chứa **Immutable Truth Snapshot** dưới dạng JSON Payload để phục vụ render UI và audit.

### User & Organization
- **User**: Liên kết sang bảng nhân sự qua `nhan_su_id`. Scope dữ liệu được quản lý qua `scope_node_id` (Khóa ngoại trỏ đến `HierarchyNode`).
- **NhanSu**: Gắn cứng với một Điểm phục vụ (`point_id`).
- **HierarchyNode**: Mô hình cây theo `parent_id`. Các type gồm `CENTER`, `CLUSTER`, `WARD`, `POINT`.
- **Cách Scope hoạt động**: Hàm `ScopingService.get_effective_scope_ids(user)` đệ quy lấy toàn bộ con cháu của `user.scope_node_id`. Leader sẽ thấy tất cả dữ liệu từ `scope_node_id` trở xuống.
- **Xác định Leader**: Kiểm tra Role (`UNIT_HEAD`, `REP_LEADER`, `CENTER_LEADER`) kết hợp với Cây phân cấp để tìm User quản lý trực tiếp Node đó.

### Timeline Storage
- **Nơi lưu trữ**: Bảng `TaskStateLog`.
- **Append-only**: **Có.** Thực sự là Append-only. Mọi hành động (Accept, Forward, Report) đều insert một row mới vào `TaskStateLog`.
- **Overwrite Risk**: **Không.** Bản ghi log không bao giờ bị update lại.
- **Lưu snapshot người giao/nhận**: **Có.** Hàm `build_timeline_payload` query tên thật và chức vụ tại thời điểm đó (`from_staff_name`, `to_staff_name`) và đóng băng vào file json text.

---

## 2. EXPORT REAL API FLOW

**Quy tắc chung**: Toàn bộ các API đều check ownership: `current_user.nhan_su_id != task.staff_id` (Ngoại trừ Reassign/Assign do Leader làm).

### 1. Assign Flow
- **Endpoint:** `POST /api/actions/assign`
- **Ownership Check:** Có. Cross-center scope check để chặn giao khác Cụm nếu không đủ quyền. Hard lock gán `assigned_staff_id` xuống bảng `Customer`.
- **Status & Timeline:** Status = `Mới`. Timeline = `DELEGATED` hoặc `ASSIGN_STAFF`.

### 2. Accept Flow
- **Endpoint:** `POST /api/actions/tasks/{task_id}/accept`
- **Ownership Check:** Bắt buộc `current_user.nhan_su_id == task.staff_id`.
- **Status & Timeline:** Đổi `Mới` -> `Đang xử lý`. Timeline = `ACCEPTED`.

### 3. Forward Flow
- **Endpoint:** `POST /api/actions/tasks/{task_id}/forward`
- **Ownership Check:** Current User phải là Owner. Leader forward phải check permission node đích nằm trong nhánh.
- **Status & Timeline:** **Status giữ nguyên** (không reset). Timeline = `FORWARDED`. Field `staff_id` của Task đổi sang staff mới. Update luôn bảng `Customer.assigned_staff_id`.

### 4. Reassign Flow
- **Endpoint:** `PATCH /api/actions/tasks/{task_id}/reassign`
- **Permission Check:** Chỉ Người đã giao việc (dựa vào History log) hoặc ADMIN mới được thao tác.
- **Status & Timeline:** Status giữ nguyên. Timeline = `REASSIGNED`. Thay đổi `staff_id`.

### 5. Escalate Flow
- **Endpoint:** `POST /api/actions/escalate`
- **Routing:** Tự động tìm Cluster Node -> Tìm User Leader của Node đó.
- **Status & Timeline:** Tạo một Task mới trỏ vào Leader (Task cũ giữ nguyên hoặc chuyển trạng thái tùy logic frontend). Status task mới = `Escalation`. Timeline = `ESCALATE` (Lưu trên task mới).

### 6. Report Flow (Complete)
- **Endpoint:** `PATCH /api/actions/tasks/{task_id}/report`
- **Ownership Check:** Staff role bắt buộc là current owner.
- **Status & Timeline:** Status thành `Hoàn thành` / `Thất bại`. Tự động unlock Khách hàng ở bảng Customer (Gán `assigned_staff_id` = None). Timeline = `COMPLETED`.

---

## 3. EXPORT REAL JSON PAYLOAD SAMPLE

### Timeline Evidence Snapshot Payload (Ghi vào `TaskStateLog.evidence_snapshot_json`)
```json
{
  "event_type": "FORWARDED",
  "acted_by_user_id": 15,
  "action_by": "Nguyễn Văn A",
  "action_source": "ACTION_CENTER",
  "from_staff_id": 1001,
  "from_staff_name": "Nguyễn Văn A (Nhân viên kinh doanh)",
  "to_staff_id": 1005,
  "to_staff_name": "Trần Thị B (Giao dịch viên)",
  "from_node": "BC An Cựu",
  "to_node": "BC An Cựu",
  "previous_status": "Đang xử lý",
  "new_status": "Đang xử lý",
  "reason": "Điều phối tiếp xuống cấp dưới",
  "evidence_text": "Chị B đi tuyến này ghé nhà khách thu tiền luôn nhé.",
  "created_at": "2026-05-24T09:00:00.123456"
}
```

---

## 4. EXPORT ACTION CENTER UI REALITY

*(Báo cáo text - Không gen ảnh để tiết kiệm dung lượng context)*

- **Action Center (Staff Kanban):**
  - **Layout:** Dạng bảng Kanban (3 cột: Mới, Đang xử lý, Hoàn thành). Task card hiển thị Kịch bản, Badge phân loại (LEAD/VIP/CẢNH BÁO).
  - **Filter:** Bọc Date Range (start_date, end_date), Dropdown chọn Node.
- **Task Modal (Thao tác chi tiết):**
  - Hiển thị Mục tiêu tiếp cận, Kịch bản (Nội dung sếp giao).
  - Tích hợp 3 nút: **[Nhận xử lý]** (Nếu Mới), **[Điều phối tiếp]**, và **[Báo cáo Form]** (Chứa 3 nút chọn kết quả).
- **Timeline UI (Right Side):**
  - Hiển thị chain history đọc từ JSON Payload.
  - Thể hiện rõ người Giao (Từ) -> người Nhận (Đến) với màu sắc rõ rệt cho từng loại event (Đỏ: Overdue, Xanh: Complete, Cam: Escalate).
- **Forward Modal (Đã hoàn thiện ở Phase 3.5):**
  - Modal tối giản. Có dropdown danh sách staff thuộc quyền + Textarea lời nhắn. Nút Xác nhận Điều phối gọi API `/forward`.
- **Leader Dashboard:**
  - Layout: 4 thẻ KPI tổng hợp. 1 bảng Grid hiển thị tiến độ của mọi nhân viên. Có nút `[Giao ngay]` (Quick Assign modal popup).

---

## 5. EXPORT DEADLOCK & RISK ANALYSIS

### Các tình huống có thể treo việc & Tình trạng thực tế:
1. **Task "Mới" không ai nhận:**
   - **Thực tế:** Hiện tại task nằm chờ ở cột Mới. Thiếu auto-notify quá hạn tiếp nhận (Chưa có tính năng SLA Response Time tự động kick).
2. **Owner nghỉ phép / Đột xuất:**
   - **Thực tế:** Hệ thống CÓ tính năng Reassign dành cho Leader để cứu task. Tuy nhiên nếu Leader quên, task sẽ nằm chết.
3. **Escalation Treo (Leader offline):**
   - **Thực tế:** Task đẩy lên Cluster Leader. Nếu Cluster Leader không xử lý, không có Auto-Escalation lên cấp Tỉnh. Đây là một Deadlock mỏng.
4. **Overdue nhưng hệ thống không unlock:**
   - **Thực tế:** Code `api/actions/{task_id}/overdue` đã có, nhưng backend **chưa có file Cron Job / Background Service** (như Celery hay background task của FastAPI) để tự động quét định kỳ. Do đó Overdue vẫn mang tính giả định (assumption) nếu thiếu Cron trigger.

---

## 6. EXPORT CURRENT SLA STATUS

- **Đã có SLA Engine thật chưa?** **CHƯA HOẠT ĐỘNG HOÀN TOÀN.**
- **Tình trạng:** Database đã thiết kế mô hình cực tốt (`SLAPolicy`, `SLATracker`, `SLASnapshot`), nhưng trong API Flow hiện tại đang **bỏ qua** nó và chỉ sử dụng `ActionTask.deadline` lưu hard-coded.
- **Overdue: Manual hay Auto?** Đang là **Manual/Nửa mùa**. Có API `/overdue` đánh cờ đỏ nhưng không ai (hay tiến trình nào) tự động gọi nó khi qua nửa đêm.
- **Cron / Background Job:** Chưa thấy tồn tại trong cấu trúc thư mục backend (`scripts` hoặc `engines` chạy ngầm).
- **Escalation tự động:** Chưa có. Hoàn toàn phụ thuộc con người click.

---

## 7. EXPORT SAFE NEXT PHASE

Dựa trên cấu trúc Backend mạnh (models đã sẵn sàng) và UI đang ổn định, đây là lộ trình an toàn nhất để tránh gãy đổ:

### SAFE NEXT PHASE: TỰ ĐỘNG HÓA BACKGROUND (CRON BINDING) & SLA TRACKER LEVEL 1

**Nên làm trước (Ưu tiên Cao):**
1. **Background Job (Cron Worker):** Viết 1 file `background_tasks.py` sử dụng `APScheduler` hoặc chỉ là một script chạy qua Task Scheduler của OS gọi thẳng vào DB.
   - Nhiệm vụ: Mỗi 30 phút quét các task lố `deadline` -> Trigger API logic `/overdue`.
2. **Auto Unlock Customer Lock:** Khi hàm quét Overdue chạy, BẮT BUỘC phải clear giá trị `assigned_staff_id` trong bảng Customer về Null.
3. **Bind SLA Badge vào UI:** Sửa UI Card Kanban để hiện nhấp nháy Đỏ nếu `is_stale == true` hoặc lố deadline.

**Chưa nên làm (Hoãn lại):**
- Đừng kích hoạt toàn bộ SLA Engine phức tạp (các bảng `SLATracker`, `SLASnapshot`) ngay lập tức. Hãy xài mượt field `deadline` của `ActionTask` trước để test độ chịu tải của người dùng.

**Nguy hiểm nếu làm sớm:**
- Escalation Automation (Tự động leo thang): Quá dễ gây ngập rác thông báo (Spam notification) cho Lãnh đạo nếu dữ liệu nhân viên báo cáo sai sót hoặc cấu hình SLA quá gắt gao. Chặn luồng Auto-Escalation cho tới khi vận hành thuần thục manual.
