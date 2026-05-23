# PHASE 2.2 — BÁO CÁO AUDIT NỀN TẢNG TIMELINE & REASSIGN

*Mục tiêu: Đánh giá và thiết kế nền tảng cho Hành trình xử lý công việc (Timeline) và Giao lại việc (Reassign) theo đúng luật nghiệp vụ CRM đã được chốt.*

---

## 1. DANH SÁCH CÁC SỰ KIỆN (EVENT) TRÊN TIMELINE

Mỗi tương tác với khách hàng sẽ sinh ra một "Dấu chân" (Event) trên Timeline.

| Tên Sự Kiện | Ý nghĩa thực tế |
| :--- | :--- |
| **TASK_CREATED** | Việc mới được sinh ra |
| **TASK_ASSIGNED** | Sếp đã giao việc này cho Nhân viên A |
| **TASK_STARTED** | Nhân viên A đã bấm nhận việc |
| **TASK_REPORTED** | Nhân viên A báo cáo tình hình (VD: Đã gọi khách) |
| **TASK_COMPLETED**| Nhân viên A đã chốt xong (Thành công/Thất bại) |
| **TASK_OVERDUE** | Việc bị "Ngâm" quá 7 ngày không ai đụng tới |
| **TASK_REASSIGNED**| Sếp rút việc từ A giao sang cho B |
| **TASK_ESCALATED** | Nhân viên A cầu cứu Sếp |
| **TASK_CANCELLED** | Sếp hủy luôn việc này |
| **CUSTOMER_UNLOCKED**| Khách hàng đã được "Thả tự do" (Hết bị khóa) |

---

## 2. PHÂN QUYỀN HIỂN THỊ TIMELINE

Luật hiển thị cực kỳ rạch ròi, tuân thủ nguyên tắc "Cô lập ngang":

| Vai trò | Quyền xem Timeline | Giới hạn |
| :--- | :--- | :--- |
| **Nhân viên (Staff)** | Xem được toàn bộ lịch sử chăm sóc của chính mình với khách hàng đó. | Không xem được lịch sử Sếp lấy việc giao cho người khác (Reassign history của nội bộ Leader). |
| **Quản lý (Leader/Admin)**| Xem được FULL 100% mọi sự kiện không che đậy. | Chỉ xem trong phạm vi Đơn vị/Bưu cục mình quản lý. |

---

## 3. LỊCH SỬ GIAO LẠI (REASSIGN) ĐANG THIẾU GÌ?

**Hiện trạng:** Bảng ghi nhận mới chỉ có "Ai thao tác" và "Đổi thành trạng thái gì".

**Cái đang thiếu:** 
- Không rõ "Rút từ tay ai".
- Không rõ "Trao cho ai".
- Thiếu ô nhập lý do minh bạch (Giao nhầm, Nhân viên A nghỉ ốm...).

**Giải pháp đề xuất:** Không cần tạo thêm cột mới trong Database (Tránh phình to DB). Chỉ cần lưu 1 đoạn văn bản dạng JSON vào cột lịch sử có sẵn là đủ (Xem mục 6).

---

## 4. LỊCH SỬ XIN HỖ TRỢ (ESCALATION) ĐANG THIẾU GÌ?

**Hiện trạng:** Khi nhân viên kêu cứu, việc đó chỉ đổi trạng thái sang "Chờ hỗ trợ". 

**Cái đang thiếu:**
- Không ghi nhận phản hồi của Sếp (Sếp đã dạy gì cho nhân viên?).
- Không biết việc kêu cứu này đã được Sếp xử lý xong chưa hay vẫn treo.

**Giải pháp đề xuất:** Bổ sung việc lưu "Lời nhắn của Sếp" vào Timeline khi Sếp trả lại việc cho Nhân viên xử lý tiếp.

---

## 5. CÓ CẦN TẠO BẢNG DATABASE MỚI KHÔNG?

**Trả lời: KHÔNG CẦN.**

**Lý do:** Bảng `TaskStateLog` (Nhật ký trạng thái công việc) hiện tại đã rất tốt. Nó đủ sức lưu trữ mọi diễn biến (Ai làm, Lúc nào, Trạng thái gì). Việc đẻ thêm bảng mới chỉ làm hệ thống chậm đi. Chúng ta sẽ tận dụng triệt để bảng này bằng cách nhét thêm các thông tin linh hoạt vào cột `evidence_snapshot_json` (Cột lưu trữ bằng chứng tự do).

---

## 6. CẤU TRÚC JSON CHUẨN ĐỂ LƯU LỊCH SỬ

Thay vì thêm cột mới, ta dùng cột JSON để nhét dữ liệu theo mẫu sau:

| Tên Field | Ý nghĩa cho dân No-code |
| :--- | :--- |
| `from_user_id` | Rút từ tay ai? (Mã nhân viên) |
| `to_user_id` | Giao cho ai? (Mã nhân viên) |
| `reason` | Vì sao lại giao lại / Hủy / Overdue? |
| `evidence_text` | Bằng chứng (Ghi chú của Sếp / Báo cáo của nhân viên) |
| `lat_long` | Định vị GPS lúc báo cáo (Dùng nếu có đi gặp mặt) |

---

## 7. CƠ CHẾ CẢNH BÁO OVERDUE (QUÁ HẠN)

Hệ thống sẽ không tước đoạt Khách hàng ngay, mà sẽ chạy theo "Đèn giao thông" tự động:

| Thời gian ngâm việc | Trạng thái Đèn | Hành động của Hệ thống |
| :--- | :--- | :--- |
| **Quá 3 ngày** | 🟡 **Đèn Vàng** (Nhắc nhẹ) | Nhảy thông báo đẩy (Noti) trên app của Nhân viên: *"Bạn có việc chưa báo cáo"*. |
| **Quá 5 ngày** | 🟠 **Đèn Cam** (Cảnh báo) | Nhảy thông báo vào app của Nhân viên VÀ màn hình của Sếp (Leader): *"Cảnh báo ngâm việc lâu"*. |
| **Quá 7 ngày** | 🔴 **Đèn Đỏ** (OVERDUE) | Khóa vĩnh viễn quyền báo cáo của nhân viên. Tự động đổi trạng thái Task thành **OVERDUE**. Bắn tin khẩn cấp cho Người giao việc (Sếp) để tự ra quyết định. |

> [!WARNING]
> Theo đúng luật nghiệp vụ đã chốt: Hệ thống **KHÔNG TỰ ĐỘNG THU HỒI KHÁCH MÀ CHỈ CẢNH BÁO ĐỎ**. Quyền sinh sát (Reassign hoặc Hủy) nằm hoàn toàn trong tay Sếp trực tiếp. Hệ thống chỉ làm nhiệm vụ minh bạch hóa sự thật trên Timeline.
