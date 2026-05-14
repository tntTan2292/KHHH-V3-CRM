# 🏛️ CRM 3.0 MASTER INDEX - VNPOST HUE EXECUTIVE COMMAND CENTER

Chào mừng các AI Assistant và Cộng tác viên. Đây là bản đồ kiến trúc và chỉ mục kỹ thuật của hệ thống CRM 3.0. Vui lòng đọc kỹ phần **Logic vận hành** trước khi thực hiện bất kỳ thay đổi nào.

---

## 🧠 1. LOGIC VẬN HÀNH CỐT LÕI (THE BRAIN)
Hệ thống hoạt động dựa trên nguyên tắc **Single Source of Truth (SSOT)** và **Governed Analytics**.

- **Lifecycle Engine**: Định nghĩa 5 trạng thái khách hàng (Mới, Hiện hữu, Nguy cơ, Rời bỏ, Tái hoạt động). Mọi logic đếm khách hàng phải tuân thủ Engine này.
  - [lifecycle_engine.py](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/app/services/lifecycle_engine.py)
- **Summary Service**: Công cụ tổng hợp dữ liệu từ Giao dịch thô sang bảng Analytical (`MonthlyAnalyticsSummary`). Đây là nguồn dữ liệu cho mọi biểu đồ.
  - [summary_service.py](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/app/services/summary_service.py)
- **Scoping Service**: Quản trị phân quyền dữ liệu theo phân cấp (Toàn tỉnh -> Bưu cục -> Tuyến thu gom).
  - [scoping_service.py](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/app/services/scoping_service.py)

---

## 📜 2. HIẾN PHÁP & QUY TẮC PHÁT TRIỂN
Mọi thay đổi code phải không được vi phạm các quy tắc trong Hiến pháp CRM 3.0.
- [HIEN_PHAP_CRM_3.0.md](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/Rules/HIEN_PHAP_CRM_3.0.md) (Quy tắc tối thượng)
- [NK_PHAT_TRIEN_V3.0.md](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/Rules/NK_PHAT_TRIEN_V3.0.md) (Nhật ký thay đổi)

---

## 🖥️ 3. FRONTEND MAP (REACT + VITE)
Giao diện tập trung vào tính mật độ thông tin cao (Executive Density).
- **Trang chủ Dashboard**: [Dashboard.jsx](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/src/pages/Dashboard.jsx)
- **Quản lý Khách hàng**: [Customers.jsx](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/src/pages/Customers.jsx)
- **Báo cáo Di cư (Movement)**: [MovementReport.jsx](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/src/pages/MovementReport.jsx)
- **Giao diện chuẩn (Executive CSS)**: [executive_theme.css](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/src/styles/executive_theme.css)

---

## ⚙️ 4. BACKEND MAP (FASTAPI)
- **Điểm nhập (EntryPoint)**: [main.py](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/app/main.py)
- **Database Schema**: [models.py](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/app/models.py)
- **API Analytics**: [analytics.py](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/app/routers/analytics.py) (Nơi chứa logic các biểu đồ)
- **API Customers**: [customers.py](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/app/routers/customers.py)

---

## 🗄️ 5. CẤU TRÚC DỮ LIỆU (DATABASE STRATEGY)
Hệ thống sử dụng SQLite (phát triển) và đã sẵn sàng cho PostgreSQL.
- **Bảng Giao dịch (`transactions`)**: Chứa dữ liệu thô từ file Excel/Hệ thống phát.
- **Bảng Tổng hợp (`monthly_analytics_summary`)**: Chứa dữ liệu đã tính toán theo tháng, point_id, và lifecycle. **BIỂU ĐỒ CHỈ ĐƯỢC ĐỌC TỪ ĐÂY.**

---

## 🛠️ 6. CÔNG CỤ DUY TRÌ (SCRIPTS)
Dành cho việc bảo trì và làm mới dữ liệu thủ công:
- [rebuild_summary.py](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/scripts/rebuild_summary.py) (Làm mới toàn bộ Dashboard)
- [database_optimizer.py](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/scripts/database_optimizer.py) (Tối ưu chỉ mục và tốc độ)

---
*Cập nhật: 14/05/2026 - Antigravity AI*
