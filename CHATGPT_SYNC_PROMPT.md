# YÊU CẦU KIỂM TRA KIẾN TRÚC & NGHIỆP VỤ (GỬI CHATGPT)

Chào ChatGPT,

Tôi vừa phối hợp với team dev hoàn thành đợt đại tu "Bộ máy tính toán Vòng đời" (Lifecycle Engine) cho hệ thống CRM 3.0 và bổ sung một số luật mới vào Hiến pháp. Nhờ bạn review giúp xem kiến trúc và cách thiết kế logic này đã tối ưu, chặt chẽ và đúng chuẩn Enterprise CRM chưa nhé.

## 1. Đại tu Lifecycle Engine sang "Calculated Lifecycle"
Thay vì cập nhật trạng thái thủ công (hard-code vào database), chúng tôi đã chuyển sang quét 100% lịch sử giao dịch:
- **Nguyên lý:** Quét ngược lại 1.7 triệu giao dịch để lấy `First Order Month` (tháng đầu tiên) và `Last Active Month` (tháng gần nhất) của từng khách hàng.
- **Quy tắc phân loại (Mutually Exclusive):**
  - `MỚI (New)`: Khách hàng có đơn trong tháng và khoảng cách từ tháng đầu tiên <= 2 (Tức là nằm trong 3 tháng đầu).
  - `TÁI BÁN (Recovered)`: Khách hàng có đơn trong tháng, nhưng khoảng cách từ tháng có đơn gần nhất (trước đó) > 3 tháng.
  - `HIỆN HỮU (Active)`: Khách hàng có đơn trong tháng (và không thuộc Mới / Tái bán).
  - `RỜI BỎ (Churned)`: Khách hàng KHÔNG có đơn trong tháng và đã nghỉ > 3 tháng.
  - `NGUY CƠ (At-risk)`: Đã cập nhật luật từ >15 ngày thành **>30 ngày** (tương đương có đơn tháng T-1 nhưng tháng T không có đơn).
- **Cách lưu trữ để tăng tốc Dashboard:** Tính toán định kỳ và lưu vào bảng `monthly_analytics_summary`. Để tránh đếm trùng (khi 1 khách dùng nhiều dịch vụ), chúng tôi lưu số lượng khách hàng Unique với cờ `ma_dv='ALL'` và lưu tách biệt doanh thu theo từng dịch vụ.

## 2. Bổ sung Nhóm đánh giá "KHÁCH HÀNG TĂNG TRƯỞNG (Growth)"
Chúng tôi vừa bổ sung thêm một lớp đánh giá mới vào Hiến pháp CRM 3.0:
- **Growth** không phải là một trạng thái vòng đời thay thế (để không phá vỡ tính mutually exclusive của 5 trạng thái trên). Nó là một **"Nhãn đánh giá bổ sung" (Tag / Overlay)**.
- **Điều kiện:** Khách hàng đang là MỚI hoặc HIỆN HỮU, đồng thời có Doanh thu/Sản lượng tăng trưởng liên tục MoM.
- **Mục đích:** Để chuẩn bị dữ liệu cho chiến lược tiếp cận "Bùng nổ & Bám sát" trong tương lai.

## Câu hỏi dành cho bạn:
1. Việc thiết kế Lifecycle dựa trên lịch sử (Calculated) thay vì Status Code cố định có phải là Best Practice giúp chống thất thoát/sai lệch dữ liệu khi scale hệ thống không?
2. Cách chúng tôi bóc tách Nhóm Growth thành một "Overlay Tag" (thay vì gộp chung làm trạng thái thứ 6) có giúp bảo toàn được logic phễu khách hàng hiện tại không?
3. Với quy mô 1.7 triệu records (và sẽ tăng lên), việc tính toán gom cụm hàng tháng rồi lưu vào `monthly_analytics_summary` để dashboard query "siêu tốc" có điểm yếu nào cần lưu ý thêm không? (Hiện tại chúng tôi dùng CTE kết hợp Indexing).

Bạn hãy đánh giá công tâm và chỉ ra những "lỗ hổng" nếu có nhé!
