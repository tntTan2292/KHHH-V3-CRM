# 📜 HIẾN PHÁP PHÂN LOẠI KHÁCH HÀNG CRM 3.0 - BƯU ĐIỆN TP HUẾ
*(Ban hành bởi Sếp - Phê duyệt bởi Biệt đội Antigravity)*

---

## 📂 NHÓM 1: MODULE DANH SÁCH KHÁCH HÀNG (LIFECYCLE - ĐỊNH DANH)
Dành cho khách hàng đã được cấp mã CRM cố định.

### 1. KHÁCH HÀNG MỚI (New) ✨
- **Điều kiện**: Đơn hàng lần đầu tiên trong lịch sử (tính lũy kế).
- **Thời gian**: Trạng thái "Mới" kéo dài từ tháng phát sinh đơn đầu tiên đến **HẾT THÁNG THỨ 03**.
- **Chuyển đổi**: Từ tháng thứ 04 trở đi mới được chuyển sang nhóm HIỆN HỮU.

### 2. KHÁCH HÀNG HIỆN HỮU (Active) ✅
- **Điều kiện**: Có đơn trong tháng báo cáo.
- **Duy trì**: Có ít nhất một đơn trong vòng 03 tháng trước đó.
- **Yêu cầu**: Phải là khách hàng đã từng đi qua giai đoạn "MỚI".

### 3. KHÁCH HÀNG RỜI BỎ (Churn) ⚠️
- **Điều kiện**: Từng phát sinh đơn trong quá khứ.
- **Dấu hiệu**: **LIÊN TIẾP 03 THÁNG** không có đơn hàng nào.
- **Xếp loại**: Được liệt kê vào danh sách Rời bỏ từ tháng thứ 04 không có đơn.
- **Thời gian**: Trạng thái "Rời bỏ" kéo dài từ tháng phát sinh đơn quay lại đầu tiên đến **HẾT THÁNG THỨ 03**.
- **Chuyển đổi**: Từ tháng thứ 04 trở đi được chuyển về lại nhóm HIỆN HỮU.

### 4. KHÁCH HÀNG TÁI BÁN (Re-activated) 🔄
- **Điều kiện**: Đã từng thuộc nhóm MỚI hoặc HIỆN HỮU.
- **Tiền sử**: Đã từng rơi vào nhóm RỜI BỎ (nghỉ trên 3 tháng).
- **Hiện tại**: Quay lại phát sinh đơn hàng.

### 5. KHÁCH HÀNG NGUY CƠ (At-risk) 🚩
- **Điều kiện**: Có đơn đều đặn trong quá khứ.
- **Dấu hiệu**: **QUÁ 15 NGÀY** kể từ đơn hàng gần nhất chưa phát sinh đơn hàng mới.
- **Mục đích**: Cảnh báo sớm để nhân viên liên hệ "cứu chữa" trước khi khách hàng rơi vào trạng thái Rời bỏ.

---

## 🚀 NHÓM 02: MODULE DANH SÁCH KHÁCH HÀNG TIỀM NĂNG (LEADS - VÃNG LAI)
Dành cho khách hàng chưa có mã CMS nhưng có lượt gửi nhiều và doanh thu cao.

| Hạng mục | Điều kiện Doanh thu | Điều kiện Sản lượng | Ghi chú |
| :--- | :--- | :--- | :--- |
| **💎 KIM CƯƠNG (Diamond)** | > 5.000.000đ và > 20 đơn/tháng | Ưu tiên định danh số 1 |
| **🏆 VÀNG (Gold)** | > 1.000.000đ và > 10 đơn/tháng | Tiềm năng tăng trưởng cao |
| **🥈 BẠC (Silver)** | > 500.000đ và > 5 đơn/tháng | Cần chăm sóc thường xuyên |
| **👤 THƯỜNG (Regular)** | < 1.000.000đ | < 5 đơn/tháng | Khách lẻ (không hiển thị Module) |

---

## ⚡ NHÓM NGOẠI LỆ: KHÁCH HÀNG VÃNG LAI LẺ
- Khách không mã CMS, gửi ít (số lượng quá lớn, không thuộc Module quản trị nào).

## 🕒 NGUYÊN TẮC TÍNH TOÁN ĐỘNG (DYNAMIC CALCULATION)
- **Tính thời điểm**: Trạng thái Lifecycle không phải là nhãn dán cố định mà được tính toán **tại thời điểm báo cáo**.
- **Hiệu lực bộ lọc**: Khi thay đổi bộ lọc "Từ ngày - Đến ngày" trên Dashboard, hệ thống sẽ tự động tính toán lại lộ trình của khách hàng tương ứng với dải thời gian đó.
- **Mục đích**: Giúp nhà quản lý có thể "quay ngược thời gian" để xem lịch sử chuyển dịch nhóm khách hàng (ví dụ: tháng trước họ là 'Nguy cơ', tháng này là 'Hiện hữu').

---

## 🏛️ PHẦN II: PHÂN CẤP & PHÂN QUYỀN TRUY CẬP (VERSION 3.0)
Hệ thống chuyển đổi từ mô hình "Phẳng" sang mô hình "Cây phân cấp" (Hierarchy Architecture).

### 1. CẤU TRÚC 5 CẤP BẬC (The 5-Level Tree)
Mọi dữ liệu được lọc tự động dựa trên vị trí của nhân sự trong cây:
1.  **Cấp 1: Tỉnh (Province)** - Toàn quyền quản trị (Lãnh đạo BĐTP).
2.  **Cấp 2: Trung tâm (Center)** - Lãnh đạo TT Kinh doanh / TT Vận hành.
3.  **Cấp 3: Cụm (Cluster)** - Trưởng đại diện.
4.  **Cấp 4: Phường/Xã (Ward)** - Giám đốc Phường/Xã.
5.  **Cấp 5: Điểm (Point)** - Nhân viên tại điểm phục vụ / Tuyến.

### 2. NGUYÊN TẮC PHÂN QUYỀN (RBAC SCOPE)
- **Cơ chế "Nhìn xuống"**: Cấp trên mặc định thấy được dữ liệu của tất cả các cấp dưới trực thuộc nhánh của mình.
- **Cơ chế "Cô lập"**: Cấp dưới không thể thấy dữ liệu của cấp trên hoặc các nhánh đồng cấp.
- **Mapping Định danh**: Hồ sơ nhân sự (`NhanSu`) được liên kết với `Username` giao dịch thông qua mã HR để xác định phạm vi dữ liệu (Scope).

### 3. QUY TẮC PHÂN CÔNG (CUSTOMER ASSIGNMENT)
- **Thẩm quyền**: Cấp quản lý được quyền gán khách hàng cho nhân viên cấp dưới trực thuộc quản lý của mình.
- **Cập nhật hồi tố có điều kiện**: 
    - Khi gán nhân sự, hệ thống tự động cập nhật tên nhân viên vào toàn bộ giao dịch của khách hàng đó **trong tháng hiện tại**.
    - Các giao dịch trong quá khứ được giữ nguyên tên người cũ (hoặc mặc định) để đảm bảo tính lịch sử quyết toán.
- **Chu kỳ Reset**: Tác vụ phân công được reset hoặc làm mới vào ngày mùng 1 hàng tháng để phục vụ chu kỳ báo cáo quản trị mới.

---

## 🤖 PHẦN III: QUY TẮC CỘNG TÁC AI & VẬN HÀNH (ELITE PROTOCOL)
1.  **QUY TẮC KHỞI ĐẦU BẮT BUỘC:** Ngay khi bắt đầu một phiên làm việc/cuộc trò chuyện mới, cộng sự AI **PHẢI THỰC HIỆN GỌI NGAY** [Đội ngũ hỗ trợ Antigravity](file:///d:/Antigravity%20-%20Project/KHHH%20-%20Antigravity%20-%20V3.0/Rules/DOI_NGU_ANTIGRAVITY.md) ra điểm danh và cùng trao đổi phương án. Tuyệt đối không được tự ý thực hiện bất kỳ công việc nào cho đến khi Sếp bấm **"OK"** hoặc **"Đồng ý"**.
2.  **QUY TẮC NHẬT KÝ CHI TIẾT:** Mọi công việc sau khi xử lý xong **BẮT BUỘC** phải được ghi nhận vào [NK_PHAT_TRIEN_V3.0.md](file:///d:/Antigravity%20-%20Project/KHHH%20-%20Antigravity%20-%20V3.0/Rules/NK_PHAT_TRIEN_V3.0.md). Nội dung ghi chép phải **THẬT CỤ THỂ**, mô tả rõ triệu chứng, nguyên nhân và các bước xử lý kỹ thuật (tương tự như cách fix lỗi Cụm TD01 ngày 22/04/2026). Tuyệt đối không ghi chung chung.
3.  **Quyền Quyết định Tối cao:** Mọi thao tác chỉnh sửa code hoặc hệ thống chỉ được thực hiện sau khi có sự đồng ý của Người dùng.
4.  **QUY TẮC TỐI ƯU & QUOTA:** Trong quá trình thực hiện (debug, tra cứu dữ liệu...), nếu nhận thấy việc tìm kiếm nguyên nhân kéo dài hoặc tốn quá nhiều tài nguyên (Quota), cộng sự **PHẢI DỪNG LẠI VÀ TRAO ĐỔI VỚI SẾP**. Mục đích là để cùng tìm hướng giải quyết nhanh hơn, tránh lãng phí tài nguyên và rút ngắn thời gian xử lý sự cố.
5.  **Quy trình Phê duyệt:** Sau khi nhận yêu cầu (Prompt), AI phải trao đổi thống nhất phương án trước khi xử lý. Chỉ thực hiện khi Người dùng bấm **"OK"** hoặc **"Đồng ý"**. Điều này nhằm tránh sai sót do nội dung yêu cầu chưa rõ ràng hoặc chưa chính xác.
6.  **QUY TẮC BẢO TỒN NGỮ CẢNH:** Luôn cập nhật đầy đủ diễn biến, các lỗi phát sinh và cách xử lý vào [NK_PHAT_TRIEN_V3.0.md](file:///d:/Antigravity%20-%20Project/KHHH%20-%20Antigravity%20-%20V3.0/Rules/NK_PHAT_TRIEN_V3.0.md) ở cuối mỗi phiên làm việc. Điều này đảm bảo ngữ cảnh luôn được giữ lại trọn vẹn cho các lần hợp tác tiếp theo, tránh mất thời gian giải thích lại từ đầu.
7.  **QUY TẮC LIÊN TỤC LỘ TRÌNH:** Ngay khi bắt đầu phiên làm việc, AI **PHẢI ĐỌC NGAY** file [KE_HOACH_NANG_CAP.md](file:///d:/Antigravity%20-%20Project/KHHH%20-%20Antigravity%20-%20V3.0/Rules/KE_HOACH_NANG_CAP.md) để nắm bắt tiến độ và các giai đoạn dang dở, đảm bảo lộ trình phát triển không bị gián đoạn.
8.  **QUY TẮC ĐỒNG BỘ GITHUB (TỐI ƯU QUOTA):** Để tiết kiệm tài nguyên hệ thống, AI **CHỈ THỰC HIỆN ĐỒNG BỘ** (dùng lệnh Git Commit và Push) khi đã hoàn thành trọn vẹn một cụm tính năng, một bản vá lỗi hoàn chỉnh, hoặc vào cuối phiên làm việc. Không gọi lệnh Git liên tục cho các sửa đổi nhỏ lẻ, nhưng phải đảm bảo mã nguồn trên GitHub luôn được cập nhật đầy đủ trước khi chốt phiên.
9.  **QUY TẮC PHẢN BIỆN ĐỘC LẬP (INDEPENDENT CRITIQUE):** Khi Người dùng gửi các đề xuất, phân tích hoặc đánh giá từ ChatGPT (hoặc AI khác), cộng sự (Antigravity) **KHÔNG ĐƯỢC ÁP DỤNG NGAY LẬP TỨC**. Bắt buộc phải tự phân tích, đối chiếu với Hiến pháp CRM và hiểu biết về ngữ cảnh dự án từ đầu để **PHẢN BIỆN** xem đề xuất đó đúng hay sai, có làm hỏng logic hệ thống không. Chỉ khi xác nhận đề xuất đó thực sự chính xác, phù hợp, và có sự chốt hạ từ Người dùng thì mới được phép điều chỉnh code.

---

> [!IMPORTANT]
> **QUY TẮC BẮT BUỘC:** Trước khi thực hiện bất kỳ nội dung nâng cấp, sửa lỗi hay thay đổi code nào, cộng sự **BẮT BUỘC** phải đọc kỹ file [HIẾN PHÁP](file:///d:/Antigravity%20-%20Project/KHHH%20-%20Antigravity%20-%20V3.0/Rules/HIEN_PHAP_CRM_3.0.md) và [NHẬT KÝ PHÁT TRIỂN](file:///d:/Antigravity%20-%20Project/KHHH%20-%20Antigravity%20-%20V3.0/Rules/NK_PHAT_TRIEN_V3.0.md) để nắm bắt Source of Truth và tránh làm hỏng các logic đã chuẩn hóa.

> [!IMPORTANT]
> **"LUẬT CỘNG SỰ":** Mọi logic tính toán trong hệ thống backend và giao diện frontend phải tuân thủ tuyệt đối Hiến pháp này để đảm bảo dữ liệu khớp 100%!
> **"LUẬT PLAN":** Mọi thay đổi và nâng cấp về hệ thống phải đưa vào [NK_PHAT_TRIEN_V3.0.md](file:///d:/Antigravity%20-%20Project/KHHH%20-%20Antigravity%20-%20V3.0/Rules/NK_PHAT_TRIEN_V3.0.md). Nội dung ghi nhận phải **THẬT CỤ THỂ**, tuyệt đối không ghi chung chung.

---
---
> [!CAUTION]
> **ĐIỀU KHOẢN TỐI CAO:** Cộng sự AI **TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ Ý CODE** hoặc thay đổi hệ thống khi chưa nhận được lệnh **"OK"** hoặc **"ĐỒNG Ý"** từ Sếp. Mọi sự nôn nóng dẫn đến sai lệch ý đồ chiến lược đều là vi phạm Hiến pháp nghiêm trọng.

*Cập nhật lần cuối: 29/04/2026 - Biệt đội Antigravity (Thiết lập Lộ trình Nâng cấp 3 Giai đoạn)*
