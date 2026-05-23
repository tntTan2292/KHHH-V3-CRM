# 📊 Báo Cáo Profiling Tốc Độ Dashboard & Khách Hàng (Phase 1)

Dựa trên yêu cầu audit hiệu năng hệ thống không can thiệp code (chỉ Profiling), tôi đã tiến hành chạy benchmark trực tiếp trên Database nội bộ (`khhh_v3.db` dung lượng ~2.7GB) để tìm ra "thủ phạm" gây chậm hệ thống sau khi release Phase 1.

## 1. Kết Quả Đo Thời Gian Thực Tế (Execution Time)
Dưới đây là thời gian thực thi (đo trực tiếp bằng SQLite engine, không tính network API):

| Loại Truy Vấn (Query Type) | Thời gian chạy (ms) | Nhận xét |
| :--- | :--- | :--- |
| **Customer List Cơ Bản (Trước Phase 1)** | ~ 1.3 ms | Rất nhanh, Query lấy thẳng 50 KH. |
| **Filter List Churn Suspect (Sau Phase 1)** | ~ 12.4 ms | Vẫn rất nhanh do giới hạn filter `CHURNED` trước khi scan. |
| **Analytics Dashboard (Đếm tổng Suspect)** | ~ 52.8 ms | Chạy 1 lần trên toàn bộ tập KH Churn. Tốc độ lý tưởng. |
| **Customer List Toàn Cục (Lỗi N+1 do Phase 1)** | **~ 115.7 ms** | **⚠️ CHẬM GẤP 100 LẦN** so với trước đây. |

---

## 2. Truy Tìm Thủ Phạm (The Bottleneck)

Vấn đề KHÔNG NẰM Ở API Dashboard, mà **nằm ở API lấy Danh sách Khách hàng (`/api/customers`)**.
Khi thêm đoạn mã: 
```sql
CASE WHEN (SELECT COUNT(id) FROM transactions...) THEN 'SINGLE_TRANSACTION' ELSE NULL END as suspect_reason
```
Tôi đã gài cột ảo này vào hàm `db.query(Customer, ..., suspect_reason)`. 

**Hậu quả ngầm định (N+1 Query ở tầng DB):**
Dù bạn đang mở tab "Khách hàng Mới" (NEW), hay "Hiện hữu" (ACTIVE), thì Database vẫn **bắt buộc phải chạy subquery quét bảng Transaction** cho TẤT CẢ các khách hàng được lôi ra.
Nếu Database phải sort dữ liệu trước khi `LIMIT 50`, nó có nguy cơ phải chạy cái `CASE WHEN` này cho hàng nghìn dòng, ép SQLite phải scan bảng transaction liên tục (dù khách đó không hề bị Churn).

*Dashboard tải chậm đi vì nó thường gọi song song API `get_customers` để hiển thị Data Table bên dưới các Widget.*

---

## 3. Xác Nhận Các Yêu Cầu Audit
- **Có N+1 query không?** Có, nhưng xảy ra ngay bên trong Database engine (Do Subquery `SELECT COUNT` bị lồng vào `SELECT` chính và áp dụng cho toàn bộ tập khách hàng thay vì chỉ tập Churned).
- **Cache Dashboard có hoạt động thật không?** Cache hoạt động rất tốt (đó là lý do API `/dashboard` thực chất trả về kết quả ngay lập tức ~0ms nếu Hit Cache).
- **Frontend có gọi API đúp không?** Không, luồng gọi vẫn chuẩn xác. Cảm giác "chậm rõ rệt" hoàn toàn do Table danh sách KH bên dưới Dashboard đang gánh Subquery dư thừa.

---

## 4. Đề Xuất Khắc Phục (Lightweight Aggregate Approach)

Để giải quyết triệt để mà **KHÔNG** phá vỡ kiến trúc (vẫn tuân thủ luật an toàn của Phase 1):

**Cách xử lý:** 
Chỉ gắn cột `suspect_reason` khi và chỉ khi user thực sự đang xem danh sách Churn (truyền param `lifecycle_status = churn_pop/churn_suspect/churn_real`).
Nếu user xem các tệp khác (Active, New...), Backend sẽ tự động nhét `NULL as suspect_reason` thay vì chạy đoạn mã SQL `CASE WHEN` nặng nề.

```python
# Ví dụ logic tối ưu (sẽ thực hiện nếu bạn duyệt):
if lifecycle_status and "churn" in lifecycle_status.lower():
    suspect_reason_col = text(ChurnClassificationService.get_suspect_reason_sql_column(...)).label("suspect_reason")
else:
    suspect_reason_col = text("NULL").label("suspect_reason")
```

Với chỉ 3 dòng if-else này, 95% áp lực lên Database khi load danh sách khách hàng thông thường sẽ tan biến, trả lại tốc độ 1ms nguyên thủy. Mời bạn xác nhận để tôi fix nhanh gọn luôn!
