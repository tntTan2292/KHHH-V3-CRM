# 🔄 Data Flow Overview

## Luồng dữ liệu tổng quan
`Frontend (SWR)` → `API Router (FastAPI)` → `Service Layer (Logic)` → `Database (SQLite)` → `Summary Tables` → `Dashboard Render`

## Chi tiết
- **Dashboard không query trực tiếp**: Dashboard không bao giờ đọc thẳng từ bảng raw `Transactions` mà query từ bảng `MonthlyAnalyticsSummary` (đã được tổng hợp định kỳ) để đảm bảo tốc độ Realtime.
- **SWR Flow**: Frontend sử dụng thư viện `swr` để fetch, cache và revalidate dữ liệu API một cách mượt mà, giảm thiểu thời gian chờ (TTI) cho người dùng.
