# BÁO CÁO TRIỂN KHAI: ACTION CENTER V2 (FLEXIBLE ASSIGNMENT UI)

## 1. TỔNG QUAN TRIỂN KHAI
Giao diện giao việc đã được nâng cấp toàn diện từ "Dropdown tĩnh" sang "Màn hình Điều phối Đa tầng (Hierarchy Drilldown UI)". Mục tiêu: Giúp Leader dễ dàng chọn nhân sự theo cấu trúc cây phòng ban (Trung tâm $\rightarrow$ Cụm $\rightarrow$ Bưu cục), trong khi vẫn giữ nguyên triết lý khóa chặt Task vào "CON NGƯỜI CỤ THỂ".

---

## 2. CÁC TÍNH NĂNG ĐÃ THÊM (FEATURES ADDED)

### 2.1. Cây Điều Phối (Hierarchy Tree Panel)
- **Tích hợp API:** Tận dụng `/api/nodes/tree` để vẽ ra cấu trúc phòng ban thuộc Scope của Leader.
- **Trải nghiệm UX:** Leader có thể mở rộng (expand) từng Node, xem cấu trúc, và ấn chọn Node để Lọc danh sách nhân viên bên phải.

### 2.2. Chọn Nhân Sự Thông Minh (Staff List Panel)
- Cập nhật `/api/users/staff` ở Backend để đính kèm `point_id`, `point_name` và `chuc_vu`.
- Bên phải hiển thị danh sách nhân viên. Khi Leader bấm chọn 1 Node bên trái, danh sách bên phải tự động Filter chỉ hiện nhân sự thuộc Node đó.
- Giao diện Card Nhân sự hiển thị rõ: Tên, Chức vụ, Tên Đơn vị để Leader dễ nhận diện.

### 2.3. Ownership Visibility
- Nút "Giao Ngay" nay hiển thị rõ hơn.
- Tại bảng danh sách Task chính, hiển thị rõ Tên người đang giữ Task và icon Avatar để Leader nhìn thấy "Task đang nằm ở đâu".

---

## 3. PHÂN TÍCH RỦI RO & BẢO VỆ SCOPE

| Tiêu chí | Mức độ | Nhận xét |
|---|---|---|
| **Scope Leakage** | 0% | Danh sách nhân viên và Cây điều phối vẫn được Backend lọc qua `ScopingService.apply_scope_filter`. User không thể giao việc cho người ngoài Scope. |
| **Workflow Conflict** | Không có | Việc "Giao Việc" (Assign) hay "Giao Lại" (Reassign) chỉ đổi `staff_id`, không sinh thêm trạng thái lạ. Cấm hoàn toàn luồng Forward (tự đẩy qua lại). |
| **Ownership Integrity** | 100% | UI không cho phép assign thẳng vào "Cái phòng", bắt buộc phải bấm vào "Send" trên Person Card cụ thể (Ví dụ: Giám đốc chi nhánh). |

---

## 4. XÁC NHẬN SEMANTIC & ĐIỀU KIỆN HIẾN PHÁP

Hệ thống ghi nhận sự ổn định của Action Center V2:

- ✅ **Flexible Assignment hoạt động:** Giao diện điều phối 2 cột (Trái: Cây đơn vị, Phải: Danh sách người).
- ✅ **Hierarchy UI hoạt động:** Expand/Collapse trơn tru.
- ✅ **Ownership không đổi semantic:** Leader phải chủ động thao tác.
- ✅ **Không có FORWARD quay trở lại:** Nhân viên không thể tự chuyển, chỉ Leader có nút Reassign.
- ✅ **Scope lock vẫn an toàn:** Data được bảo vệ từ Backend.
- ✅ **Không cross-center leakage:** Phân quyền giới hạn bởi User Scope.
- ✅ **Task vẫn thuộc PERSON cụ thể:** Backend lưu `staff_id` thay vì Node.
