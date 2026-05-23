# 🧠 AI Context Onboarding Guide

Chào mừng bạn đến với thư mục `AI_CONTEXT`. Đây là thư mục làm việc (working context) của các AI Agents trong dự án KHHH V3.0.

> [!WARNING] 
> **SOURCE OF TRUTH**: Tất cả các **Quy tắc cốt lõi (Rules)**, **Quy ước lập trình (Conventions)** và **Kiến trúc gốc** đều nằm ở thư mục `/Rules` ở gốc dự án. Tuyệt đối **KHÔNG SỬA** các file trong `/Rules` trừ khi có lệnh rõ ràng. `AI_CONTEXT` chỉ đóng vai trò hướng dẫn quy trình và báo cáo tiến độ hiện tại.

---

## 📖 AI Nên Đọc Gì Trước?

Khi bạn vừa được on-board hoặc bắt đầu một session mới, hãy đọc theo thứ tự ưu tiên sau để lấy đủ Context:

1. **`00_FOUNDATION/PROJECT_OVERVIEW.md`**: Hiểu mục tiêu và định hướng toàn dự án.
2. **`00_FOUNDATION/DATA_FLOW.md`**: Nắm vững luồng dữ liệu kiến trúc.
3. **`03_PHASES_ACTIVE/PHASE6_STABILIZATION_PLAN.md`** (hoặc các file Active Phase khác): Biết được chúng ta đang tập trung giải quyết việc gì hiện tại.

---

## 📂 Ý Nghĩa Các Thư Mục

### 🏗️ `00_FOUNDATION/`
Chứa các nền tảng kiến thức cơ bản của dự án.
- **`PROJECT_OVERVIEW.md`**: Tổng quan dự án, mục đích hệ thống.
- **`DATA_FLOW.md`**: Sơ đồ luồng dữ liệu, liên kết các module.
- **`IMPORTANT_FILES.md`**: Danh sách file nguy hiểm/quan trọng trong source code.
- **`KPI_DEFINITIONS.md`**: Các định nghĩa về chỉ số đo lường.

### 🎨 `01_FRONTEND/`
Chứa tài liệu riêng cho việc thiết kế UI/UX và kiến trúc Frontend.
- **`DASHBOARD_ARCHITECTURE.md`**: Cấu trúc Widget, layout Dashboard.
- **`SCREENSHOTS.md` & `/screenshots`**: Hình ảnh minh họa giao diện.

### ⚙️ `02_OPERATIONAL_WORKFLOW/`
Chứa các thiết kế quy trình nghiệp vụ hệ thống.
- **`USER_FLOW.md`**: Sơ đồ luồng thao tác của người dùng.

### 🚀 `03_PHASES_ACTIVE/`
Chứa tài liệu kế hoạch của **Phase hiện tại đang phát triển**. AI cần đọc thư mục này để biết mục tiêu sprint/phase hiện tại.

### 🔍 `04_AUDITS/`
Chứa các tài liệu rà soát, báo cáo lỗi, và technical debt đang cần xử lý (nhưng chưa đưa vào active plan).
- **`DASHBOARD_AUDIT.md`**: Các vấn đề của UI cũ.
- **`TECHNICAL_DEBT.md`**: Nợ kỹ thuật cần dọn.

### 📦 `05_ARCHIVE/`
**[OBSOLETE]** - Chứa toàn bộ các kế hoạch, báo cáo audit của các Phase cũ. 
- AI **KHÔNG CẦN ĐỌC** thư mục này trừ khi cần truy vết lịch sử quyết định cũ.
- Bao gồm: `OLD_PHASES/` và `OBSOLETE_AUDITS/`.

---

## ⚖️ Quy Tắc Cập Nhật
- Nếu có một quyết định thiết kế kiến trúc/luật lệ mới ra đời, hãy đề xuất ghi nó vào `/Rules`.
- Cập nhật tiến độ hàng ngày vào các file trong `03_PHASES_ACTIVE/`.
- Nếu audit phát hiện lỗi mới, hãy ghi vào `04_AUDITS/`.
- Khi chuyển Phase, hãy **Move** các file từ `03_PHASES_ACTIVE` sang `05_ARCHIVE/OLD_PHASES`. Tuyệt đối không xóa.
