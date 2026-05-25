# BÁO CÁO TRIỂN KHAI: SLA CORE SERVICE (SAFE CLEANUP)

## 1. MỤC TIÊU VÀ KẾT QUẢ
Phase này hoàn thành việc "gom logic SLA về một mối" để tránh tình trạng phân mảnh, hardcode rải rác. Quá trình dọn dẹp diễn ra cực kỳ an toàn, tuyệt đối tuân thủ Hiến pháp: Không thay đổi Workflow, Không đụng tới chức năng, Không tự động hóa trái phép.

---

## 2. CHI TIẾT CÁC PATCH ĐÃ THỰC HIỆN

### 2.1. Tạo Helper Function trong `sla_service.py`
Đã thiết lập một loạt các định nghĩa chuẩn hóa trong lớp `SLAService`:
- Định nghĩa Hằng số `ACTIVE_TASK_STATUSES = ["Mới", "Đang xử lý", "CHỜ CHỈ ĐẠO"]` để thống nhất khái niệm "Task Đang Mở".
- Hàm `is_task_active(task)`: Xác định Task có đang trong chu kỳ làm việc hay không.
- Hàm `is_overdue(task, now)`: Trả về trạng thái lố hạn (Dựa vào `overdue_at` hoặc `deadline < now`).
- Hàm `is_upcoming_sla(task, hours, now)`: Tính toán thời hạn sắp tới ngưỡng nguy hiểm (Ví dụ < 24h).
- Hàm `calculate_stale_days(task, now)`: Tính toán số ngày Task bị "đóng băng" (không cập nhật).

### 2.2. Dọn dẹp Duplicated Logic
- **Tại `backend/app/routers/actions.py`:**
  Các Endpoint `/summary` và `/tasks` đã được tháo gỡ toàn bộ khối lệnh `if/else` tính thời gian trùng lặp. Thay vào đó, chúng trực tiếp gọi các Helper từ `SLAService`.
- **Tại `backend/app/services/task_verifier.py`:**
  Thay thế mảng hardcode `["Mới", "Đang xử lý", "CHỜ CHỈ ĐẠO"]` bằng `SLAService.ACTIVE_TASK_STATUSES`. Engine quét Overdue đã đồng bộ với bộ não SLA trung tâm.

---

## 3. ĐÁNH GIÁ MỨC ĐỘ AN TOÀN

| Rủi ro | Đánh giá | Cách phòng vệ |
|---|---|---|
| **Lệch pha Semantic** | Không còn | Tất cả các Controller và Service giờ đây "nói cùng một ngôn ngữ" khi hỏi về SLA thông qua `SLAService`. |
| **Phá vỡ State Machine**| Không | Không có bất kỳ dòng code nào chạm tới lệnh đổi Status `trang_thai` hay `staff_id`. Workflow được giữ nguyên trạng. |
| **Rollback Safety** | Cực Cao | Đây thuần túy là việc Refactor (Extract Method). Không sửa đổi hay drop bất kỳ Table/Column nào của Database. Dễ dàng git revert. |

---

## 4. FINAL CONFIRMATION

Hệ thống ghi nhận sự ổn định của Core Service mới:

- ✅ **SLA logic tập trung hơn:** 100% việc tính toán Warning/Overdue/Stale diễn ra tại `SLAService`.
- ✅ **Không phá workflow:** Task Lifecycle giữ nguyên vẹn.
- ✅ **Không đổi ownership:** Không có lệnh Reassign tự động nào được thêm vào.
- ✅ **Không đổi semantic:** Vẫn giữ nguyên triết lý OVERDUE = WARNING FLAG.
- ✅ **Không có automation mới:** Chưa kích hoạt Queue, Background Enterprise phức tạp. 
- ✅ **Chỉ là safe cleanup:** Giúp codebase nhẹ và đồng bộ hơn phục vụ cho giai đoạn Scale up tương lai.
