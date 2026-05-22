# 🏛️ VNPOST HUE CRM 3.0 - EXECUTIVE COMMAND CENTER

[![Status](https://img.shields.io/badge/Status-Stable-success)]() [![Stack](https://img.shields.io/badge/Stack-FastAPI%20%7C%20React%20%7C%20SQLite-blue)]()

Chào mừng đến với hệ thống quản trị khách hàng **CRM 3.0 của Bưu điện TP Huế**. Đây là trung tâm điều hành dữ liệu và phân tích hành trình khách hàng dựa trên nguyên tắc **Single Source of Truth (SSOT)**.

---

## 🎯 1. AI-READY BUSINESS CONTEXT

### 1.1 Business Context
Hệ thống được xây dựng phục vụ **Ban lãnh đạo và Đội ngũ kinh doanh Bưu điện TP Huế**. 
- **Mục tiêu chính**: Số hóa công tác quản trị, chấm dứt việc quản lý rời rạc. Cung cấp góc nhìn 360 độ về sức khỏe tập khách hàng và tự động hóa cảnh báo rủi ro.
- **Vai trò Dashboard**: Là "Trung tâm chỉ huy" giúp lãnh đạo nắm bắt biến động doanh thu theo thời gian thực, nhận diện vùng lõm và ra quyết định điều hành tức thời.

### 1.2 User Roles
- **Ban Giám Đốc / Lãnh Đạo**: Xem toàn cảnh báo cáo vĩ mô, theo dõi dòng chảy doanh thu và cảnh báo cấp bách toàn tỉnh.
- **Trưởng/Phó Phòng**: Theo dõi KPI theo cụm/bưu cục, phát hiện xu hướng và điều phối chiến lược.
- **Trưởng Đại Diện / GĐ Phường Xã**: Quản lý hiệu quả điểm giao dịch trực thuộc.
- **Nhân Viên Kinh Doanh (Sale/AM)**: Theo dõi danh sách khách hàng được giao, tiếp nhận cảnh báo tự động, thực hiện chăm sóc và báo cáo.

### 1.3 User Flow
Luồng vận hành thực tế thường diễn ra như sau:
`Dashboard (Nhìn số tổng)` → `Nhận diện rủi ro/cơ hội` → `Drilldown (Lọc xuống cấp dưới)` → `Phân tích (Xem chi tiết KH)` → `Hành động (Giao việc/Xử lý)`.

### 1.4 Module Overview
- **Dashboard**: Cung cấp chỉ số vĩ mô, biểu đồ xu hướng và cảnh báo nhanh.
- **Customer Management**: Lưới dữ liệu chi tiết 360 độ mọi thông tin khách hàng.
- **Lifecycle Analytics**: Phân loại vòng đời khách hàng tự động bằng thuật toán.
- **Bot & Tasks**: Hệ thống giao việc tự động và đẩy báo cáo định kỳ qua Zalo.
- **Reports**: Hệ thống xuất báo cáo dữ liệu.

### 1.5 KPI Definitions
- **Revenue (Doanh thu)**: Tổng doanh thu phát sinh từ khách hàng.
- **Active (Hiện hữu)**: Tệp nòng cốt, có doanh thu ổn định liên tục.
- **At Risk (Nguy cơ)**: Khách hàng có dấu hiệu ngừng gửi hoặc rớt doanh thu nghiêm trọng.
- **Churn (Rời bỏ)**: Khách hàng đã ngừng giao dịch trong thời gian dài.
- **Reactivated (Tái bản)**: Tệp khách hàng cũ quay lại giao dịch.
- **KPI cốt lõi**: Tỷ lệ giữ chân khách hàng (Retention Rate) và Tăng trưởng so với cùng kỳ (MoM/YoY).

---

## 🎨 2. AI-READY UI/UX CONTEXT

### 2.1 Frontend Structure
- **Pages**: Các màn hình chính (Dashboard, Customers, Guidelines).
- **Components**: Các mảnh ghép UI tái sử dụng (Modals, Charts, KPI Cards, TreeExplorer).
- **Layouts**: Khung bao bọc ứng dụng (Sidebar, Header, Main Content).
- **Services/Hooks**: Xử lý logic API (SWR fetcher, Navigation Context) tách biệt khỏi UI.
- **Theme/Style**: Sử dụng TailwindCSS kết hợp custom CSS (hiệu ứng gradient/animations đặc thù).

### 2.2 Dashboard Structure
- **Filters Area**: Bộ lọc theo cấp độ địa bàn, thời gian, và chế độ xem (MoM/YoY).
- **Elite Pulse (Realtime)**: Widget báo cáo nhanh buổi sáng với nút push lên Zalo.
- **Population (Hiện trạng)**: Các thẻ KPI lớn hiển thị 5 nhóm vòng đời khách hàng.
- **Potentials**: Phân hạng khách hàng VIP (Kim Cương, Vàng, Bạc).
- **Charts & Tables**: Biểu đồ biến động doanh thu và bảng Heatmap đánh giá hiệu quả từng địa bàn.
- **Drilldown**: Khả năng click trực tiếp vào các chỉ số để nhảy sang màn hình danh sách chi tiết.

### 2.3 UI/UX Goals
- **Enterprise Operation Center**: Thiết kế chuẩn hệ thống điều hành cấp doanh nghiệp.
- **Tập trung Dữ liệu**: Đưa các số liệu quan trọng lên hàng đầu, dễ đọc lướt (scannability).
- **Hiện đại & Compact**: Giao diện tối giản, tối ưu không gian hiển thị, dữ liệu tải nhanh.
- **Responsive**: Thích ứng đa màn hình, đáp ứng nhu cầu xem báo cáo mọi lúc mọi nơi.

### 2.4 Current UI/UX Problems
- **Monolithic File**: File `Dashboard.jsx` quá lớn (>1800 dòng), khó duy trì.
- **Layout bất đối xứng**: Một số block (VD: Cơ cấu vòng đời) chưa được đưa vào hệ Grid tổng thể chuẩn mực.
- **Responsive hạn chế**: Bảng dữ liệu dễ bị tràn ngang (overflow-x) trên màn hình nhỏ. Các filter có thể bị lệch.
- **Tính đồng nhất**: Các widget đôi khi thiếu sự nhất quán về khoảng cách (spacing/padding).

### 2.5 Screenshots
- 🖼️ *[Placeholder: Dashboard Overview - Desktop]*
- 🖼️ *[Placeholder: Dashboard Overview - Mobile]*
- 🖼️ *[Placeholder: Customer List & Drilldown View]*

---

## 🚀 3. HƯỚNG DẪN VẬN HÀNH NHANH (QUICK START)

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

## 🧠 4. KIẾN TRÚC & LUỒNG DỮ LIỆU (THE BRAIN)

Hệ thống được vận hành bởi 4 "Động cơ" cốt lõi:
1.  **[Hierarchy Engine](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/app/services/hierarchy_service.py)**: Quản trị mô hình 5 cấp chức danh (BĐTP -> Trung tâm -> Trưởng đại diện -> Giám đốc Phường/Xã -> Nhân viên).
2.  **[Lifecycle Engine](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/app/services/lifecycle_engine.py)**: Tự động phân loại 5 trạng thái khách hàng (Mới, Hiện hữu, Nguy cơ, Rời bỏ, Tái hoạt động).
3.  **[Summary Service](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/app/services/summary_service.py)**: Tổng hợp dữ liệu từ Giao dịch thô (`Transactions`) sang bảng Analytical (`MonthlyAnalyticsSummary`).
4.  **[Scoping Service](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/app/services/scoping_service.py)**: Đảm bảo phân quyền dữ liệu tuyệt đối theo phân cấp quản lý và các ngoại lệ (531120).

---

## 📜 5. HIẾN PHÁP & QUY TẮC PHÁT TRIỂN
Tuyệt đối không vi phạm các nguyên tắc quản trị trong các tài liệu sau:
- [📖 HIÊN PHÁP CRM 3.0](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/Rules/HIEN_PHAP_CRM_3.0.md) (Quy tắc tối thượng)
- [📝 NHẬT KÝ PHÁT TRIỂN](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/Rules/NK_PHAT_TRIEN_V3.0.md) (Theo dõi thay đổi)

---

## 🗺️ 6. BẢN ĐỒ TRA CỨU MÃ NGUỒN (TECHNICAL INDEX)

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

## 🛠️ 7. CÔNG CỤ BẢO TRÌ (ADMIN SCRIPTS)
- [rebuild_summary.py](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/scripts/rebuild_summary.py) - Chạy khi cần làm mới toàn bộ Dashboard.
- [database_optimizer.py](https://github.com/tntTan2292/KHHH-V3-CRM/blob/main/backend/scripts/database_optimizer.py) - Tối ưu hiệu năng Database.

---
*Cập nhật lần cuối: 14/05/2026 - Antigravity AI*
