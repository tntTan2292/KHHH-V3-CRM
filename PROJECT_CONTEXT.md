# 🗺️ PROJECT CONTEXT: KHHH CRM V3.0 - BƯU ĐIỆN TP HUẾ

## 🎯 Tổng quan dự án
Hệ thống quản lý quan hệ khách hàng (CRM) phiên bản 3.0 dành cho Bưu điện TP Huế, tập trung vào tối ưu hóa doanh thu, quản lý vòng đời khách hàng định danh và khai thác tệp khách hàng tiềm năng (vãng lai).

---

## 💻 Công nghệ cốt lõi (Tech Stack)
- **Frontend**: Vite + React + Tailwind CSS + Lucide Icons.
- **Backend**: Python FastAPI + SQLAlchemy (ORM).
- **Database**: SQLite (File: `data/database/khhh_v3.db`).
- **Deployment**: Local Server (Windows), uvicorn.

---

## 🏗️ Cấu trúc Module & File Quan Trọng

### 1. Dashboard (Tổng quan Chiến lược)
- **UI**: `src/pages/Dashboard.jsx`
- **API**: `backend/app/routers/analytics.py`
- **Vai trò**: Hiển thị doanh thu, sản lượng, và thống kê 2 nhóm khách hàng (Định danh & Tiềm năng).

### 2. Khách hàng Tiềm năng (Leads/Vãng lai)
- **UI**: `src/pages/PotentialCustomers_V3.jsx`
- **Service**: `backend/app/services/potential_service.py`
- **API**: `backend/app/routers/potential.py`
- **Đặc điểm**: Chỉ dành cho khách **CHƯA CÓ MÃ CRM** (`ma_kh` is null/empty).

### 3. Vòng đời Khách hàng (Lifecycle/Định danh)
- **UI**: `src/pages/Customers.jsx`
- **Service**: `backend/app/services/lifecycle_service.py` & `customer_service.py`
- **Đặc điểm**: Chỉ dành cho khách **ĐÃ CÓ MÃ CRM**.

---

## 📜 Quy tắc Kinh doanh Tối thượng (Business Rules)
*Mọi thay đổi phải tuân thủ tuyệt đối file: `Rules/HIEN_PHAP_CRM_3.0.md`*

### 1. Phân hạng Khách hàng Tiềm năng (Nhóm 02)
- **Diamond (Kim Cương)**: Doanh thu > 5M VNĐ AND Sản lượng > 20 đơn/tháng.
- **Gold (Vàng)**: Doanh thu > 1M VNĐ AND Sản lượng > 10 đơn/tháng.
- **Silver (Bạc)**: Doanh thu > 500K VNĐ AND Sản lượng > 5 đơn/tháng.
- **Quan trọng**: Không áp dụng bộ lọc tần suất (số ngày gửi) để tránh lệch số liệu.

### 2. Phân loại Vòng đời (Nhóm 01)
- **Mới (New)**: Đơn đầu tiên trong 3 tháng đầu.
- **Hiện hữu (Active)**: Có đơn trong tháng và duy trì trong 3 tháng.
- **Nguy cơ (At-risk)**: Quá 15 ngày chưa có đơn mới.
- **Rời bỏ (Churn)**: 3 tháng liên tiếp không có đơn.

---

## 🛠️ Quy trình Phối hợp AI
1. **Antigravity (Local Agent)**: Thực thi code, quản lý Git, thao tác Database và Terminal.
2. **ChatGPT (Remote Architect)**: Tư vấn giải pháp, review code và gợi ý tối ưu hóa dựa trên GitHub Repo.
3. **Đồng bộ**: Code sau khi fix sẽ được Antigravity đẩy lên GitHub để ChatGPT luôn nắm bắt được trạng thái mới nhất.

---
*Cập nhật: 05/05/2026 - Biệt đội Antigravity*
