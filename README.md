# 🏛️ VNPOST HUE CRM 3.0 - EXECUTIVE COMMAND CENTER

[![Status](https://img.shields.io/badge/Status-Stable-success)]() [![Stack](https://img.shields.io/badge/Stack-FastAPI%20%7C%20React%20%7C%20SQLite-blue)]()

Chào mừng đến với hệ thống quản trị khách hàng **CRM 3.0 của Bưu điện TP Huế**. Đây là trung tâm điều hành dữ liệu và phân tích hành trình khách hàng dựa trên nguyên tắc **Single Source of Truth (SSOT)**.

---

## 🚀 1. HƯỚNG DẪN VẬN HÀNH NHANH (QUICK START)

Dành cho AI Assistant và Cộng tác viên muốn khởi chạy hệ thống locally:

### **Backend (FastAPI)**
- **Thư mục**: `/backend`
- **Chạy Server**: `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`
- **Database**: `data/database/khhh_v3.db` (SQLite)
- **API Docs**: `http://localhost:8000/docs`

### **Frontend (React + Vite)**
- **Thư mục**: `/` (Root)
- **Chạy Dev**: `npm run dev -- --port 5181`
- **URL**: `http://localhost:5181`

---

## 🧠 2. KIẾN TRÚC & LUỒNG DỮ LIỆU (THE BRAIN)

Hệ thống được vận hành bởi 4 "Động cơ" cốt lõi:
1.  **Hierarchy Engine**: Quản trị mô hình 5 cấp (BĐTP -> Trung tâm -> Trưởng đại diện -> Giám đốc Phường/Xã -> Nhân viên).
2.  **Lifecycle Engine**: Tự động phân loại 5 trạng thái khách hàng (Mới, Hiện hữu, Nguy cơ, Rời bỏ, Tái hoạt động).
3.  **Summary Service**: Tổng hợp dữ liệu từ Giao dịch thô (`Transactions`) sang bảng Analytical (`MonthlyAnalyticsSummary`).
4.  **Scoping Service**: Đảm bảo phân quyền dữ liệu tuyệt đối theo phân cấp quản lý.

---

## 📜 3. HIẾN PHÁP & QUY TẮC PHÁT TRIỂN
Tuyệt đối không vi phạm các nguyên tắc quản trị trong các tài liệu sau:
- [📖 HIÊN PHÁP CRM 3.0](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/Rules/HIEN_PHAP_CRM_3.0.md) (Quy tắc tối thượng)
- [📝 NHẬT KÝ PHÁT TRIỂN](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/Rules/NK_PHAT_TRIEN_V3.0.md) (Theo dõi thay đổi)

---

## 🗺️ 4. BẢN ĐỒ TRA CỨU MÃ NGUỒN (TECHNICAL INDEX)

Sử dụng các liên kết dưới đây để truy cập trực tiếp vào các module quan trọng:

### **Business Logic (Backend Services)**
- [lifecycle_engine.py](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/app/services/lifecycle_engine.py) - Bộ não phân loại khách hàng.
- [summary_service.py](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/app/services/summary_service.py) - Công cụ tổng hợp doanh thu & KPI.
- [scoping_service.py](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/app/services/scoping_service.py) - Logic phân quyền 5 cấp.

### **API Endpoints (Routers)**
- [analytics.py](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/app/routers/analytics.py) - Nguồn dữ liệu cho Dashboard & Biểu đồ.
- [customers.py](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/app/routers/customers.py) - API quản lý danh sách khách hàng.

### **Frontend UI (React Components)**
- [Dashboard.jsx](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/src/pages/Dashboard.jsx) - Giao diện điều hành Executive.
- [Customers.jsx](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/src/pages/Customers.jsx) - Lưới dữ liệu khách hàng & Drill-down.

---

## 🛠️ 5. CÔNG CỤ BẢO TRÌ (ADMIN SCRIPTS)
- [rebuild_summary.py](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/scripts/rebuild_summary.py) - Chạy khi cần làm mới toàn bộ Dashboard.
- [database_optimizer.py](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/scripts/database_optimizer.py) - Tối ưu hiệu năng Database.

---
*Cập nhật lần cuối: 14/05/2026 - Antigravity AI*
