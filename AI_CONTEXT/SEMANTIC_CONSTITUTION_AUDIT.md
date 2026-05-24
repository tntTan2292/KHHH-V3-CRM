# CONSTITUTION AUDIT REPORT — SEMANTIC VALIDATION
*(Phân tích và đối chiếu độ lệch chuẩn giữa Hiến pháp, Code và các suy diễn của AI)*

---

## 1. TRÍCH XUẤT CHÍNH XÁC SEMANTIC TỪ HIẾN PHÁP

Dựa trên nguyên văn từ `HIEN_PHAP_CRM_3.0.md`, `TASK_LIFECYCLE_RULES.md`, `PERMISSION_SCOPING_RULES.md`:

- **OVERDUE (QUÁ HẠN)**: Khi lố hạn SLA, hệ thống trừ điểm KPI và **tự động nhả khóa Khách hàng (Unlock)**. Nguyên văn: *"Một Task chuyển sang Quá hạn (Overdue) sẽ làm mất Lock, nhưng Ownership không tự động đổi sang người khác trừ khi quản lý Reassign."*
- **FORWARD (ĐIỀU PHỐI TIẾP)**: **Không tồn tại trong Hiến pháp gốc.** Khái niệm này do AI đẻ ra trong bản kế hoạch Phase 3.5 với định nghĩa: *"Không làm thay đổi Owner gốc, chỉ giao việc tiếp"*.
- **ESCALATE (XIN HỖ TRỢ)**: Nhân viên gặp khó, đẩy lên nhờ Leader can thiệp. Task vẫn nằm trong danh sách của nhân viên nhưng chuyển trạng thái thành **CHỜ HỖ TRỢ**. Nguyên văn: *"Nhờ sếp giúp đỡ. Không đổi Owner gốc."*
- **REASSIGN (GIAO LẠI / ĐIỀU CHUYỂN)**: Cắt hẳn khách hàng giao cho người khác. Hành động này thay đổi hoàn toàn quyền sở hữu. Nguyên văn: *"Chuyển Owner."*
- **ACCEPT (NHẬN VIỆC)**: Đổi trạng thái từ `MỚI NHẬN` sang `ĐANG XỬ LÝ`.
- **REPORT / COMPLETED (HOÀN THÀNH)**: Phải có báo cáo. Dù kết quả là "Thành công" hay "Thất bại" thì trạng thái Task vẫn là `HOÀN THÀNH`. Nếu thất bại thì hệ thống nhả khóa khách hàng.
- **OWNERSHIP (SỞ HỮU)**: Người chăm sóc chính (Accountability). Được phân biệt rõ với khái niệm "Lock" (Khóa khách trong lúc đi làm task).

---

## 2. ĐỐI CHIẾU VỚI CODE HIỆN TẠI (API FLOW)

| Semantic | Hiến pháp quy định | Code đang làm gì | Đánh giá sai lệch |
|---|---|---|---|
| **OVERDUE** | Mất Lock Khách hàng (Unlock). | API `/overdue` chỉ đổi status task thành `OVERDUE`. **Không hề** set `Customer.assigned_staff_id = None` để nhả khóa. | 🚨 **SAI LỆCH** (Code chưa thực hiện Unlock). |
| **FORWARD** | (AI audit nói: Không đổi Owner). | API `/forward` đổi `task.staff_id` và **đổi luôn** `Customer.assigned_staff_id` (Tức là đổi Owner hoàn toàn). | 🚨 **SAI LỆCH** (Code biến Forward thành Reassign). |
| **ESCALATE** | Chuyển task của nhân viên thành `CHỜ HỖ TRỢ`. Không đổi Owner. | API `/escalate` **tạo ra 1 Task hoàn toàn mới** giao cho Sếp. Bỏ mặc task cũ của nhân viên. | 🚨 **SAI LỆCH** (Code đẻ task mới thay vì chuyển trạng thái). |
| **REASSIGN** | Cắt hẳn, chuyển Owner. | API `/reassign` đổi `task.staff_id` nhưng lại **không update** bảng Customer. | 🚨 **SAI LỆCH** (Quên đổi Owner dưới DB). |
| **ACCEPT** | Chuyển sang `Đang xử lý`. | API `/accept` đổi status và lưu timeline chuẩn xác. | ✅ Đúng Hiến pháp. |
| **REPORT / COMPLETED** | Ghi nhận Hoàn thành, nếu Thất bại/Hủy thì nhả khóa. | API `/report` làm đúng: Nếu Thất bại -> gán `Customer.assigned_staff_id = None`. | ✅ Đúng Hiến pháp. |

---

## 3. ĐẶC BIỆT KIỂM TRA OVERDUE

Theo Hiến pháp hiện tại:
- Quá hạn => Tự unlock khách hàng: **CÓ QUY ĐỊNH** (*"Tự động nhả khóa Khách hàng"*).
- Quá hạn => Mất ownership: **KHÔNG QUY ĐỊNH** (*"Ownership không tự động đổi sang người khác"*).
- Quá hạn => Auto reassign: **KHÔNG QUY ĐỊNH**.

**Thực tế Code:** 
Code API `/overdue` hoàn toàn làm sai Hiến pháp vì **không hề thực thi lệnh Unlock**.
Đồng thời, AI audit trước đó đã bỏ qua một mâu thuẫn lớn trong Database: Hệ thống dùng chung 1 field `Customer.assigned_staff_id` cho cả việc "Lock" và việc "Ghi nhận Ownership". Vì vậy, nếu Unlock (gán bằng None) thì cũng đồng nghĩa với mất Ownership. AI đã tự suy diễn bỏ qua mâu thuẫn kỹ thuật này.

---

## 4. ĐẶC BIỆT KIỂM TRA ESCALATE

**ESCALATE có nghĩa là: Xin hỗ trợ (Không chuyển trách nhiệm).**
- **Hiến pháp ghi:** "Task vẫn nằm trong danh sách của nhân viên nhưng chuyển sang trạng thái CHỜ HỖ TRỢ."
- **Code đang làm:** Tạo ra một Task mới tinh giao thẳng cho Leader Cụm, mang trạng thái `Escalation`. Task gốc của nhân viên không bị đổi trạng thái.
- **Timeline hiểu:** Ghi nhận sự kiện `TASK_ESCALATED` lên Task MỚI của Leader.

**=> Code đang làm hoàn toàn ngược lại với Hiến pháp.** Nó biến "Xin sếp hỗ trợ" thành "Đá bóng trách nhiệm qua cho sếp".

---

## 5. ĐẶC BIỆT KIỂM TRA OWNERSHIP

Dựa trên ngôn ngữ nghiệp vụ, trong hệ thống hiện tại, hành động nào THẬT SỰ được phép đổi người chịu trách nhiệm chính?

- **ACCEPT:** KHÔNG đổi người.
- **FORWARD:** Bản chất nghiệp vụ là KHÔNG đổi người (nhưng code hiện tại đang code nhầm thành đổi người).
- **ESCALATE:** KHÔNG đổi người.
- **OVERDUE:** KHÔNG đổi người (chỉ mất quyền độc chiếm/khóa khách, chờ người khác nhặt).
- **REPORT:** KHÔNG đổi người.
- **REASSIGN (Điều chuyển):** **CÓ ĐỔI NGƯỜI**. Đây là hành động duy nhất mang bản chất chuyển giao hoàn toàn quyền sở hữu khách hàng.

---

## 6. TÌM CÁC CHỖ AI DỄ SUY DIỄN SAI

Những khe hở khiến AI Audit các Phase trước tự suy diễn lệch chuẩn:

1. **Gộp chung "Lock" và "Ownership":** Hiến pháp rạch ròi 2 khái niệm, nhưng DB chỉ có 1 cột `assigned_staff_id`. AI đã không phát hiện ra sự thiếu hụt này ở DB mà tự ngộ nhận rằng hệ thống "hiểu" sự khác biệt.
2. **Khái niệm "FORWARD" từ trên trời rơi xuống:** Hiến pháp gốc của khách hàng không hề có luật Forward. AI đã tự "đẻ" ra khái niệm này ở Phase 3.5, dẫn đến việc code nhầm lẫn nghiêm trọng giữa Forward và Reassign.
3. **Escalation mường tượng:** Vì thiếu flow rõ ràng cho trạng thái "CHỜ HỖ TRỢ", AI (hoặc Coder) đã tự chọn cách dễ nhất là "tạo luôn 1 task mới cho Sếp" thay vì giải quyết bài toán UI cho trạng thái "Nhân viên chờ Sếp trả lời trên cùng 1 task".

---

## 7. KẾT LUẬN CUỐI CÙNG

| Vấn đề | Kết luận |
|---|---|
| Hiến pháp sai | **Không** (Nghiệp vụ trong Hiến pháp ghi rất chặt chẽ và chuẩn xác). |
| Code sai Hiến pháp | **CÓ** (Lệch cực kỳ nghiêm trọng ở các luồng FORWARD, REASSIGN, ESCALATE, OVERDUE). |
| AI audit trước suy diễn sai | **CÓ** (AI tự vẽ ra flow Forward, hiểu sai Escalate và bỏ qua lỗi DB Lock/Ownership). |
| Cần sửa Hiến pháp | **Có** (Phải loại bỏ hoặc định nghĩa lại khái niệm Forward để tránh đá chân với Reassign). |
| Cần sửa code | **CÓ** (Phải đập đi code lại flow Escalate, Reassign và sửa Overdue Unlock). |
| Cần khóa semantic rõ hơn | **CÓ** (Bắt buộc phải cập nhật prompt để AI không được tự đẻ ra keyword nghiệp vụ mới). |
