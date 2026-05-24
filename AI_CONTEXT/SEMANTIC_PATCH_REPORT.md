# SEMANTIC PATCH REPORT — KHHH-V3-CRM
*(Báo cáo cập nhật và Khóa chặt Semantic Hệ thống)*

## 1. Updated Constitution Patch
Các tài liệu Hiến pháp đã được vá (patched) để phản ánh đúng thực tế vận hành và loại bỏ các suy diễn sai lệch trước đó:
- Đã cập nhật `TASK_LIFECYCLE_RULES.md` (Điều 1, 4, 5, 9, 15, 16).
- Đã cập nhật `HIEN_PHAP_CRM_3.0.md` (Thêm AI Semantic Safety Rule vào Elite Protocol).

## 2. Semantic Change Summary
| Semantic | Ý nghĩa đã chốt (Khóa cứng) |
|---|---|
| **OVERDUE** | Chỉ là Cảnh báo đỏ & Trừ KPI. **KHÔNG** tự động Unlock khách hàng, **KHÔNG** tự đổi Owner. Quyết định hoàn toàn nằm ở Leader. |
| **ESCALATE** | Báo cáo Leader xin chỉ đạo. Task chuyển sang `CHỜ CHỈ ĐẠO` và **VẪN LÀ CỦA NHÂN VIÊN**. Leader **KHÔNG** nhận 1 task mới tinh. Leader chỉ ghi chú hướng xử lý trả về, hoặc quyết định Reassign. |
| **OWNERSHIP** | Quyền sở hữu (Accountability) luôn **CỐ ĐỊNH** cho tới khi Leader thực hiện lệnh REASSIGN. Các action (Accept, Overdue, Escalate, Report) tuyệt đối không đổi Owner. |
| **OWNERSHIP vs LOCK** | 2 khái niệm độc lập. (Lock = chống tranh giành, Ownership = trách nhiệm). Việc DB hiện tại đang gộp chung vào cột `assigned_staff_id` là một giới hạn kỹ thuật (Technical Limitation), KHÔNG ĐƯỢC phép lấy lý do đó để tự động viết logic "Unlock = Mất Ownership". |
| **AI SAFETY RULE** | Nghiêm cấm mọi hành vi AI/Coder tự "sáng tác" Semantic, tự đẻ Automation ngoài Hiến pháp. Mọi tính năng mới phải được viết vào Hiến pháp trước khi đụng vào Code. |

## 3. Deprecated Semantic List
🚫 **FORWARD (Điều phối tiếp)**
- **Lý do xóa bỏ:** Gây loạn Ownership, khó đo đếm trách nhiệm, dễ bị lợi dụng để đá bóng trách nhiệm cho đồng nghiệp. Hệ thống chỉ cho phép 1 luồng điều chuyển duy nhất là **REASSIGN** và chỉ có **LEADER** mới được thao tác.
- **Trạng thái:** Đã đánh dấu Deprecated trong Hiến pháp. 

## 4. Required Future Code Fix List
*(Danh sách các đầu việc cần đập đi xây lại trong Phase kế tiếp để Code khớp với Hiến pháp mới)*

1. **API `/overdue`**: Đảm bảo không tồn tại đoạn code nào tự động gán `customer.assigned_staff_id = None`. (Thực tế hiện tại code đang không làm, giữ nguyên không thêm vào).
2. **API `/forward`**: **Xóa bỏ hoàn toàn API này** hoặc đánh dấu `@deprecated`. Tháo gỡ nút UI `[Điều phối tiếp]` trong ActionCenter của nhân viên.
3. **API `/escalate`**: Đập đi viết lại. KHÔNG gọi logic đẻ task mới cho Cluster Leader. Sửa lại thành logic update status task hiện tại của nhân viên thành `CHỜ CHỈ ĐẠO`, và gắn cờ notify cho Leader.
4. **API `/reassign`**: Fix lại lỗi hiện tại (Quên cập nhật `Customer.assigned_staff_id` dưới DB). Đảm bảo Reassign là API duy nhất được quyền sửa cột field này để chuyển quyền.
5. **Timeline Render**: Đảm bảo UI đọc Timeline không còn render "Forwarded" (trừ khi là data lịch sử).
