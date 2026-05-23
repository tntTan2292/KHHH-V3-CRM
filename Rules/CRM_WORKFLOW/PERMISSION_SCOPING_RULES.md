# LUẬT PHÂN QUYỀN & PHẠM VI DỮ LIỆU (PERMISSION & SCOPING RULES)

> [!IMPORTANT]
> Đây là tài liệu quy định nguyên tắc cốt lõi về Quyền hạn, Phạm vi dữ liệu và Sở hữu khách hàng trong hệ thống CRM 3.0. Mọi tính năng giao việc, phân quyền hiển thị hay báo cáo đều phải tuân thủ tuyệt đối các nguyên tắc này.

---

## A. Scope Hierarchy (Cây Phân Cấp)

Hệ thống hoạt động dựa trên cây phân cấp hành chính (Hierarchy Tree) gồm 5 cấp độ chuẩn:

| Cấp độ | Tên gọi chuẩn | Ví dụ | Quyền hạn bao trùm |
| :--- | :--- | :--- | :--- |
| **Cấp 1** | Bưu điện Tỉnh/TP | BĐTP Huế | Toàn bộ Tỉnh/TP |
| **Cấp 2** | Trung tâm / Chi nhánh | TTKD, TTVH | Toàn bộ cụm/Khu vực được giao |
| **Cấp 3** | Trưởng đại diện / Cụm trưởng | Trưởng Đại diện cụm Nam | Các Bưu cục/Đơn vị thuộc cụm |
| **Cấp 4** | Giám đốc Đơn vị (Phường/Xã) | Bưu cục An Cựu | Toàn bộ nhân viên tại Bưu cục đó |
| **Cấp 5** | Nhân viên (Staff) | Nhân viên Kinh doanh A | Dữ liệu cá nhân |

*(Ngoại lệ: Trung tâm Vận hành (Cấp 2) có thể quản lý trực tiếp Bưu cục 531120 ở Cấp 5 mà không thông qua Cấp 3/4)*

---

## B. Quyền Xem Dữ Liệu (Data Visibility)

Triết lý cốt lõi: **"Nhìn xuống, Cô lập ngang"**.

- **Nhìn xuống (Top-down visibility):** Cấp trên (Leader) mặc định nhìn thấy toàn bộ dữ liệu của tất cả các cấp dưới thuộc nhánh cây của mình.
  - *Ví dụ:* Giám đốc Bưu cục An Cựu sẽ thấy toàn bộ khách hàng của tất cả nhân viên thuộc Bưu cục An Cựu.
- **Cô lập ngang (Horizontal Isolation):** Cấp dưới không được thấy dữ liệu của cấp trên. Các cá nhân/đơn vị cùng cấp không được thấy dữ liệu của nhau.
  - *Ví dụ:* Nhân viên A không thấy khách của Nhân viên B (dù chung Bưu cục). Bưu cục An Cựu không thấy khách của Bưu cục Vỹ Dạ.
- **Quyền tuyệt đối:** Nhân viên (Staff) **chỉ nhìn thấy** khách hàng mà mình đang là Chủ sở hữu (Owner) hoặc được gán làm Người phối hợp (Collaborator).

---

## C. Quyền Giao Việc (Task Delegation Rules)

| Ai giao việc? | Giao cho ai? | Quy tắc bắt buộc | Bật cờ `cross_point_flag` khi nào? |
| :--- | :--- | :--- | :--- |
| **Leader/Quản lý** | Cấp dưới trực tiếp | Chỉ giao trong phạm vi Node quản lý. | ❌ Không |
| **Admin / Tỉnh** | Bất cứ ai | Giao từ trên cùng xuống nhánh bất kỳ. | ❌ Không |
| **Cấp ngang hàng** | Lẫn nhau | **Không được phép tự giao việc chéo.** | N/A |
| **Hệ thống (Auto)** | Theo cấu hình | Phân bổ lead theo luồng. | N/A |

> [!WARNING]
> Nếu bắt buộc phải nhờ một nhân viên ở Bưu cục khác đi gặp khách (Ví dụ: Khách ở An Cựu nhưng giao hàng tại Vỹ Dạ), hệ thống phải bật cờ **`cross_point_flag`**. Cờ này đánh dấu đây là ngoại lệ giao chéo, báo cáo kết quả sẽ trả về cho Bưu cục gốc (Owner).

---

## D. Ownership Rules (Luật Sở Hữu Khách Hàng)

Mọi khách hàng trên CRM đều phải có một **Chủ sở hữu (Owner)**. Khách hàng không thể vô chủ.

- **Khách hàng Hiện hữu (Lifecycle):** Owner mặc định theo **Bưu cục chấp nhận cuối cùng** của khách hàng (Transaction Truth Ownership).
- **Khách hàng Tiềm năng (Manual Lead):** Owner thuộc về nhân viên đã tạo ra/khai thác lead đó (B1/B2).
- **Primary Owner Model:** Một khách hàng chỉ có duy nhất **01 Primary Owner** (Chịu trách nhiệm KPI chính) và có thể có nhiều Collaborators (Người phối hợp).
- **Khi nào Transfer Ownership?** Khi khách hàng thực sự thay đổi địa điểm giao dịch liên tục, hoặc khi có Quyết định điều chuyển từ Lãnh đạo (Reassign).

---

## E. Escalation Rules (Luật Leo Thang - Xin Hỗ Trợ)

Khi nhân viên không thể tự xử lý (Khách chửi, cần giảm giá sâu, vượt thẩm quyền), nhân viên được quyền **Xin Hỗ Trợ (Escalate)**.

- **Escalate đi đâu?** Task sẽ ngay lập tức được đẩy thẳng lên màn hình của **Leader trực tiếp (Cấp trên 1 bậc)**. Không được Escalate nhảy cóc.
- **Có giữ Task cũ không?** Task vẫn nằm trong danh sách của nhân viên nhưng chuyển sang trạng thái `CHỜ HỖ TRỢ`.
- **Leader làm gì?**
  1. Hướng dẫn (Ghi chú) và trả lại Task.
  2. Tự đi gặp khách và tự ấn Hoàn thành Task.
  3. Giao lại (Reassign) cho người khác chuyên môn cao hơn.

---

## F. Customer Lock Philosophy (Triết Lý Khóa Khách Hàng)

> [!TIP]
> Để tránh tình trạng "Om khách" (Nhận khách nhưng không chịu đi bán hàng/chăm sóc).

1. **Lock là gì?** Khi một Task tiếp cận khách hàng được tạo, khách hàng đó bị **Khóa (Lock)** lại cho nhân viên được giao. Không ai khác được tương tác hay giật khách.
2. **Khi nào Unlock?** Khách hàng sẽ được **Mở khóa (Unlock)** ngay lập tức khi:
   - Nhân viên hoàn thành Task (Có báo cáo).
   - Task bị lố hạn (Quá hạn SLA).
   - Quản lý chủ động bấm Force Unlock.
3. **Orphan Lock Risk:** Nếu hệ thống bị lỗi và không chịu Unlock khi quá hạn, khách hàng đó sẽ trở thành "Mồ côi" (Không ai chốt sale được). Do đó, Rule Mở khóa tự động khi Overdue là tối quan trọng và bất khả xâm phạm.
