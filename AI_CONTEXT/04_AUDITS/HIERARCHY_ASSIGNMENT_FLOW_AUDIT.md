# AUDIT: HIERARCHY ASSIGNMENT FLOW

**Mục tiêu:** Đánh giá đúng hiện trạng thật của cấu trúc cây tổ chức và luồng giao việc (Assign) đang hoạt động trong module Customers.

---

## 1. CÂY TỔ CHỨC HỆ THỐNG (HIERARCHY TREE)

Cây tổ chức được định nghĩa qua mô hình đệ quy (Self-referential) trong Database.

| Yếu tố | Hiện trạng Code |
|---|---|
| **Model quản lý** | `HierarchyNode` (nằm trong `models.py`) |
| **Field liên kết** | `parent_id` (trỏ ngược về `HierarchyNode.id`) |
| **Loại Node (Type)** | `CENTER` (Trung tâm) <br> `UNIT` (Đơn vị) <br> `CLUSTER` (Cụm) <br> `WARD` (Phường/Xã) <br> `POINT` (Bưu cục/Điểm phục vụ) |

*Mối quan hệ nhân sự:* Model `NhanSu` liên kết với cây tổ chức qua trường `point_id` (chỉ đích danh nhân sự đang ngồi tại Node nào).

---

## 2. FLOW GIAO VIỆC TRONG CUSTOMERS (REALITY)

Khi User nhấn "Giao việc" trên bảng Khách hàng, luồng thực tế diễn ra như sau:

| Bước | Thực tế xử lý trong Code |
|---|---|
| **1. Trigger Modal** | Gọi hàm `handleOpenAssignModal(c)`. Pop-up Modal hiển thị ngay trên nền trang `Customers.jsx`. |
| **2. Auto Load Bưu cục** | Gọi API `GET /api/customers/staff-options?target_id=...`. Backend dò tìm giao dịch cuối cùng (`last_tx`) của khách hàng này để lấy `point_id` (Bưu cục phát sinh doanh thu). |
| **3. Drilldown Hierarchy** | Từ `point_id` tìm được, Backend leo ngược cây (loop) để tìm `WARD` cha và `CLUSTER` cha. Sau đó xuất toàn bộ danh sách WARD và POINT cùng Cụm trả về cho Frontend. |
| **4. Auto Select Staff** | Frontend tự chọn sẵn WARD và POINT. Nếu Point đó chỉ có duy nhất 1 nhân viên (`staffInPoint.length === 1`), hệ thống tự động chọn luôn Nhân viên đó (`selectedStaffId`). |

---

## 3. SCOPING & PERMISSION (PHÂN QUYỀN GIAO VIỆC)

Việc giới hạn quyền giao việc đang được bám chặt vào Node (Đơn vị) thông qua role hiện tại.

| Vai trò (Role) | Giới hạn (Scope giới hạn thực tế) | Thể hiện trên UI |
|---|---|---|
| **ADMIN / Lãnh đạo** | Không giới hạn | Dropdown WARD mở tự do, có thể giao chéo Cụm/Phường. |
| **UNIT_HEAD** (Trưởng P/X) | Bị khóa chặt vào `user_ward_id` (Node WARD mà user đang quản lý). | Dropdown WARD bị `disabled`. Có dòng cảnh báo vàng: *"🔒 Khoá theo phạm vi quản lý của bạn"*. |

*Lưu ý:* Logic check quyền nằm tại API `/staff-options`. Backend tra ngược từ `User -> NhanSu -> Point -> Ward` để chốt `user_ward_id`.

---

## 4. ASSIGNMENT LIMITATION (GIỚI HẠN GIAO VIỆC)

- **Đích đến cuối cùng:** Mọi thao tác Assign đều giao **thẳng cho 1 Cá nhân** (Lưu vào `staff_id` của `ActionTask`).
- **KHÔNG GIAO CHO ĐƠN VỊ:** Không có logic giao task cho "Cả cái bưu cục" hay "Giao cho Trưởng bưu cục để họ tự chia". Dữ liệu bắt buộc phải map 1-1 với một `NhanSu` cụ thể.
- **Có chống trùng lặp:** Backend check `active_task`. Nếu khách hàng đang có Task chưa hoàn thành $\rightarrow$ API chặn lỗi 400.

---

## 5. MINH HỌA FLOW (USER JOURNEY)

1. Mở màn hình **Customers**.
2. Click icon **Giao việc** (màu cam).
3. Mở **Modal Assign Staff**.
4. Khung Modal hiện danh sách:
   - **Bưu điện Phường/Xã** (Tự động điền).
   - **Chọn Bưu cục** (Tự động điền dựa theo Giao dịch gốc).
   - **Chọn Nhân sự** (Auto-select nếu bưu cục chỉ có 1 người).
   - **Kịch bản** (Dropdown chọn Kịch bản chăm sóc).
   - **Nội dung + Deadline**.
5. Nhấn **Giao Việc** $\rightarrow$ Post API $\rightarrow$ Tạo `ActionTask` $\rightarrow$ Sinh Zalo Message điều hành.
