# HIẾN PHÁP DOANH THU CRM 3.0
*Tài liệu quản trị tối cao về tính toàn vẹn và độ tin cậy của dữ liệu doanh thu.*

## 1. Mục tiêu hệ thống doanh thu
### Vì sao phải có Nguồn Sự Thật Duy Nhất (SSOT)?
Trong các phiên bản trước, hệ thống thường xuyên gặp tình trạng "mỗi màn hình một số liệu khác nhau". Điều này làm mất niềm tin của cấp quản lý và gây khó khăn cho việc ra quyết định. CRM 3.0 thiết lập SSOT để đảm bảo mọi báo cáo, biểu đồ đều nhìn về một hướng.

### Vì sao trước đây số liệu bị lệch?
Nguyên nhân chính là do sự chồng chéo giữa dữ liệu thô (Realtime) và dữ liệu tổng hợp (Analytics). Khi dữ liệu thô được cập nhật hoặc làm sạch (như xóa trùng lặp), nhưng dữ liệu tổng hợp không được tính toán lại ngay lập tức, sẽ dẫn đến hiện tượng "vênh" số liệu giữa thẻ KPI và biểu đồ.

### Vì sao phải tách biệt Realtime và Analytics?
- **Realtime (Thời gian thực):** Dùng để truy vấn các con số "sống" như tổng doanh thu hôm nay, xu hướng 13 tháng. Cần độ chính xác tuyệt đối từ từng giao dịch.
- **Analytics (Phân tích):** Dùng cho các tác vụ nặng như xếp hạng khách hàng, tính điểm tiềm năng AI. Dữ liệu này được xử lý sẵn (Snapshot) để đảm bảo tốc độ phản hồi của hệ thống mà không làm treo cơ sở dữ liệu.

---

## 2. Nguồn dữ liệu chuẩn (SSOT)
Hệ thống phân cấp dữ liệu thành hai tầng nghiêm ngặt:
- **Tầng Giao dịch (Transaction):** Đây là "Gốc". Mọi đồng doanh thu phát sinh đều nằm ở đây. Nếu một con số không thể tìm thấy trong bảng giao dịch, nó không được coi là doanh thu hợp lệ.
- **Tầng Tổng hợp (Summary/Snapshot):** Đây là "Ngọn". Dữ liệu được gom nhóm theo tháng, theo vùng miền hoặc theo phân khúc để phục vụ các thuật toán phức tạp. Tầng này phải luôn được đồng bộ (Rebuild) mỗi khi tầng Gốc có thay đổi lớn.

---

## 3. Quy tắc Quản trị Doanh thu (Governance)
- **Widget Thời gian thực:** Bắt buộc truy vấn trực tiếp từ bảng **Transaction**. Không được dùng bảng Summary để tránh sai lệch khi dữ liệu chưa kịp đồng bộ.
- **Widget Phân tích/Xếp hạng:** Được phép sử dụng bảng **Summary** để tối ưu hiệu năng, nhưng phải hiển thị rõ thời điểm cập nhật cuối cùng (Latest Sync).
- **Tuyệt đối không mix nguồn:** Một widget không được phép lấy doanh thu tổng từ Summary nhưng lại lấy chi tiết từ Transaction trong cùng một khung nhìn.

---

## 4. Bảng phân định nguồn dữ liệu cuối cùng

| STT | Chức năng trên hệ thống | Nguồn dữ liệu chuẩn |
|:---:|---|---|
| 1 | Tổng doanh thu (KPI Cards) | **Transaction** |
| 2 | So sánh doanh thu với kỳ trước | **Transaction** |
| 3 | Biểu đồ xu hướng (Revenue Trend) | **Transaction** |
| 4 | Xu hướng 12 tháng của khách hàng | **Transaction** |
| 5 | Popup lịch sử doanh thu khách hàng | **Transaction** |
| 6 | Nhịp Điệu Elite T-1 (Daily Performance) | **Transaction** |
| 7 | Phân Phối Doanh Thu Theo Dịch Vụ | **Transaction** |
| 8 | Tỉ trọng Thị trường (Region Distribution) | **Transaction** |
| 9 | Top Movers (Khách hàng biến động) | **Summary/Snapshot** |
| 10 | AI Ranking / Potential Score | **Summary + Lifecycle** |
| 11 | Cảnh báo mất khách (Churn Prediction) | **Transaction** |

---

## 5. Quản trị làm sạch dữ liệu trùng (Cleanup)
Hệ thống đã trải qua đợt tổng rà soát và làm sạch lịch sử:
- **Số bản ghi đã xóa:** 4,597 records (Dữ liệu import lỗi/trùng).
- **Khóa định danh trùng lặp (Dedup Key):**
  `Số hiệu biểu giá (SHBG)` + `Thời gian chấp nhận` + `Doanh thu`.
- **Nguyên tắc:** Nếu 3 thông tin trên giống hệt nhau, hệ thống chỉ giữ lại 01 bản ghi gốc duy nhất.

---

## 6. Quản trị Đồng bộ (Sync Governance)
- **Trạng thái hiện tại:** **LOCK (Khóa toàn bộ)** các tiến trình import/sync tự động.
- **Mục tiêu:** Ngăn chặn tuyệt đối việc dữ liệu rác hoặc dữ liệu trùng quay trở lại làm ô nhiễm SSOT trong khi đang tinh chỉnh logic quản trị.
- **Điều kiện mở lại:** Chỉ mở khi quy trình kiểm tra trùng lặp tự động (Anti-duplicate pipeline) được nghiệm thu 100%.

---

## 7. Các nguyên tắc bất biến
1. **Không tự ý đổi nguồn:** Lập trình viên không được tự ý đổi nguồn dữ liệu của widget từ Transaction sang Summary (hoặc ngược lại) mà không có sự phê duyệt của Hội đồng Quản trị Dữ liệu.
2. **Không cộng dồn chéo:** Tuyệt đối không thực hiện các phép tính cộng dồn giữa bảng Transaction và bảng Summary trong cùng một logic vì sẽ gây hiện tượng gấp đôi doanh thu (Double Counting).
3. **Tính giải trình (Traceability):** Mọi con số hiển thị trên Dashboard phải có khả năng truy xuất ngược về danh sách các mã giao dịch (Raw Transactions) cấu thành nên nó.

---

## 8. Kết luận Quản trị
CRM 3.0 hiện đã đạt trạng thái **"Doanh thu có thể giải trình"**. 

Mọi chỉnh sửa, nâng cấp hoặc xây dựng tính năng mới liên quan đến tiền tệ trên Dashboard bắt buộc phải tuân thủ nghiêm ngặt theo **Hiến pháp doanh thu** này. Bất kỳ sự sai lệch nào so với nguồn SSOT đều bị coi là lỗi nghiêm trọng (Critical Bug) của hệ thống.

---
*Ngày ban hành: 14/05/2026*
*Phiên bản: 1.0 (Governance Stabilized)*
