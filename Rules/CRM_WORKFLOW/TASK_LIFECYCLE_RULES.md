# HIẾN PHÁP VẬN HÀNH ACTION CENTER & CRM WORKFLOW (KHHH-V3)

> [!IMPORTANT]
> Tài liệu này đóng vai trò là "Hiến pháp" định chuẩn toàn bộ quy trình vận hành giao việc, chăm sóc và tiếp cận khách hàng trên hệ thống CRM 3.0. Dành cho tất cả Quản lý, Giám sát và Nhân viên thị trường để hiểu rõ cách thức hệ thống vận hành.

---

## 1. Triết lý tổng thể hệ thống CRM Workflow

Hệ thống được thiết kế dựa trên 4 nguyên tắc cốt lõi:

1. **Ủy quyền thực thi:** Nhân viên được phép tự chủ hoàn thành Task nếu cung cấp đủ thông tin Báo cáo (Feedback) theo yêu cầu.
2. **Quản lý hỗ trợ (Servant Leadership):** Leader/Quản lý chủ yếu đóng vai trò Giám sát tiến độ, Điều phối (Reassign) khi quá tải và Hỗ trợ (Escalation) khi nhân viên gặp bế tắc.
3. **Chống "Giam lỏng" Khách hàng (Anti-Orphan Lock):** Không một khách hàng nào bị "khóa" chết ở một nhân viên. Tuy nhiên, khi Quá hạn SLA, hệ thống CHỈ cảnh báo đỏ và trừ KPI. Quyền thu hồi (Reassign) phụ thuộc hoàn toàn vào Quyết định của Leader.
4. **Action Center = Customer Lifecycle Management:** Action Center CHỈ phục vụ khách hàng hiện hữu (đã có mã). KHÔNG dùng cho Phễu Sale, KHÔNG dùng cho Lead.

---

## 2. Phân tách 3 Domain Dữ Liệu (Customer Domains)

Hệ thống quản lý 3 tệp dữ liệu với bản chất hoàn toàn khác nhau. **Action Center hiện tại CHỈ xử lý Domain số 1.**

| Tầng Khách Hàng | Mô tả nghiệp vụ | Nơi xử lý |
| :--- | :--- | :--- |
| **1. CUSTOMER LIFECYCLE DOMAIN** | Khách hàng ĐÃ có mã KH chính thức và đã/đang đóng góp doanh thu. Mục tiêu là Giữ chân, cảnh báo rời bỏ, VIP care. | **Sử dụng Action Center hiện tại.** |
| **2. POTENTIAL LEAD DOMAIN** | Lead chưa có mã nhưng đã phát sinh giao dịch thực tế. Mục tiêu là chuyển đổi thành KH chính thức. | *Sẽ có workflow riêng (Module khác).* |
| **3. MARKET LEAD DOMAIN** | Lead do nhân viên tự tìm kiếm đi thị trường, import tay. Mục tiêu là sale mới hoàn toàn. | *Sẽ có module Sales CRM riêng.* |

---

## 3. Bản chất của Action Center

> [!WARNING]
> Action Center hiện tại là **"Trung tâm điều hành chăm sóc & hành động với Khách hàng hiện hữu"**.
> TUYỆT ĐỐI KHÔNG mang tư duy "Phễu bán hàng" (Sale Funnel), "Chuyển đổi Lead" (Lead Conversion) hay "Pipeline Sale" vào đây.

Cách thức vận hành của Action Center:
- Giao Task chăm sóc dựa trên **Kịch bản** (Ví dụ: Cảnh báo rời bỏ, Chúc mừng sinh nhật VIP, Xử lý bồi thường).
- Hành động: Gọi điện / Gặp mặt $\rightarrow$ Báo cáo kết quả $\rightarrow$ Đóng Task.
- Hoàn toàn vắng bóng các thuật ngữ như "Sàng lọc", "Báo giá", "Chốt Sale", "Win rate".

---

## 4. Danh sách trạng thái Task chuẩn (Task Status)

Mỗi "Công việc" (Task tiếp cận) sẽ chạy qua các trạng thái sau:

| Trạng thái (Status) | Ý nghĩa nghiệp vụ | Trách nhiệm xử lý |
| :--- | :--- | :--- |
| **MỚI NHẬN** (New) | Quản lý vừa giao việc, hoặc hệ thống tự động giao. Nhân viên chưa xem. | Nhân viên |
| **ĐANG XỬ LÝ** (In Progress) | Nhân viên đã ấn "Nhận việc" và đang trong quá trình tiếp cận/liên hệ KH. | Nhân viên |
| **CHỜ HỖ TRỢ / CHỜ CHỈ ĐẠO** (Escalated) | Nhân viên gặp khó, báo cáo lên Leader xin hướng xử lý. (Task vẫn của nhân viên, không đẻ task mới cho sếp) | Leader chỉ đạo / Nhân viên |
| **HOÀN THÀNH** (Completed) | Đã xong. Đã lưu Báo cáo kết quả (Thành công hoặc Thất bại đều là Hoàn thành task). | Hệ thống đóng |
| **QUÁ HẠN** (Overdue) | Đã lố hạn SLA quy định. (Chỉ Cảnh báo đỏ, KHÔNG tự động thu hồi/unlock khách hàng) | Leader quyết định |
| **ĐÃ HỦY** (Canceled) | Task bị hủy do giao sai, khách hàng không tồn tại, hoặc trùng lặp. | Leader / Quản lý |

---

## 5. Luật chuyển trạng thái (State Transition Rules)

- **MỚI NHẬN** $\rightarrow$ Chỉ có thể chuyển sang **ĐANG XỬ LÝ** (Khi nhân viên click Nhận).
- **ĐANG XỬ LÝ** $\rightarrow$ Có thể chuyển sang **HOÀN THÀNH** (Kèm nội dung báo cáo), hoặc **CHỜ HỖ TRỢ** (Kèm lý do xin chỉ đạo).
- **CHỜ HỖ TRỢ** $\rightarrow$ Leader chỉ đạo hướng xử lý và chuyển ngược về **ĐANG XỬ LÝ** để trả lại cho nhân viên, hoặc Leader quyết định **REASSIGN** cho người khác. Tuyệt đối KHÔNG đẻ thêm task mới cho Leader.
- Mọi Task khi bị lố giờ tự động bị gắn cờ **QUÁ HẠN** để cảnh báo. Việc quá hạn KHÔNG tự động nhả khóa khách hàng, KHÔNG tự mất ownership, KHÔNG tự reassign.

---

## 6. Luật Khóa/Mở Khách Hàng (Locking Rules)

> [!NOTE]
> Chi tiết triết lý và cơ chế Khóa (Lock)/Mở khóa (Unlock) đã được chuyển sang tài liệu chuyên biệt.
> Vui lòng xem: `[PERMISSION_SCOPING_RULES.md](PERMISSION_SCOPING_RULES.md)`

---

## 7. Luật Giao lại (Reassign Rules)

> [!NOTE]
> Phân quyền Reassign (Ai được giao lại, Giữ lịch sử thế nào) đã được quy định chi tiết tại Hiến pháp Phân quyền.
> Vui lòng xem: `[PERMISSION_SCOPING_RULES.md](PERMISSION_SCOPING_RULES.md)`

---

## 8. Luật Xin Hỗ trợ (Escalation Rules)

> [!NOTE]
> Luật leo thang, ai được hỗ trợ ai, và hành động của Leader đã được quy định tại phần Escalation Rules.
> Vui lòng xem: `[PERMISSION_SCOPING_RULES.md](PERMISSION_SCOPING_RULES.md)`

---

## 9. Luật Thời hạn (SLA Rules)

- **SLA Khởi tạo:** Mọi task khi sinh ra ĐỀU PHẢI CÓ thời hạn (Deadline). Không có task vô thời hạn.
- **Hệ thống đếm giờ:** Tính theo giờ hành chính (Tùy chọn) hoặc Real-time.
- **Cảnh báo vàng:** Trước khi hết hạn 24h, hệ thống báo nhắc nhở nhẹ.
- **Cảnh báo đỏ (Overdue):** Quá hạn $\rightarrow$ Trừ điểm KPI của nhân viên $\rightarrow$ Báo cáo lên Leader Dashboard. Tuyệt đối KHÔNG tự động nhả khóa Khách hàng hay đổi người phụ trách. Chỉ Leader mới có quyền định đoạt (Reassign).

---

## 10. Luật Ghi nhận lịch sử (Timeline Logging)

> [!TIP]
> Timeline là bằng chứng thép của hệ thống CRM. "Nếu không có trên hệ thống, coi như chưa từng xảy ra."

- Mọi thao tác: Đổi trạng thái, Đổi người, Sửa deadline, Viết báo cáo... **Tự động lưu** thành 1 dòng thời gian (Log) không thể xóa.
- Khi nhân viên **Hoàn thành** task, BẮT BUỘC phải điền Text báo cáo hoặc chọn Dropdown kết quả.
- Báo cáo phải có Check-in định vị (Nếu là task Gặp mặt) hoặc Ghi âm (Nếu có tổng đài).

---

## 11. Ma trận Phân quyền (Permission Matrix)

> [!NOTE]
> Ma trận phân quyền thao tác và Xem dữ liệu toàn hệ thống được tổng hợp tại:
> `[PERMISSION_SCOPING_RULES.md](PERMISSION_SCOPING_RULES.md)`

---

## 12. Rủi ro Cốt tử: Trộn lẫn Phễu & Lifecycle (The Mixing Risk)

> [!CAUTION]
> **Tuyệt đối không nhét "Customer Lifecycle" vào Phễu Bán Hàng (Funnel).**

Nếu vi phạm, hệ thống sẽ gặp các rủi ro sau:
1. **Gãy logic:** Khách VIP đang mang lại doanh thu trăm triệu, nếu đưa vào Phễu B1 (Tiếp cận) sẽ làm hỏng toàn bộ chỉ số chuyển đổi, vì khách này vốn đã "Chuyển đổi" từ lâu.
2. **Rác dữ liệu:** Nhân viên không biết dùng bước nào để đóng Phễu, dẫn đến treo dữ liệu ảo.
3. **Mất điểm chạm:** Chăm sóc khách hiện hữu cần kịch bản tinh tế (Tặng quà, xử lý khiếu nại), không phải là thúc ép chốt Sale như khách hàng mới.
4. Xuyên tạc báo cáo: Tỉ lệ chốt Sale (Win rate) của toàn chi nhánh sẽ bị sai lệch nghiêm trọng.

---

## 13. TASK TYPE (Phân loại Công việc)

Phân biệt rõ bản chất của từng loại công việc trong Action Center:

| Task Type | Ý nghĩa nghiệp vụ |
| :--- | :--- |
| **CUSTOMER_CARE** | Chăm sóc định kỳ Khách hàng hiện hữu. |
| **CHURN_WARNING** | Tiếp cận khẩn cấp Khách hàng có nguy cơ rời bỏ. |
| **VIP_CARE** | Chăm sóc đặc biệt Khách hàng VIP (Sinh nhật, Lễ Tết). |
| **REACTIVATION** | Kích hoạt lại Khách hàng đã ngủ đông/rời bỏ từ lâu. |
| **ESCALATION_SUPPORT** | Nhiệm vụ phát sinh do cấp dưới xin hỗ trợ. |
| **CROSS_POINT_SUPPORT**| Nhiệm vụ đi chăm sóc hộ khách hàng của bưu cục khác. |

> [!TIP]
> Task Type quyết định **Kịch bản** mà nhân viên phải nói khi gặp khách, giúp nhân viên không bị lúng túng.

---

## 14. TASK OUTCOME (Kết quả xử lý)

Outcome là kết quả cuối cùng của cuộc gặp/gọi điện. **Outcome hoàn toàn khác với Task Status (Trạng thái công việc).**

| Outcome (Kết quả) | Ý nghĩa thực tế |
| :--- | :--- |
| **SUCCESS** | Thành công (Khách đồng ý gửi hàng, hài lòng). |
| **FAILED** | Không thành công (Khách từ chối dứt khoát). |
| **NO_RESPONSE** | Khách hàng không nghe máy / Không gặp được. |
| **FOLLOW_UP** | Chăm sóc chưa dứt điểm, cần theo dõi và gặp lại. |
| **ESCALATED** | Vượt thẩm quyền, đã đẩy lên cho sếp xử lý. |
| **INVALID_TARGET** | Nhầm người, sai số điện thoại, khách ảo. |

> [!WARNING]
> Bất kể Outcome là gì (kể cả FAILED), hệ thống vẫn ghi nhận Task Status là **HOÀN THÀNH**. Đừng nhầm lẫn giữa việc "Hoàn thành nhiệm vụ đi gặp khách" và việc "Khách đồng ý mua hàng".

---

## 15. TASK OWNERSHIP (Sở hữu Công việc)

Sở hữu (Ownership) quyết định ai là người chịu trách nhiệm chính về Khách hàng và Công việc đó. Quyền này luôn cố định cho tới khi LEADER can thiệp.

| Khái niệm | Ý nghĩa |
| :--- | :--- |
| **Owner chính (Primary)**| Người đang nắm giữ và chịu trách nhiệm chính. |
| **Reassign (Điều chuyển)** | Cắt hẳn khách hàng giao cho người khác. **Hành động DUY NHẤT được phép thay đổi Owner**. Chỉ Leader mới có quyền này. |
| **Escalation (Xin hỗ trợ)** | Báo cáo Leader xin hướng xử lý. **Không đổi Owner, Task vẫn của nhân viên, Không tạo task mới cho sếp**. |
| **Forward (Điều phối tiếp)** | 🚫 **BỊ CẤM (DEPRECATED)**. Nhân viên tuyệt đối KHÔNG được tự ý chuyển khách cho nhau để tránh đá bóng trách nhiệm. |
| **Các Action KHÔNG đổi Owner** | ACCEPT, OVERDUE, REPORT, COMPLETED. Tất cả hành động này **không** làm thay đổi người chịu trách nhiệm. |

> [!CAUTION]
> **PHÂN BIỆT RÕ "OWNERSHIP" vs "LOCK":**
> - **Ownership:** Người chịu trách nhiệm chính (Accountability).
> - **Lock:** Cơ chế chống nhiều người cùng chăm sóc một khách.
> - *(Technical Limitation):* Hiện tại hệ thống đang dùng chung 1 field (`Customer.assigned_staff_id`) cho cả 2 khái niệm này. 
> - **AI SAFETY WARNING:** Tuyệt đối KHÔNG được để AI tự suy diễn 2 khái niệm này là một, không được phép viết code tự động gán `assigned_staff_id = None` khi Overdue.

---

## 16. AI SAFETY RULE (Khóa Semantic)

> [!CAUTION]
> Để bảo vệ sự toàn vẹn của Hiến pháp, cấm tuyệt đối mọi sự suy diễn từ AI/Coder.
>
> **AI/Coder KHÔNG ĐƯỢC PHÉP:**
> - Tự đẻ semantic mới (Ví dụ: tự nghĩ ra quy trình "Forward").
> - Tự suy diễn workflow mới ngoài các rule đã chốt.
> - Tự thêm automation/cronjob ngoài Constitution (Ví dụ: tự viết logic unlock khách hàng khi overdue).
>
> **Mọi semantic mới / tính năng mới:**
> - PHẢI được báo cáo và ghi vào Constitution/Rules trước.
> - Chờ Phê duyệt rồi mới được phép implement vào Code.
