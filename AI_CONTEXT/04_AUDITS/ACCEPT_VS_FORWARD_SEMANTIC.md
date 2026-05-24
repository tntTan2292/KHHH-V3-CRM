# AUDIT & SEMANTIC DESIGN: ACCEPT vs FORWARD

**Mục tiêu:** Định nghĩa rõ ràng Semantic (ngữ nghĩa) giữa hành vi Nhận xử lý (ACCEPT) và Điều phối tiếp (FORWARD) trong mô hình Flexible Delegation. Tránh sự nhầm lẫn với Reassign (Chuyển giao ngang) trong CRM thông thường.

---

## 1. OWNER BEHAVIOR MODEL (HIỆN TẠI VS TƯƠNG LAI)

Khi một cấp Quản lý (Leader) nhận được Task từ cấp trên:

| Hành vi | Ý nghĩa | Trạng thái hệ thống (Semantic) |
|---|---|---|
| **ACCEPT** | Tự giữ xử lý | `staff_id` giữ nguyên. Task chuyển trạng thái sang `IN_PROGRESS` (hoặc Đang xử lý). |
| **FORWARD** | Giao tiếp xuống dưới | `staff_id` thay đổi thành cấp dưới. Trạng thái Task giữ nguyên (Vẫn là `NEW`). |

**Đánh giá hiện trạng Model:**
- **ActionTask:** Hỗ trợ tốt vì chỉ cần đổi `staff_id`.
- **TaskStateLog:** Đang dùng chung hành động `REASSIGN` cho mọi việc đổi `staff_id`. Điều này làm **trộn lẫn** giữa việc "Sửa sai người nhận" (Reassign ngang) và "Điều phối xuống cấp dưới" (Forward dọc).

---

## 2. PHÂN BIỆT RÕ: REASSIGN vs FORWARD vs ESCALATION

Sự trộn lẫn Semantic hiện tại cần được rạch ròi bằng 3 khái niệm:

| Khái niệm | Hướng di chuyển | Mục đích vận hành |
|---|---|---|
| **FORWARD** (Điều phối tiếp) | ⬇️ **Đi Xuống** (Vertical Down) | Cấp trên nhận việc $\rightarrow$ Chia nhỏ/đẩy xuống cấp dưới xử lý thay. |
| **REASSIGN** (Phân công lại) | ➡️ **Đi Ngang** (Horizontal) | Giao nhầm người $\rightarrow$ Giao lại cho người khác cùng cấp. (VD: Cụm A $\rightarrow$ Cụm B). |
| **ESCALATE** (Báo cáo vượt cấp)| ⬆️ **Đi Lên** (Vertical Up) | Cấp dưới không xử lý được $\rightarrow$ Đẩy ngược lên cấp trên xin ý kiến. |

---

## 3. BUSINESS SCENARIOS (MÔ PHỎNG THỰC TẾ)

| Kịch bản | Dòng chảy (Flow) | Ai là Owner cuối? | Semantic Timeline sinh ra |
|---|---|---|---|
| **Scenario A** | GĐ BĐTP $\rightarrow$ Trưởng Cụm $\rightarrow$ Trưởng Cụm tự làm. | **Trưởng Cụm** | BĐTP: `DELEGATED` <br> Trưởng Cụm: `ACCEPTED` |
| **Scenario B** | GĐ BĐTP $\rightarrow$ Trưởng Cụm $\rightarrow$ Trưởng Bưu cục. | **Trưởng Bưu cục** | BĐTP: `DELEGATED` <br> Trưởng Cụm: `FORWARDED` |
| **Scenario C** | GĐ Trung tâm $\rightarrow$ Trưởng BC $\rightarrow$ Nhân viên. | **Nhân viên** | GĐ TT: `DELEGATED` <br> Trưởng BC: `FORWARDED` |

---

## 4. TIMELINE SEMANTIC (ĐỀ XUẤT CHUẨN)

Bảng `TaskStateLog` cần chuẩn hóa bộ `action_type` thay vì chỉ dùng chung chữ `REASSIGN`:

1. `DELEGATED`: Lần giao việc đầu tiên từ Lãnh đạo cấp cao xuống.
2. `ACCEPTED`: Lãnh đạo nhận việc quyết định tự mình giải quyết (Lock Owner).
3. `FORWARDED`: Lãnh đạo quyết định không làm mà đẩy tiếp xuống cấp dưới.
4. `REASSIGNED`: Đổi người ngang hàng (Chỉ người giao ban đầu mới có quyền này).
5. `ESCALATED`: Người đang cầm Task giơ cờ trắng, trả về tuyến trên.

*Timeline UI sẽ đọc các type này để vẽ icon: ⬇️ (Forward), ⬆️ (Escalate), ➡️ (Reassign), ✅ (Accept).*

---

## 5. KPI & ACCOUNTABILITY (TRÁCH NHIỆM)

**Quy tắc bất di bất dịch:**
- **Accountability trực tiếp (Direct):** Thuộc về `staff_id` đang nắm Task cuối cùng. Đánh giá KPI hoàn thành Task tính cho người này.
- **Accountability gián tiếp (Roll-up):** Người giao (Forwarder) vẫn chịu trách nhiệm liên đới. Lý do: Trên hệ thống Dashboard, số liệu của cấp dưới tự động Roll-up (cộng dồn) lên cấp trên theo Hierarchy Tree. 

$\rightarrow$ **Kết luận:** Hệ thống KHÔNG CẦN chia nhỏ % KPI cho chuỗi Forward. Cứ tính 100% cho người cầm cuối cùng. Người Forward tự động hưởng lợi nhờ cơ chế Roll-up Cây Tổ Chức của KPI Engine.

---

## 6. UI/UX IMPACT (ĐỀ XUẤT ACTION CENTER)

Khi một Quản lý mở Task Detail (task đang được giao cho chính họ):

Bên cạnh nút "Báo cáo kết quả", bổ sung 2 nút hành vi rõ ràng:
1. Nút **[ Nhận xử lý ]** (Primary): Chuyển task sang Đang xử lý $\rightarrow$ Sinh log `ACCEPTED`.
2. Nút **[ Điều phối tiếp ]** (Secondary): Mở Assign Modal (như ở Phase 3.4) nhưng khi Submit $\rightarrow$ Sinh log `FORWARDED` thay vì `REASSIGNED`.

*Đảm bảo dân No-code nhìn vào luồng Timeline là hiểu ngay Task đã "chảy" như thế nào.*
