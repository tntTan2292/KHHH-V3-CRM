# HƯỚNG DẪN SỬ DỤNG THƯ MỤC RULES (SINGLE SOURCE OF TRUTH)

> [!IMPORTANT]
> Thư mục `/Rules` là "Nguồn luật gốc duy nhất" (Single Source of Truth) của hệ thống KHHH-V3-CRM. Bất kỳ AI hoặc Developer nào khi bắt đầu làm việc với hệ thống đều **BẮT BUỘC PHẢI ĐỌC** các file trong thư mục này.

---

## 1. Thư mục /Rules dùng để làm gì?
Thư mục này chỉ chứa các **quy định bất biến**, **cấu trúc chuẩn mực**, và **triết lý cốt lõi** không thay đổi trong ngắn hạn. Nó hoạt động như một bộ hiến pháp để AI và con người tuân theo.

### AI bắt buộc phải đọc file nào trước?
Khi bạn (AI) nhận yêu cầu code hoặc thay đổi kiến trúc, bạn phải tra cứu thư mục tương ứng trong `/Rules` để đảm bảo code của bạn không vi phạm nguyên tắc của hệ thống.

**Cụ thể:**
- Đọc `PERMISSION_SCOPING_RULES.md` trước khi sửa bất kỳ logic nào liên quan đến: Action Center, Giao việc, Escalation, Timeline, Reassign, hoặc phân quyền xem dữ liệu.

---

## 2. Cấu trúc chuẩn của /Rules

Thư mục được chia thành các nhóm chuyên biệt:

### 🏢 CORE_SYSTEM
Chứa các hiến pháp hệ thống cao nhất:
- `HIEN_PHAP_CRM_3.0.md`: Triết lý thiết kế lõi, Single Source of Truth (SSOT).
- `HIEN_PHAP_DOANH_THU_CRM_3.0.md`: Cách tính doanh thu và luồng dữ liệu Transaction.

### 🔄 CRM_WORKFLOW
Chứa quy trình nghiệp vụ:
- `LIFECYCLE_SSOT_REFERENCE_TABLE.md`: Bảng chuẩn vòng đời khách hàng.
- `TASK_LIFECYCLE_RULES.md`: Quy trình giao việc, ticket, SLA.
- `PERMISSION_SCOPING_RULES.md`: [Bắt buộc đọc] Phân quyền, Scope, Lock, Reassign, Escalation cho Action Center.

### 🎨 UI_UX
Chứa các quy tắc giao diện:
- `UI_STYLE_GUIDE.md`: Phong cách thiết kế, màu sắc, font chữ.
- `COMPONENT_GUIDELINES.md`: Cách thức tái sử dụng component React.
- `UI_UX_GOALS.md`: Triết lý UX, Micro-interactions.

### 💻 DEVELOPMENT
Chứa luật dành cho lập trình viên:
- `DEVELOPMENT_CONVENTIONS.md`: Chuẩn viết code, đặt tên.
- `GIT_WORKFLOW.md`: Luồng commit, quản lý branch.
- `SAFE_REFACTOR_RULES.md`: Quy định refactor (chỉ thêm, không phá vỡ cũ).

### 🗄️ ARCHIVE
Chứa toàn bộ các rule cũ, kế hoạch đã hoàn thành, hoặc file báo cáo tạm thời.

---

## 3. Sự khác nhau giữa /Rules, /AI_CONTEXT và /Archive

Để giữ cho thư mục `/Rules` luôn sạch sẽ và chính xác, chúng tôi phân chia rõ 3 thư mục sau:

| Thư mục | Chứa nội dung gì? | Bản chất |
| :--- | :--- | :--- |
| **`/Rules`** | Hiến pháp, định chuẩn kiến trúc, quy tắc phân quyền, workflow nghiệp vụ cố định. | **BẤT BIẾN** (Là luật, AI phải tuân theo tuyệt đối). |
| **`/AI_CONTEXT`** | Kế hoạch hiện tại, To-do list, file báo cáo profiling, Audit report, kế hoạch refactor. | **TẠM THỜI** (Context thay đổi theo từng Phase). |
| **`/Rules/ARCHIVE`** | Các bản nháp, tài liệu hướng dẫn sử dụng, rule đã lỗi thời, báo cáo cũ. | **LƯU TRỮ** (Chỉ để tra cứu lịch sử, không lấy làm chuẩn). |

> [!CAUTION]
> Tuyệt đối không lưu các file báo cáo, kế hoạch (Plan), hay TODO List vào trong thư mục `/Rules`. Hãy để chúng ở `/AI_CONTEXT`.
