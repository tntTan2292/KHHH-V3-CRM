# 📜 HIẾN PHÁP CRM 3.0 - BƯU ĐIỆN TP HUẾ
*(Single Source of Truth - Phiên bản điều hành tối cao)*

---

# I. GOVERNANCE PRINCIPLES
1.  **SSOT (Single Source Of Truth)**: Mọi quyết định điều hành, báo cáo và đánh giá đều dựa trên một nguồn dữ liệu chuẩn duy nhất từ Transaction Database.
2.  **Transaction-first architecture**: Dữ liệu giao dịch thật (đã được đối soát) là nền tảng của mọi logic. Tuyệt đối không dùng dữ liệu nhập tay để tính toán KPI.
3.  **Ownership & hierarchy**: Quản lý theo cấu trúc cây 5 cấp (Tỉnh -> Trung tâm -> Cụm -> Phường/Xã -> Điểm). Mọi khách hàng phải có "Chủ sở hữu" (Owner) rõ ràng.
4.  **No fake KPI / No activity-driven scoring**: Không tính điểm dựa trên số lượng hoạt động (Activity) ảo. Mọi điểm số phải được chứng thực bằng hiệu quả kinh doanh thực tế.
5.  **Triết lý CRM ưu tiên**: **Giữ khách > Ổn định > Tăng trưởng > Mở mới**.

### 🛡️ Ownership Principle
- Mỗi khách hàng phải có: Đơn vị quản lý, phạm vi quản lý và Ownership rõ ràng.
- Mọi Task, Escalation, Notification và Action đều phải tuân thủ Hierarchy, Ownership và Scope quản lý.
- CRM không được phép: Giao việc vượt phạm vi quản trị hoặc chuyển Ownership trái Hierarchy nếu không có Escalation hợp lệ.

---

# II. MODULE HÀNH TRÌNH 5B (State Machine cho KH Tiềm năng)
Quy trình chuyển đổi khách hàng từ vãng lai thành khách hàng định danh:

-   **B1 - Bắt nhịp**: Tiếp cận, thu thập thông tin cơ bản.
-   **B2 - Bàn bạc**: Thương thảo hợp đồng/chính sách.
    -   *B2 Aging Warning*: Cảnh báo nếu khách hàng ở trạng thái B2 quá lâu mà không chuyển biến.
-   **B3 - Bán hàng**: Giai đoạn bắt đầu phát sinh đơn hàng.
    -   **QUY TẮC DỮ LIỆU**: B1/B2 chưa được đọc transaction thật. B3 là mốc bắt đầu quét dữ liệu giao dịch thực tế.
    -   **Sync Rule**: Ngay khi phát sinh transaction khớp với mã định danh (hoặc thông tin định danh) -> Hệ thống tự động chuyển sang **Module Danh sách khách hàng** với trạng thái **Khách hàng mới**.
-   **B4 - Bùng nổ**: Đẩy mạnh doanh thu và sản lượng sau khi đã có đơn hàng ổn định.
-   **B5 - Bám sát**: Chăm sóc định kỳ, ngăn ngừa nguy cơ rời bỏ ngay từ đầu.
-   **Monitoring**: Theo dõi chặt chẽ số ngày sau khi báo "Thành công" tại B3 nhưng chưa phát sinh sản lượng thực tế trên hệ thống.

---

# III. MODULE DANH SÁCH KHÁCH HÀNG (Lifecycle State Machine)
Dành cho khách hàng đã có mã CMS cố định. Tuân thủ 5 trạng thái vòng đời gốc:

### 1. KHÁCH HÀNG MỚI (New) ✨
- **Điều kiện**: Đơn hàng lần đầu tiên trong lịch sử (tính lũy kế).
- **Thời gian**: Kéo dài từ tháng phát sinh đơn đầu tiên đến **HẾT THÁNG THỨ 03**.

### 2. KHÁCH HÀNG HIỆN HỮU (Active) ✅
- **Điều kiện**: Có đơn trong tháng báo cáo và đã đi qua giai đoạn "MỚI".
- **Duy trì**: Có ít nhất một đơn trong vòng 03 tháng trước đó.

### 3. KHÁCH HÀNG NGUY CƠ (At-risk) 🚩
- **Dấu hiệu**: **QUÁ 30 NGÀY** kể từ đơn hàng gần nhất chưa phát sinh đơn hàng mới.
- **Mục đích**: Cảnh báo sớm để nhân viên liên hệ "cứu chữa".

### 4. KHÁCH HÀNG RỜI BỎ (Churn) ⚠️
- **Dấu hiệu**: **LIÊN TIẾP 03 THÁNG** không có đơn hàng nào. Liệt kê vào danh sách Rời bỏ từ tháng thứ 04.

### 5. KHÁCH HÀNG TÁI BÁN (Re-activated) 🔄
- **Điều kiện**: Khách từng RỜI BỎ nay quay lại phát sinh đơn hàng. Kéo dài trạng thái này trong 03 tháng đầu quay lại.

### 6. QUY CHUẨN SEMANTIC: POPULATION VS. EVENTS 🏗️
Để đảm bảo tính nhất quán SSOT và khả năng đối soát (Auditability), hệ thống phân tách Vòng đời khách hàng thành 2 lớp dữ liệu độc lập:

#### A. Lớp Dân số (Population States) - SSOT Chính
- Mỗi khách hàng tại một thời điểm snapshot chỉ thuộc về **DUY NHẤT MỘT** trạng thái dân số.
- **Quy tắc Mutually Exclusive**: Không có sự chồng lấn giữa các nhóm dân số. Trạng thái ACTIVE phải loại trừ các nhóm đang trong diện Probation (NEW, REACTIVATED).
- **Công thức tính Tổng**:
  `TỔNG KHÁCH HÀNG = NEW_POP + ACTIVE + AT_RISK + CHURN_POP + REACTIVATED_POP`
- **Dashboard Compliance**: Số tổng hiển thị trên Dashboard phải bằng tổng đại số của 5 thẻ dân số thành phần.

#### B. Lớp Biến động (Event Layer) - Biến động tháng
- Ghi nhận các sự kiện phát sinh trong kỳ báo cáo để phục vụ phân tích xu hướng.
- **Các sự kiện chuẩn**:
  - `NEW_EVENT`: Phát sinh giao dịch đầu tiên trong tháng.
  - `REACTIVATED_EVENT`: Khách hàng từ trạng thái Churn quay lại giao dịch trong tháng.
  - `CHURN_EVENT`: Khách hàng chính thức chuyển sang trạng thái Churn trong tháng.
- **Tính chất**: Sự kiện ghi nhận biến động trong kỳ, không thay đổi nguyên tắc "Một khách hàng = Một trạng thái dân số". 

#### C. Quy tắc Chuyển đổi & Trưởng thành (Maturation Governance)
1.  **Giai đoạn Probation (Tập sự)**: Khách hàng thuộc `NEW_POP` hoặc `REACTIVATED_POP` được theo dõi trong 90 ngày.
2.  **Maturation (Trưởng thành)**: Sau 90 ngày, nếu vẫn hoạt động ổn định (có giao dịch trong 30 ngày gần nhất), khách hàng tự động chuyển sang trạng thái `ACTIVE`.
3.  **Dormancy (Ngủ đông)**: Khách hàng `ACTIVE` không có giao dịch > 30 ngày chuyển sang `AT_RISK`.
4.  **Final Churn (Rời bỏ)**: Khách hàng `AT_RISK` tiếp tục không có giao dịch > 90 ngày chuyển sang `CHURN_POP`.

### 🚫 No Manual Lifecycle Override
- Các trạng thái Lifecycle (Mới, Hiện hữu, Nguy cơ, Rời bỏ, Tái bán) **KHÔNG** được phép chỉnh sửa thủ công.
- Mọi thay đổi Lifecycle phải được xác định tự động từ: Transaction Truth, Lifecycle Engine và Rule Engine.
- Tuyệt đối không cho phép: Update tay trạng thái, ép trạng thái thủ công hoặc Bypass quy trình xác minh giao dịch (Transaction Verification).

### 📊 NHÓM ĐÁNH GIÁ TĂNG TRƯỞNG (Growth Tag)
- **Bản chất**: Là một **Nhãn đánh giá động (Dynamic Tag)**, không phải trạng thái Lifecycle độc lập.
- **Quy tắc**:
    - Chỉ áp dụng cho khách hàng đã có mã.
    - Chỉ áp dụng SAU KHI đã xác định trạng thái Lifecycle gốc.
    - Đọc tăng trưởng MoM (Month-over-Month) dựa trên transaction thật.
    - **Tính cộng dồn**: Một khách hàng có thể đồng thời là "Khách hàng hiện hữu + Tăng trưởng" hoặc "Khách hàng mới + Tăng trưởng".

---

# IV. VIP TIER ENGINE (Dynamic Ranking)
Hệ thống tự động phân tầng khách hàng dựa trên Ranking doanh thu thực tế:
1.  **💎 Diamond (Kim cương)**
2.  **💍 Platinum (Bạch kim)**
3.  **🏆 Gold (Vàng)**
4.  **🥈 Silver (Bạc)**
5.  **🥉 Bronze (Đồng)**

- **Nguyên tắc**: VIP Tier là xếp hạng động, **KHÔNG nhập tay**. CRM tự tính toán định kỳ.
- **Phạm vi**: Chỉ áp dụng cho khách hàng đã định danh (có mã). Khách hàng tiềm năng (Leads) không có VIP Tier.

---

# V. LEAD TIER ENGINE (Dynamic Prospect Ranking)
Lead Tier Engine là hệ thống xếp hạng động dành riêng cho khách hàng tiềm năng, giúp chuẩn hóa việc quản lý, theo dõi và chuyển đổi Lead.

### 1. ĐỊNH NGHĨA LEAD
CRM V3.0 chuẩn hóa 02 loại khách hàng tiềm năng:
- **Transaction Leads**: Khách hàng đã có giao dịch thực tế nhưng chưa được cấp mã định danh chính thức. Dữ liệu được trích xuất tự động từ Transaction Database.
- **Manual Prospect Leads**: Khách hàng chưa có giao dịch, được tạo ra từ hoạt động khai thác thị trường/bán mới. Dữ liệu được quản lý bởi TTKD và cấu trúc hierarchy sales.

### 2. LEAD TIER ENGINE PRINCIPLES
- **Dynamic Ranking**: Lead Tier được tính toán tự động dựa trên Ranking, Momentum (tốc độ tăng trưởng), Lead Risk (nguy cơ mất dấu), Lead Aging (độ trễ xử lý) và Conversion Readiness (mức độ sẵn sàng chuyển đổi).
- **No Manual Entry**: Lead Tier **KHÔNG được nhập tay**. Hệ thống tự động xếp hạng dựa trên Hybrid Ranking Model.
- **Hybrid Ranking Model**: Sử dụng rolling transaction window, momentum growth và stability scoring. Tuyệt đối không sử dụng các ngưỡng doanh thu cố định (fixed hard-coded thresholds).

### 3. LEAD OWNERSHIP GOVERNANCE
- **Transaction Leads**: Ownership mặc định theo **Bưu cục chấp nhận cuối cùng** (Transaction Truth Ownership).
- **Manual Prospect Leads**: Ownership thuộc về nhân viên được giao xử lý trực tiếp (B1/B2). 
- **Hierarchy Mapping**: Mọi Lead phải được mapping ownership chính xác theo Hierarchy Tree hiện tại.

### 4. TTKD vs TTVH LAYER
- **TTVH (Trung tâm Vận hành)**: Quản lý khách hàng hiện hữu, duy trì sản lượng, retention và giám sát vận hành.
- **TTKD (Trung tâm Kinh doanh)**: Quản lý khách hàng tiềm năng, phát triển Lead và Sales Acquisition. Mặc định Lead Governance thuộc về layer TTKD.

### 5. LOCAL & PROVINCIAL RANKING
Hệ thống hỗ trợ đa tầng xếp hạng:
- **Provincial Ranking**: Top Lead toàn Bưu điện TP.
- **Local Ranking**: Top Lead theo Khu vực, Bưu cục và địa bàn quản lý.

### 6. LEAD CONVERSION & ATTRIBUTION GOVERNANCE
- **Conversion Lock**: Khi một Manual Prospect Lead được tạo mã khách hàng chính thức, hệ thống thực hiện khóa Attribution ban đầu.
- **Confirmation Mechanism**: Chờ transaction thực tế xác nhận. Nếu transaction phát sinh đúng Ownership Hierarchy -> Tự động xác nhận (Auto-confirm).
- **Conflict Handling**: Nếu transaction phát sinh ở đơn vị khác -> Bắt buộc kích hoạt **Escalation Governance** để xử lý tranh chấp.

### 7. LEAD AGING & RISK GOVERNANCE
- Hệ thống theo dõi Lead Aging để đưa ra các mức cảnh báo (Configurable):
    - **30 ngày**: WATCHLIST.
    - **60 ngày**: HIGH RISK.
    - **90 ngày**: Tự động hạ bậc xếp hạng (Tier Degradation).
    - **180 ngày**: STALE LEAD (Lead nguội).
- Mọi ngưỡng thời gian phải được cấu hình linh hoạt, không được hard-code.

### 8. ESCALATION & PRIMARY OWNER MODEL
- **Escalation Case**: CRM không tự động xử lý tranh chấp Attribution. Các trường hợp sai lệch Ownership/Hierarchy phải được đẩy lên cấp quản lý (Trưởng đại diện/Giám đốc) để quyết định tỷ lệ phân chia doanh thu hoặc xác định chủ sở hữu cuối cùng.
- **Primary Owner Model**: Manual Prospect Lead hỗ trợ 01 Primary Owner và nhiều Collaborators nhằm rõ ràng KPI chính nhưng vẫn khuyến khích teamwork.

### 9. ARCHITECTURE & SSOT ALIGNMENT
- Lead Tier Engine không được phép bypass Transaction Truth hoặc hard-code ownership/hierarchy.
- Transaction Database vẫn là **Single Source of Truth** cuối cùng. Dashboard chỉ hiển thị kết quả đã được Engine tính toán và chuẩn hóa (Governed Outputs).

---

# VI. PRIORITY ENGINE (Hybrid Scoring Model)
Hệ thống ưu tiên xử lý dựa trên sự kết hợp giữa các chỉ số tĩnh và động:
- **Fixed Score**: VIP Tier, Lifecycle Stage.
- **Dynamic Weight**: Risk aging (mức độ nghiêm trọng của nguy cơ), Growth rate (tốc độ tăng trưởng), B2 aging (độ trễ thương thảo).

**TRIẾT LÝ ƯU TIÊN**:
1.  Giữ khách hiện hữu quan trọng hơn mở khách mới.
2.  **VIP Risk** (Khách lớn có nguy cơ) là mức ưu tiên cao nhất.
3.  **Sale ảo** (đơn hàng rác/không thực chất) nguy hiểm hơn sale chậm.
4.  Khách hàng có **Growth mạnh** được ưu tiên chăm sóc để bùng nổ.
5.  Priority Score phải tổng hợp đồng thời: VIP + Risk + Lifecycle + Growth.

---

# VII. NOTIFICATION ENGINE (Hybrid Alert System)
Hệ thống cảnh báo đa tầng:
- **🔵 INFO**: Thông tin thống kê định kỳ.
- **🟡 WARNING**: Hiển thị trên Dashboard để lưu ý.
- **🟠 ALERT**: Cảnh báo hàng ngày kèm huy hiệu (badge) thông báo.
- **🔴 CRITICAL**: Cảnh báo thời gian thực (Real-time).

**QUY TẮC CRITICAL**: Chỉ các trường hợp sau mới được đẩy cảnh báo Critical:
- Khách hàng Diamond có dấu hiệu Risk.
- Khách hàng hiện hữu lớn sắp rơi vào trạng thái Rời bỏ.
- Phát hiện dấu hiệu Sale ảo/Giao dịch bất thường.
- VIP Tier bị giảm sụt mạnh.

---

# VIII. ACTION ENGINE
CRM không chỉ đưa ra con số, mà phải đề xuất hướng xử lý chiến lược:
- **Action != Task**: Action là chiến lược (Ví dụ: "Chiến dịch khôi phục VIP"), Task là công việc cụ thể (Ví dụ: "Gọi điện cho anh A lúc 9h").
- **Các Action chuẩn**: Gọi khách, Chăm sóc VIP, Kiểm tra chất lượng dịch vụ, Upsell, Recovery (Khôi phục).

---

# IX. ESCALATION ENGINE (Cơ chế leo thang)
Xác định cấp độ quản lý cần can thiệp dựa trên độ nghiêm trọng:
- **Phân cấp**: Nhân viên -> Giám đốc BCVH -> Trưởng đại diện Cụm -> Lãnh đạo BĐTP.
- **Trình đọc Escalation**: Tổng hợp đồng thời VIP Tier, Priority, Risk và Lifecycle.
- **Cơ chế**: Tự động leo thang theo thời gian (SLA) hoặc theo mức độ ảnh hưởng doanh thu.

---

# X. TASK ORCHESTRATOR
Điều phối công việc thông minh:
- **Workflow**: CRM gợi ý nhiệm vụ -> Lãnh đạo duyệt/điều chỉnh -> Giao nhân viên.
- **Quy tắc**: KHÔNG giao việc lung tung. Task phải tuân thủ Ownership và Scope quản lý của từng cấp.
- **Closure Condition**: Nhiệm vụ chỉ được coi là hoàn thành khi:
    - Có transaction thật phát sinh.
    - Hoặc trạng thái Lifecycle/Risk được cải thiện thực tế trên dữ liệu hệ thống.
    - *Tuyệt đối không đóng task chỉ dựa trên báo cáo mồm.*

---

# XI. EXECUTIVE DASHBOARD
Giao diện điều hành chia làm 2 lớp tách biệt:
1.  **Executive Layer (Lớp điều hành)**: Tập trung vào Critical Center, VIP Risk, Escalation và các Task nóng cần xử lý ngay.
2.  **Analytics Layer (Lớp phân tích)**: Tập trung vào xu hướng MoM, YoY, Revenue Mix, cấu trúc Lifecycle và biểu đồ tăng trưởng.

---

# XII. SSOT (SINGLE SOURCE OF TRUTH) SUMMARY
**Transaction Database là nguồn dữ liệu chuẩn duy nhất và cuối cùng**. 
Mọi thông tin về Lifecycle, Growth, VIP Tier, KPI và Priority đều phải được truy xuất và chứng thực từ đây. Tuyệt đối không chấp nhận các báo cáo thủ công hoặc dữ liệu ảo nhằm ghi đè lên "Sự thật giao dịch" (Transaction Truth).

### 🔍 Auditability Principle
- Mọi thay đổi quan trọng liên quan đến: Ownership, VIP Tier, Task Reassignment, Escalation, CRM Verification và Customer Mapping đều phải được **Audit Log** đầy đủ.
- Nội dung Audit Log bắt buộc bao gồm: Ai thay đổi, Thời gian thay đổi, Giá trị trước, Giá trị sau và Lý do thay đổi (nếu có).
- Audit Log là điều kiện bắt buộc (Mandatory) đối với toàn bộ hành động quản trị quan trọng trong CRM.

---

# XIII. KPI CONSTITUTION LAYER (Governance Foundation)
Quy chuẩn quản trị và thẩm quyền của các chỉ số hiệu năng (KPI) trong hệ thống:

### 1. PHÂN CẤP THẨM QUYỀN KPI
- **GOVERNED KPI (Chỉ số Gốc)**: Định nghĩa trực tiếp từ Transaction Truth. Tuyệt đối không thể ghi đè (e.g., Doanh thu, Sản lượng, Số lượng đơn hàng).
- **SSOT KPI (Chỉ số Tổng hợp)**: Chỉ số từ Summary Layer đã qua chuẩn hóa. Là nguồn tin cậy duy nhất cho báo cáo định kỳ (e.g., Số lượng KH Diamond, Tỷ lệ Churn, Tỷ trọng vùng).
- **DERIVED KPI (Chỉ số Phái sinh)**: Tính toán từ các chỉ số Gốc/Tổng hợp (e.g., Revenue per Customer, Growth Rate, ROI).
- **DISPLAY-ONLY KPI**: Chỉ số phục vụ hiển thị nhanh trên Dashboard, không có giá trị pháp lý trong điều hành chiến lược (e.g., Target completion % dự tính).

### 2. NGUYÊN TẮC QUẢN TRỊ KPI
- **Centralized Definition**: Mọi KPI phải có mã định danh (Code) và nguồn dữ liệu (Source) duy nhất.
- **Summary-First**: Dashboard chỉ được phép đọc các KPI tổng hợp từ Summary Layer để đảm bảo tốc độ và tính nhất quán.
- **Auditability**: Mọi thay đổi trong công thức tính toán KPI (nếu có) phải được cập nhật trong Hiến pháp và ghi log phiên bản.

### 3. RANH GIỚI VẬN HÀNH (Governance Boundaries)
- Chỉ **GOVERNED KPI** và **SSOT KPI** mới có quyền:
    - Kích hoạt **Critical Alert** (Cảnh báo đỏ).
    - Kích hoạt **Escalation Engine** (Leo thang quản lý).
    - Xuất hiện trên **Executive Dashboard** (Màn hình lãnh đạo).
    - Được dùng làm căn cứ tính **Operational Scoring** (Điểm thi đua).

---

## 🏛️ PHỤ LỤC: PHÂN CẤP & PHÂN QUYỀN TRUY CẬP
1.  **Cấu trúc 5 cấp**: Tỉnh -> Trung tâm -> Cụm -> Phường/Xã -> Điểm.
2.  **Cơ chế "Nhìn xuống"**: Cấp trên thấy dữ liệu tất cả cấp dưới.
3.  **Cơ chế "Cô lập"**: Cấp dưới không thấy dữ liệu cấp trên hoặc nhánh ngang.

---

## 🤖 QUY TẮC CỘNG TÁC AI & VẬN HÀNH (ELITE PROTOCOL)
1.  **ĐIỂM DANH & PHÊ DUYỆT**: Luôn gọi Đội ngũ Antigravity điểm danh đầu phiên. Chỉ thực hiện khi Sếp bấm **"OK"**.
2.  **NHẬT KÝ CHI TIẾT**: Ghi chép mọi bước xử lý vào `NK_PHAT_TRIEN_V3.0.md`.
3.  **PHẢN BIỆN ĐỘC LẬP**: Không áp dụng ngay các đề xuất từ bên ngoài (ChatGPT, v.v.) mà phải đối chiếu với Hiến pháp này.
4.  **BẢO TỒN NGỮ CẢNH**: Cập nhật diễn biến cuối phiên để giữ mạch công việc.
5.  **SSOT COMPLIANCE**: AI phải bảo vệ SSOT, không được để logic code làm sai lệch các nguyên tắc trong Hiến pháp.

---
*Cập nhật lần cuối: 08/05/2026 - Tích hợp LEAD TIER ENGINE và Chuẩn hóa 12 Section.*
