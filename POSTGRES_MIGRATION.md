# 🐘 LỘ TRÌNH NÂNG CẤP LÊN POSTGRESQL (PHASE 3.4)

## 1. Lý do nâng cấp
Mặc dù SQLite đã được tối ưu hóa bằng kiến trúc **Summary-First**, tuy nhiên để phục vụ quy mô dữ liệu vượt ngưỡng 2 triệu bản ghi và hỗ trợ đa người dùng (Concurrent Write) tốt hơn, việc chuyển sang PostgreSQL là cần thiết.

## 2. Các bước triển khai dự kiến

### Bước 1: Chuẩn bị hạ tầng
- Cài đặt PostgreSQL 15+ (Local hoặc Docker).
- Thiết lập database `khhh_v3_prod`.

### Bước 2: Chỉnh sửa mã nguồn Backend
- Cập nhật `DATABASE_URL` trong file `.env`.
- Chỉnh sửa `database.py` để sử dụng `psycopg2` driver thay cho `sqlite3`.
- Thay đổi các hàm SQL dialect đặc thù của SQLite sang PostgreSQL chuẩn:
    - `strftime('%Y-%m', ...)` -> `to_char(..., 'YYYY-MM')`
    - `substr(..., 1, 7)` -> `left(..., 7)`
    - `COALESCE` và các hàm chuẩn khác giữ nguyên.

### Bước 3: Migration Dữ liệu (ETL)
- Sử dụng công cụ `pgloader` hoặc viết script Python để chuyển dữ liệu từ `khhh_v3.db` sang PostgreSQL.
- **Thứ tự ưu tiên**: `hierarchy_nodes` -> `users` -> `customers` -> `transactions`.

### Bước 4: Tối ưu hóa Indexing
- Tận dụng `GIN` index cho các trường tìm kiếm văn bản.
- Sử dụng `B-tree` index cho `point_id` và `ngay_chap_nhan`.

## 3. Thời gian dự kiến
- **Coding Refactor**: 1-2 ngày.
- **Data Migration & Test**: 1 ngày.
- **Tổng cộng**: 3 ngày làm việc.

---
*Tài liệu được soạn thảo bởi Antigravity phục vụ kế hoạch ổn định hệ thống CRM V3.0.*
