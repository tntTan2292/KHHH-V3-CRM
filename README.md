# 🏛️ VNPOST HUE CRM 3.0 - EXECUTIVE COMMAND CENTER

[![Status](https://img.shields.io/badge/Status-Stable-success)]() [![Stack](https://img.shields.io/badge/Stack-FastAPI%20%7C%20React%20%7C%20SQLite-blue)]()

Chào mừng đến với hệ thống quản trị khách hàng **CRM 3.0 của Bưu điện TP Huế**. Đây là trung tâm điều hành dữ liệu và phân tích hành trình khách hàng dựa trên nguyên tắc **Single Source of Truth (SSOT)**.

---

## 🧠 1. REPO STRUCTURE & DOCUMENT PRIORITY ORDER

Hệ thống tài liệu được tổ chức khắt khe theo kiến trúc `ONE DOMAIN = ONE CONSTITUTION`. 

**DOCUMENT PRIORITY ORDER (THỨ TỰ ƯU TIÊN LUẬT)**
1. **`Rules/`**: Nguồn chân lý cao nhất (Constitution). Nếu có conflict, `Rules` luôn luôn chiến thắng.
2. **`AI_CONTEXT/`**: Bộ nhớ vận hành (Operational memory), tiến độ các phase, và audit dưới 14 ngày.
3. **`ARCHIVE/`**: Lịch sử forensic, tài liệu cũ, báo cáo lỗi. Không có giá trị thực thi.

> [!IMPORTANT]
> Nếu có xung đột (conflict) giữa các tài liệu, **`Rules/` là nguồn chân lý duy nhất (Single Source of Truth).**
> Các file trong `AI_CONTEXT` hay `ARCHIVE` không được quyền ghi đè (override) luật lệ tại `Rules/`.

### 📂 Chi tiết cấu trúc
- 🖥️ `/src`: Chứa toàn bộ source code **Frontend** (React + Vite).
- ⚙️ `/backend`: Chứa toàn bộ source code **Backend** (FastAPI + Python).
- 📜 `/Rules`: **SOURCE OF TRUTH CỐ ĐỊNH**. Chứa luật lệ gốc của hệ thống (Hiến pháp, Conventions, UX Guidelines). Tuyệt đối **KHÔNG** sửa đổi trực tiếp nếu không có Decision Log.
  - `/CORE_SYSTEM`: Hiến pháp lõi của hệ thống.
  - `/ASSIGNMENT`: Luật giao việc.
  - `/SECURITY`: Luật phân quyền và an toàn hệ thống.
  - `/CRM_WORKFLOW`: Luật vòng đời trạng thái khách hàng.
  - `/DECISIONS`: Lịch sử các quyết định chốt luật.
- 📁 `/AI_CONTEXT`: Thư mục làm việc hiện tại, chứa các tài liệu audit active, tiến độ phase, và tài liệu vận hành workflow.
- 📦 `/ARCHIVE`: Chứa tài liệu lịch sử, báo cáo sập hệ thống (forensic history). FOR REFERENCE ONLY.

---

## 🚀 2. HƯỚNG DẪN VẬN HÀNH NHANH (QUICK START)

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

## 🧠 3. KIẾN TRÚC & LUỒNG DỮ LIỆU (THE BRAIN)

Hệ thống được vận hành bởi 4 "Động cơ" cốt lõi:
1.  **[Hierarchy Engine](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/app/services/hierarchy_service.py)**: Quản trị mô hình 5 cấp chức danh (BĐTP -> Trung tâm -> Trưởng đại diện -> Giám đốc Phường/Xã -> Nhân viên).
2.  **[Lifecycle Engine](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/app/services/lifecycle_engine.py)**: Tự động phân loại 5 trạng thái khách hàng (Mới, Hiện hữu, Nguy cơ, Rời bỏ, Tái hoạt động).
3.  **[Summary Service](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/app/services/summary_service.py)**: Tổng hợp dữ liệu từ Giao dịch thô (`Transactions`) sang bảng Analytical (`MonthlyAnalyticsSummary`).
4.  **[Scoping Service](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/app/services/scoping_service.py)**: Đảm bảo phân quyền dữ liệu tuyệt đối theo phân cấp quản lý và các ngoại lệ (531120).

---

## 📜 4. HIẾN PHÁP & QUY TẮC PHÁT TRIỂN
Tuyệt đối không vi phạm các nguyên tắc quản trị trong các tài liệu sau (nằm trong thư mục `Rules/`):
- `Rules/CORE_SYSTEM/HIEN_PHAP_CRM_3.0.md` (Quy tắc tối thượng)
- `Rules/CORE_SYSTEM/NODE_TYPE_DEFINITION.md` (FROZEN - **Quy chuẩn Semantic Node Hierarchy**)
- `Rules/ASSIGNMENT/ASSIGNMENT_CONSTITUTION.md` (FROZEN - **Single Source of Truth cho toàn bộ Assignment System**)
- `Rules/ASSIGNMENT/ASSIGNMENT_DELEGATION_MATRIX.md` (FROZEN - **Luồng phân cấp Delegation**)
- `Rules/SECURITY/SAFE_REFACTOR_RULES.md`

---

## 🗺️ 5. BẢN ĐỒ TRA CỨU MÃ NGUỒN (TECHNICAL INDEX)

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

## 🛠️ 6. CÔNG CỤ BẢO TRÌ (ADMIN SCRIPTS)
- [rebuild_summary.py](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/scripts/rebuild_summary.py) - Chạy khi cần làm mới toàn bộ Dashboard.
- [database_optimizer.py](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/scripts/database_optimizer.py) - Tối ưu hiệu năng Database.
