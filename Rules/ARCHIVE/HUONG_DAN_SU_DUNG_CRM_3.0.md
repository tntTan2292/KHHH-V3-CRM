# HƯỚNG DẪN SỬ DỤNG HỆ THỐNG CRM ANTIGRAVITY V3.0
*Tài liệu đào tạo nội bộ chính thức - Cập nhật ngày 04/05/2026*

---

## 📋 TỔNG QUAN HỆ THỐNG
Hệ thống **CRM Antigravity V3.0** là nền tảng quản trị khách hàng thông minh (Customer Intelligence) được thiết kế riêng cho mạng lưới Bưu điện, tập trung vào việc tự động hóa phân tích dữ liệu, dự báo hành vi và tối ưu hóa quy trình tiếp cận khách hàng để gia tăng doanh thu bền vững.

### Cấu trúc phân lớp chức năng (Module Cha - Con):
1. **[NHÓM 1] PHÂN TÍCH & ĐIỀU HÀNH (INTELLIGENCE HUB)**
   * *Module:* Trung tâm điều hành (Dashboard).
   * *Module:* Báo cáo biến động (Movement Reports).
   * *Module:* Phân tích & Vòng đời (Analytics).
2. **[NHÓM 2] QUẢN LÝ KHÁCH HÀNG (CRM CORE)**
   * *Module:* Danh sách khách hàng (Customers).
   * *Module:* Khách hàng tiềm năng (Potential Whales).
   * *Module:* Hành trình 5B (Lead Pipeline).
3. **[NHÓM 3] TRUNG TÂM HÀNH ĐỘNG (OPERATIONAL CENTER)**
   * *Module:* Quản lý tiếp cận (Action Center).
   * *Module:* Nhật ký & Truy vết (Audit Trail).
4. **[NHÓM 4] QUẢN TRỊ & HỆ THỐNG (ELITE CONTROL)**
   * *Module:* Quản lý nhân sự & Phân quyền.
   * *Module:* Quản lý Cây đơn vị (Elite Tree).
   * *Module:* Nhập liệu & Master Data.

---

## 📈 [NHÓM 1] PHÂN TÍCH & ĐIỀU HÀNH

### [MODULE] TRUNG TÂM ĐIỀU HÀNH (DASHBOARD)
*Câu hỏi dẫn dắt: "Làm sao để Lãnh đạo nắm bắt được 'sức khỏe' kinh doanh toàn đơn vị, biết rõ hôm qua tăng/giảm bao nhiêu doanh thu và khách hàng nào cần tác động ngay trong 30 giây đầu ngày?"*

**1. Mục đích**
Cung cấp cái nhìn toàn cảnh về hiệu quả kinh doanh theo thời gian thực. Giúp quản lý ra quyết định dựa trên dữ liệu (Data-driven) thay vì cảm tính.

**2. Các chức năng chính**
* **Chỉ số Elite (KPI Cards)**: Doanh thu, Sản lượng, Số lượng khách hàng đang hoạt động.
* **Elite Morning Pulse**: Hệ thống cảnh báo nhanh về biến động doanh thu và khách hàng mục tiêu hàng ngày.
* **Cơ cấu RFM (Phân khúc giá trị)**: Tự động phân loại khách hàng thành các hạng (Kim cương, Vàng, Bạc...) dựa trên giá trị đóng góp.
* **Dự báo Churn (Rủi ro rời bỏ)**: Sử dụng AI để cảnh báo sớm những khách hàng có dấu hiệu ngừng sử dụng dịch vụ.

**3. Giải thích Thuật ngữ & Chỉ số (Dành cho slide báo cáo)**
* **Chỉ số RFM**: 
    * *Recency (R)*: Độ gần (Thời gian từ đơn cuối đến nay).
    * *Frequency (F)*: Tần suất (Số lần gửi hàng trong kỳ).
    * *Monetary (M)*: Giá trị (Tổng doanh thu đóng góp).
* **Health Score (70/30)**: Điểm sức khỏe khách hàng được tính theo công thức `Score = (Hạng Doanh thu * 0.7) + (Hạng Tần suất * 0.3)`. Điểm càng cao, khách hàng càng giá trị và ổn định.

**4. Hướng dẫn sử dụng chi tiết**
* **Truy cập**: Click biểu tượng **Dashboard** trên thanh menu trái.
* **Elite Tree Explorer**: Sử dụng cây đơn vị bên trái để xem dữ liệu theo từng cấp (Tỉnh -> Cụm -> Bưu cục).
* **Dispatch Elite Bot**: Click nút **Gửi Zalo** tại widget Morning Pulse để đẩy báo cáo nhanh về nhóm điều hành.

---

### [MODULE] BÁO CÁO BIẾN ĐỘNG (MOVEMENT REPORTS)
*Câu hỏi dẫn dắt: "Tại sao doanh thu kỳ này sụt giảm so với kỳ trước? Do mất khách hàng lớn, do khách hàng cũ giảm sản lượng hay do không có khách hàng mới bù đắp?"*

**1. Mục đích**
Phân tích "lỗ hổng" doanh thu bằng cách so sánh hai giai đoạn bất kỳ để tìm ra nguyên nhân thực sự của sự tăng/giảm.

**2. Các chức năng chính**
* **Phân rã biến động (Movement Decomposition)**: Tự động bóc tách doanh thu thành 4 nhóm:
    * **New (Mới)**: Khách hàng phát sinh doanh thu trong kỳ này nhưng kỳ trước không có.
    * **Lost (Rời đi)**: Khách hàng có doanh thu kỳ trước nhưng kỳ này hoàn toàn vắng bóng.
    * **Growing (Tăng trưởng)**: Khách hàng kỳ này gửi nhiều tiền hơn kỳ trước.
    * **Declining (Sụt giảm)**: Khách hàng vẫn gửi hàng nhưng doanh thu thấp hơn kỳ trước.
* **Logic Phân rã Sản lượng Bưu cục**: Tự động bóc tách doanh thu từ khách vãng lai/chưa định danh để gắn vào từng điểm phục vụ (Point ID), giúp đánh giá đúng thực lực khai thác tại chỗ.

**3. Hướng dẫn thao tác**
* **Chọn Kỳ A (Hiện tại) & Kỳ B (Đối chiếu)**.
* **Chọn Chế độ xem**: Tổng hợp đơn vị (để quản lý cụm/bưu cục) hoặc Chi tiết khách hàng (để biết đích danh ai tăng, ai giảm).
* **Drill-down**: Click vào tên đơn vị để xem sâu xuống các bưu cục cấp dưới.

---

## 👥 [NHÓM 2] QUẢN LÝ KHÁCH HÀNG (CRM CORE)

### [MODULE] DANH SÁCH KHÁCH HÀNG (CUSTOMERS)
*Câu hỏi dẫn dắt: "Trong hàng vạn mã khách hàng, làm sao để biết ai là khách hàng mới cần được chăm sóc đặc biệt, ai là khách hàng 'VIP' đang có dấu hiệu nguội lạnh cần tiếp cận ngay?"*

**1. Giải thích Thuật ngữ Vòng đời (Lifecycle)**
Hệ thống tự động phân loại khách hàng dựa trên hành vi thực tế:
* **Mới (New)**: Đang trong 03 tháng đầu tiên kể từ khi phát sinh đơn hàng đầu tiên.
* **Hiện hữu (Active)**: Khách hàng gửi hàng đều đặn trong 03 tháng gần nhất.
* **Tái bản (Recovered)**: Khách từng rời bỏ (nghỉ > 03 tháng) nay quay lại gửi hàng.
* **Nguy cơ (At Risk)**: Tháng trước có doanh thu, tháng này hiện chưa phát sinh (Cần xử lý ngay).
* **Rời bỏ (Churned)**: Liên tiếp 04 tháng không phát sinh doanh thu.

**2. Các chức năng chính**
* **Elite Modal**: Click vào khách hàng để xem "Hồ sơ sức khỏe" 12 tháng gần nhất.
* **Làm giàu dữ liệu (Enrichment)**: Cập nhật SĐT, địa chỉ, ngành hàng để phục vụ phân tích sâu.
* **Giao việc tiếp cận**: Trực tiếp giao nhiệm vụ chăm sóc cho nhân viên bưu cục.

---

### [MODULE] KHÁCH HÀNG TIỀM NĂNG (POTENTIAL WHALES)
*Câu hỏi dẫn dắt: "Làm sao để định danh những khách hàng vãng lai gửi lẻ nhưng có doanh thu cực lớn (Kim cương, Vàng) để chuyển đổi họ thành khách hàng ký hợp đồng chính thức?"*

**1. Tiêu chuẩn phân hạng Tiềm năng (Ngưỡng doanh thu)**
Hệ thống sử dụng AI để gom nhóm các số điện thoại/tên khách vãng lai và phân hạng:
* **Kim Cương**: Doanh thu tiềm năng > 10Tr / Tháng.
* **Vàng**: Doanh thu tiềm năng > 4Tr / Tháng.
* **Bạc**: Doanh thu tiềm năng > 1Tr / Tháng.

**2. Hướng dẫn sử dụng**
* **Nhận diện**: Hệ thống tự động lọc ra những khách hàng gửi > 5 ngày/tháng nhưng chưa có mã CRM.
* **Chuyển đổi**: Xuất danh sách để nhân viên tiếp thị thực tế tại quầy hoặc địa bàn.

---

## 🛠️ [NHÓM 3] TRUNG TÂM HÀNH ĐỘNG (OPERATIONAL CENTER)

### [MODULE] QUẢN LÝ TIẾP CẬN (ACTION CENTER)
*Câu hỏi dẫn dắt: "Làm sao để Lãnh đạo biết được nhân viên đã đi gặp khách hàng chưa, nội dung trao đổi là gì và kết quả có mang lại doanh thu thực tế hay không?"*

**1. Quy trình thực thi**
* **Giao việc**: Lãnh đạo/Quản lý chọn khách hàng cần tác động -> Giao cho nhân sự cụ thể.
* **Ghi nhật ký (Logs)**: Nhân viên cập nhật kết quả tiếp cận (Đồng ý ký hợp đồng, Chờ xem xét, Từ chối...).
* **Nhật ký truy vết (Audit Trail)**: Hệ thống ghi lại lịch sử thay đổi thông tin khách hàng để đảm bảo tính minh bạch.

---

## ⚙️ [NHÓM 4] QUẢN TRỊ & HỆ THỐNG (ELITE CONTROL)

### [MODULE] QUẢN TRỊ ELITE (ADMIN CENTER)
*Câu hỏi dẫn dắt: "Làm sao để đảm bảo dữ liệu khách hàng được bảo mật, đúng bưu cục nào chỉ xem được dữ liệu bưu cục đó và mọi hành vi nhập liệu đều được kiểm soát?"*

**1. Các chức năng then chốt**
* **Elite Tree Management**: Thiết lập cây đơn vị từ Tỉnh -> Cụm -> Xã -> Bưu cục.
* **Elite Scoping (Phân vùng dữ liệu)**: Quyền hạn xem doanh thu được phân cấp nghiêm ngặt. User bưu cục A tuyệt đối không xem được dữ liệu bưu cục B.
* **Master Data Import**: Cổng nhập dữ liệu giao dịch thô từ hệ thống Tổng công ty (MPITS, TMS...) vào CRM.

---

## 🚀 LỜI KHUYÊN DÀNH CHO NGƯỜI DÙNG

1. **Với Nhân viên kinh doanh**: Hãy bắt đầu ngày mới bằng tab **"Khách hàng Nguy cơ"** để cứu vãn doanh thu kịp thời.
2. **Với Lãnh đạo**: Sử dụng **Morning Pulse** trên Dashboard để nắm bắt biến động trong 30 giây đầu ngày.
3. **Với Quản trị viên**: Luôn kiểm tra **Nhật ký truy vết** để đảm bảo dữ liệu được cập nhật đúng và đủ.

---
*Hệ thống được phát triển bởi Antigravity Team. Mọi thắc mắc vui lòng liên hệ Bộ phận CNTT để được hỗ trợ.*
