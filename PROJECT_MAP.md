# 🗺️ PROJECT MAP - CRM V3.0 ARCHITECTURE

Bản đồ này cung cấp cái nhìn tổng quan về cấu trúc và luồng dữ liệu của dự án CRM V3.0 phục vụ Audit kiến trúc.

---

## 📂 1. Cấu trúc thư mục chính (Tree View)

```text
/ (Root)
├── backend/                # Toàn bộ logic Server (FastAPI)
│   ├── app/
│   │   ├── auth/           # Core Security & JWT logic
│   │   ├── core/           # Cấu hình hệ thống & Phân hạng (RFM, Constitution)
│   │   ├── models.py       # Database Schema (SQLAlchemy)
│   │   ├── routers/        # API Endpoints (Giao tiếp Front-Back)
│   │   ├── services/       # Business Logic xử lý dữ liệu tập trung
│   │   └── utils/          # Công cụ bổ trợ (Normalization, Logging)
│   └── scripts/            # Jobs, Maintenance & Migrations
├── src/                    # Toàn bộ logic Client (Vite + React)
│   ├── components/         # UI Components tái sử dụng
│   ├── context/            # Quản lý State toàn cục (Auth, UI)
│   ├── pages/              # Các Module chức năng chính (Dashboard, Pipeline)
│   └── utils/              # API Client (Axios) & Helper Front
├── data/                   # Database & Static Files
│   └── database/           # SQLite (khhh_v3.db)
└── Rules/                  # Hiến pháp CRM & Hướng dẫn vận hành
```

---

## 🧩 2. Mô tả chi tiết Module

### 🏗️ Backend Core
- **Routers/API** (`backend/app/routers/`):
    - `actions.py`: Quản lý Giao việc & Báo cáo (Task Pipeline).
    - `analytics.py`: Xử lý Drill-down dữ liệu & Báo cáo thông minh.
    - `customers.py`: Quản lý danh sách khách hàng & Lifecycle.
    - `bot.py`: Điều khiển Elite Bot gửi Zalo tự động.
- **Services** (`backend/app/services/`):
    - `summary_service.py`: Tính toán số liệu Dashboard thời gian thực.
    - `task_verifier.py`: **[CRITICAL]** Đối soát giao dịch tự động để xác thực Task B3.
    - `potential_service.py`: Xử lý dữ liệu Khách hàng tiềm năng & Enrichment.
    - `rfm.py`: Thuật toán phân hạng khách hàng.

### 🔐 Authentication & Security
- **Module Auth** (`backend/app/auth/`):
    - Chức năng: Cấp phát JWT, mã hóa mật khẩu, kiểm tra quyền (Permissions).
    - Liên quan: Mọi Router đều qua `get_current_user` để Scoping dữ liệu.

### 📊 Frontend & UI
- **Dashboard** (`src/pages/Dashboard.jsx`):
    - Chức năng: Hiển thị Morning Pulse, biểu đồ tăng trưởng & Cảnh báo rủi ro.
- **Task Pipeline (5B)** (`src/pages/LeadPipeline.jsx`):
    - Chức năng: Quản lý Kanban hành trình khách hàng từ B1 -> B5.
- **Action Center**: Nơi nhân viên báo cáo kết quả và Leader duyệt Task.

### ⚙️ Scheduler & Jobs
- **Nightly Maintenance** (`backend/scripts/nightly_maintenance.py`):
    - Chức năng: Chạy lúc 0h để dọn dẹp Token, tối ưu DB và chạy Engine đối soát Task.
- **Start Scripts**: `START_SERVICE_V3.0.vbs` quản lý khởi chạy ngầm toàn bộ dịch vụ.

---

## 🔄 3. Luồng dữ liệu chính (Data Flow)

1. **Transaction Sync**: Raw data từ CMS/VNP -> Import API -> `Transaction` table.
2. **Analysis**: `SummaryService` -> `SummaryMain` table (Lưu trữ số liệu đã tính toán để Dashboard load nhanh).
3. **Task & Verify**: `LeadPipeline` (Giao việc) -> `TransactionData` (Đối soát) -> `TaskVerifier` -> Cập nhật trạng thái `Verified`.
4. **Enrichment**: `ReportTask` -> `PotentialCustomer` table (Lưu SĐT/Địa chỉ chi tiết mới).

---
*Tài liệu này được tạo tự động bởi Antigravity phục vụ mục đích Audit.*
